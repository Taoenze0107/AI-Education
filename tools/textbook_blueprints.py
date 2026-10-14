"""Original lesson plans and deterministic teaching readings; never laboratory observations."""
import math

PLANS=[]
def add(eid,title,area,columns,parameters,relation,label,unit,equipment,conditions,steps,method,question,fault):
    cols=[dict(zip(('key','label','unit'),v.split('|'))) for v in columns.split(';')]
    params=[]
    for field in parameters.split(';') if parameters else []:
        key,name,u,value=field.split('|');params.append(dict(key=key,label=name,unit=u,default=float(value)))
    PLANS.append(dict(experiment_id=eid,title=title,area=area,columns=cols,parameters=params,relation=relation,
        output_label=label,output_unit=unit,equipment=equipment.split('；'),conditions=conditions.split('；'),
        steps=steps.split('；'),method=method,question=question,fault=fault))

add('length_measurement','游标卡尺与螺旋测微器：长度及不确定度','measurement',
 'reading_mm|长度读数|mm','zero_offset|零位读数|mm|0.02;resolution|分辨率|mm|0.01',
 'x=读数−零位；u_A=s/√N，u_分辨率=分辨率/√12','平均长度','mm','卡尺或测微器；待测件；温度记录',
 '注明仪器类型与分辨率；零位在同一测量时段检查；量具与工件无明显倾斜或过大夹持力',
 '先记录零位和仪器分辨率；换位置重复测量，保留原始读数；校零后计算均值、离散性和分辨率项',
 '逐个读数减去零位再平均；分别报告均值 A 类标准不确定度和分辨率 B 类项。','重复测量能否消除零位偏差？','把仪器零位当作零')
add('mass_measurement','天平与电子秤：质量的测量','measurement',
 'reading_g|质量读数|g','zero_offset|零位读数|g|0.1;resolution|分辨率|g|0.01',
 'm=读数−零位；重复测量与分辨率分别评定','平均质量','g','电子天平或物理天平；标准砝码；待测物',
 '仪器调平并记录零位；量程覆盖待测质量；待测物稳定且无风扰',
 '记录仪器量程、分辨率和零位；同一物体重复取放称量；保留均值、标准差及校准来源',
 '校零后平均质量；A 类项来自重复读数，分辨率项不替代校准证书。','取放后的波动和固定零位如何区分？','未扣除 0.1 g 零位')
add('solid_density','固体密度：圆柱体的质量与尺寸','measurement',
 'mass_g|质量|g;diameter_mm|直径|mm;height_mm|高度|mm','',
 'ρ=m/(πd²h/4)','固体密度','kg/m³','天平；卡尺或测微器；圆柱试样',
 '试样近似实心圆柱；质量与尺寸对应同一试样；不同方位测直径并检查椭圆或锥度',
 '称量试样并记录零位；测不同方位直径与高度；逐组计算体积和密度，讨论尺寸误差',
 '质量 g 转 kg，体积 mm³ 转 m³，逐组计算密度后平均。','直径误差为何比同样比例的高度误差更敏感？','所有直径标定偏大 2%')
add('density_buoyancy','固体密度：液体静力称量法','measurement',
 'mass_air_g|空气中质量读数|g;apparent_mass_g|浸液表观质量读数|g',
 'liquid_density_kg_m3|浸液密度|kg/m³|1000','ρ物=ρ液 m空气/(m空气−m浸液)','固体密度','kg/m³',
 '天平及悬挂装置；温度计；已知密度液体',
 '物体完全浸没且不接触容器；排除气泡与明显吸液；按温度确定液体密度',
 '记录空气质量和浸液温度；完全浸没后称表观质量；由质量差求排液体积并复查气泡',
 '质量差对应浮力，逐组以 ρ液 m空气/(m空气−m浸液) 计算。','气泡会怎样改变排开液体体积和密度估计？','浸液表观质量统一增加 0.1 g')
add('multimeter','万用电表：量程选择与读数核对','measurement',
 'reference_V|标准电压|V;display_V|万用表读数|V','',
 'U显示=k U标准+b','读数增益','1','万用电表；低压标准源；表笔',
 '量程和输入类型匹配；使用同一标准源和参考表；先断电接线再测量',
 '按电压测量方式正确并联；从适当量程逐级核对标准点；拟合增益与零位并保留表的规格',
 '对显示电压与标准电压带截距拟合，斜率为增益；不把高 R² 当作校准合格。','读数很线性是否意味着数值准确？','电压显示增益偏大 4%')
add('oscilloscope','数字示波器：周期、幅度与探头倍率','measurement',
 'period_div|一个完整周期格数|div;peak_to_peak_div|峰峰值格数|div',
 'timebase_ms_div|时基|ms/div|0.2;voltage_V_div|垂直刻度|V/div|0.5;probe_ratio|探头倍率|1|10',
 'f=1/(周期格数×时基)；Upp=幅度格数×垂直刻度×探头倍率','信号频率','Hz',
 '示波器；信号源；探头',
 '同相位起止点构成完整周期；探头倍率与显示设置一致；触发稳定且带宽覆盖信号',
 '检查补偿、耦合、倍率与接地；重复读完整周期及峰峰值格数；换算频率和幅度并核对信号源',
 '周期格数乘 ms/div 后转 s，逐组取倒数；幅度另按倍率换算。','探头倍率会改变频率吗，还是只影响幅度？','填写的时基偏大 10%')
add('virtual_daq','虚拟仪器：采样、波形与有效值','measurement',
 'time_s|采样时刻|s;voltage_V|电压|V','',
 'Uac,rms=√mean((U−mean U)²)','交流分量有效值','V','采集卡；信号源；采集软件',
 '时间单调且采样率高于信号主要频率；注明通道增益和带宽；分析窗覆盖足够周期',
 '保留时间戳与原始电压；检查直流偏置、削顶与漏采；按窗口计算去直流有效值并比较过零频率',
 '减去均值计算交流分量均方根；上升过零频率仅作独立对照。','同一个信号，分析窗不整周期时均值会不会变化？','电压通道整体增益偏大 4%')
add('trifilar','三线摆：测量物体转动惯量','mechanics','period_s|小角振动周期|s',
 'mass_kg|摆动物体总质量|kg|0.5;gravity_m_s2|重力加速度|m/s²|9.81;upper_radius_m|上悬点半径|m|0.05;lower_radius_m|下悬点半径|m|0.05;length_m|悬线有效长度|m|0.5',
 'J=M g R r T²/(4π²L)','转动惯量','kg·m²','三线摆；天平；长度尺与计时装置',
 '小扭角且主要为绕竖直轴振动；三根悬线等长且对称；总质量与平台本底惯量另记',
 '量悬点半径、有效线长和总质量；多周期计时换算单周期；先算总惯量，需测物体时再减平台本底',
 '逐组周期平方乘 M g R r/(4π²L)，原量纲为 kg·m²。','为什么加物体后不能只用物体质量代入总摆周期？','悬线有效长度低估 5%')
add('shear_modulus','金属丝扭转：切变模量','mechanics','twist_deg|扭转角|°;torque_mNm|施加力矩|mN·m',
 'length_m|有效丝长|m|0.5;radius_mm|金属丝半径|mm|0.5','M=Gπr⁴θ/(2L)','切变模量','GPa',
 '扭转装置；测微器；力矩和角度读数',
 '均匀圆丝且小形变；力矩与角度对应同一时刻；不超弹性限度',
 '量丝半径及有效长度；分级加卸力矩记录扭角；带截距拟合力矩对弧度角并核对滞后',
 '角度转 rad、力矩转 N·m；G=2L×斜率/(πr⁴)，再转 GPa。','半径误差为什么会放大到四次方？','半径读数偏大 2%')
add('forced_resonance','波尔共振与音叉受迫振动：幅频曲线','waves','frequency_Hz|驱动频率|Hz;amplitude_mm|稳态振幅|mm','',
 '共振频率取扫描振幅最大值位置','采样共振频率','Hz','共振仪或音叉装置；驱动源；幅度测量装置',
 '每点等待稳态；驱动力幅度在扫描期间可比；扫描包住峰两侧',
 '记录驱动设置和阻尼条件；扫频采集稳态振幅；在峰附近加密读数并比较相位',
 '绘制幅频曲线，报告采样最高点的频率；采样结果不等于连续精确峰位。','峰位和峰宽分别受哪些因素影响？','低频侧增益与高频侧不一致')
add('collision','气垫导轨：碰撞与动量守恒','mechanics',
 'v1_before|物体1碰前速度|m/s;v2_before|物体2碰前速度|m/s;v1_after|物体1碰后速度|m/s;v2_after|物体2碰后速度|m/s',
 'mass1_kg|物体1质量|kg|0.2;mass2_kg|物体2质量|kg|0.3','p=m₁v₁+m₂v₂','碰后 / 碰前动量比','1',
 '气垫导轨；光电门；天平',
 '统一有符号速度方向；碰撞期间外冲量可忽略；包括全部参与碰撞质量',
 '称质量并确认系统边界；采集碰前后速度和方向；同时比较动量与动能，区分弹性和非弹性',
 '保留速度符号，计算每次碰前后总动量比；初始总动量接近零时改用绝对差。','动量守恒是否意味着动能也守恒？','只在碰后通道出现 4% 速度增益偏差')
add('magnetic_levitation','磁悬浮动力学：平衡点附近的小振动','mechanics','time_s|时刻|s;displacement_mm|竖直位移|mm',
 'mass_g|悬浮物质量|g|20','k有效=m(2π/T)²','有效小振动刚度','N/m',
 '低压教学磁悬浮装置；位移传感器；采集装置',
 '平衡点附近小幅稳定运动；控制器设置在整段保持不变；有效刚度描述闭环装置而非裸磁体',
 '记录工作点与控制设置；采集多次过平衡点的小振动；从同方向过零间隔求周期并讨论阻尼',
 '从至少三次上升过平衡点估计周期，k=m(2π/T)²；这是局部闭环有效量。','更换控制增益后，能否直接比较两次“刚度”？','记录时间刻度偏大 10%')
add('air_heat_ratio','空气比热容比：绝热放气与恒容恢复','thermal',
 'initial_height_mm|放气前压差高度h1|mm;restored_height_mm|恢复室温后高度h2|mm','',
 'γ≈h₁/(h₁−h₂)','空气比热容比','1','比热容比装置；压差计；温度计',
 '小压差近似；开阀过程近似绝热且迅速完成；关闭后等待恢复室温',
 '记录初始压差和室温；短时放气后关闭并等待温度恢复；多次计算 γ，检查阀门漏气和压差零位',
 '使用已校零的压差高度，逐组计算 h₁/(h₁−h₂)。','关闭太慢和提前读取 h₂ 会分别引入什么偏差？','恢复压差高度低估 4%')
