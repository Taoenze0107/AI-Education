"""Train and evaluate the optional Random Forest classifier from generated CSV data."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit

from app.anomaly_detector import AnomalyDetector, FEATURE_NAMES


ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "data" / "ohms_law_training.csv"
MODEL = ROOT.parent / "models" / "anomaly_classifier.pkl"
LEGACY_MODEL = ROOT / "models" / "ohms_law_rf.joblib"
REPORT = ROOT / "reports" / "evaluation.json"


def _number(value: str) -> float | None:
    return None if value == "" else float(value)


def load_runs() -> tuple[list[dict[str, float]], list[str], list[str]]:
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    with DATASET.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            groups[row["run_id"]].append(row)
    features: list[dict[str, float]] = []
    labels: list[str] = []
    run_ids: list[str] = []
    for run_id, rows in groups.items():
        rows.sort(key=lambda item: int(item["point_index"]))
        voltage = [_number(row["voltage_V"]) for row in rows]
        current = [_number(row["current_mA"]) for row in rows]
        features.append(AnomalyDetector.feature_vector(voltage, current))
        labels.append(rows[0]["label"])
        run_ids.append(run_id)
    return features, labels, run_ids


def main() -> None:
    if not DATASET.exists():
        raise SystemExit("Training dataset missing. Run generate_dataset.py first.")
    features, labels, run_ids = load_runs()
    matrix = [[row[name] for name in FEATURE_NAMES] for row in features]
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_index, test_index = next(splitter.split(matrix, labels, groups=run_ids))
    x_train = [matrix[index] for index in train_index]
    x_test = [matrix[index] for index in test_index]
    y_train = [labels[index] for index in train_index]
    y_test = [labels[index] for index in test_index]
    model = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42)
    model.fit(x_train, y_train)
    predicted = model.predict(x_test)
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    payload = {"model": model, "feature_names": FEATURE_NAMES, "artifact_version": "ad-rf-v2"}
    joblib.dump(payload, MODEL)
    # Retain the original path so old local copies of the website can still run.
    LEGACY_MODEL.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, LEGACY_MODEL)
    ordered_labels = sorted(set(labels))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    normal_total = sum(label == "normal" for label in y_test)
    anomalous_total = sum(label != "normal" for label in y_test)
    false_positive = sum(actual == "normal" and prediction != "normal" for actual, prediction in zip(y_test, predicted))
    false_negative = sum(actual != "normal" and prediction == "normal" for actual, prediction in zip(y_test, predicted))
    class_report = classification_report(y_test, predicted, output_dict=True, zero_division=0)
    report = {
        "dataset": str(DATASET),
        "samples": len(labels),
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "accuracy": accuracy_score(y_test, predicted),
        "false_positive_rate": false_positive / normal_total if normal_total else None,
        "false_negative_rate": false_negative / anomalous_total if anomalous_total else None,
        "noise_recall": class_report.get("noise", {}).get("recall"),
        "labels": ordered_labels,
        "confusion_matrix": confusion_matrix(y_test, predicted, labels=ordered_labels).tolist(),
        "classification_report": class_report,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Model saved to {MODEL}")
    print(f"Held-out accuracy: {report['accuracy']:.2%}")
    print(f"FPR: {report['false_positive_rate']:.2%}; FNR: {report['false_negative_rate']:.2%}; noise recall: {report['noise_recall']:.2%}")


if __name__ == "__main__":
    main()
