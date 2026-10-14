"""读取数学标准（MS）模块提供的实验标准。

标准文件位于 ``standards/<experiment_id>.json``，采用 MS 推荐的嵌套契约
（meter/fit/outlier/noise/drift/unit_error/missing/reference 等）。

为兼容仍在读取旧版三个顶层阈值字段的代码，加载 ohms_law 标准时会把 json 中
的 ``legacy_*`` 默认值投影回旧字段名；标准文件尚未到位时回退到稳定默认值，
因此文件缺失不会影响服务启动。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


# 旧版（MS 标准落地前）的三个顶层阈值默认值，保留用于无 json 时的兜底与兼容。
DEFAULT_OHMS_LAW_STANDARD: dict[str, float] = {
    "outlier_relative_residual": 0.35,
    "noise_normalized_residual_std": 0.12,
    "unit_error_ratio_decades": 1.05,
}


def _sget(node: Any, dotted: str, default: Any = None) -> Any:
    """按点分路径读取嵌套 dict，任一层缺失即返回 default。"""

    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node


def _standards_root() -> Path:
    return Path(__file__).resolve().parent.parent / "standards"


def load_experiment_standard(experiment_id: str) -> dict[str, Any]:
    """加载 ``standards/<experiment_id>.json``。

    文件缺失、损坏或不是 JSON 对象时：ohms_law 返回文档化默认值，其余实验返回
    空 dict，保证调用方始终拿到可用的 mapping。
    """

    path = _standards_root() / f"{experiment_id}.json"
    if not path.exists():
        return dict(DEFAULT_OHMS_LAW_STANDARD) if experiment_id == "ohms_law" else {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return dict(DEFAULT_OHMS_LAW_STANDARD) if experiment_id == "ohms_law" else {}
    if not isinstance(value, dict):
        return dict(DEFAULT_OHMS_LAW_STANDARD) if experiment_id == "ohms_law" else {}

    if experiment_id == "ohms_law":
        # 旧字段兼容投影：新契约把历史默认值放在各分支的 legacy_* 键里。
        legacy = {
            "outlier_relative_residual": _sget(
                value, "outlier.legacy_outlier_relative_residual_default", 0.35
            ),
            "noise_normalized_residual_std": _sget(
                value, "noise.legacy_noise_normalized_residual_std_default", 0.12
            ),
            "unit_error_ratio_decades": _sget(
                value, "unit_error.legacy_unit_error_ratio_decades_default", 1.05
            ),
        }
        merged = dict(legacy)
        merged.update(value)
        return merged
    return value