add('surface_tension','液体表面张力：拉脱力与润湿周长','thermal',
 'wetted_perimeter_mm|两面合计润湿周长|mm;corrected_force_mN|已扣本底的拉脱力|mN',
 'contact_cosine|接触角余弦|1|1','F=γ l cosθ','表面张力系数','N/m','拉脱装置；测力传感器；尺寸尺与液体',
 '周长包括全部受力液面接触线；已扣装置自重及必要浮力；温度、清洁度和接触角可比',
 '调零并测量润湿几何；缓慢拉脱记录修正峰值；拟合力对总润湿周长，复查接触角与本底',
 'mN/mm 数值等于 N/m；斜率除以接触角余弦得到 γ。','为什么细板两面的接触线不能只数一次？','接触角余弦填写偏小 5%')
add('ice_latent_heat','混合法：冰的比熔解热','thermal',
 'initial_water_C|初始水温|°C;final_C|平衡温度|°C;ice_mass_g|实际融化冰质量|g',
 'water_mass_g|初始水质量|g|200;water_specific_heat|水比热容|J/(kg·K)|4180',
 'm水c(T初−T末)=m冰L+m冰cT末','比熔解热','kJ/kg','量热器；天平；温度计及0°C冰',
 '冰初温为0°C且已吸去表面水；冰完全融化并达到均匀温度；本简化模型忽略容器热容及散热',
 '称水并记录初温；加入已处理的0°C冰，记录最终质量和温度；列热平衡，讨论容器与湿冰误差',
 '先扣融冰升到最终温度的热量，再除以冰质量，换成 kJ/kg。','如果冰表面带水，称得的质量还能全部乘熔解热吗？','冰质量因表面水偏大 4%')
add('vapor_latent_heat','液体比汽化热：能量与蒸发质量','thermal',
 'evaporated_g|蒸发质量|g;corrected_energy_kJ|已扣散热的加热能量|kJ','',
 'Q修正=L Δm + 本底项','比汽化热','kJ/kg','低压电热装置；天平；温度与能量记录',
 '在同一沸点稳定蒸发；能量已扣容器储热与散热；质量变化不混入飞溅',
 '先到稳定沸腾再记录能量；同步测蒸发质量和本底散热；拟合修正能量对质量变化并讨论截距',
 '质量 g 转 kg，Q(kJ) 对 Δm(kg) 的斜率即 kJ/kg。','未扣散热时，拟合汽化热为什么可能偏大？','修正能量仍含 4% 额外散热')
add('temperature_pid','温度PID调节：响应与误差记录','thermal',
 'time_s|采样时刻|s;temperature_C|物体温度|°C','target_C|目标温度|°C|50;tolerance_K|允许温差|K|1',
 'IAE=∫|T−T设定|dt','窗口积分绝对误差','K·s','教学温控装置；温度探头；采集软件',
 '观察窗和设定值明确；传感器标定与响应时间已记录；比较方案时采用相同初始状态',
 '记录控制参数、设定及初温；采集完整升温和稳定阶段；比较超调、容差内起点与积分误差',
 '按时间顺序梯形积分绝对温差；调整时间仅在至记录末尾保持在容差内时报告。','两次观察窗不一样长，积分误差能直接比较吗？','温度探头零位偏高 2°C')
add('heat_engine','空气热机：P–V循环与净功','thermal','volume_ml|气体体积|mL;pressure_kPa|绝对压强|kPa',
 'input_heat_J|每循环输入热量|J|20','W=∮P dV','每周期净功绝对值','J','空气热机教学装置；压强和体积传感器；热量记录',
 '按真实采集顺序记录闭合循环；绝对压强与体积标定完整；循环功不等于单个过程的功',
 '同步记录P与V并确认循环闭合；按顺序绘制循环并积分；记录方向、热量及散热，讨论效率',
 '保持采集顺序，梯形积分 P dV；kPa·mL 乘10⁻³得J。','为什么重新按体积排序会破坏循环功？','压强通道增益偏大 4%')
add('temperature_viscosity','变温黏度：落球终速与温度','thermal',
 'temperature_C|液体温度|°C;terminal_speed_mm_s|落球终端速度|mm/s',
 'radius_mm|小球半径|mm|0.2;density_difference|球液密度差|kg/m³|6500;gravity_m_s2|重力加速度|m/s²|9.81',
 'η=2Δρgr²/(9v)；lnη≈A+B/T','经验温度系数B','K','落球黏度装置；恒温水浴；温度计与计时装置',
 '各温度均满足低雷诺数与终速条件；球尺寸和密度差可比；容器壁修正及实际液温已讨论',
 '恒温后测两段落球终速；各温度计算黏度并保留原值；拟合lnη对1/T，限定经验温区',
 '从终速得到各温度黏度，再拟合其对数与绝对温度倒数；B为经验系数，不自动等于普适材料常数。','升温后终速增加，斯托克斯模型是否还适用？','终速通道增益偏大 4%')

# Electrical measurement and characteristic curves.
add('wheatstone','惠斯通电桥：平衡法测电阻','electricity',
 'R1_ohm|比例臂R1|Ω;R2_ohm|比例臂R2|Ω;R3_ohm|已知桥臂R3|Ω;null_mV|平衡零位电压|mV',
 'null_tolerance_mV|平衡容差|mV|0.1','R1/R2=R3/Rx；Rx=R2R3/R1','被测电阻','Ω','电阻箱；检流计；低压电源',
 '桥臂位置按页面公式对应；检流零位达到填写容差；接触及导线电阻影响已核查',
 '记录四桥臂的接线位置；改变倍率臂多次调零；由平衡关系计算Rx并讨论灵敏度',
 '满足零位容差后，逐组计算 R2×R3/R1；未平衡时拒绝套用平衡公式。','指针不动是否可能是检流计不够灵敏？','已知桥臂R3标定偏大 4%')
add('potentiometer','电位差计：补偿法测电动势','electricity',
 'standard_length_mm|标准电池平衡长度|mm;unknown_length_mm|未知电池平衡长度|mm',
 'standard_emf_V|标准电池电动势|V|1.0186','Ex=Es Lx/Ls','未知电动势','V','电位差计；标准电池；检流计与工作电源',
 '平衡时被测电池支路无电流；标准和未知测量使用相同工作电流；电位线单位长度电阻均匀',
 '以标准电池校准工作电流；记录未知电池的补偿长度；交替测标准与未知并核对漂移',
 '逐组按标准电动势乘两平衡长度之比计算，不把有负载端电压当电动势。','校准后工作电流漂移会怎样影响未知测量？','未知平衡长度读数偏大 4%')
add('meter_conversion','电表改装与校正：分流与串联电阻','electricity',
 'reference_mA|参考电流|mA;indicated_mA|改装表指示电流|mA',
 'movement_fullscale_uA|表头满偏电流|μA|100;movement_resistance_ohm|表头内阻|Ω|1000;ammeter_range_mA|目标电流量程|mA|10;voltmeter_range_V|目标电压量程|V|10',
 'R分流=IgRg/(I量程−Ig)；R串联=U量程/Ig−Rg','改装表读数增益','1','微安表头；电阻箱；参考表及低压电源',
 '表头内阻与满偏电流已实测；改装量程高于原量程；校正点覆盖新量程且不过载',
 '先确定表头参数并计算扩大量程电阻；断电接线后逐点与参考表比较；拟合显示增益和截距，复查回程',
 '显示值对参考值带截距拟合；设计电阻另按表头实测参数计算。','电阻设计正确，是否就不需要读数校正？','改装表读数增益偏大 4%')
add('meter_resistance','电表内阻：端电压与电流','electricity','current_mA|表头电流|mA;terminal_V|表头端电压|V','',
 'U=Rg I+b','表头内阻','Ω','表头；参考电压表；限流低压电源',
 '电流不超过表头量程；电压表输入负载已讨论；温度与接触条件稳定',
 '先设置限流并检查表头规格；配对读端电压和电流；拟合斜率并与其他内阻测量方法比较',
 '电流mA转A，端电压对电流的斜率为Ω。','把半偏法的电阻直接当内阻，需要什么负载条件？','端电压增益偏大 4%')
add('diode','二极管与非线性电阻：正向伏安曲线','electricity','forward_V|正向电压|V;current_mA|正向电流|mA',
 'temperature_K|结温估计|K|300','I≈Is exp(eU/nkT)，I≫Is','指数段理想因子n','1','二极管；限流源；电流电压表',
 '仅拟合正向指数段且I≫Is；串联电阻压降相对小；温升与结温已核查',
 '限流逐点测伏安特性；选指数段并记录温度；对lnI与U拟合，比较原始曲线和残差',
 'ln(I/1mA)对U的斜率为e/(nkT)，由其倒数计算n；不覆盖反向击穿或高注入。','大电流段为什么不能继续套用同一指数关系？','增加随电流上升的串联压降')
add('thermistor','NTC热敏电阻与半导体温度计','electricity','temperature_C|恒温温度|°C;resistance_ohm|热敏电阻|Ω','',
 'lnR=A+B/TK','热敏参数B','K','热敏电阻；恒温水浴；参考温度计与电阻表',
 '使用NTC且温区内近似B模型；测量电流引起的自热可忽略；温度与电阻在稳定后配对',
 '恒温后测各点电阻；转开尔文并拟合lnR对1/T；保留残差，用独立温度点检查温度计设计',
 '摄氏温度加273.15，拟合lnR对其倒数；斜率即经验B。','常数B模型能否跨很宽温区直接使用？','高温点出现额外自热偏差')
add('unbalanced_bridge','非平衡电桥：小电阻变化与灵敏度','electricity',
 'delta_resistance_ohm|单桥臂电阻变化|Ω;bridge_output_mV|差分输出|mV',
 'arm_resistance_ohm|平衡时各桥臂电阻|Ω|1000;excitation_V|桥路激励|V|5',
 'U输出≈U激励 ΔR/(4R)','小信号灵敏度','mV/Ω','四电阻桥；激励源；差分电压表',
 '初始为等阻平衡桥；单桥臂变化不超过2%；差分输出符号按接线约定',
 '先记录初始平衡零位；改变一桥臂的小电阻量；拟合输出并与一阶模型灵敏度比较',
 '拟合输出mV对ΔR(Ω)；理论一阶灵敏度为1000U/(4R)。','偏离平衡越来越远，线性近似会怎样失效？','输出放大链增益偏大 4%')
