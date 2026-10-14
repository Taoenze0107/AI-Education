"""Original teaching datasets and transparent, model-based data processing.

These calculations process readings; they do not certify apparatus or conditions.
The catalog is kept separate from students' saved trial records.
"""
from __future__ import annotations

import csv
import io
import json
import math
from pathlib import Path
from statistics import mean, stdev
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import KnowledgeSource, MathEvidence
from app.catalog_extension import BY_ID, process
from app.textbook_models import IDS as TEXTBOOK_IDS, analyze as analyze_textbook


class CatalogModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ReadingColumn(CatalogModel):
    key: str
    label: str
    unit: str


class Parameter(ReadingColumn):
    default: float


class PracticeQuestion(CatalogModel):
    prompt: str
    hint: str
    solution: list[str] = Field(min_length=1)


class ExperimentCase(CatalogModel):
    case_id: str
    title: str
    level: Literal["basic", "standard", "challenge"]
    description: str
    provenance: Literal["synthetic-example"] = "synthetic-example"
    columns: dict[str, list[float]]
    parameters: dict[str, float]
    questions: list[PracticeQuestion] = Field(min_length=3, max_length=3)


class ExperimentTopic(CatalogModel):
    experiment_id: str
    title: str
    area: Literal["mechanics", "electricity", "optics", "thermal", "waves", "measurement", "modern"]
    summary: str
    goal: str
    equipment: list[str]
    conditions: list[str]
    steps: list[str]
    columns: list[ReadingColumn]
    parameters: list[Parameter]
    relation: str
    output_label: str
    output_unit: str
    data_questions: list[str] = Field(min_length=2, max_length=2)
    checks: list[str]
    knowledge_ids: list[str]
    sources: list[KnowledgeSource] = Field(min_length=1)
    cases: list[ExperimentCase] = Field(min_length=3)

    @model_validator(mode="after")
    def check_case_schema(self):
        columns = {column.key for column in self.columns}
        params = {parameter.key for parameter in self.parameters}
        for case in self.cases:
            if set(case.columns) != columns or set(case.parameters) != params:
                raise ValueError(f"{case.case_id}: columns or parameters differ from topic")
        return self


class ReadingRequest(CatalogModel):
    columns: dict[str, list[float]]
    parameters: dict[str, float] = Field(default_factory=dict)


def _fit(x: list[float], y: list[float]):
    xm, ym = mean(x), mean(y)
    xx = sum((v - xm) ** 2 for v in x)
    if xx <= 1e-24:
        raise ValueError("横坐标需要包含不同的读数，才能估计斜率。")
    slope = sum((a-xm)*(b-ym) for a, b in zip(x, y)) / xx
    intercept = ym - slope*xm
    predicted = [slope*a + intercept for a in x]
    residuals = [b-p for b, p in zip(y, predicted)]
    yy = sum((v-ym)**2 for v in y)
    r2 = 1 - sum(v*v for v in residuals)/yy if yy > 0 else None
    return slope, intercept, predicted, residuals, r2


