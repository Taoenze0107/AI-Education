"""可复现的伏安法数据异常检测。

判定主体（v2）由 MS 数学模块的 ``ms_gates.detect_ms_gates`` 提供，统一采用：
OLS 拟合 + 仪表 MPE 物理闸门 + 单侧精确 Grubbs + 原始顺序 runs/Spearman 漂移
检验 + 斜率数量级单位判定。本模块负责：

* 解析与校验原始测量（兼容 voltage_V/current_mA/current_A、缺失占位）；
* 调用 ms_gates，并补充一个“电流通道单点粗录入误差”闸门（Theil-Sen 电流残差），
  用于检出高杠杆的电流突跳点（ms_gates 的 Grubbs 建立在电压残差上，对这种点不敏感）；
* 把结果映射回既有对外 Pydantic schema（AnomalyAnalysisResponse），保持 API 兼容；
* 随机森林（若已训练）仅作为独立复核附在诊断依据中，不再覆盖数学判定。

该模块不依赖网络或大模型，离线即可运行。
"""

from __future__ import annotations

import math
import statistics
from pathlib import Path
from typing import Any

from app.models import (
    AnomalyAnalysisResponse,
    AnomalyDetails,
    AnomalyEvidence,
    AnomalyLocation,
    IssueType,
)
from app.ms_gates import detect_ms_gates
from app.standards import load_experiment_standard


FEATURE_NAMES = [
    "n_points",
    "missing_ratio",
    "slope_mA_per_V",
    "intercept_mA",
    "estimated_resistance_ohm",
    "r_squared",
    "normalized_residual_std",
    "current_std_mA",
    "current_coefficient_variation",
    "residual_iqr_mA",
    "max_robust_z_score",
    "max_relative_residual",
    "residual_trend_mA_per_point",
    "max_adjacent_change_mA",
    "max_change_robust_z_score",
]


def _median(values: list[float]) -> float:
    return statistics.median(values) if values else 0.0


def _quartiles(values: list[float]) -> tuple[float, float]:
    """Tukey-style lower/upper quartiles for transparent IQR reporting."""

    ordered = sorted(values)
    if len(ordered) < 2:
        return (ordered[0], ordered[0]) if ordered else (0.0, 0.0)
    middle = len(ordered) // 2
    lower = ordered[:middle]
    upper = ordered[middle + (len(ordered) % 2) :]
    return _median(lower), _median(upper)


def _robust_z_scores(values: list[float]) -> list[float]:
    """Modified Z scores based on median absolute deviation (MAD)."""

    if not values:
        return []
    middle = _median(values)
    mad = _median([abs(value - middle) for value in values])
    scale = 1.4826 * mad
    if scale < 1e-9:
        # A perfectly linear measurement has zero MAD.  A small floor keeps
        # the score finite while still flagging a visibly deviating point.
        scale = max(0.1, max(abs(value) for value in values) * 0.01)
    return [(value - middle) / scale for value in values]


def _as_numbers(value: Any, name: str) -> list[float | None]:
    if not isinstance(value, list):
        raise ValueError(f"原始测量 {name} 必须是数值列表。")
    result: list[float | None] = []
    for item in value:
        if item is None or item == "":
            result.append(None)
        elif isinstance(item, (int, float)) and math.isfinite(float(item)):
            result.append(float(item))
        else:
            raise ValueError(f"原始测量 {name} 中存在非数值。")
    return result


def _find(raw: dict[str, Any], *names: str) -> Any:
    normalized = {str(key).lower(): value for key, value in raw.items()}
    for name in names:
        if name.lower() in normalized:
            return normalized[name.lower()]
    return None


def _theil_sen(x: list[float], y: list[float]) -> tuple[float, float]:
    slopes = [
        (y[j] - y[i]) / (x[j] - x[i])
        for i in range(len(x))
        for j in range(i + 1, len(x))
        if x[j] != x[i]
    ]
    slope = _median(slopes)
    intercept = _median([value - slope * voltage for voltage, value in zip(x, y)])
    return slope, intercept