add('hall_effect','霍尔效应：消偏电压与霍尔系数','modern',
 'current_mA|样品电流大小|mA;field_mT|磁场大小|mT;hall_mV|反向消偏后霍尔电压大小|mV',
 'thickness_mm|样品厚度|mm|0.5','|VH|=|RH| I B/d','霍尔系数绝对值','m³/C','霍尔元件；恒流源；磁场和微电压测量',
 '输入已用电流及磁场反向消偏的幅值；样品厚度已测；磁场及温度在每点稳定',
 '记录四种极性原始电压；消除不等位等背景后配对I、B与VH；以IB拟合VH并另按符号判断载流子类型',
 '电流mA和磁场mT转SI，VH转V；斜率乘厚度m得到|RH|。','为什么仅用正向一次电压难以排除不等位电势？','样品厚度被低估 5%')
add('helmholtz','亥姆霍兹线圈：轴向磁场分布','electricity','axial_m|离线圈对中心的轴向位置|m;field_mT|轴向磁场|mT',
 'coil_radius_m|线圈半径及线圈间距|m|0.15;current_A|线圈电流|A|0.5',
 'B(z)=Nμ0IR²/2×[(R²+(z−R/2)²)^−3/2+(R²+(z+R/2)²)^−3/2]','拟合有效匝数','匝',
 '亥姆霍兹线圈对；霍尔探头；恒流源与位置尺',
 '同半径同匝数且间距等于半径；两线圈同向同电流；探头方向与中心位置已校准',
 '量线圈几何和电流；扫描中心两侧的轴向磁场；用线圈对模型系数拟合并观察中心均匀区',
 '每个轴向位置计算单匝线圈对的场系数，再以磁场拟合有效匝数。','把间距设成两倍半径，还能称为同一均匀区条件吗？','磁场探头增益偏大 4%')
add('rlc_series','RLC串联谐振：幅频、相频与Q','electricity',
 'frequency_Hz|源频率|Hz;current_mA|电流有效值|mA;phase_deg|电流相对源相位|°',
 'inductance_mH|电感|mH|10;capacitance_uF|电容|μF|1;resistance_ohm|总串联电阻|Ω|20',
 'f0=1/(2π√LC)；Q≈f峰/(f2−f1)','采样谐振频率','Hz','RLC串联回路；信号源；示波器与电流采样',
 '频率扫描包住峰两侧；源有效电压在扫描中稳定；电阻包括源与电感损耗',
 '记录元件参数和源幅度；扫频采集电流及相位；定位峰并在两个半功率点加密',
 '峰位置从采样最大值取；半功率频率由相邻读数插值，不足两个交点则不报告Q。','电流峰值是否一定落在你的采样频率上？','电容实际值与填写值偏离 10%')
add('hysteresis','磁滞回线：磁化、矫顽与每周期损耗','electricity','field_A_m|磁场强度H|A/m;flux_T|磁感应强度B|T','',
 '单位体积每周期损耗=|∮H dB|','磁损耗密度','J/m³','铁磁环或磁化装置；示波器；H和B测量链',
 '按顺序记录完整闭合回线；H与B标定及相位链核对；驱动频率和样品温度记录完整',
 '校准积分链和探头；同步采集一个稳态周期；保持方向作图积分并找零B交点',
 '逐段梯形积分H dB；不排序、不自动补闭合；零B交点用线性插值。','积分器漂移和通道相位差会怎样改变面积？','B通道增益偏大 4%')
add('curie_temperature','铁磁材料：磁性消失与居里温度估计','electricity','temperature_C|样品温度|°C;remanence_mT|同一测量条件剩磁|mT',
 'remaining_fraction|相对低温最大值的判据|1|0.1','按填写剩磁比例插值转变温度','判据定义的转变温度','°C','温控磁性装置；温度探头；磁场测量链',
 '使用同一剩磁测量程序；升降温足够慢且实际样品温度已测；记录背景和磁性消失判据',
 '说明温度及剩磁标定；扫描经过磁性消失区域；按判据插值并比较升降温和不同判据',
 '按最大剩磁的指定比例找交点；该估计依赖判据，不能自动等同精确热力学Tc。','换一个“磁性消失”阈值，估计温度会变吗？','温度零位偏高 5°C')
add('electrostatic_field','模拟静电场：二维电势与梯度','electricity',
 'x_cm|网格x坐标|cm;y_cm|网格y坐标|cm;potential_V|电势|V','',
 'E=−∇V；矩形网格差分','网格场强大小均值','V/m','导电介质模拟板；低压源；高阻电压表与坐标纸',
 '完整矩形网格且坐标不重复；测量不显著加载模拟场；边界电极和参考电势明确',
 '记录电极边界与参考零位；按网格测电势并保留坐标；绘制电势图并计算内部与边界差分',
 '内部中心差分、边界单边差分；报告所有网格局部场强大小的均值。','等势线密集处与场强大小有什么关系？','额外二次电势项使场不再均匀')
add('photoresistor','光敏电阻：照度与非线性响应','electricity','illuminance_lux|照度|lx;resistance_ohm|光敏电阻|Ω','',
 'R≈A E^−γ','经验照度指数γ','1','光敏电阻；稳定光源；照度计和电阻表',
 '照度与电阻同步稳定；光谱和几何在各点可比；限定温区和照度区间',
 '先记录暗场与环境；改变照度测电阻；作双对数图并讨论响应滞后和温升',
 'lnR对lnE做负斜率拟合，γ取斜率相反数。','同样lx但光源光谱不同，电阻会一定相同吗？','高照度端混入不同的响应指数')
add('solar_cell','硅光电池与太阳能电池：伏安和功率','electricity','voltage_V|负载电压|V;current_mA|输出电流|mA','',
 'P=UI；FF=P最大/(U开路I短路)','采样最大输出功率','mW','硅光电池；稳定光源；可调负载和电压电流表',
 '扫描包括短路与开路点；照明和温度在扫描中保持可比；入射光功率未经测量时不计算转换效率',
 '固定照明和温度；改变负载采集全曲线；计算功率与填充因子并加密峰附近',
 'U(V)×I(mA)为mW；取采样最大值并用端点计算填充因子。','只知道照度lx，能否直接得到光电能量效率？','电流显示增益偏大 4%')
add('magnetoresistance','磁阻效应与磁阻传感器','modern','field_T|磁场大小|T;resistance_ohm|电阻|Ω',
 'zero_field_resistance|独立测得零场电阻|Ω|100','(R−R0)/R0≈βB²','二次磁阻系数β','1/T²','磁阻样品；磁场源；电阻与磁场计',
 '只使用适合二次近似的磁场区间；温度和样品方向稳定；R0独立测量且电流自热可忽略',
 '记录零场电阻和方向；逐场测阻并做正反场对照；拟合相对变化对B²并讨论偏离',
 '先按实测R0归一化，带截距拟合相对电阻变化与B²。','电阻温升与磁阻响应怎样分辨？','磁场标定增益偏大 4%')
add('strain_gauge','电阻应变片与电子秤：应变响应','electricity','microstrain|已知应变|με;delta_resistance_mohm|电阻变化|mΩ',
 'baseline_resistance_ohm|零应变电阻|Ω|120','ΔR/R0=K ε','应变片灵敏系数','1','应变梁及加载装置；电桥；参考应变测量',
 '应变在弹性小形变范围；粘贴方向与被测主应变一致；温度补偿及零应变电阻已记',
 '记录安装与温度补偿；逐级加载得到参考应变及电阻变化；拟合灵敏系数并做卸载回程',
 'με乘10⁻⁶，mΩ转Ω；相对电阻变化对无量纲应变的斜率为K。','称重校准后换一根梁，能直接沿用同一关系吗？','电阻变化增益偏大 4%')
add('temperature_sensor','温度传感器：标定与半导体温度计设计','electricity',
 'temperature_C|参考温度|°C;output_mV|输出电压|mV','',
 'U≈S T+b（限定标定温区）','温度灵敏度','mV/K','温度传感器；参考温度计；恒温装置与电压表',
 '参考温度计具有可追溯标定；温区内允许线性近似；达到热平衡后同步读取',
 '说明传感器类型和范围；恒温逐点记录输出；拟合增益零位，用未参与拟合的点检验设计',
 '输出mV对参考°C拟合；温差°C与K数值相同，零位不能省略。','参考温度计的偏差会不会进入你设计的温度计？','输出增益偏大 4%')
add('rectifier','整流滤波电路：直流、纹波与波形','electricity','time_s|采样时刻|s;voltage_V|输出电压|V','',
 '纹波系数=交流分量有效值/平均直流电压','纹波系数','1','低压交流源；整流滤波教学板；示波器',
 '仅用隔离低压教学电路；分析窗覆盖足够纹波周期；负载、探头耦合和电容已记录',
 '比较整流前后与滤波后波形；保存DC耦合完整数据；按同一窗口算直流与交流有效值',
 '先算均值，再算去均值有效值，两者相除；峰峰纹波不能直接等同有效值。','只测峰峰值，可否不用波形形状就算纹波系数？','输出里混入较低频调制')
add('magnetic_pendulum','小磁针简谐振动：磁矩与周期','electricity','field_uT|总水平磁场|μT;period_s|小角周期|s',
 'inertia_kg_m2|磁针转动惯量|kg·m²|0.00000001','T²=4π²J/(μB)','有效磁偶极矩','A·m²','小磁针摆；磁场测量；计时器',
 '小角扭转且转轴固定；输入包含地磁贡献的总水平场；转动惯量已独立测定',
 '量总磁场和磁针惯量；多周期计时并换算周期；拟合T²对1/B且检查阻尼',
 'μT转T后取倒数，T²斜率为4π²J/μ。','只填线圈场而遗漏地磁场会怎样影响拟合？','填写惯量偏大 4%')
add('wireless_power','无线输电：线圈距离与功率传输','electricity',
 'distance_cm|线圈间距|cm;input_W|同步输入电功率|W;received_W|负载接收电功率|W',
 'frequency_kHz|工作频率|kHz|100','η=P负载/P输入','采样最大传输比例','%',
 '低压无线供电教学装置；功率测量；可调线圈间距',
 '输入输出功率同步且定义一致；记录频率、负载与谐振设置；线圈轴线与偏移角可比',
 '固定工作频率与负载；逐距测输入和接收功率；画效率随距离，复查不对中与测量相位',
 '各距同步电功率之比乘100%，报告采样最大值。','用U有效值乘I有效值一定等于交流有功功率吗？','接收功率标定偏大 4%')
add('fuel_cell','燃料电池综合特性：极化与功率','electricity','current_A|负载电流|A;terminal_V|端电压|V','',
 'P=UI','采样最大电功率','W','低压燃料电池教学模块；负载；电压电流测量',
 '按装置规范保持供气和温度；各点等待稳态；未记燃料流量时不认证效率',
 '记录供给、温度和负载设置；扫描极化曲线；计算功率并讨论不同区域的压降',
 '逐点U×I得到W，报告所测工作点最大值；效率还需燃料能量。','极化曲线下降的几段是否一定是同一种损耗？','电流通道增益偏大 4%')
