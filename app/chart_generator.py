"""Generate chart-ready data for the PC material-analysis module.

The browser draws the chart with native SVG, avoiding a second front-end
framework and keeping the local demo offline-friendly.
"""

from __future__ import annotations

from typing import Any


def ohms_law_chart_data(
    voltage: list[float], current_mA: list[float], slope: float, intercept: float
) -> dict[str, list[dict[str, float]]]:
    """Return scatter, fitted-line and residual series with consistent units."""

    scatter = [{"x": x, "y": y} for x, y in zip(voltage, current_mA)]
    fitted = [{"x": x, "y": slope * x + intercept} for x in voltage]
    residuals = [
        {"x": x, "y": y - (slope * x + intercept)}
        for x, y in zip(voltage, current_mA)
    ]
    return {"scatter": scatter, "fitted": fitted, "residuals": residuals}
