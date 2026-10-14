"""AD 模块对外入口。

团队其他模块只需从这里导入 ``AnomalyDetector``。具体实现仍放在
``app.anomaly``，以保留已有网页与测试的兼容性。
"""

from app.anomaly import FEATURE_NAMES, AnomalyDetector

__all__ = ["AnomalyDetector", "FEATURE_NAMES"]