add('railgun','电磁炮原理：低能教学脉冲的能量记录','electricity',
 'time_ms|同步采样时刻|ms;current_A|输入电流|A;voltage_V|输入电压|V',
 'projectile_mass_g|运动体质量|g|1;exit_speed_m_s|实测末速|m/s|2',
 'W电=∫UI dt；K=mv²/2','窗口电能到动能的比例','%',
 '实验室低能教学演示装置；同步采集；测速与称量装置',
 '由实验室指导操作既有低能教学装置；记录窗包含完整输入脉冲；末速和质量来自独立测量',
 '记录既有装置与采样同步信息；采完整U、I脉冲及末速；积分输入能量，比较动能及未计损耗',
 'ms转s，梯形积分UI；动能除窗口电能，不据此设计或扩大发射能力。','如果只记录脉冲一半，能量比例会怎样偏离？','电流采样增益偏大 4%')

# Optical instruments, coherent recording and imaging.
add('prism_angle','分光计调整与三棱镜顶角','optics','double_angle_deg|两个镜面反射方向差|°','',
 'A=两反射方向差/2','棱镜顶角','°','分光计；三棱镜；平行光源',
 '两反射面已辨认且望远镜调焦；两游标共同消偏；读数差已正确处理跨0°',
 '完成自准直和载物台调平；分别读两个面反射光方向；用两游标差求顶角并重复',
 '输入处理好跨零的反射方向差，逐组除以2再平均。','为什么要同时读两个相差180°的游标？','反射方向差读数偏大 4%')
add('prism_refraction','分光计：最小偏向角法测折射率','optics','minimum_deviation_deg|最小偏向角|°',
 'apex_deg|实测棱镜顶角|°|60','n=sin((A+δmin)/2)/sin(A/2)','棱镜折射率','1',
 '分光计；棱镜；单色光',
 '使用已测顶角；光路处在最小偏向对称状态；波长及温度明确',
 '调整分光计并测顶角；旋转棱镜寻找真正最小偏向；重复角读数并计算n',
 '角度转弧度后使用棱镜最小偏向公式。','只找到一次偏向较小的读数，就能当最小偏向吗？','偏向角零位增加1°')
add('abbe_refractometer','阿贝折射仪：临界角与液体折射率','optics','critical_angle_deg|已换算的棱镜内临界角|°',
 'prism_index|测量棱镜在该波长的折射率|1|1.7','n液=n棱镜 sinθc','液体折射率','1',
 '阿贝折射仪；标准液；温度计',
 '使用仪器对应的棱镜内临界角定义；记录标准波长和温度；液体均匀且无气泡',
 '用标准液检查仪器；读明暗分界并消色差；按棱镜临界几何计算并记录温度',
 '临界角转弧度后，乘测量棱镜折射率；原始刻度需先按仪器说明换算。','明暗分界不清会如何影响折射率？','临界角零位增加0.5°')
add('lens_group','透镜组基点：等效焦距与主平面','optics',
 'f1_cm|第一薄透镜实测焦距|cm;f2_cm|第二薄透镜实测焦距|cm;separation_cm|两薄透镜间距|cm','',
 'F=f1f2/(f1+f2−d)','透镜组等效焦距','cm','两片薄透镜；光具座；物屏与长度尺',
 '近轴两薄透镜且光轴共线；间距定义为薄透镜平面间距；本页只处理正等效焦距',
 '先独立测两透镜焦距；记录组合间距并对光轴；计算F及主平面，再用组合成像核对',
 '由独立f1、f2及d计算等效焦距和主平面；镜片外表面不是自动等同主平面。','用镜片顶点量物距，为什么可能不符合薄透镜方程？','透镜间距标定偏大 4%')
add('lens_bessel','薄透镜焦距：贝塞尔位移法','optics',
 'object_screen_cm|固定物屏距离D|cm;lens_displacement_cm|两次清晰成像透镜位移d|cm','',
 'f=(D²−d²)/(4D)','焦距','cm','凸透镜；光具座；固定物屏',
 '物屏间距能给出两次清晰成像；使用薄透镜近轴近似；两次位置用同一机械基准',
 '固定物屏并确认两次成像；记录两透镜位置之差；重复不同D并用位移法计算',
 '逐组f=(D²−d²)/(4D)，D与d同用cm。','物屏距离接近4f时，两个位置如何影响精度？','透镜位移读数偏大 4%')
add('fresnel_biprism','菲涅耳双棱镜：虚光源干涉','optics','order|亮纹级次|1;position_mm|亮纹位置|mm',
 'virtual_separation_mm|实测虚光源间距|mm|0.5;screen_distance_m|虚光源到屏距离|m|1',
 'Δx=λD/d虚','波长','nm','双棱镜；狭缝与单色源；屏尺与测虚像间距装置',
 '相干的两个虚光源已形成；d是虚光源间距而非棱镜尺寸；满足小角近轴条纹关系',
 '调整重叠区并独立测虚源间距；记录多个亮纹位置与级次；由条纹斜率换算波长',
 '位置mm对级次的斜率是条纹间距；配合虚源间距mm和D(m)换算nm。','虚光源间距应怎样独立测量，为什么不能凭棱镜尺寸猜？','虚源间距低估 5%')
add('grating_characteristics','光栅特性：线密度、角色散和分辨','optics',
 'wavelength_nm|已知谱线波长|nm;angle_deg|同级正侧衍射角|°',
 'order|同一衍射级次|1|1;illuminated_width_mm|照亮光栅宽度|mm|10','d sinθ=mλ；Dθ=m/(d cosθ)','光栅线密度','线/mm',
 '分光计；光栅；已知谱线光源',
 '垂直入射且各谱线使用同一级次；角度为单侧衍射角；照明宽度和有效缝数记录完整',
 '用已知谱线校光栅；以sinθ拟合波长得到线密度；另看角色散及相邻谱线的分辨限制',
 'sinθ对λ(nm)斜率乘10⁶/m得到线/mm；分辨本领mN仅为理想几何估计。','照亮缝数与角色散分别决定什么？','衍射角零位增加0.5°')
add('wire_diffraction','细丝直径：巴比涅衍射法','optics','dark_order|正侧暗纹级次|1;dark_angle_deg|暗纹衍射角|°',
 'wavelength_nm|独立已知光源波长|nm|632.8','a sinθ=mλ','细丝直径','μm','细丝；单色光源；屏和距离尺',
 '细丝近似均匀且垂直光束；衍射远场近似；正侧暗纹级次已核对',
 '记录波长和观察几何；多级暗纹位置换成角度；拟合sinθ对级次并用测微器复查',
 'sinθ–m斜率为λ/a；波长nm乘0.001再除斜率得到μm。','细丝衍射与等宽狭缝的暗纹为什么对应？','填写光源波长偏大 4%')
add('optical_flatness','工件平整度：反射等厚干涉','optics',
 'fringe_spacing_mm|局部条纹间距|mm;fringe_bend_mm|相对参考条纹弯曲量|mm',
 'wavelength_nm|单色光波长|nm|589.3','局部高度差=λ/2×条纹弯曲量/条纹间距','采样最大相对高度','nm',
 '参考平晶；单色源；条纹成像与标尺',
 '参考面及波长已知；局部条纹间距可辨认；采用反射双程空气膜近似',
 '保持工件与参考平晶清洁；测量局部条纹弯曲和间距；换算高度并明确覆盖区域',
 '条纹弯曲比例乘λ/2得到nm，报告已采样区域最大值。','只看几条直条纹就能认证整个表面吗？','条纹弯曲量读数偏大 4%')
add('diffraction_intensity','单缝衍射：光强扫描与暗纹识别','optics','position_mm|屏位置|mm;intensity|扣除背景的光强|1',
 'wavelength_nm|光源波长|nm|632.8;screen_distance_m|单缝到屏距离|m|1','I∝(sinβ/β)²；a sinθ1=λ','第一暗纹估计缝宽','mm',
 '单缝和单色源；光电探测器；扫描尺',
 '记录中央峰和正侧第一极小；探测器在线性范围内；背景、步进和屏距明确',
 '先测暗场并调中轴；以相同增益扫过主峰和至少第一旁瓣；手动核对极小再比较缝宽',
 '从扫描识别中央峰及正侧首个局部极小，按sin(arctan(y/D))计算缝宽；步进与噪声限制精度。','小噪声产生的局部谷值一定是第一暗纹吗？','扫描位置刻度偏大 4%')
add('holography','全息照相：记录几何与条纹分辨','optics','beam_angle_deg|物光与参考光夹角|°;fringe_pitch_um|记录条纹间距|μm','',
 'p=λ/(2 sin(夹角/2))','记录几何估计波长','nm',
 '相干光源；全息教学光路；记录介质与条纹观察',
 '夹角定义和条纹间距标定一致；光路相干且曝光时稳定；再现观察另留照片和参数',
 '说明物光、参考光和记录角；测条纹间距并核对介质分辨能力；保存曝光与再现图像及振动观察',
 '以2sin(夹角/2)拟合条纹间距倒数；倒数斜率得到波长。此数据处理不代替曝光再现。','记录角越大，记录介质需要分辨怎样的条纹？','条纹间距标定偏大 4%')
add('infrared_radiation','红外与热辐射：净辐射功率关系','optics','temperature_K|物体绝对温度|K;net_power_mW|已扣背景的总辐射功率|mW',
 'ambient_K|环境绝对温度|K|293.15;area_m2|已校正视因子的有效面积|m²|0.0001',
 'P净=εσA(T⁴−T环境⁴)','有效发射率','1','总辐射探测装置；温度计；标定面积与几何',
 '探测器能测校准后的总辐射功率；有效面积与视因子已核对；发射率在温区内近似不变',
 '测背景与探测器响应；恒温后测净功率；以T⁴差拟合并讨论窄带仪器的区别',
 'mW转W，拟合净功率对T⁴−T环境⁴，斜率除σA。','窄带红外相机输出为什么不能直接套总辐射T⁴关系？','净功率增益偏大 4%')
add('thermal_imaging','红外扫描成像：标定与区域比较','optics','reference_C|区域参考温度|°C;detector_count|背景修正平均计数|count','',
 '限定温区：计数≈S T+b','局部响应灵敏度','count/K','红外相机或扫描探测器；参考温度源；成像记录',
 '只在已验证的窄标定温区使用线性响应；温度源发射率与背景一致；区域、距离和焦点固定',
 '保存原始图像及对应ROI；逐温度记录区域平均输出；标定后在独立温度点检验，讨论空间分辨',
 '以区域计数对参考温度拟合局部灵敏度；不直接给未校准图像认证真实温度。','背景反射变化会怎样影响热像？','计数输出增益偏大 4%')
