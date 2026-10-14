# 异常检测模块交付说明

本目录实现伏安法测电阻（`ohms_law`）的数据异常检测，数据单位约定为：`voltage_V` 使用 V，`current_mA` 使用 mA。

## 文件与作用

| 文件 | 作用 |
| --- | --- |
| `data/ohms_law_dataset.csv` | 手工录入的小样本；保留不改。 |
| `generate_dataset.py` | 固定随机种子生成 480 组训练样本，包含 normal、outlier、missing、noise、drift、unit_error。 |
| `data/ohms_law_training.csv` | 自动生成的 3840 条测量记录。 |
| `train_model.py` | 以“测量组”为单位划分训练/测试集，训练随机森林并输出评估。 |
| `models/ohms_law_rf.joblib` | 已训练的随机森林模型。 |
| `reports/evaluation.json` | 准确率、误报率、漏报率、噪声识别率、混淆矩阵和各类别指标。 |
| `data/real_data_template.csv` | 真实实验数据的空白模板，不能用合成数据替代。 |
| `evaluate_real_data.py` | 对手工标注的真实实验数据单独评估，输出真实数据报告。 |
| `../app/anomaly_detector.py` | AD 模块对外入口，供 AT 模块稳定调用。 |
| `../models/anomaly_classifier.pkl` | 团队约定的随机森林模型文件；保留旧路径以兼容已有网页。 |

## 指标定义

- `fault_strength`：构造训练数据时的真实异常强度标签，取值 0 到 1；它不等于在线检测器返回的 `anomaly_score`。
- `anomaly_score`：在线检测根据当前数据的规则分数，取值 0 到 1。
- `confidence`：检测结论可信度，取值 0 到 1。
- FPR：正常数据被误判为异常的比例。
- FNR：异常数据被误判为正常的比例。

## 复现训练

在项目根目录运行：

```powershell
.\.venv\Scripts\python anomaly_module\generate_dataset.py
.\.venv\Scripts\python anomaly_module\train_model.py
```

## 真实实验数据评估

1. 将 `data/real_data_template.csv` 复制为 `data/real_data.csv`；
2. 按每个实验组填写电压、电流和真实标签；
3. 运行：

```powershell
.\.venv\Scripts\python anomaly_module\evaluate_real_data.py
```

该命令会生成 `reports/real_data_evaluation.json`。没有真实数据时，不应把合成数据指标当作真实实验效果。

网页端可直接输入伏安数据，也可以导入 CSV/XLSX（使用 `run_id` 区分多组）。点击“用原始数据自动分析”即可调用 `/api/v1/anomaly/analyze`。接口返回异常类型、定位、分数和可解释依据，然后自动回填到原页面的异常证据表单。

## 与数学标准模块的衔接

当数学成员提供 `standards/ohms_law.json` 后，AD 会自动读取其中的阈值，例如：

```json
{
  "outlier_relative_residual": 0.35,
  "noise_normalized_residual_std": 0.12,
  "unit_error_ratio_decades": 1.05
}
```

没有标准文件时，AD 使用同一组默认阈值，并在正式答辩前应以数学成员的标准测试案例和真实实验数据重新评估。
