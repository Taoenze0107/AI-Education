"""PC module: parse experiment material and generate structured evidence."""

from __future__ import annotations

import statistics
from typing import Any

from app.anomaly_detector import AnomalyDetector
from app.chart_generator import ohms_law_chart_data
from app.models import ConsistencyCheck, ConsistencyEvidence, MathEvidence


def analyze_ohms_law_material(
    voltage: list[float],
    current_mA: list[float | None],
    metadata: dict[str, float],
    student_result: float | None,
    tolerance_percent: float,
) -> tuple[ConsistencyEvidence, MathEvidence, dict[str, list[dict[str, float]]]]:
    """Create PC consistency and calculation evidence from one imported run."""

    features = AnomalyDetector.feature_vector(voltage, current_mA)
    pairs = [(x, y) for x, y in zip(voltage, current_mA) if y is not None]
    x_values = [pair[0] for pair in pairs]
    y_values = [float(pair[1]) for pair in pairs]
    resistances = [1000 * x / y for x, y in pairs if abs(y) > 1e-12]
    resistance_cv = (
        statistics.pstdev(resistances) / max(abs(statistics.fmean(resistances)), 1e-9)
        if len(resistances) > 1
        else 0.0
    )
    reference = float(metadata.get("expected_resistance_ohm") or features["estimated_resistance_ohm"])
    last_voltage, last_current = pairs[-1]
    checks = [
        ConsistencyCheck(
            name="数据完整性",
            passed=not any(value is None for value in current_mA),
            observed=f"{len(pairs)}/{len(voltage)} 个有效测量点",
            expected="所有测量点均有电压和电流读数",
            note="缺失读数会交由 AD 模块单独定位。",
        ),
        ConsistencyCheck(
            name="伏安线性关系",
            passed=features["r_squared"] >= 0.98,
            observed=round(features["r_squared"], 6),
            expected="R² ≥ 0.98",
            deviation_percent=round(max(0.0, 0.98 - features["r_squared"]) / 0.98 * 100, 4),
            note="R² 越接近 1，数据越符合欧姆定律的线性关系。",
        ),
        ConsistencyCheck(
            name="各测量点电阻稳定性",
            passed=resistance_cv <= 0.05,
            observed=round(resistance_cv * 100, 4),
            expected="变异系数 ≤ 5%",
            deviation_percent=round(resistance_cv * 100, 4),
            note="按每一点的 R=U/I 计算后比较离散程度。",
        ),
    ]
    if metadata.get("expected_resistance_ohm"):
        relative = abs(reference - features["estimated_resistance_ohm"]) / reference * 100
        checks.append(
            ConsistencyCheck(
                name="参考电阻一致性",
                passed=relative <= tolerance_percent,
                observed=round(features["estimated_resistance_ohm"], 6),
                expected=reference,
                deviation_percent=round(relative, 4),
                note="依据拟合斜率估计电阻，并与填写的参考电阻比较。",
            )
        )
    mathematics = MathEvidence(
        formula="R = U / I",
        variables={"U": float(last_voltage), "I": float(last_current) / 1000},
        student_result=student_result,
        reference_result=reference,
        tolerance_percent=tolerance_percent,
        unit="Ω",
        student_steps=["读取电压 U（V）和电流 I（A）。", "代入 R = U / I 计算电阻。"],
    )
    charts = ohms_law_chart_data(
        x_values,
        y_values,
        features["slope_mA_per_V"],
        features["intercept_mA"],
    )
    return ConsistencyEvidence(checks=checks), mathematics, charts