add('astronomical_imaging','天文光学与CCD数字成像：暗场校准','optics','exposure_s|曝光时间|s;dark_count|同温暗场平均计数|count',
 'pixel_pitch_um|像元尺寸|μm|5','暗场计数≈偏置+暗电流计数率×曝光','暗场增长率','count/s',
 'CCD或CMOS相机；遮光盖；成像软件',
 '增益和芯片温度固定；无光且未饱和；保存同设置的偏置、暗场、平场与星像',
 '采集多曝光暗场并注明像元区域；拟合暗场增长率；在天体图像处理中核查平场、饱和与角尺度',
 '暗场平均计数对曝光时间带截距拟合；暗场率不是恒星通量。','为什么把暗场均值减去后仍需平场？','曝光时间刻度偏大 4%')
add('color_design','色彩设计：sRGB混色与相对亮度','optics','red|红通道码值|0–255;green|绿通道码值|0–255;blue|蓝通道码值|0–255','',
 '解码sRGB后：Y=0.2126R线性+0.7152G线性+0.0722B线性','颜色样本相对亮度均值','1',
 'sRGB图像或显示器；颜色记录；可选标定色度计',
 '输入为标准sRGB码值；颜色不能仅凭未标定屏幕认证；码值与线性光强有不同含义',
 '记录RGB编码和显示条件；分别解码三通道再求相对亮度；比较码值平均与线性平均的差别',
 '先按sRGB分段传递函数解码，再加权得到Y；这是编码理论计算。','红绿蓝相同码值是否有相同亮度贡献？','红通道零位低估20码值')
add('optical_cloaking','光学隐身演示：视场与目标对比度','optics',
 'view_angle_deg|观察角|°;reference_contrast|无装置目标对比度|1;cloak_contrast|有装置目标对比度|1','',
 '可见对比度比例=C装置/C基准','平均可见对比度比例','%',
 '有限视场光学演示装置；目标与背景；相机',
 '有无装置采用同一曝光和背景；对比度提取定义一致；不能把有限视场演示当普遍隐身',
 '保存有无装置的同条件图像；改变观察角并提取目标对比度；比较遮挡、背景透射和有效视场',
 '逐角比较对比度比例并平均；同时保留原图，不以比例代替完整视场检验。','目标对比度下降是否只是因为装置遮住了背景？','装置图像对比度提取增益偏大 4%')
add('stereo_display','裸眼3D显示：视差与深度几何','optics','depth_m|校正物体深度|m;parallax_mm|校正双视点视差|mm',
 'focal_length_mm|成像焦距|mm|50','d=fB/Z','几何基线估计','mm',
 '双视点成像或裸眼3D演示；标尺；位置可控目标',
 '平行且校正过的双视点几何；像面视差长度定义一致；零视差面及观察位置明确',
 '记录几何与像面尺度；逐深度取双视点视差；拟合视差对深度倒数并讨论串扰与视场',
 '深度m转mm，拟合d对1/Z，斜率除f得到基线mm。','屏幕上的像素视差如何转成这里填写的mm？','视差长度标定偏大 4%')
add('white_light_interference','白光干涉：包络定位与台阶高度','optics',
 'envelope_order|重复测量序号|1;mirror_shift_um|两个反射面包络的镜面位移差|μm',
 'known_step_nm|用于对照的已知台阶|nm|500','反射：2h=2Δz，因此h=Δz','台阶高度','nm',
 '白光干涉教学装置；台阶样品；扫描和图像记录',
 '使用相同方向扫描的零光程差包络；两个表面和包络已独立辨认；扫描传动比与回程已校准',
 '保存完整扫描包络；分别定位两个表面的包络中心；重复位移差并和已知台阶对照',
 '反射双程同时出现在台阶和扫描两端，h=镜面位移差；μm转nm后平均。','包络中心和单色干涉亮纹级次有什么不同？','位移差标定偏大 4%')

add('doppler','声波多普勒：低速反射频移','waves','radial_speed_m_s|目标径向速度|m/s;frequency_shift_Hz|反射频移大小|Hz',
 'source_Hz|源频率|Hz|40000','低速反射：Δf≈2f0v/c','传播声速','m/s',
 '声波源及接收器；低速运动目标；速度与频率测量',
 '目标径向速度远小于声速；输入为反射法而非直接接收法；温湿度和径向方向记录完整',
 '独立测目标径向速度；配对测反射频移；拟合斜率并核查两倍频移和有限速度修正',
 '频移对速度斜率≈2f0/c，取倒数换算声速。','将直接接收法和反射法混用会出现什么因子？','径向速度标定偏大 4%')
add('acoustic_levitation','声悬浮：节点位置与稳定性观察','waves','node_order|相邻节点序号|1;node_position_mm|节点位置|mm',
 'frequency_kHz|声频率|kHz|40','相邻节点间距=λ/2；c=fλ','节点间距估计声速','m/s',
 '教学超声悬浮装置；位置尺；频率记录',
 '同一轴向模式的相邻节点；频率与环境条件稳定；节点间距不能单独证明悬浮力足够',
 '记录频率、颗粒和工作位置；测相邻节点并观察稳定范围；用节点间距核声速，另记悬浮与失稳照片',
 '节点位置对序号斜率乘2得到λ，再乘频率；mm转m。','节点存在就一定能悬浮任意大小颗粒吗？','节点位置刻度偏大 4%')
add('ultrasonic_echo','超声定位与形貌：回波时间标定','waves',
 'known_depth_mm|已知反射面深度|mm;echo_time_us|往返回波时延|μs','',
 't回波=2d/c+t延迟','介质声速','m/s','超声探头；已知深度目标；时延采集',
 '同一介质和温度；明确往返而非单程时间；记录触发延迟和回波级次',
 '用已知深度目标标定；配对记录首个对应回波；拟合时延对深度，成像时另保留扫描坐标与回波',
 '时延μs对深度mm的斜率为2000/c，截距保留触发延迟。','第二次回波被当第一次，会怎样影响深度？','深度标尺偏大 4%')
add('double_grating','双光栅测微振动：同类事件与频率','waves',
 'event_order|同类光学事件累计序号|1;event_time_ms|事件时刻|ms',
 'events_per_cycle|已独立核对的每振动周期事件数|1|2','f=1/(每周期事件数×事件间隔)','微振动频率','Hz',
 '双光栅教学装置；光电探测；同步振动参照',
 '只比较同类同相位事件；每周期事件数独立核对；光栅与探测带宽足够',
 '记录光栅几何和事件规则；多次记录同类事件时刻；拟合间隔求频率，幅度需另留相位或条纹计数',
 '事件时刻ms对序号的斜率为事件间隔，除以每周期事件数后换算Hz。','为什么一次过亮纹不一定就是一个完整振动周期？','记录时间增益偏大 4%')
add('chaos','非线性电路与混沌：时域、相图及复查','modern','time_s|时刻|s;x_V|同步x通道|V;y_V|同步y通道|V','',
 '保留同步时域、相图和峰值返回图；σ仅描述波动','x信号样本标准差','V',
 '低压非线性电路；双通道示波器；参数扫描记录',
 '同步采样且无明显削顶；参数和初值记录可复查；复杂曲线不自动判定为混沌',
 '记录元件和可控参数；采同步时域并绘相图、返回图；补参数扫描与初值试验，排除噪声和采样假象',
 '样本标准差仅为描述量；返回图不等于李雅普诺夫指数或混沌认证。','噪声、拍频和混沌怎样通过重复与扫描区分？','x通道测量增益偏大 4%')

# Modern experiments use instrument-derived observables with explicit limitations.
add('millikan','密立根油滴：黏性修正与电荷量子化','modern',
 'fall_speed_mm_s|无场终端下降速度|mm/s;balance_voltage_V|静态平衡电压大小|V;charge_number|独立提出的整数电荷数|1',
 'air_viscosity|空气黏度|Pa·s|0.0000183;density_difference|油滴与空气密度差|kg/m³|981;gravity_m_s2|重力加速度|m/s²|9.8;plate_gap_mm|极板间距|mm|5;pressure_Pa|气压|Pa|101300;slip_constant_Pa_m|黏性修正常数b|Pa·m|0.00822',
 'r0=√(9ηv/(2Δρg))；q=6πηvr0d/[U(1+b/(pr0))^(3/2)]','拟合基本电荷','C',
 '油滴教学仪；速度与电压读数；气压和温度记录',
 '无场下降达到终速且加场时静止平衡；黏性、气压和间距独立记录；整数电荷数由学生提出并论证',
 '记录同一油滴的终速与平衡电压；加入黏性修正计算电荷；独立讨论整数电荷数，再拟合q对n',
 '静态平衡法使用r0与(1+b/pr0)的3/2修正；q对独立n的斜率估计e，不自动用已知e给n取整。','如果先用已知e给每个q取整，再拟合e，验证是否循环？','平衡电压显示增益偏大 4%')
add('electron_em','电子荷质比：磁场中的电子束','modern',
 'accelerating_V|加速电压|V;coil_current_A|线圈电流|A;orbit_radius_mm|轨道半径|mm',
 'coil_radius_m|亥姆霍兹线圈半径|m|0.15;turns|每个线圈匝数|匝|130',
 'e/m=2U/(B²r²)，B=(4/5)^(3/2)μ0NI/R','电子荷质比','C/kg',
 '电子束教学仪；亥姆霍兹线圈；电压电流和半径读数',
 '电子束近似垂直均匀磁场；半径不是直径；线圈几何和加速电压已核查',
 '记录线圈几何与地磁影响；多组配对读U、I和束半径；逐组计算荷质比并讨论半径误差',
 '半径mm转m，用线圈模型求B，逐组2U/(B²r²)后平均。','轨道直径被当半径会导致怎样的倍数偏差？','轨道半径标定偏大 4%')
add('franck_hertz','弗兰克—赫兹：峰位与激发能','modern',
 'peak_order|独立辨認的峰级次|1;peak_voltage_V|峰位加速电压|V','',
 'U峰≈n ΔU+接触电势；激发能/e=ΔU','第一激发能','eV',
 '弗兰克—赫兹教学仪；加速电压及电流曲线；温度记录',
 '已保存完整电流电压曲线并正确辨峰；同一管种和温度状态；未混入跳峰或不同激发过程',
 '保存完整曲线和控制电压；识别多个相邻峰位并标级次；用带截距拟合和逐差对照激发间隔',
 '峰位V对级次的斜率是电压间隔；以eV报告电子能量时数值相同，截距不强制为零。','首个峰为什么不一定出现在第一激发电压数值上？','把跳过一个峰的后续级次当连续')
