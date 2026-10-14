"""生成 5 组「完全正常」的伏安法测电阻评估样本。

特征：
- 覆盖不同电阻值（47/51/100/150/200Ω）与不同点数（5/6/7/8）
- 只注入真实仪表量级的轻微噪声（电流 σ ≤ 0.25mA），所有电压残差远小于 MPE=0.06V
- 模拟数字表读数舍入（电流保留 1 位小数）
生成后立即用 AnomalyDetector 双口径验证（传/不传 expected_resistance），
必须 5/5 判 normal，否则脚本以非零码退出。
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.anomaly import AnomalyDetector


OUT_DIR = Path(__file__).resolve().parent
CSV_PATH = OUT_DIR / "normal_cases.csv"

# (case_id, 真实电阻Ω, 电压序列V, 电流噪声σ mA, 备注)
CASES = [
    ("N01", 51.0, [1.00, 2.00, 3.00, 4.00, 5.00], 0.12,
     "标称50Ω电阻实测约51Ω，5个点，常规教学数据"),
    ("N02", 100.0, [1.00, 2.00, 3.00, 4.00, 5.00, 6.00], 0.10,
     "100Ω电阻，6个点铺满量程"),
    ("N03", 200.0, [0.50, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00], 0.06,
     "200Ω大电阻，8个密点小电流，数字表读数"),
    ("N04", 47.0, [1.00, 2.00, 3.00, 4.00, 5.00], 0.02,
     "47Ω电阻，近乎完美直线（验证不产生浮点假阳性）"),
    ("N05", 150.0, [1.00, 1.50, 2.00, 3.00, 3.50, 4.50, 5.00], 0.18,
     "150Ω电阻，7个非等间距电压点，轻微手持抖动量级"),
]


def round_gauge(value_mA: float) -> float:
    """模拟数字毫安表：保留 1 位小数。"""
    return round(float(value_mA), 1)


def main() -> None:
    rng = np.random.default_rng(20260922)
    rows = []
    for case_id, resistance, voltages, sigma_mA, note in CASES:
        currents = []
        for u in voltages:
            ideal_i_mA = u / resistance * 1000.0
            noisy = ideal_i_mA + rng.normal(0.0, sigma_mA)
            currents.append(round_gauge(noisy))

        # 用读数反算拟合 R，给评估留参考值
        fit = np.polyfit(np.array(currents) / 1000.0, voltages, 1)
        r_fit = float(fit[0])
        r2_matrix = np.corrcoef(np.array(currents) / 1000.0, voltages)[0, 1] ** 2

        rows.append(
            {
                "case_id": case_id,
                "experiment_id": "ohms_law",
                "n_points": len(voltages),
                "voltage_V": json.dumps(voltages),
                "current_mA": json.dumps(currents),
                "meter_accuracy_class": 1.0,
                "label": "normal",
                "injected_anomaly_location": "",
                "expected_R_ohm": round(r_fit, 2),
                "expected_r2_min": 0.999,
                "expected_issue_type": "no_error",
                "expected_first_hint_level": "",
                "note": f"{note}；标称电阻 {resistance}Ω",
            }
        )

    fieldnames = [
        "case_id", "experiment_id", "n_points", "voltage_V", "current_mA",
        "meter_accuracy_class", "label", "injected_anomaly_location",
        "expected_R_ohm", "expected_r2_min", "expected_issue_type",
        "expected_first_hint_level", "note",
    ]
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # ===== 检测器双重验证 =====
    detector = AnomalyDetector()
    failures = []
    print(f"{'case':5} {'R_fit':>8} {'r2':>8}  verdict(带ref / 不带ref)")
    for row, (_, resistance, _, _, _) in zip(rows, CASES):
        v = json.loads(row["voltage_V"])
        i = json.loads(row["current_mA"])
        raw = {"voltage_V": v, "current_mA": i}

        with_ref = detector.analyze(
            "ohms_law", raw, {"expected_resistance_ohm": resistance}
        )
        without_ref = detector.analyze("ohms_law", raw, {})

        ok = (
            with_ref.anomaly.status == "normal"
            and without_ref.anomaly.status == "normal"
        )
        r2 = with_ref.details.features.get("r_squared", float("nan"))
        print(f"{row['case_id']:5} {row['expected_R_ohm']:8} {r2:8.5f}  "
              f"{with_ref.details.anomaly_type:9} / {without_ref.details.anomaly_type:9}"
              f"  {'OK' if ok else 'FAIL'}")
        if not ok:
            failures.append(row["case_id"])

    if failures:
        raise SystemExit(f"以下样本未判 normal: {failures}")
    print(f"\n5/5 全部判 normal → {CSV_PATH}")


if __name__ == "__main__":
    main()