def analyze_readings(topic: ExperimentTopic, request: ReadingRequest) -> dict:
    c, p = request.columns, request.parameters
    if set(c) != {v.key for v in topic.columns} or set(p) != {v.key for v in topic.parameters}:
        raise ValueError("数据列或实验参数不完整，请按本实验的表头填写。")
    lengths = {len(values) for values in c.values()}
    if len(lengths) != 1 or not lengths or not 3 <= next(iter(lengths)) <= 500:
        raise ValueError("请填写 3–500 组对应读数，各列的数量必须相同。")
    if any(not math.isfinite(v) for values in c.values() for v in values) or any(not math.isfinite(v) for v in p.values()):
        raise ValueError("所有读数与参数都必须是有限数。")
    n = next(iter(lengths))
    notes = ["图线和计算基于当前填写的数据；实验条件仍需逐项核实。"]
    metrics, charts = [], []
    eid = topic.experiment_id

    def positive(values, label):
        if any(v <= 0 for v in values):
            raise ValueError(f"{label}必须大于零。")

    def metric(label, value, unit=""):
        metrics.append(dict(label=label, value=value, unit=unit))

    def chart(title, x, y, xlabel, ylabel, model=None, model_label="线性拟合"):
        item=dict(title=title, points=[dict(x=a, y=b) for a,b in zip(x,y)],
                           model=[dict(x=a,y=b) for a,b in sorted(zip(x,model))] if model else [],
                           x_label=xlabel, y_label=ylabel, model_label=model_label)
        charts.append(item)
        return item

    def fitted(x,y,xlabel,ylabel,*,decreasing=False):
        slope, intercept, prediction, residuals, r2 = _fit(x,y)
        if decreasing:
            if slope>=0: raise ValueError("放电对数图的拟合斜率须为负，请核对读数与时间顺序。")
        else: positive([slope], "拟合斜率")
        chart("读数与线性拟合",x,y,xlabel,ylabel,prediction)
        chart("残差：检查模型是否合适",x,residuals,xlabel,ylabel)
        metric("拟合截距",intercept,ylabel.split("（")[-1].rstrip("）") if "（" in ylabel else "")
        if r2 is not None: metric("R²",r2)
        notes.append("采用带截距的普通最小二乘拟合。残差保留全部点，没有自动删除异常读数；R² 高也不能证明实验条件正确。")
        return slope

    def averaged(values):
        result=mean(values)
        metric("逐组结果的样本标准差",stdev(values),topic.output_unit)
        chart("各组计算值与平均值",list(range(1,n+1)),values,"测量组",f"{topic.output_label}（{topic.output_unit}）",[result]*n,"算术平均")
        notes.append("参考结果取逐组计算值的算术平均；样本标准差描述离散程度，不包括全部系统误差。")
        return result

    if eid == "ohms_law":
        positive(c["current_mA"],"电流")
        value=fitted([v/1000 for v in c["current_mA"]],c["voltage_V"],"电流（A）","电压（V）")
        formula,variables="R = k",{"k":value}
    elif eid == "rc_time_constant":
        positive([p["resistance_kohm"],p["capacitance_uF"]],"电阻、电容")
        times, volts=c["time_ms"],c["capacitor_voltage_V"]
        if times[0] != 0 or any(b<=a for a,b in zip(times,times[1:])):
            raise ValueError("充电时间须从 0 ms 开始并严格递增。")
        final=p["final_voltage_V"]
        if final<=volts[0]: raise ValueError("充电终值须高于初始电压。")
        r,cap=p["resistance_kohm"]*1000,p["capacitance_uF"]*1e-6
        value=r*cap
        model=[volts[0]+(final-volts[0])*(1-math.exp(-t/1000/value)) for t in times]
        chart("充电读数与参数模型",times,volts,"时间（ms）","电容电压（V）",model,"由 R、C 构造的模型")
        threshold=volts[0]+(final-volts[0])*(1-math.exp(-1))
        metric("63.2% 阈值",threshold,"V")
        for i in range(1,n):
            if volts[i-1] < threshold <= volts[i]:
                crossing=times[i-1]+(threshold-volts[i-1])*(times[i]-times[i-1])/(volts[i]-volts[i-1])
                metric("阈值时间（插值）",crossing,"ms"); break
        else: notes.append("当前采样未跨过 63.2% 阈值，不能由这组读数报告阈值时间。")
        formula,variables="tau = R * C",{"R":r,"C":cap}
        notes.append("参考值为 R×C；虚线是参数模型而非拟合。此快速处理仅适用于充电。")
    elif eid == "simple_pendulum":
        positive([p["length_cm"],p["cycles"]],"摆长、周期数");positive(c["total_time_s"],"计时")
        if not p["cycles"].is_integer(): raise ValueError("完整周期数必须是整数。")
        periods=[t/p["cycles"] for t in c["total_time_s"]]
        period=mean(periods); length=p["length_cm"]/100
        value=4*math.pi**2*length/period**2
        chart("重复计时的单周期",list(range(1,n+1)),periods,"计时组","周期（s）",[period]*n,"平均周期")
        metric("平均周期",period,"s");metric("周期样本标准差",stdev(periods),"s")
        formula,variables="g = 4 * pi^2 * L / T^2",{"L":length,"T":period}
    elif eid == "hookes_law":
        if any(v<0 for v in c["extension_cm"]): raise ValueError("伸长量不能为负；请以自然长度为零点。")
        value=fitted([v/100 for v in c["extension_cm"]],c["force_N"],"伸长量（m）","力（N）")
        formula,variables="k = slope",{"slope":value}
    elif eid == "spring_oscillation":
        positive(c["mass_g"],"质量");positive(c["total_time_s"],"计时");positive([p["cycles"]],"周期数")
        if not p["cycles"].is_integer(): raise ValueError("完整周期数必须是整数。")
        slope=fitted([v/1000 for v in c["mass_g"]],[(t/p["cycles"])**2 for t in c["total_time_s"]],"质量（kg）","周期平方（s²）")
        value=4*math.pi**2/slope
        formula,variables="k = 4 * pi^2 / slope",{"slope":slope}
        notes.append("线性截距可受支架及弹簧有效质量影响。公式假定小振幅与近似线性弹性。")
    elif eid == "free_fall":
        positive(c["time_ms"],"下落时间");positive(c["height_cm"],"下落高度")
        slope=fitted([(t/1000)**2 for t in c["time_ms"]],[h/100 for h in c["height_cm"]],"时间平方（s²）","高度（m）")
        value=2*slope;formula,variables="g = 2 * slope",{"slope":slope}
        notes.append("h 对 t² 的处理假定从静止释放且计时无固定延迟；仅靠高 R² 不能确认这两个条件。")
    elif eid == "inclined_friction":
        if any(not 0<a<80 for a in c["critical_angle_deg"]): raise ValueError("临界角须介于 0° 与 80° 之间。")
        value=averaged([math.tan(a*math.pi/180) for a in c["critical_angle_deg"]])
        formula,variables="mu = mean_mu",{"mean_mu":value}
        notes.append("这里只计算最大静摩擦系数；开始滑动的临界角不能直接给出动摩擦系数。")
    elif eid == "thin_lens":
        positive(c["object_distance_cm"],"物距");positive(c["image_distance_cm"],"像距")
        value=averaged([u*v/(u+v) for u,v in zip(c["object_distance_cm"],c["image_distance_cm"])])
        formula,variables="f = mean_f",{"mean_f":value}
        notes.append("采用凸透镜成实像、物距和像距均为正的约定；距离须从透镜主平面计量。")
    elif eid == "snell_refraction":
        if any(not 0<a<90 for a in c["incidence_deg"]+c["refraction_deg"]): raise ValueError("入射角和折射角须介于 0° 与 90° 之间。")
        value=fitted([math.sin(a*math.pi/180) for a in c["refraction_deg"]],[math.sin(a*math.pi/180) for a in c["incidence_deg"]],"sin(折射角)","sin(入射角)")
        formula,variables="n = slope",{"slope":value}
        notes.append("斜率给出 n₂/n₁；只有入射介质近似为空气时，才近似等于待测介质折射率。")
    elif eid == "double_slit":
        positive([p["slit_spacing_mm"],p["screen_distance_m"]],"缝距、屏距")
        if any(not v.is_integer() for v in c["fringe_order"]): raise ValueError("亮纹级次必须是整数。")
        slope=fitted(c["fringe_order"],c["position_mm"],"亮纹级次","位置（mm）")
        value=slope*p["slit_spacing_mm"]/p["screen_distance_m"]*1000
        formula,variables="lambda_nm = delta_y * d / D * 1e9",{"delta_y":slope/1000,"d":p["slit_spacing_mm"]/1000,"D":p["screen_distance_m"]}
        notes.append("使用小角度近似 Δy=λD/d；不可将跨越多条亮纹的总距离当作一个间距。")
    elif eid == "calorimetry":
        positive([p["metal_mass_g"],p["water_mass_g"],p["water_specific_heat"]],"质量、比热容")
        cold=p["water_initial_C"]
        if any(not cold<final<hot for hot,final in zip(c["metal_initial_C"],c["equilibrium_C"])):
            raise ValueError("平衡温度须高于初始水温并低于初始金属温度。")
        value=averaged([p["water_mass_g"]*p["water_specific_heat"]*(final-cold)/(p["metal_mass_g"]*(hot-final)) for hot,final in zip(c["metal_initial_C"],c["equilibrium_C"])])
        formula,variables="c = mean_c",{"mean_c":value}
        notes.append("基础热平衡模型忽略容器吸热与环境散热；未经修正的结果只能作为该模型下的估计。")
    elif eid == "sound_resonance":
        positive(c["frequency_Hz"],"频率")
        if any(not 0<a<b for a,b in zip(c["first_length_cm"],c["second_length_cm"])):
            raise ValueError("须填写正的共鸣长度，第二次长度应大于第一次。")
        value=averaged([2*f*(b-a)/100 for f,a,b in zip(c["frequency_Hz"],c["first_length_cm"],c["second_length_cm"])])
        formula,variables="v = mean_v",{"mean_v":value}
        notes.append("一端封闭管的相邻共鸣长度相差约半个波长；相减可减弱相同端部修正的影响。")
    elif eid == "uniform_acceleration":
        times=c["time_s"]
        if times[0]<0 or any(b<=a for a,b in zip(times,times[1:])):
            raise ValueError("时间须非负且严格递增。")
        value=fitted(times,c["velocity_m_s"],"时间（s）","速度（m/s）")
        formula,variables="a = slope",{"slope":value}
        notes.append("本页处理正向匀加速运动；带截距拟合允许非零初速度。共同速度偏移只改变截距，弯曲残差则提示加速度可能变化。")
    elif eid == "newtons_second_law":
        positive(c["acceleration_m_s2"],"加速度");positive(c["net_force_N"],"合外力")
        value=fitted(c["acceleration_m_s2"],c["net_force_N"],"加速度（m/s²）","合外力（N）")
        formula,variables="m = slope",{"slope":value}
        notes.append("斜率估计同一系统的惯性质量；所填力须为合外力，不能自动将拉力当作合力。截距不为零时应回查摩擦、零点或系统边界。")
    elif eid == "work_energy":
        if p["initial_speed_m_s"]<0: raise ValueError("初速大小不能为负。")
        positive(c["speed_m_s"],"末速")
        if any(v<=p["initial_speed_m_s"] for v in c["speed_m_s"]):
            raise ValueError("本页处理速度增大的过程，末速须高于初速。")
        positive(c["net_work_J"],"合外力做功")
        slope=fitted([v*v-p["initial_speed_m_s"]**2 for v in c["speed_m_s"]],c["net_work_J"],"速度平方变化（m²/s²）","合外力做功（J）")
        value=2*slope;formula,variables="m = 2 * slope",{"slope":slope}
        notes.append("只处理平动动能；合外力做功须包括摩擦等外力贡献。仅记录驱动力做功、遗漏初速度或存在转动动能都会改变解释。")
    elif eid == "archimedes":
        positive(c["submerged_volume_cm3"],"浸没体积");positive(c["buoyant_force_N"],"浮力");positive([p["gravity_m_s2"]],"重力加速度")
        slope=fitted([v*1e-6 for v in c["submerged_volume_cm3"]],c["buoyant_force_N"],"浸没体积（m³）","浮力（N）")
        value=slope/p["gravity_m_s2"];formula,variables="rho = slope / g",{"slope":slope,"g":p["gravity_m_s2"]}
        notes.append("F浮=ρ液gV排，斜率给出排开液体的密度而非物体密度；本模型忽略明显表面张力，并需确认物体不接触容器。")
    elif eid == "resistivity":
        positive(c["length_cm"],"导线有效长度");positive(c["resistance_ohm"],"电阻");positive([p["diameter_mm"]],"导线直径")
        area=math.pi*(p["diameter_mm"]/1000)**2/4
        slope=fitted([v/100 for v in c["length_cm"]],c["resistance_ohm"],"长度（m）","电阻（Ω）")
        value=slope*area*1e6;metric("截面积",area,"m²")
        formula,variables="rho_micro = slope * A * 1e6",{"slope":slope,"A":area}
        notes.append("采用均匀圆截面和近似恒温模型；电阻率显示为 μΩ·m，乘 10⁻⁶ 得 Ω·m。共同接触电阻可改变截距，直径误差通过平方影响结果。")
    elif eid == "joule_heating":
        positive([p["current_A"],p["resistance_ohm"],p["water_mass_g"],p["specific_heat_J_kgK"]],"电流、电阻、质量及比热容")
        if any(t<0 for t in c["time_s"]) or any(b<=a for a,b in zip(c["time_s"],c["time_s"][1:])):
            raise ValueError("加热时间须非负且严格递增。")
        slope=fitted(c["time_s"],c["temperature_rise_C"],"时间（s）","水温升（K）")
        mass=p["water_mass_g"]/1000;power=p["current_A"]**2*p["resistance_ohm"]
        value=100*mass*p["specific_heat_J_kgK"]*slope/power
        metric("输入电功率",power,"W")
        formula,variables="eta_percent = 100 * m * c * slope / power",{"m":mass,"c":p["specific_heat_J_kgK"],"slope":slope,"power":power}
        notes.append("这是所选时间段内进入水的表观热转换比例，忽略容器储热；模型要求近似恒定 I、R 与线性温升。它不是对完整装置效率的认证。")
        if value>100: notes.append("表观比例超过 100%，应核对温升、质量、电流与额外热源，不能按物理效率直接解释。")
    elif eid == "capacitor_discharge":
        times=c["time_ms"]
        if times[0]<0 or any(b<=a for a,b in zip(times,times[1:])):
            raise ValueError("放电时间须非负且严格递增。")
        positive(c["capacitor_voltage_V"],"用于对数处理的电压")
        seconds=[t/1000 for t in times];logs=[math.log(v) for v in c["capacitor_voltage_V"]]
        slope=fitted(seconds,logs,"时间（s）","ln(V / 1 V)",decreasing=True)
        intercept=mean(logs)-slope*mean(seconds)
        chart("放电电压随时间变化",seconds,c["capacitor_voltage_V"],"时间（s）","电容电压（V）",
              [math.exp(intercept+slope*t) for t in seconds],"对数拟合还原")
        charts.insert(0,charts.pop())
        value=-1/slope;formula,variables="tau = -1 / slope",{"slope":slope}
        notes.append("对 ln(V/1 V) 做带截距拟合，τ=−1/斜率；假定零终值、单指数放电。低电压零点偏移或多时间常数会使对数图弯曲；这里未做噪声加权拟合。")
    elif eid == "transformer_ratio":
        positive(c["primary_voltage_V"],"初级交流有效值");positive(c["secondary_voltage_V"],"次级交流有效值")
        positive([p["primary_turns"],p["secondary_turns"],p["frequency_Hz"]],"匝数与交流频率")
        if any(not p[k].is_integer() for k in ["primary_turns","secondary_turns"]):
            raise ValueError("线圈匝数必须是正整数。")
        value=fitted(c["primary_voltage_V"],c["secondary_voltage_V"],"初级交流有效值（V）","次级交流有效值（V）")
        metric("理想匝数比",p["secondary_turns"]/p["primary_turns"])
        formula,variables="ratio = slope",{"slope":value}
        notes.append("比较同频率正弦交流有效值，测得斜率近似 V₂/V₁；N₂/N₁ 是理想空载关系。匝数比不能自动证明带载压降、铁芯损耗或仪表频响可忽略。")
    elif eid == "grating_diffraction":
        positive([p["lines_per_mm"]],"光栅线密度");positive(c["diffraction_order"],"正侧衍射级次")
        if any(not m.is_integer() for m in c["diffraction_order"]): raise ValueError("衍射级次必须是正整数。")
        if any(not 0<a<90 for a in c["angle_deg"]): raise ValueError("正侧衍射角须介于 0° 与 90° 之间。")
        slope=fitted(c["diffraction_order"],[math.sin(math.radians(a)) for a in c["angle_deg"]],"衍射级次","sin(衍射角)")
        spacing=1e-3/p["lines_per_mm"]
        value=slope*spacing*1e9;metric("光栅间距",spacing,"m")
        formula,variables="lambda_nm = slope * d * 1e9",{"slope":slope,"d":spacing}
        notes.append("采用垂直入射 d sinθ=mλ，不使用小角度替代正弦；仅处理正侧非零级次。线密度、级次和角度零点须独立核对。")
    elif eid == "total_internal_reflection":
        if any(not 0<a<90 for a in c["critical_angle_deg"]): raise ValueError("临界角须介于 0° 与 90° 之间。")
        value=averaged([1/math.sin(math.radians(a)) for a in c["critical_angle_deg"]])
        formula,variables="relative_n = mean_n",{"mean_n":value}
        notes.append("临界角只在高折射率向低折射率传播时出现；结果为 n高/n低。只有低折射率介质近似空气时，才近似等于高侧材料折射率。")
    elif eid == "thermal_expansion":
        positive([p["initial_length_cm"]],"初始长度")
        if any(t<0 for t in c["temperature_rise_C"]): raise ValueError("本页处理升温过程，温升不能为负。")
        slope=fitted(c["temperature_rise_C"],c["elongation_mm"],"温升（K）","伸长（mm）")
        length=p["initial_length_cm"]*10
        value=slope/length*1e6
        formula,variables="alpha_micro = slope / L0 * 1e6",{"slope":slope,"L0":length}
        notes.append("α 显示为 10⁻⁶/K；ΔL 与初始长度在计算中同用 mm。模型要求温度近似均匀、系数在本温区近似恒定，并需讨论支架自身膨胀。")
    elif eid == "string_waves":
        positive(c["length_cm"],"有效弦长");positive(c["frequency_Hz"],"基频");positive([p["tension_N"]],"张力")
        slope=fitted([100/v for v in c["length_cm"]],c["frequency_Hz"],"有效弦长倒数（1/m）","基频（Hz）")
        value=p["tension_N"]/(4*slope*slope)*1000;metric("由斜率估计的波速",2*slope,"m/s")
        formula,variables="mu_g = F / (4 * slope^2) * 1000",{"F":p["tension_N"],"slope":slope}
        notes.append("f₁=(1/2L)√(F/μ)，假定两端为节点、基频只有一个波腹且张力近似恒定。显示 g/m；混入高次谐波会改变线密度估计。")
    elif eid in TEXTBOOK_IDS:
        value,formula,variables=analyze_textbook(topic,c,p,fitted,averaged,chart,metric,notes)
        if eid=="electrostatic_field":
            charts[0]['kind']='heatmap';charts[0]['z_label']='电势（V）'
            for point,z in zip(charts[0]['points'],c['potential_V']):point['z']=z
    elif eid in BY_ID:
        value, formula, variables = process(BY_ID[eid], c, fitted)
        notes.extend([BY_ID[eid][20], BY_ID[eid][21], "固定装置常量见实验关系；换用其他装置时不能直接沿用。"])
    else:
        raise ValueError("该实验尚无专门的数据处理模型。")
    if not math.isfinite(value) or value<=0: raise ValueError("计算结果无效，请核对读数与模型条件。")
    metric(topic.output_label,value,topic.output_unit)
    # All inputs are retained, including SI conversions in mathematical variables.
    raw={**c,**p}
    return dict(result=value,unit=topic.output_unit,label=topic.output_label,metrics=metrics,
                charts=charts,notes=notes,raw_measurements=raw,
                mathematics=MathEvidence(formula=formula,variables=variables,reference_result=value,
                                         unit=topic.output_unit).model_dump(mode="json"))


class ExperimentCatalog:
    def __init__(self, path: Path | None = None):
        path=path or Path(__file__).parent/"data"/"experiment_catalog.json"
        self.topics=[ExperimentTopic.model_validate(v) for v in json.loads(path.read_text(encoding="utf-8"))]
        self.by_id={t.experiment_id:t for t in self.topics}
        self.cases={c.case_id:(t,c) for t in self.topics for c in t.cases}
        if len(self.by_id)!=len(self.topics) or len(self.cases)!=sum(len(t.cases) for t in self.topics):
            raise ValueError("实验或练习编号重复。")
        for t,c in self.cases.values(): analyze_readings(t,ReadingRequest(columns=c.columns,parameters=c.parameters))

    def csv(self, case_id: str) -> str:
        topic,case=self.cases[case_id]
        stream=io.StringIO(); writer=csv.writer(stream)
        keys=[c.key for c in topic.columns]; params=[p.key for p in topic.parameters]
        writer.writerow([*keys,*params,"data_origin"])
        for row in zip(*(case.columns[key] for key in keys)):
            writer.writerow([*row,*(case.parameters[key] for key in params),case.provenance])
        return "\ufeff"+stream.getvalue()