add('hydrogen_spectrum','氢原子光谱：巴耳末系与里德伯常数','modern',
 'upper_n|已辨认的上能级n|1;wavelength_nm|巴耳末谱线波长|nm','',
 '1/λ=RH(1/2²−1/n²)','氢原子里德伯常数','1/m',
 '氢光谱源；光谱仪或分光计；波长校准源',
 '正确辨认巴耳末系且n>2；波长标定与空气/真空约定明确；区分氢常数和无限核质量常数',
 '用参考谱线标定波长；记录氢各线波长并独立配能级；拟合倒波长对量子数因子',
 'nm转m后取倒数，拟合1/λ对1/4−1/n²；斜率为RH。','直接把其他元素谱线也标成氢的能级会怎样？','波长标尺增益偏大 4%')
add('thermionic_work_function','热电子发射：金属电子逸出功','modern',
 'temperature_K|阴极绝对温度|K;saturation_current_A|热发射饱和电流|A','',
 'I/T²=A exp(−W/kT)','热发射模型逸出功','eV',
 '热电子教学仪；温度测量；真空及微电流记录',
 '使用饱和发射段而非空间电荷受限段；阴极有效温度已校准；温区内发射面积和背景可比',
 '确认真空和温度标定；取得不同温度下饱和电流；拟合ln(I/T²)对1/T并讨论场致修正',
 '带截距负斜率为−W/k，乘−k/e以eV表达；不能把加热电流当阴极温度。','温度的少量系统误差为什么特别影响逸出功？','温度标定增益偏大 2%')
add('nuclear_magnetic_resonance','核磁共振：共振频率与磁场','modern',
 'field_mT|磁场|mT;frequency_MHz|共振频率|MHz','',
 'f=(γ/2π)B','旋磁比γ/(2π)','MHz/T',
 '核磁共振教学仪；射频源；磁场标定',
 '同一核种和样品；磁场近似均匀且实际场已测；共振峰与射频链背景独立核对',
 '注明核种和磁场标定；逐磁场测共振中心频率；拟合f对B并讨论谱宽和扫场滞后',
 'mT转T，以MHz对T的斜率报告γ/(2π)，不是γ本身。','为什么旋磁比γ与γ/(2π)的单位和数值不同？','磁场标定低估 4%')
add('zeeman','塞曼效应：谱线分裂与磁矩','modern',
 'field_T|磁感应强度|T;single_shift_GHz|中心到单个σ分量的频移|GHz',
 'lande_factor|对应跃迁的有效g因子|1|1','Δf=g μB B/h（中心到单分量）','玻尔磁子估计','J/T',
 '塞曼教学装置；高分辨干涉或光谱；磁场计',
 '谱线和跃迁g因子已辨认；输入单分量频移不是两侧总分裂；偏振及观测方向有记录',
 '观察不同方向及偏振的分裂；把干涉读数独立换成频移；拟合频移对B并核对g因子',
 'GHz转Hz，斜率乘h/g得到J/T；异常塞曼不能无条件取g=1。','把两侧σ之间间隔当中心到单σ会差多少？','把两侧总分裂误填为单分量频移')
add('nuclear_counts','原子核物理：计数统计与本底','modern','gate_s|计数窗长度|s;counts|累计计数|count',
 'background_counts|独立本底累计计数|count|60;background_gate_s|本底计数时间|s|60',
 'r净=N/t−N背景/t背景','净计数率均值','1/s',
 '实验室既有核计数教学仪；本底记录；计数窗控制',
 '实验室按既定规程管理装置；计数未受明显死时间损失；本底独立记录且稳定',
 '先保存本底计数及时间；使用独立窗口重复计数；扣本底并分别讨论泊松统计与共同本底项',
 '各窗计数率扣相同本底率；泊松项和共同本底项分别传播，不凭计数波动判定新信号。','共同本底的不确定度能随着样本数一起除以√N吗？','本底时间被错误放大10%')
add('nuclear_decay','原子核物理：衰减与半衰期','modern','elapsed_s|经过时间|s;rate_cps|观测计数率|1/s',
 'background_cps|独立本底计数率|1/s|1','r净=A exp(−λt)；T半=ln2/λ','半衰期','s',
 '核衰减教学记录；计数仪；计时器',
 '单一指数衰减近似；本底和死时间已核查；各点计数窗足够短且相互可比',
 '记录本底与计数窗；逐时保存计数率及统计误差；扣本底后拟合对数并检查残差',
 '净计数率须为正，ln(r净)对t负斜率给λ，T半=−ln2/斜率。','低计数阶段忘记扣本底会怎样改变半衰期？','观测计数率额外增加0.5/s背景')
add('microwave_properties','微波光学性质：驻波、波长与传播','modern','node_order|相邻驻波节点序号|1;node_position_mm|节点位置|mm',
 'frequency_GHz|微波频率|GHz|10','相邻节点间距=λ/2；c=fλ','驻波估计传播速度','m/s',
 '微波教学源；接收器与反射板；导轨',
 '记录同一模式相邻节点；源频率独立核对；偏振和反射观察另记',
 '改变反射板并测节点；用同类节点间距求波长；另观察反射、折射和偏振，区别传播介质',
 '节点位置斜率乘2和源频率；mm转m，GHz乘10⁹。','驻波节点间距与波长为何相差二倍？','位置刻度增益偏大 4%')
add('microwave_bragg','微波布拉格衍射：模拟晶格','modern','order|反射级次|1;bragg_angle_deg|布拉格掠射角|°',
 'lattice_spacing_cm|模拟晶面间距|cm|5','2d sinθ=mλ','微波波长','cm',
 '微波分光教学装置；模拟晶格；角度尺',
 'θ为晶面掠射角而非接收方向总夹角；同一晶面间距；已正确辨认反射峰级次',
 '记录晶格方向和间距；扫描角度定位各峰；以sinθ拟合级次并核对2θ定义',
 'sinθ对m的斜率乘2d得到cm；不把接收器转角直接当布拉格角。','把2θ当θ会使哪一个三角函数关系错误？','角度零位增加0.5°')
add('magnus_ball','会转弯的球：旋转球侧向轨迹','mechanics','time_s|时刻|s;lateral_mm|俯视侧向位移|mm',
 'mass_g|球质量|g|10','小偏转段：y=y0+ay t²/2；F侧=may','侧向合力估计','N',
 '低速旋转球演示；俯视成像；质量和长度标定',
 '只看水平侧向投影而非竖直落体位移；截取近似恒定侧向加速度段；初始侧向速度近似零',
 '记录旋转方向与速度；俯视采集坐标和时间；拟合侧移对t²并用无旋转对照讨论空气作用',
 '侧向mm转m，t²斜率乘2m得到侧向合力；未独立量转速和流场时不求普适升力系数。','有侧向偏转就一定由旋转造成吗？','时间刻度偏大 4%')
add('dancing_coin','跳舞的硬币：热气体与抬升条件','thermal',
 'coin_mass_g|硬币质量|g;lift_temperature_C|抬升前气体温度|°C',
 'initial_K|密闭初态温度|K|293.15;ambient_Pa|外界压强|Pa|101300;opening_radius_mm|孔口有效半径|mm|10',
 '抬升前ΔP≈P0(T/T0−1)；阈值应与mg/A比较','观测温度的压差估计均值','Pa',
 '低温瓶口演示；硬币和尺寸尺；气体温度测量',
 '只在抬升前近似固定气量；温度为气体实际温度；润湿粘附和密封另行记录',
 '记录硬币重量、孔口和初态；缓慢加热观察抬升温度；估计压差并对照重量及泄气后的变化',
 '观测温度转K，用定容比例估计抬升前压差；抬升后泄气不再沿用同一密闭公式。','硬币第一次抬起后，为何不能继续按固定气量算每次周期？','温度零位偏高1°C')


add('light_speed','光速测量：光路长度与传播时延','optics','optical_path_m|实际单程光路长度|m;delay_ns|对应传播时延|ns','',
 't=L光路/c+t电子延迟','传播光速','m/s','光速教学装置；可调光路；时延测量',
 '输入实际光路长度而非机械镜面位移；电子触发延迟在各点可比；探测链时延及介质记录完整',
 '记录单程和反射光路的定义；配对测不同实际光程及时延；带截距拟合分离电子延迟',
 'ns对m的斜率为10⁹/c；取倒数得到m/s，截距保留链路延迟。','为什么镜面移动1m可能改变2m光程？','实际光路长度标定偏大 4%')

add('dc_source','直流电源特性：电动势与内阻','electricity','current_mA|负载电流|mA;terminal_V|端电压|V','',
 'U=E−rI（限定负载区间）','源内阻估计','Ω','低压直流源；可调负载；电压电流表',
 '使用非限流非饱和的稳态区间；负载改变时温度可比；参考表负载效应已讨论',
 '先测开路状态并记录源类型；改变负载配对测I和U；拟合负斜率与截距，核查非线性区',
 '负载mA转A，端电压对电流负斜率的相反数为源内阻，截距估计电动势。','稳压源进入限流后还能认为内阻恒定吗？','端电压标定增益偏大 4%')

