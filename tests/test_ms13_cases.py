# tests/test_ms13_cases.py
# MS3 定稿 13 条案例断言（小狗 2026-09-17 派发，scipy 复核口径）
#
# apply 到项目后运行：
#   cd C:\Users\18941\Desktop\adaptive_lab_tutor_revised
#   .\.venv\Scripts\python.exe -m pytest tests/test_ms13_cases.py -q
#
# 覆盖两个 AD 必坑点：
#   1) 完美直线 Grubbs 浮点假阳性（ohms_normal_clean 必须判 normal，不跑 Grubbs）
#   2) drift 必须基于测量原始顺序（ohms_drift_heating 电流乱序，只报 drift）
# 以及边界：outlier_critical 只 warn 不 reject、mixed 两路触发、Grubbs 单侧精确临界值。
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.ms_gates import detect_ms_gates  # noqa: E402
from app.standards import load_experiment_standard  # noqa: E402


def _parse_list(s: str):
    """'0.5;1;1.5' -> [0.5, 1.0, 1.5]；空段 -> None（缺失占位）"""
    out = []
    if s is None:
        return out
    for part in str(s).split(";"):
        part = part.strip()
        if not part:
            out.append(None)
        else:
            out.append(float(part))
    return out


def _load_cases():
    csv_path = Path(__file__).resolve().parent.parent / "test_cases_filled.csv"
    # 兼容：文件可能在共享目录或其他位置
    if not csv_path.exists():
        csv_path = Path(__file__).resolve().parent / "test_cases_filled.csv"
    with open(csv_path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


CASES = _load_cases()
STANDARD = load_experiment_standard("ohms_law")
# 与 verify_cloud.py 口径一致：注入参考电阻 50.0Ω，确保 unit_error/mixed 案例可判定
STANDARD.setdefault("reference", {})["reference_resistance_ohm"] = 50.0


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["case_id"])
def test_ms13_case(case):
    voltage = _parse_list(case["voltage_V"])
    current = _parse_list(case["current_mA"])
    result = detect_ms_gates(
        voltage,
        current,
        standard=STANDARD,
        reference_resistance_ohm=None,  # 由 standard.reference 提供，未填则 unit_error 标记 unverified
    )
    # label 断言：normal/outlier/missing/noise/drift/unit_error/mixed
    assert result["label"] == case["label"], (
        f"{case['case_id']}: label 期望 {case['label']}，实际 {result['label']} "
        f"(flags={result['flags']}, note={case['note']})"
    )


# ---------------- 坑点1：完美直线不触发 Grubbs 假阳性 ----------------
def test_normal_clean_no_grubbs_false_positive():
    case = next(c for c in CASES if c["case_id"] == "ohms_normal_clean")
    voltage = _parse_list(case["voltage_V"])
    current = _parse_list(case["current_mA"])
    result = detect_ms_gates(voltage, current, standard=STANDARD)
    assert result["label"] == "normal"
    assert result["grubbs"]["mpe_gate_passed"] is True, "完美直线残差应全部在 MPE 内"
    assert result["grubbs"]["G"] is None, "物理闸门通过时不应计算 Grubbs G"
    assert result["grubbs"]["status"] == "none"
    assert result["flags"]["outlier"] is False


# ---------------- 坑点2：drift 必须基于原始测量顺序 ----------------
def test_drift_heating_only_drift_not_noise_not_outlier():
    case = next(c for c in CASES if c["case_id"] == "ohms_drift_heating")
    voltage = _parse_list(case["voltage_V"])
    current = _parse_list(case["current_mA"])
    result = detect_ms_gates(voltage, current, standard=STANDARD)
    assert result["label"] == "drift"
    assert result["flags"]["drift"] is True
    assert result["flags"]["noise"] is False, "s/FS=0.037 不应误报 noise"
    assert result["flags"]["outlier"] is False, "最大 G=0.95 不应误报 outlier"
    assert result["drift"]["runs"] == 2, "前5+后5- 应为 2 个 runs"
    assert result["drift"]["runs_p"] is not None and result["drift"]["runs_p"] < 0.05
    assert result["drift"]["half_diff_over_fs"] is not None and result["drift"]["half_diff_over_fs"] > 0.03
    assert result["drift"]["spearman_rho"] is not None and abs(result["drift"]["spearman_rho"]) > 0.7


# ---------------- 边界：outlier_critical 只 warn 不 reject ----------------
def test_outlier_critical_warn_not_reject():
    case = next(c for c in CASES if c["case_id"] == "ohms_outlier_critical")
    voltage = _parse_list(case["voltage_V"])
    current = _parse_list(case["current_mA"])
    result = detect_ms_gates(voltage, current, standard=STANDARD)
    assert result["label"] == "outlier"
    assert result["grubbs"]["status"] == "warn", "G=2.204 落在 (2.127, 2.274) 应只 warn"
    assert result["grubbs"]["G"] > result["grubbs"]["G_warn"]
    assert result["grubbs"]["G"] <= result["grubbs"]["G_reject"]


# ---------------- mixed：离群 + 单位错误两路触发 ----------------
def test_mixed_outlier_unit_two_paths():
    case = next(c for c in CASES if c["case_id"] == "ohms_mixed_outlier_unit")
    voltage = _parse_list(case["voltage_V"])
    current = _parse_list(case["current_mA"])
    result = detect_ms_gates(voltage, current, standard=STANDARD,
                             reference_resistance_ohm=50.0)
    assert result["label"] == "mixed"
    assert result["flags"]["outlier"] is True, "离群 G≈2.30>2.274 应触发"
    assert result["flags"]["unit_error"] is True, "|log10(R/50)|=3.0 应触发"
    assert result["unit_error"]["log10_ratio"] > 2.0