class AnomalyDetector:
    """Hybrid detector for Ohm's-law measurements.

    Inputs use voltage in V and current in mA.  The detector returns a rule
    explanation even before the optional random-forest artifact is trained.
    """

    def __init__(self, model_path: Path | None = None) -> None:
        root = Path(__file__).resolve().parent.parent
        canonical_model = root / "models" / "anomaly_classifier.pkl"
        legacy_model = root / "anomaly_module" / "models" / "ohms_law_rf.joblib"
        self.model_path = model_path or (canonical_model if canonical_model.exists() else legacy_model)
        self.model: Any | None = None
        self.model_feature_names: list[str] = FEATURE_NAMES
        self._load_model()

    def _load_model(self) -> None:
        if not self.model_path.exists():
            return
        try:
            import joblib

            payload = joblib.load(self.model_path)
            self.model = payload["model"]
            self.model_feature_names = payload.get("feature_names", FEATURE_NAMES)
        except (ImportError, OSError, KeyError, ValueError):
            # A missing/corrupt optional model must not break the main service.
            self.model = None

    @staticmethod
    def feature_vector(voltage: list[float | None], current_mA: list[float | None]) -> dict[str, float]:
        if len(voltage) != len(current_mA):
            raise ValueError("电压与电流列表长度必须相同。")
        pairs = [(x, y) for x, y in zip(voltage, current_mA) if x is not None and y is not None]
        if len(pairs) < 2:
            raise ValueError("至少需要两组非缺失的电压、电流数据。")
        x = [item[0] for item in pairs]
        y = [item[1] for item in pairs]
        slope, intercept = _theil_sen(x, y)
        predicted = [slope * item + intercept for item in x]
        residuals = [actual - fitted for actual, fitted in zip(y, predicted)]
        mean_y = statistics.fmean(y)
        total = sum((value - mean_y) ** 2 for value in y)
        residual_sum = sum(value**2 for value in residuals)
        r_squared = 1.0 if total == 0 and residual_sum == 0 else max(-1.0, 1.0 - residual_sum / max(total, 1e-9))
        amplitude = max(max(y) - min(y), abs(statistics.fmean(y)), 1.0)
        expected_abs = [max(abs(value), 1.0) for value in predicted]
        indices = list(range(len(residuals)))
        trend, _ = _theil_sen([float(index) for index in indices], residuals) if len(residuals) >= 2 else (0.0, 0.0)
        adjacent = [abs(y[index] - y[index - 1]) for index in range(1, len(y))]
        q1, q3 = _quartiles(residuals)
        residual_z_scores = _robust_z_scores(residuals)
        change_z_scores = _robust_z_scores(adjacent)
        current_std = statistics.pstdev(y) if len(y) > 1 else 0.0
        resistance = 1000.0 / slope if abs(slope) > 1e-12 else 1e12
        return {
            "n_points": float(len(voltage)),
            "missing_ratio": sum(value is None for value in current_mA) / len(current_mA),
            "slope_mA_per_V": slope,
            "intercept_mA": intercept,
            "estimated_resistance_ohm": resistance,
            "r_squared": r_squared,
            "normalized_residual_std": statistics.pstdev(residuals) / amplitude if len(residuals) > 1 else 0.0,
            "current_std_mA": current_std,
            "current_coefficient_variation": current_std / max(abs(statistics.fmean(y)), 1.0),
            "residual_iqr_mA": q3 - q1,
            "max_robust_z_score": max((abs(value) for value in residual_z_scores), default=0.0),
            "max_relative_residual": max(abs(value) / scale for value, scale in zip(residuals, expected_abs)),
            "residual_trend_mA_per_point": trend,
            "max_adjacent_change_mA": max(adjacent, default=0.0),
            "max_change_robust_z_score": max((abs(value) for value in change_z_scores), default=0.0),
        }

    @staticmethod
    def _expected_resistance(metadata: dict[str, Any]) -> float | None:
        for key in ("expected_resistance_ohm", "resistance_ohm", "expected_R_ohm"):
            value = metadata.get(key)
            if isinstance(value, (int, float)) and value > 0 and math.isfinite(float(value)):
                return float(value)
        return None

    def _model_vote(self, features: dict[str, float]) -> tuple[str | None, float | None]:
        if self.model is None:
            return None, None
        try:
            values = [[features.get(name, 0.0) for name in self.model_feature_names]]
            label = str(self.model.predict(values)[0])
            probabilities = self.model.predict_proba(values)[0]
            return label, float(max(probabilities))
        except (AttributeError, ValueError, TypeError):
            return None, None

    @staticmethod
    def _current_entry_errors(
        voltage: list[float | None], current: list[float | None]
    ) -> list[tuple[int, float, float]]:
        """电流通道单点粗录入误差闸门。

        ms_gates 的 Grubbs 在电压残差上计算，对“某一电流读数被录成异常大值”
        这类高杠杆点不敏感（会被拟合线整体拉偏）。这里用 Theil-Sen 拟合 I~U，
        找电流相对残差极大（≥80%）或稳健 Z 分数极大（≥20）的孤立点。
        阈值刻意取得很高，只拦截明确的录入错误，避免把噪声/电压离群误判进来。

        返回 (原始1基序号, 相对残差, 稳健Z) 列表，保持测量原始顺序。
        """

        pairs = [
            (index, v, c)
            for index, (v, c) in enumerate(zip(voltage, current))
            if v is not None and c is not None
        ]
        if len(pairs) < 3:
            return []
        x = [item[1] for item in pairs]
        y = [item[2] for item in pairs]
        slope, intercept = _theil_sen(x, y)
        residuals = [c - (slope * v + intercept) for _, v, c in pairs]
        predictions = [max(abs(slope * v + intercept), 1.0) for _, v, _ in pairs]
        z_scores = _robust_z_scores(residuals)
        hits: list[tuple[int, float, float]] = []
        for (index, _v, _c), residual, scale, z in zip(pairs, residuals, predictions, z_scores):
            relative = abs(residual) / scale
            if relative >= 0.8 or abs(z) >= 20.0:
                hits.append((index + 1, relative, z))
        return hits

    def analyze(
        self, experiment_id: str, raw_measurements: dict[str, Any], metadata: dict[str, Any]
    ) -> AnomalyAnalysisResponse:
        if experiment_id != "ohms_law":
            return self._uncertain("当前自动检测仅支持“伏安法测电阻（ohms_law）”。")
        voltage_value = _find(raw_measurements, "voltage_V", "voltage", "u_v")
        current_value = _find(raw_measurements, "current_mA", "current", "i_mA")
        current_a_value = _find(raw_measurements, "current_A", "i_a")
        if voltage_value is None or (current_value is None and current_a_value is None):
            return self._uncertain("需要原始测量中的 voltage_V 与 current_mA（或 current_A）两列。")
        voltage = _as_numbers(voltage_value, "voltage_V")
        current = _as_numbers(current_value if current_value is not None else current_a_value, "current_mA")
        if current_value is None:
            current = [value * 1000 if value is not None else None for value in current]
        if len(voltage) != len(current):
            return self._uncertain("电压与电流读数数量不一致。")

        standard = load_experiment_standard(experiment_id)
        expected_resistance = self._expected_resistance(metadata)
        # MS1 参考电阻：优先元数据，其次标准文件 reference 块。
        reference_resistance = expected_resistance
        if reference_resistance is None:
            ref = standard.get("reference") if isinstance(standard, dict) else None
            if isinstance(ref, dict):
                value = ref.get("reference_resistance_ohm")
                if isinstance(value, (int, float)) and value > 0:
                    reference_resistance = float(value)

        valid_count = sum(v is not None and c is not None for v, c in zip(voltage, current))
        has_missing = any(v is None or c is None for v, c in zip(voltage, current))
        missing_locations = [
            AnomalyLocation(channel="current_mA", point_index=index + 1, value=None, reason="电流读数缺失")
            for index, value in enumerate(current)
            if value is None
        ]

        # 特征向量（有效点 < 2 时无法拟合）
        try:
            features = self.feature_vector(voltage, current)
        except ValueError:
            features = {name: 0.0 for name in FEATURE_NAMES}

        bases = [
            f"最小二乘拟合 U=a+b·I，估计电阻 R≈{features.get('estimated_resistance_ohm', 0.0):.4g} Ω，"
            f"R²={features.get('r_squared', 0.0):.4f}。"
        ]

        # 有效点过少：无法可靠做统计判定
        if valid_count < 2:
            return self._uncertain(f"仅有 {valid_count} 组有效电压、电流数据，至少需要 2 组才能拟合。")

        entry_errors = self._current_entry_errors(voltage, current)
        missing_std = standard.get("missing") if isinstance(standard, dict) else None
        min_points = int(missing_std.get("min_valid_points", 5)) if isinstance(missing_std, dict) else 5

        # ---------- 缺失优先：定位缺失点、禁止静默插值 ----------
        if has_missing:
            score = min(1.0, 0.65 + 0.35 * features.get("missing_ratio", 0.0))
            bases.append(
                f"共 {len(missing_locations)} 个电流读数缺失（{features.get('missing_ratio', 0.0):.0%}），"
                "已定位，缺失点不做插值，需补测后再判定。"
            )
            return self._response("missing", score, missing_locations, bases, features)

        # ---------- 有效点不足 5 个但无缺失：小样本兼容分支 ----------
        if valid_count < min_points:
            if entry_errors:
                index, relative, _z = entry_errors[0]
                bases.append(
                    f"第 {index} 个电流读数相对拟合值偏离 {relative:.0%}，明显是录入错误，"
                    f"但仅 {valid_count} 个点、少于 {min_points} 个，统计检验仅供参考，建议补测确认。"
                )
                locations = [
                    AnomalyLocation(
                        channel="current_mA", point_index=index,
                        value=current[index - 1], reason=f"电流相对拟合残差 {relative:.0%}",
                    )
                ]
                return self._response("outlier", 0.7, locations, bases, features, warn_only=True)
            if features.get("r_squared", 0.0) >= 0.98:
                bases.append(f"数据高度线性（R²={features.get('r_squared', 0.0):.4f}），未见异常；")
                bases.append(f"提示：仅 {valid_count} 个测量点（建议不少于 {min_points} 个），结论供参考。")
                return self._response("normal", 0.05, [], bases, features)
            return self._uncertain(
                f"有效测量点 {valid_count} 个（少于 {min_points} 个），且线性关系不充分，无法可靠判定，请补测。"
            )

        # ---------- 主判定：ms_gates（n 足够、无缺失） ----------
        gates = detect_ms_gates(
            [v if v is not None else None for v in voltage],
            [c if c is not None else None for c in current],
            standard=standard,
            reference_resistance_ohm=reference_resistance,
        )
        label = gates["label"]
        flags = gates["flags"]
        fit = gates.get("fit") or {}

        if fit:
            bases.append(
                f"OLS：R={fit.get('R_ohm', 0.0):.4g} Ω，R²={fit.get('r2', 0.0):.4f}，"
                f"归一化残差 s/满量程={fit.get('s_over_fs', 0.0):.4f}，仪表 MPE={gates.get('mpe_V', 0.0):g} V。"
            )

        # 电流通道单点粗录入误差：ms_gates 漏检时的补充升级
        if entry_errors and label in ("normal", "noise"):
            index, relative, _z = entry_errors[0]
            if flags.get("unit_error"):
                # 同时存在数量级问题：保留单位判定（差异更本质），但在依据中注明突跳点
                label = "unit_error"
                bases.append(f"另：第 {index} 个电流读数相对偏离 {relative:.0%}，为明显录入错误。")
            else:
                label = "outlier"
                bases.append(
                    f"第 {index} 个电流读数相对拟合值偏离 {relative:.0%}（稳健 Z 极大），"
                    "判为单点录入误差（电流通道高杠杆点）。"
                )

        locations: list[AnomalyLocation] = []
        anomaly_type = label
        warn_only = False

        if label == "outlier":
            grubbs = gates.get("grubbs") or {}
            warn_only = grubbs.get("status") == "warn"
            if entry_errors and not flags.get("outlier"):
                # 补充闸门命中：定位该电流点
                index = entry_errors[0][0]
                locations = [
                    AnomalyLocation(
                        channel="current_mA", point_index=index,
                        value=current[index - 1], reason=f"电流相对拟合残差 {entry_errors[0][1]:.0%}",
                    )
                ]
            else:
                # ms_gates 电压通道离群：定位电压残差最大点
                locations = self._voltage_outlier_locations(voltage, current)
            if grubbs.get("status") == "warn":
                bases.append(
                    f"Grubbs G={grubbs.get('G'):.3f} 落在警告线 {grubbs.get('G_warn'):.3f} 与剔除线 "
                    f"{grubbs.get('G_reject'):.3f} 之间，判歧离值：只警告、建议先找物理原因，不直接删点。"
                )
            elif grubbs.get("status") == "reject":
                bases.append(
                    f"Grubbs G={grubbs.get('G'):.3f} 超过剔除线 {grubbs.get('G_reject'):.3f}，"
                    "且残差超过仪表 MPE，判统计离群值。"
                )
        elif label == "noise":
            noise = gates.get("noise") or {}
            bases.append(
                f"归一化残差标准差 s/满量程={fit.get('s_over_fs', 0.0):.4f}，"
                f"达到噪声{('剔除线' if noise.get('status') == 'reject' else '警告线')}，"
                "各点围绕拟合线随机波动偏大，与系统性漂移相区分。"
            )
            locations = [AnomalyLocation(channel="current_mA", point_index=None, value=None,
                                          reason="各点围绕拟合线随机波动偏大")]
        elif label == "drift":
            drift = gates.get("drift") or {}
            bases.append(
                f"按测量原始顺序：游程数={drift.get('runs')}（双侧 p={drift.get('runs_p'):.3f}），"
                f"前后半残差均值差/满量程={drift.get('half_diff_over_fs'):.3f}，"
                f"残差-序号 Spearman ρ={drift.get('spearman_rho'):.2f}（p={drift.get('spearman_p'):.3f}），"
                "提示温升/仪器零漂等系统性漂移；该判定基于测量次序而非电流大小。"
            )
            locations = [AnomalyLocation(channel="current_mA", point_index=None, value=None,
                                          reason="残差随测量序号系统变化（漂移）")]
        elif label == "unit_error":
            unit = gates.get("unit_error") or {}
            ratio = unit.get("log10_ratio")
            scale_name = {"x10": "约 10 倍", "x100": "约 100 倍", "x1000": "约 1000 倍"}.get(
                unit.get("status"), "一个以上数量级"
            )
            ref_text = f"{reference_resistance:g} Ω" if reference_resistance else "应有数量级"
            bases.append(
                f"拟合电阻 {fit.get('R_ohm', features.get('estimated_resistance_ohm', 0.0)):.4g} Ω 与参考 {ref_text} "
                f"相差{scale_name}（|log10 比值|={ratio:.2f}）；即使 R² 很高也需单独核对斜率数量级，"
                "常见原因是 mA 与 A 未换算。"
            )
            locations = [AnomalyLocation(channel="current_mA", point_index=None, value=None,
                                          reason="电流单位与电阻尺度不一致（疑似 mA/A 未换算）")]
        elif label == "mixed":
            locations = self._voltage_outlier_locations(voltage, current)
            bases.append("同时触发离群点与单位数量级两路异常，属高置信混合错误，建议直接进入定位+单位核对提示。")
        else:  # normal
            if gates.get("grubbs") and gates["grubbs"].get("mpe_gate_passed"):
                bases.append("所有残差均在仪表最大允许误差（MPE）以内，物理闸门通过，不再触发 Grubbs，判正常。")
            else:
                bases.append("残差、漂移趋势与单位尺度均在标准阈值内，未见数据异常。")

        score = self._score_label(label, gates, entry_errors, warn_only)

        # 随机森林仅作独立复核附注，不覆盖数学判定
        model_label, model_confidence = self._model_vote(features)
        if model_label:
            bases.append(f"随机森林独立复核预测为 {model_label}，置信度 {model_confidence:.0%}（仅供参考）。")

        return self._response(anomaly_type, score, locations, bases, features, warn_only=warn_only)

    @staticmethod
    def _voltage_outlier_locations(
        voltage: list[float | None], current: list[float | None]
    ) -> list[AnomalyLocation]:
        """根据 OLS 电压残差定位最异常的测量点（1 基序号），与 ms_gates 同口径。"""

        pairs = [(i, v, c) for i, (v, c) in enumerate(zip(voltage, current))
                 if v is not None and c is not None]
        if len(pairs) < 3:
            return []
        import numpy as np

        V = np.array([p[1] for p in pairs], dtype=float)
        I = np.array([p[2] for p in pairs], dtype=float) * 1e-3
        im, vm = I.mean(), V.mean()
        sxx = float(((I - im) ** 2).sum())
        if sxx <= 1e-15:
            return []
        b = float(((I - im) * (V - vm)).sum()) / sxx
        a = float(vm - b * im)
        residuals = V - (a + b * I)
        local = int(np.argmax(np.abs(residuals)))
        orig_index = pairs[local][0]
        return [
            AnomalyLocation(
                channel="voltage_V", point_index=orig_index + 1,
                value=voltage[orig_index], reason=f"电压残差 {float(residuals[local]):.3f} V 超过 MPE",
            )
        ]

    @staticmethod
    def _score_label(
        label: str, gates: dict[str, Any], entry_errors: list[tuple[int, float, float]], warn_only: bool
    ) -> float:
        flags = gates.get("flags", {})
        if label == "normal":
            return 0.05
        if label == "missing":
            return 0.8
        if label == "outlier":
            if entry_errors and not flags.get("outlier"):
                return 0.85
            return 0.7 if warn_only else 0.9
        if label == "noise":
            return 0.6 if (gates.get("noise") or {}).get("status") == "warn" else 0.85
        if label == "drift":
            return 0.85
        if label == "unit_error":
            status = (gates.get("unit_error") or {}).get("status")
            return {"x10": 0.7, "x100": 0.85, "x1000": 0.95}.get(status, 0.8)
        if label == "mixed":
            return 0.9
        return 0.5

    def _response(
        self,
        anomaly_type: str,
        score: float,
        locations: list[AnomalyLocation],
        bases: list[str],
        features: dict[str, float],
        warn_only: bool = False,
    ) -> AnomalyAnalysisResponse:
        is_normal = anomaly_type == "normal"
        confidence = min(0.99, max(0.55, 0.55 + 0.44 * score))
        if anomaly_type == "unit_error":
            predicted = IssueType.CALCULATION_ERROR
        elif anomaly_type == "mixed":
            predicted = IssueType.MIXED
        else:
            predicted = IssueType.NO_ERROR if is_normal else IssueType.DATA_ERROR
        status = "normal" if is_normal else "anomalous"
        if warn_only:
            summary = "检测到疑似离群的歧离值（警告级），建议先查找物理原因并复测，暂不直接剔除。"
        elif is_normal:
            summary = "未发现明显数据异常。"
        else:
            type_names = {
                "outlier": "离群点",
                "missing": "数据缺失",
                "noise": "随机噪声偏大",
                "drift": "系统性漂移",
                "unit_error": "单位/数量级错误",
                "mixed": "混合错误（离群+单位）",
            }
            summary = f"检测到{type_names.get(anomaly_type, anomaly_type)}，建议按定位与诊断依据核查。"
        evidence = AnomalyEvidence(
            status=status,
            predicted_issue=predicted,
            confidence=confidence,
            observed_features=bases[:5],
            summary=summary,
            model_version="ms-gates+hybrid-v2" if self.model is None else "ms-gates+hybrid-rf-v2",
        )
        return AnomalyAnalysisResponse(
            anomaly=evidence,
            details=AnomalyDetails(
                anomaly_type=anomaly_type,
                anomaly_score=round(min(1.0, max(0.0, score)), 4),
                locations=locations,
                diagnostic_basis=bases,
                features={key: round(value, 8) for key, value in features.items()},
            ),
        )

    def _uncertain(self, message: str) -> AnomalyAnalysisResponse:
        return AnomalyAnalysisResponse(
            anomaly=AnomalyEvidence(status="uncertain", confidence=0.5, summary=message,
                                    model_version="ms-gates+hybrid-v2"),
            details=AnomalyDetails(anomaly_type="uncertain", anomaly_score=0.0, diagnostic_basis=[message]),
        )