def readings(eid):
    """Independent generation parameters and physically distinct full reading tables."""
    p={v['key']:v['default'] for v in next(t for t in PLANS if t['experiment_id']==eid)['parameters']}
    x=[1,2,3,4,5,6,7];e=1.602176634e-19;kb=1.380649e-23;mu0=4*math.pi*1e-7
    if eid=='length_measurement':return {'reading_mm':[25.04,25.03,25.05,25.04,25.03,25.05,25.04]},p
    if eid=='mass_measurement':return {'reading_g':[50.11,50.10,50.09,50.10,50.11,50.09,50.10]},p
    if eid=='solid_density':return {'mass_g':[math.pi*20**2*30/4*.0078]*7,'diameter_mm':[20]*7,'height_mm':[30]*7},p
    if eid=='density_buoyancy':return {'mass_air_g':[78]*7,'apparent_mass_g':[68]*7},p
    if eid=='multimeter':return {'reference_V':x,'display_V':[v+.01 for v in x]},p
    if eid=='oscilloscope':return {'period_div':[5]*7,'peak_to_peak_div':[2]*7},p
    if eid in {'virtual_daq','rectifier','magnetic_levitation','chaos'}:
        t=[i*.001 for i in range(101)] if eid in {'virtual_daq','rectifier'} else [i*.01 for i in range(201)]
        if eid=='virtual_daq':return {'time_s':t,'voltage_V':[.2+2*math.sin(2*math.pi*50*v) for v in t]},p
        if eid=='rectifier':return {'time_s':t,'voltage_V':[5+.3*math.sin(2*math.pi*100*v) for v in t]},p
        if eid=='magnetic_levitation':return {'time_s':t,'displacement_mm':[2*math.sin(2*math.pi*3*v) for v in t]},p
        return {'time_s':t,'x_V':[math.sin(2*math.pi*3*v)+.35*math.sin(2*math.pi*5.3*v) for v in t],'y_V':[math.cos(2*math.pi*3*v)+.35*math.cos(2*math.pi*5.3*v) for v in t]},p
    if eid=='trifilar':return {'period_s':[math.sqrt(.004*4*math.pi**2*.5/(.5*9.81*.05*.05))]*7},p
    if eid=='shear_modulus':return {'twist_deg':x,'torque_mNm':[40e9*math.pi*(.0005)**4*math.radians(v)/(2*.5)*1000 for v in x]},p
    if eid=='forced_resonance':
        f=[35,40,45,48,50,52,55,60,65];return {'frequency_Hz':f,'amplitude_mm':[20/math.sqrt((1-(v/50)**2)**2+(.15*v/50)**2) for v in f]},p
    if eid=='collision':
        u=[v*.1 for v in x];return {'v1_before':u,'v2_before':[0]*7,'v1_after':[-.2*v for v in u],'v2_after':[.8*v for v in u]},p
    if eid=='air_heat_ratio':
        a=[30,35,40,45,50,55,60];return {'initial_height_mm':a,'restored_height_mm':[v*(1-1/1.4) for v in a]},p
    if eid=='surface_tension':return {'wetted_perimeter_mm':[v*10 for v in x],'corrected_force_mN':[.072*v*10 for v in x]},p
    if eid=='ice_latent_heat':
        mi=[20,22,24,26,28,30,32];tf=15;return {'initial_water_C':[tf+(m*334000+m*4180*tf)/(200*4180) for m in mi],'final_C':[tf]*7,'ice_mass_g':mi},p
    if eid=='vapor_latent_heat':return {'evaporated_g':x,'corrected_energy_kJ':[2256*v*.001 for v in x]},p
    if eid=='temperature_pid':
        t=[v*10 for v in range(16)];return {'time_s':t,'temperature_C':[50-25*math.exp(-v/25)+3*math.exp(-v/60)*math.sin(v/15) for v in t]},p
    if eid=='heat_engine':return {'volume_ml':[100,120,140,140,120,100,100],'pressure_kPa':[120,120,120,100,100,100,120]},p
    if eid=='temperature_viscosity':
        t=[10,15,20,25,30,35,40];eta=[math.exp(-8+2500/(v+273.15)) for v in t]
        return {'temperature_C':t,'terminal_speed_mm_s':[2*6500*9.81*.0002**2/(9*v)*1000 for v in eta]},p
    if eid=='wheatstone':
        a=[100,200,300,400,500,600,700];return {'R1_ohm':a,'R2_ohm':[1000]*7,'R3_ohm':[470*v/1000 for v in a],'null_mV':[0]*7},p
    if eid=='potentiometer':
        a=[400,410,420,430,440,450,460];return {'standard_length_mm':a,'unknown_length_mm':[1.5/1.0186*v for v in a]},p
    if eid=='meter_conversion':return {'reference_mA':x,'indicated_mA':x.copy()},p
    if eid=='meter_resistance':return {'current_mA':[v*.01 for v in x],'terminal_V':[v*.01 for v in x]},p
    if eid=='diode':
        u=[.30,.32,.34,.36,.38,.40,.42];return {'forward_V':u,'current_mA':[.001*math.exp(e*v/(1.8*kb*300)) for v in u]},p
    if eid=='thermistor':
        t=[5,15,25,35,45,55,65];return {'temperature_C':t,'resistance_ohm':[10000*math.exp(3500*(1/(v+273.15)-1/298.15)) for v in t]},p
    if eid=='unbalanced_bridge':return {'delta_resistance_ohm':x,'bridge_output_mV':[1.25*v for v in x]},p
    if eid=='hall_effect':return {'current_mA':[v*.5 for v in x],'field_mT':[100]*7,'hall_mV':[.01*(v*.0005*.1)/.0005*1000 for v in x]},p
    if eid=='helmholtz':
        z=[-.15,-.10,-.05,0,.05,.10,.15];r=.15
        return {'axial_m':z,'field_mT':[130*mu0*.5*r*r/2*((r*r+(v-r/2)**2)**-1.5+(r*r+(v+r/2)**2)**-1.5)*1000 for v in z]},p
    if eid=='rlc_series':
        f0=1/(2*math.pi*math.sqrt(.01*1e-6));f=[f0*v for v in [.6,.75,.85,.92,1,1.08,1.18,1.33,1.5]]
        react=[2*math.pi*v*.01-1/(2*math.pi*v*1e-6) for v in f]
        return {'frequency_Hz':f,'current_mA':[1000/math.hypot(20,v) for v in react],'phase_deg':[-math.degrees(math.atan2(v,20)) for v in react]},p
    if eid=='hysteresis':return {'field_A_m':[0,100,200,300,200,100,0,-100,-200,-300,-200,-100,0],'flux_T':[-.3,0,.45,.6,.58,.5,.3,0,-.45,-.6,-.58,-.5,-.3]},p
    if eid=='curie_temperature':return {'temperature_C':[20,50,80,100,110,120,130,140],'remanence_mT':[100,95,85,60,35,10,1,0]},p
    if eid=='electrostatic_field':
        grid=[(a,b) for b in range(5) for a in range(5)]
        return {'x_cm':[a for a,b in grid],'y_cm':[b for a,b in grid],'potential_V':[5-.2*a-.1*b for a,b in grid]},p
    if eid=='photoresistor':
        illum=[20,40,60,100,150,200,300];return {'illuminance_lux':illum,'resistance_ohm':[100000*v**-.7 for v in illum]},p
    if eid=='solar_cell':return {'voltage_V':[0,.1,.2,.3,.4,.45,.5,.55,.6],'current_mA':[20,19.9,19.7,19,17,14,9,4,0]},p
    if eid=='magnetoresistance':
        b=[0,.1,.2,.3,.4,.5,.6];return {'field_T':b,'resistance_ohm':[100*(1+.5*v*v) for v in b]},p
    if eid=='strain_gauge':return {'microstrain':[v*100 for v in x],'delta_resistance_mohm':[120*2*v*.0001*1000 for v in x]},p
    if eid=='temperature_sensor':return {'temperature_C':[v*10 for v in x],'output_mV':[v*100+500 for v in x]},p
    if eid=='magnetic_pendulum':
        b=[20,30,40,50,60,70,80];return {'field_uT':b,'period_s':[math.sqrt(4*math.pi**2*1e-8/(.01*v*1e-6)) for v in b]},p
    if eid=='wireless_power':return {'distance_cm':x,'input_W':[5]*7,'received_W':[3*math.exp(-v*.12) for v in x]},p
    if eid=='fuel_cell':return {'current_A':[0,.1,.2,.4,.6,.8,1],'terminal_V':[.95,.85,.78,.70,.58,.42,.2]},p
    if eid=='railgun':return {'time_ms':[0,1,2,3,4,5,6],'current_A':[0,1,2,3,2,1,0],'voltage_V':[5]*7},p
    if eid=='prism_angle':return {'double_angle_deg':[120]*7},p
    if eid=='prism_refraction':return {'minimum_deviation_deg':[2*math.degrees(math.asin(1.5*math.sin(math.radians(30))))-60]*7},p
    if eid=='abbe_refractometer':return {'critical_angle_deg':[math.degrees(math.asin(1.333/1.7))]*7},p
    if eid=='lens_group':return {'f1_cm':[10]*7,'f2_cm':[15]*7,'separation_cm':[5]*7},p
    if eid=='lens_bessel':
        d=[50,55,60,65,70,75,80];return {'object_screen_cm':d,'lens_displacement_cm':[math.sqrt(v*v-40*v) for v in d]},p
    if eid=='fresnel_biprism':return {'order':x,'position_mm':[632.8/1000/.5*v+.2 for v in x]},p
    if eid=='grating_characteristics':
        w=[400,450,500,550,600,650,700];return {'wavelength_nm':w,'angle_deg':[math.degrees(math.asin(v*.0003)) for v in w]},p
    if eid=='wire_diffraction':return {'dark_order':x,'dark_angle_deg':[math.degrees(math.asin(v*.0006328/.08)) for v in x]},p
    if eid=='optical_flatness':return {'fringe_spacing_mm':[2]*7,'fringe_bend_mm':[.1,.2,.3,.5,.4,.2,.1]},p
    if eid=='diffraction_intensity':
        positions=[i*.06328 for i in range(-100,101)]
        def sinc(v):return 1 if abs(v)<1e-12 else math.sin(v)/v
        return {'position_mm':positions,'intensity':[100*sinc(math.pi*.0002*(v*.001)/(.0000006328*1))**2 for v in positions]},p
    if eid=='holography':
        angles=[10,15,20,25,30,35,40];return {'beam_angle_deg':angles,'fringe_pitch_um':[.6328/(2*math.sin(math.radians(v/2))) for v in angles]},p
    if eid=='infrared_radiation':
        t=[310,320,330,340,350,360,370];return {'temperature_K':t,'net_power_mW':[.8*5.670374419e-8*.0001*(v**4-293.15**4)*1000 for v in t]},p
    if eid=='thermal_imaging':return {'reference_C':[v*5+20 for v in x],'detector_count':[v*50+700 for v in x]},p
    if eid=='astronomical_imaging':return {'exposure_s':x,'dark_count':[100+2*v for v in x]},p
    if eid=='color_design':return {'red':[255,0,0,255,255,128,255],'green':[0,255,0,255,0,128,255],'blue':[0,0,255,0,255,128,255]},p
    if eid=='optical_cloaking':return {'view_angle_deg':[-15,-10,-5,0,5,10,15],'reference_contrast':[.8]*7,'cloak_contrast':[.5,.3,.15,.08,.15,.3,.5]},p
    if eid=='stereo_display':
        depths=[.5,.8,1,1.5,2,2.5,3];return {'depth_m':depths,'parallax_mm':[50*60/(v*1000) for v in depths]},p
    if eid=='white_light_interference':return {'envelope_order':x,'mirror_shift_um':[.5]*7},p
    if eid=='doppler':return {'radial_speed_m_s':[v*.1 for v in x],'frequency_shift_Hz':[2*40000*v*.1/343 for v in x]},p
    if eid=='acoustic_levitation':return {'node_order':x,'node_position_mm':[343/(2*40000)*1000*v+1 for v in x]},p
    if eid=='ultrasonic_echo':return {'known_depth_mm':[v*10 for v in x],'echo_time_us':[2000/(1480)*v*10+2 for v in x]},p
    if eid=='double_grating':return {'event_order':x,'event_time_ms':[v*10+5 for v in x]},p
    if eid=='millikan':
        speeds=[.08,.09,.10,.11,.12,.13,.14];charges=x
        eta=p['air_viscosity'];rho=p['density_difference'];g=p['gravity_m_s2'];gap=p['plate_gap_mm']*.001
        voltages=[]
        for speed,n in zip(speeds,charges):
            v=speed*.001;r0=math.sqrt(9*eta*v/(2*rho*g));correction=1+p['slip_constant_Pa_m']/(p['pressure_Pa']*r0)
            voltages.append(6*math.pi*eta*v*r0*gap/(n*e*correction**1.5))
        return {'fall_speed_mm_s':speeds,'balance_voltage_V':voltages,'charge_number':charges},p
    if eid=='electron_em':
        u=[100,120,140,160,180,200,220];i=[.6]*7;b=(4/5)**1.5*mu0*130/.15*.6
        return {'accelerating_V':u,'coil_current_A':i,'orbit_radius_mm':[math.sqrt(2*v/(1.75882001076e11*b*b))*1000 for v in u]},p
    if eid=='franck_hertz':return {'peak_order':x,'peak_voltage_V':[4.9*v+1.2 for v in x]},p
    if eid=='hydrogen_spectrum':
        n=[3,4,5,6,7,8,9];return {'upper_n':n,'wavelength_nm':[1e9/(10967758.34*(.25-1/v**2)) for v in n]},p
    if eid=='thermionic_work_function':
        t=[1500,1550,1600,1650,1700,1750,1800];return {'temperature_K':t,'saturation_current_A':[1e-6*v*v*math.exp(-2.2*e/(kb*v)) for v in t]},p
    if eid=='nuclear_magnetic_resonance':return {'field_mT':[v*100 for v in x],'frequency_MHz':[42.57747892*v*.1 for v in x]},p
    if eid=='zeeman':return {'field_T':[v*.1 for v in x],'single_shift_GHz':[9.2740100783e-24/6.62607015e-34/1e9*v*.1 for v in x]},p
    if eid=='nuclear_counts':return {'gate_s':[30]*7,'counts':[330]*7},p
    if eid=='nuclear_decay':
        t=[v*30 for v in range(7)];return {'elapsed_s':t,'rate_cps':[50*math.exp(-math.log(2)/120*v)+1 for v in t]},p
    if eid=='microwave_properties':return {'node_order':x,'node_position_mm':[299792458/(2*1e10)*1000*v+2 for v in x]},p
    if eid=='microwave_bragg':
        m=[1,2,3];return {'order':m,'bragg_angle_deg':[math.degrees(math.asin(v*2.99792458/(2*5))) for v in m]},p
    if eid=='magnus_ball':
        t=[v*.05 for v in range(7)];return {'time_s':t,'lateral_mm':[.5*2*v*v*1000 for v in t]},p
    if eid=='dancing_coin':
        masses=[1,1.5,2,2.5,3,3.5,4];area=math.pi*.01**2
        return {'coin_mass_g':masses,'lift_temperature_C':[293.15*(1+v*.001*9.81/(area*101300))-273.15 for v in masses]},p
    if eid=='light_speed':return {'optical_path_m':x,'delay_ns':[v*1e9/299792458+10 for v in x]},p
    if eid=='dc_source':return {'current_mA':[v*10 for v in x],'terminal_V':[5-10*v*.01 for v in x]},p
    raise ValueError('Missing generator: '+eid)


