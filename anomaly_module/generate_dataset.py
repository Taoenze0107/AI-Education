"""生成可复现的伏安法异常检测训练数据，不修改手工填写的 ohms_law_dataset.csv。"""

from __future__ import annotations

import csv
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "data" / "ohms_law_training.csv"
FIELDS = [
    "run_id", "point_index", "voltage_V", "current_mA", "label",
    "fault_channel", "fault_location", "fault_strength",
]


def emit_run(rows: list[dict[str, object]], run_id: str, label: str, values: list[float | None], location: str, strength: float) -> None:
    for point, (voltage, current) in enumerate(zip(range(1, len(values) + 1), values), start=1):
        rows.append({
            "run_id": run_id,
            "point_index": point,
            "voltage_V": voltage,
            "current_mA": "" if current is None else round(current, 4),
            "label": label,
            "fault_channel": "none" if label == "normal" else "current_mA",
            "fault_location": "none" if label == "normal" else location,
            "fault_strength": 0 if label == "normal" else round(strength, 4),
        })


def build_dataset(seed: int = 20260913, runs_per_class: int = 80) -> list[dict[str, object]]:
    rng = random.Random(seed)
    rows: list[dict[str, object]] = []
    for label in ("normal", "outlier", "missing", "noise", "drift", "unit_error"):
        for sequence in range(1, runs_per_class + 1):
            resistance = rng.uniform(180, 330)
            intercept = rng.uniform(-0.25, 0.25)
            base = [1000 * voltage / resistance + intercept + rng.gauss(0, 0.08) for voltage in range(1, 9)]
            values: list[float | None] = base[:]
            location = "none"
            strength = 0.0
            if label == "outlier":
                index = rng.randrange(len(values))
                deviation = rng.choice((-1, 1)) * rng.uniform(7, 18)
                values[index] = (values[index] or 0) + deviation
                location, strength = str(index + 1), min(1.0, abs(deviation) / max(abs(base[index]), 1.0))
            elif label == "missing":
                index = rng.randrange(len(values))
                values[index] = None
                location, strength = str(index + 1), 1.0 / len(values)
            elif label == "noise":
                sigma = rng.uniform(1.8, 4.0)
                values = [value + rng.gauss(0, sigma) for value in base]
                location, strength = "all", min(1.0, sigma / 4.0)
            elif label == "drift":
                step = rng.choice((-1, 1)) * rng.uniform(0.8, 1.8)
                values = [value + step * index for index, value in enumerate(base)]
                location, strength = "all", min(1.0, abs(step) * (len(values) - 1) / max(base))
            elif label == "unit_error":
                values = [value * 1000 for value in base]
                location, strength = "all", 1.0
            emit_run(rows, f"{label}_{sequence:03d}", label, values, location, strength)
    return rows


def main() -> None:
    rows = build_dataset()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} points for 480 runs to {OUTPUT}")


if __name__ == "__main__":
    main()
