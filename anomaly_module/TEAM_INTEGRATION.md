# AD 模块团队对接说明

## AD 当前交付

- 对外检测入口：`app/anomaly_detector.py`
- 自动分析接口：`POST /api/v1/anomaly/analyze`
- CSV/XLSX 导入接口：`POST /api/v1/anomaly/import`
- 团队模型文件：`models/anomaly_classifier.pkl`
- 输出内容：`anomaly_type`、`anomaly_score`、异常位置、可解释依据，以及可直接写入 AT 的 `anomaly` 字段。

## 数学成员提供后自动生效的内容

将伏安法标准保存为 `standards/ohms_law.json`。AD 目前会读取以下阈值；未提供时使用同名默认值。

```json
{
  "outlier_relative_residual": 0.35,
  "noise_normalized_residual_std": 0.12,
  "unit_error_ratio_decades": 1.05
}
```

数学成员的正式测试案例应放在 `test_cases/`，并带有每组数据的真实 `label`。AD 不会把合成训练集指标当作正式系统评价；拿到这些案例后，使用 `anomaly_module/evaluate_real_data.py` 生成独立报告。

## 数据输入格式

CSV 或 XLSX 至少要有：`voltage_V`、`current_mA`。推荐完整列：

```text
run_id,point_index,voltage_V,current_mA,label,expected_resistance_ohm
```

- `voltage_V` 单位是 V；`current_mA` 单位是 mA。
- `run_id` 用于区分多组实验；`point_index` 决定测量点顺序。
- 空白电流读数会保留为缺失值，并由 AD 报告 `missing`。
- `label` 只用于人工标注后的评估，在线分析不需要填写。

## 当前边界

AD 当前已针对伏安法（`ohms_law`）完成数据异常检测。RC 时间常数与单摆需要数学成员提供各自标准后，再按相同接口扩展；周期性特征如 FFT 不适合直接套到非周期的伏安曲线，因此这里采用线性趋势、残差、IQR、稳健 Z 分数和突变特征。

## 已整合的 PC 材料分析接口

`POST /api/v1/materials/analyze` 会针对一组伏安法材料同时完成：

1. 读取 CSV/XLSX，并将 `current_A` 自动换算成 `current_mA`；
2. 生成伏安散点、拟合线和残差图所需的数据；
3. 复算电阻，并生成数据完整性、线性关系、电阻稳定性、参考电阻一致性检查；
4. 调用 AD 模块返回异常类型、位置和依据。

前端的“自动完成数据分析”按钮会把上述三路结果分别写入 `anomaly`、`consistency`、`mathematics`，随后仍由原 AT 流程提交诊断与教学反馈。