def variant(eid,level):
    cols,p=readings(eid)
    cols={k:list(v) for k,v in cols.items()};p=dict(p)
    if level=='basic':return cols,p,'根据明确模型生成的理想教学读数。'
    index=[-.003,.001,.002,-.001,.003,-.002,.001]
    if level=='standard':
        # Preserve ordinal/integer fields and exact loop/endpoint constraints.
        keys={'solid_density':'mass_g','density_buoyancy':'mass_air_g','wheatstone':'R3_ohm','potentiometer':'unknown_length_mm',
              'color_design':'red','solar_cell':'current_mA','hysteresis':'flux_T','collision':'v1_after',
              'electrostatic_field':'potential_V','rlc_series':'current_mA','millikan':'balance_voltage_V',
              'electron_em':'orbit_radius_mm','chaos':'x_V','nuclear_counts':'counts','magnetic_pendulum':'period_s',
              'heat_engine':'pressure_kPa','white_light_interference':'mirror_shift_um'}
        key=keys.get(eid,list(cols)[-1])
        if eid=='nuclear_counts':cols[key]=[v+[-2,1,2,-1,3,-3,0][i%7] for i,v in enumerate(cols[key])]
        elif eid=='color_design':cols[key]=[max(0,min(255,v+[-2,1,2,-1,3,-3,0][i%7])) for i,v in enumerate(cols[key])]
        else:cols[key]=[v*(1+index[i%7]) for i,v in enumerate(cols[key])]
        if eid in {'heat_engine','hysteresis'}:cols[key][-1]=cols[key][0]
        column=next(c for plan in PLANS if plan['experiment_id']==eid for c in plan['columns'] if c['key']==key)
        change='最多增减3个计数' if eid=='nuclear_counts' else '最多增减3个编码等级' if eid=='color_design' else '约±0.3%'
        return cols,p,f'对“{column["label"]}”加入{change}的读数波动；这是教学模拟，非仪器实测噪声。'
    # Investigative cases alter a named condition; the solution uses the altered readings.
    if eid in {'length_measurement','mass_measurement'}:p['zero_offset']=0
    elif eid=='solid_density':cols['diameter_mm']=[v*1.02 for v in cols['diameter_mm']]
    elif eid=='density_buoyancy':cols['apparent_mass_g']=[v+.1 for v in cols['apparent_mass_g']]
    elif eid=='oscilloscope':p['timebase_ms_div']*=1.1
    elif eid in {'magnetic_levitation','magnus_ball'}:cols['time_s']=[v*(1.1 if eid=='magnetic_levitation' else 1.04) for v in cols['time_s']]
    elif eid=='trifilar':p['length_m']*=.95
    elif eid=='shear_modulus':p['radius_mm']*=1.02
    elif eid=='forced_resonance':cols['amplitude_mm']=[v*(1+(.2 if i<len(cols['amplitude_mm'])//2 else -.2)) for i,v in enumerate(cols['amplitude_mm'])]
    elif eid=='collision':cols['v1_after']=[v*1.04 for v in cols['v1_after']];cols['v2_after']=[v*1.04 for v in cols['v2_after']]
    elif eid=='air_heat_ratio':cols['restored_height_mm']=[v*.96 for v in cols['restored_height_mm']]
    elif eid=='surface_tension':p['contact_cosine']=.95
    elif eid=='ice_latent_heat':cols['ice_mass_g']=[v*1.04 for v in cols['ice_mass_g']]
    elif eid=='temperature_pid':cols['temperature_C']=[v+2 for v in cols['temperature_C']]
    elif eid=='diode':cols['forward_V']=[u+.04*i for u,i in zip(cols['forward_V'],cols['current_mA'])]
    elif eid=='thermistor':cols['resistance_ohm']=[r*math.exp(3500*(1/(t+273.15+2+i*.2)-1/(t+273.15))) for i,(t,r) in enumerate(zip(cols['temperature_C'],cols['resistance_ohm']))]
    elif eid=='hall_effect':p['thickness_mm']*=.95
    elif eid=='rlc_series':p['capacitance_uF']*=1.1
    elif eid=='curie_temperature':cols['temperature_C']=[v+5 for v in cols['temperature_C']]
    elif eid=='electrostatic_field':cols['potential_V']=[v+.02*x*x for x,v in zip(cols['x_cm'],cols['potential_V'])]
    elif eid=='photoresistor':cols['resistance_ohm']=[v*(1+.02*i) for i,v in enumerate(cols['resistance_ohm'])]
    elif eid=='magnetoresistance':cols['field_T']=[v*1.04 for v in cols['field_T']]
    elif eid=='rectifier':cols['voltage_V']=[v+.2*math.sin(2*math.pi*15*t) for t,v in zip(cols['time_s'],cols['voltage_V'])]
    elif eid=='magnetic_pendulum':p['inertia_kg_m2']*=1.04
    elif eid in {'prism_refraction','grating_characteristics','microwave_bragg'}:
        key='minimum_deviation_deg' if eid=='prism_refraction' else 'angle_deg' if eid=='grating_characteristics' else 'bragg_angle_deg'
        cols[key]=[v+(1 if eid=='prism_refraction' else .5) for v in cols[key]]
    elif eid=='abbe_refractometer':cols['critical_angle_deg']=[v+.5 for v in cols['critical_angle_deg']]
    elif eid=='fresnel_biprism':p['virtual_separation_mm']*=.95
    elif eid=='wire_diffraction':p['wavelength_nm']*=1.04
    elif eid=='diffraction_intensity':cols['position_mm']=[v*1.04 for v in cols['position_mm']]
    elif eid=='color_design':cols['red']=[max(0,min(255,v-20)) for v in cols['red']]
    elif eid=='nuclear_magnetic_resonance':cols['field_mT']=[v*.96 for v in cols['field_mT']]
    elif eid=='zeeman':cols['single_shift_GHz']=[v*2 for v in cols['single_shift_GHz']]
    elif eid=='nuclear_counts':p['background_gate_s']*=1.1
    elif eid=='nuclear_decay':cols['rate_cps']=[v+.5 for v in cols['rate_cps']]
    elif eid=='thermionic_work_function':cols['temperature_K']=[v*1.02 for v in cols['temperature_K']]
    elif eid=='franck_hertz':cols['peak_voltage_V']=[v+(4.9 if i>=5 else 0) for i,v in enumerate(cols['peak_voltage_V'])]
    elif eid=='dancing_coin':cols['lift_temperature_C']=[v+1 for v in cols['lift_temperature_C']]
    else:
        key={'wheatstone':'R3_ohm','potentiometer':'unknown_length_mm','millikan':'balance_voltage_V','electron_em':'orbit_radius_mm',
             'chaos':'x_V','solar_cell':'current_mA','heat_engine':'pressure_kPa','hysteresis':'flux_T',
             'optical_cloaking':'cloak_contrast','doppler':'radial_speed_m_s','ultrasonic_echo':'known_depth_mm',
             'double_grating':'event_time_ms','astronomical_imaging':'exposure_s','light_speed':'optical_path_m'}.get(eid,list(cols)[-1])
        cols[key]=[v*1.04 for v in cols[key]]
    plan=next(t for t in PLANS if t['experiment_id']==eid)
    return cols,p,'明确预设偏差：'+plan['fault']+'。保留这些读数进行处理，不自动改回生成参数。'
