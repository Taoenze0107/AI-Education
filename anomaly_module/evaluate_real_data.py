"""Evaluate the deployed hybrid detector on manually labelled real measurements.

The input is intentionally not generated here: fill data/real_data.csv from
actual experiments, then run this script to produce a separate report.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from app.anomaly_detector import AnomalyDetector


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "data" / "real_data.csv"
DEFAULT_OUTPUT = ROOT / "reports" / "real_data_evaluation.json"
KNOWN_LABELS = {"normal", "outlier", "missing", "noise", "drift", "unit_error"}


def optional_number(value: str | None) -> float | None:
    return float(value) if value not in (None, "") else None


def evaluate(input_path: Path, output_path: Path) -> dict[str, object]:
    with input_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    required = {"run_id", "point_index", "voltage_V", "current_mA", "label"}
    if not rows or not required.issubset(rows[0]):
        raise ValueError(f"真实数据必须包含列：{', '.join(sorted(required))}。")
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if row["label"] not in KNOWN_LABELS:
            raise ValueError(f"实验组 {row['run_id']} 的 label 不支持：{row['label']}。")
        groups[row["run_id"]].append(row)

    detector = AnomalyDetector()
    actual: list[str] = []
    predicted: list[str] = []
    details: list[dict[str, object]] = []
    for run_id, group in groups.items():
        group.sort(key=lambda item: int(item["point_index"]))
        labels = {item["label"] for item in group}
        if len(labels) != 1:
            raise ValueError(f"实验组 {run_id} 的 label 必须一致。")
        metadata: dict[str, float] = {}
        value = optional_number(group[0].get("expected_resistance_ohm"))
        if value is not None:
            metadata["expected_resistance_ohm"] = value
        result = detector.analyze(
            "ohms_law",
            {
                "voltage_V": [optional_number(item["voltage_V"]) for item in group],
                "current_mA": [optional_number(item["current_mA"]) for item in group],
            },
            metadata,
        )
        actual.append(next(iter(labels)))
        predicted.append(result.details.anomaly_type)
        details.append({
            "run_id": run_id,
            "actual": actual[-1],
            "predicted": predicted[-1],
            "score": result.details.anomaly_score,
        })

    labels = sorted(set(actual) | set(predicted))
    normal_count = sum(value == "normal" for value in actual)
    anomaly_count = len(actual) - normal_count
    false_positive = sum(a == "normal" and p != "normal" for a, p in zip(actual, predicted))
    false_negative = sum(a != "normal" and p == "normal" for a, p in zip(actual, predicted))
    report: dict[str, object] = {
        "input": str(input_path),
        "runs": len(actual),
        "accuracy": accuracy_score(actual, predicted),
        "false_positive_rate": false_positive / normal_count if normal_count else None,
        "false_negative_rate": false_negative / anomaly_count if anomaly_count else None,
        "labels": labels,
        "confusion_matrix": confusion_matrix(actual, predicted, labels=labels).tolist(),
        "classification_report": classification_report(actual, predicted, labels=labels, output_dict=True, zero_division=0),
        "runs_detail": details,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if not args.input.exists():
        raise SystemExit(f"未找到真实数据：{args.input}。请先复制 real_data_template.csv 为 real_data.csv 并填写。")
    report = evaluate(args.input, args.output)
    print(f"Evaluated {report['runs']} real runs; accuracy: {report['accuracy']:.2%}")
    print(f"Report saved to {args.output}")


if __name__ == "__main__":
    main()
