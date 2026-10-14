"""Measurement models for the textbook catalogue; no arbitrary expression evaluation."""
import math
from statistics import mean, stdev

IDS = set('''length_measurement mass_measurement solid_density density_buoyancy multimeter oscilloscope virtual_daq
trifilar shear_modulus forced_resonance collision magnetic_levitation
air_heat_ratio surface_tension ice_latent_heat vapor_latent_heat temperature_pid heat_engine temperature_viscosity
wheatstone potentiometer meter_conversion meter_resistance diode thermistor unbalanced_bridge hall_effect helmholtz rlc_series hysteresis curie_temperature electrostatic_field photoresistor solar_cell magnetoresistance strain_gauge temperature_sensor rectifier magnetic_pendulum wireless_power fuel_cell railgun
prism_angle prism_refraction abbe_refractometer lens_group lens_bessel fresnel_biprism grating_characteristics wire_diffraction optical_flatness diffraction_intensity holography infrared_radiation thermal_imaging astronomical_imaging color_design optical_cloaking stereo_display white_light_interference
doppler acoustic_levitation ultrasonic_echo double_grating chaos
millikan electron_em franck_hertz hydrogen_spectrum thermionic_work_function nuclear_magnetic_resonance zeeman nuclear_counts nuclear_decay microwave_properties microwave_bragg
magnus_ball dancing_coin light_speed dc_source'''.split())

K_B=1.380649e-23
E_CHARGE=1.602176634e-19
H_PLANCK=6.62607015e-34
MU0=4*math.pi*1e-7


def integrate(x,y):
    return sum((a+b)*(d-c)/2 for c,d,a,b in zip(x,x[1:],y,y[1:]))


def crossing(x,y,target):
    candidates=[]
    for a,b,c,d in zip(x,x[1:],y,y[1:]):
        if c==target:candidates.append(a)
        elif (c-target)*(d-target)<0:candidates.append(a+(target-c)*(b-a)/(d-c))
    if y[-1]==target:candidates.append(x[-1])
    return candidates


def analyze(topic,c,p,fit,average,chart,metric,notes):
    eid=topic.experiment_id
    def pos(values,label='读数或参数'):
        if any(v<=0 for v in values):raise ValueError(label+'必须为正。')
    def nonneg(values,label='读数'):
        if any(v<0 for v in values):raise ValueError(label+'不能为负。')
    def ordered(x):
        if any(b<=a for a,b in zip(x,x[1:])):raise ValueError('自变量须严格递增，保留原始采集顺序。')
    def integer(x):
        if any(v<1 or not float(v).is_integer() for v in x):raise ValueError('级次或计数须为正整数。')
    def avg(values):
        value=average(values)
        return value,'result = mean_value',{'mean_value':value}
    def line(x,y,xl,yl,scale=1,inverse=False,decreasing=False):
        slope=fit(x,y,xl,yl,decreasing=decreasing)
        value=scale/slope if inverse else scale*slope
        formula='result = factor / slope' if inverse else 'result = factor * slope'
        return value,formula,{'factor':scale,'slope':slope}
    def curve(title,x,y,xl,yl,model=None):
        item=chart(title,x,y,xl,yl,model,model_label='参考关系')
        item['connect']=True
    def descriptive(value):return value,'result = measured_value',{'measured_value':value}

    if eid in {'length_measurement','mass_measurement'}:
        key='reading_mm' if eid=='length_measurement' else 'reading_g'
        pos([p['resolution']],'仪器分辨率')
        values=[v-p['zero_offset'] for v in c[key]];pos(values,'校零后的读数')
        metric('均值的 A 类标准不确定度',stdev(values)/math.sqrt(len(values)),topic.output_unit)
        metric('分辨率引入的 B 类标准不确定度',p['resolution']/math.sqrt(12),topic.output_unit)
        notes.append('分辨率项按宽为一个分辨率的均匀分布处理；未包括校准、温度、形变及零位不确定度。')
        return avg(values)
    if eid=='solid_density':
        for v in c.values():pos(v)
        return avg([m/(math.pi*d*d*h/4)*1e6 for m,d,h in zip(c['mass_g'],c['diameter_mm'],c['height_mm'])])
    if eid=='density_buoyancy':
        pos([p['liquid_density_kg_m3']]);pos(c['mass_air_g']);pos(c['apparent_mass_g'])
        if any(a<=b for a,b in zip(c['mass_air_g'],c['apparent_mass_g'])):raise ValueError('本模型要求空气质量读数大于浸液表观质量。')
        return avg([p['liquid_density_kg_m3']*a/(a-b) for a,b in zip(c['mass_air_g'],c['apparent_mass_g'])])
    if eid in {'multimeter','meter_conversion','temperature_sensor','thermal_imaging','astronomical_imaging','photoresistor','strain_gauge','unbalanced_bridge','meter_resistance','surface_tension','magnus_ball','franck_hertz','nuclear_magnetic_resonance','zeeman','double_grating','prism_angle'}:
        if eid=='multimeter':
            pos(c['reference_V']);return line(c['reference_V'],c['display_V'],'标准电压（V）','万用表读数（V）')
        if eid=='meter_conversion':
            pos([p['movement_fullscale_uA'],p['movement_resistance_ohm'],p['ammeter_range_mA'],p['voltmeter_range_V']])
            ig=p['movement_fullscale_uA']*1e-6; rg=p['movement_resistance_ohm']; im=p['ammeter_range_mA']*.001
            if im<=ig or p['voltmeter_range_V']<=ig*rg:raise ValueError('扩大量程必须高于表头原量程。')
            metric('设计分流电阻',ig*rg/(im-ig),'Ω');metric('设计串联电阻',p['voltmeter_range_V']/ig-rg,'Ω')
            return line(c['reference_mA'],c['indicated_mA'],'标准电流（mA）','改装表读数（mA）')
        if eid=='temperature_sensor':return line(c['temperature_C'],c['output_mV'],'参考温度（°C）','输出电压（mV）')
        if eid=='thermal_imaging':
            notes.append('这里只标定当前温区的输出响应，不直接把计数当温度；需保留发射率、背景、距离和相机校准。')
            return line(c['reference_C'],c['detector_count'],'参考温度（°C）','探测器计数')
        if eid=='astronomical_imaging':
            pos([p['pixel_pitch_um']]);pos(c['exposure_s']);ordered(c['exposure_s'])
            notes.append('斜率是暗场平均计数的增长率，不能仅凭它认证天体亮度；需另存偏置、暗场、平场、星像和饱和检查。')
            return line(c['exposure_s'],c['dark_count'],'曝光时间（s）','暗场平均计数')
        if eid=='photoresistor':
            pos(c['illuminance_lux']);pos(c['resistance_ohm'])
            slope=fit([math.log(v) for v in c['illuminance_lux']],[math.log(v) for v in c['resistance_ohm']],'ln(E / 1 lx)','ln(R / 1 Ω)',decreasing=True)
            curve('光照与电阻',c['illuminance_lux'],c['resistance_ohm'],'照度（lx）','电阻（Ω）')
            return -slope,'gamma = -slope',{'slope':slope}
        if eid=='strain_gauge':
            pos([p['baseline_resistance_ohm']]);pos(c['microstrain'])
            return line([v*1e-6 for v in c['microstrain']],[v*.001/p['baseline_resistance_ohm'] for v in c['delta_resistance_mohm']],'应变','电阻相对变化')
        if eid=='unbalanced_bridge':
            pos([p['arm_resistance_ohm'],p['excitation_V']]);pos(c['delta_resistance_ohm'])
            if max(c['delta_resistance_ohm'])>.02*p['arm_resistance_ohm']:raise ValueError('小信号模型要求电阻变化不超过桥臂的 2%。')
            metric('一阶理论灵敏度',p['excitation_V']*1000/(4*p['arm_resistance_ohm']),'mV/Ω')
            return line(c['delta_resistance_ohm'],c['bridge_output_mV'],'桥臂电阻变化（Ω）','桥路输出（mV）')
        if eid=='meter_resistance':
            pos(c['current_mA']);return line([v*.001 for v in c['current_mA']],c['terminal_V'],'电流（A）','表头端电压（V）')
        if eid=='surface_tension':
            pos(c['wetted_perimeter_mm']);pos([p['contact_cosine']])
            if p['contact_cosine']>1:raise ValueError('接触角余弦不大于 1。')
            return line(c['wetted_perimeter_mm'],c['corrected_force_mN'],'总润湿周长（mm）','扣除本底后的拉力（mN）',1/p['contact_cosine'])
        if eid=='magnus_ball':
            pos([p['mass_g']]);nonneg(c['time_s']);ordered(c['time_s'])
            notes.append('侧向坐标来自俯视轨迹；仅用近似恒定侧向加速度段估计合侧向力，不据此单独认证马格努斯系数。')
            return line([t*t for t in c['time_s']],[v*.001 for v in c['lateral_mm']],'时间平方（s²）','侧向位移（m）',2*p['mass_g']*.001)
        if eid=='franck_hertz':
            integer(c['peak_order']);ordered(c['peak_order']);pos(c['peak_voltage_V'])
            return line(c['peak_order'],c['peak_voltage_V'],'已识别峰级次','峰位电压（V）')
        if eid=='nuclear_magnetic_resonance':
            pos(c['field_mT']);pos(c['frequency_MHz'])
            return line([v*.001 for v in c['field_mT']],c['frequency_MHz'],'磁感应强度（T）','共振频率（MHz）')
        if eid=='zeeman':
            pos(c['field_T']);pos(c['single_shift_GHz']);pos([p['lande_factor']])
            return line(c['field_T'],c['single_shift_GHz'],'磁感应强度（T）','中心到单个 σ 分量频移（GHz）',H_PLANCK*1e9/p['lande_factor'])
        if eid=='double_grating':
            integer(c['event_order']);ordered(c['event_order']);ordered(c['event_time_ms']);pos([p['events_per_cycle']])
            if not p['events_per_cycle'].is_integer():raise ValueError('每周期计数须为正整数。')
            return line(c['event_order'],c['event_time_ms'],'同类事件累计序号','时刻（ms）',1000/p['events_per_cycle'],inverse=True)
        if eid=='prism_angle':
            pos(c['double_angle_deg'])
            if any(v>=360 for v in c['double_angle_deg']):raise ValueError('反射方向差须小于 360°。')
            return avg([v/2 for v in c['double_angle_deg']])
    if eid in {'oscilloscope','virtual_daq','rectifier','magnetic_levitation'}:
        if eid=='oscilloscope':
            pos(c['period_div']);pos([p['timebase_ms_div'],p['voltage_V_div'],p['probe_ratio']]);nonneg(c['peak_to_peak_div'])
            metric('平均峰峰值',mean(c['peak_to_peak_div'])*p['voltage_V_div']*p['probe_ratio'],'V')
            return avg([1000/(v*p['timebase_ms_div']) for v in c['period_div']])
        times=c['time_s'];ordered(times)
        key='displacement_mm' if eid=='magnetic_levitation' else 'voltage_V';signal=c[key];offset=mean(signal)
        curve('保留原始时域波形',times,signal,'时间（s）',f'{topic.columns[1].label}（{topic.columns[1].unit}）')
        rms=math.sqrt(mean((v-offset)**2 for v in signal));metric('直流 / 平衡位置均值',offset,topic.columns[1].unit)
        if eid=='rectifier':
            pos([offset],'平均直流输出');metric('输出平均电压',offset,'V')
            return rms/offset,'ripple = ac_rms / dc',{'ac_rms':rms,'dc':offset}
        if eid=='virtual_daq':
            pos([rms],'去直流后的均方根')
            edges=crossing(times,signal,offset)
            rising=[t for t in edges if any(a<=t<=b and d>q for a,b,q,d in zip(times,times[1:],signal,signal[1:]))]
            if len(rising)>1:metric('上升过零估计频率',1/mean(b-a for a,b in zip(rising,rising[1:])),'Hz')
            return rms,'rms = ac_rms',{'ac_rms':rms}
        pos([p['mass_g']])
        edges=crossing(times,signal,offset)
        rising=[t for t in edges if any(a<=t<=b and d>q for a,b,q,d in zip(times,times[1:],signal,signal[1:]))]
        if len(rising)<3:raise ValueError('至少记录三个上升过平衡点，才能估计小振动周期。')
        period=mean(b-a for a,b in zip(rising,rising[1:]));metric('小振动周期',period,'s')
        return p['mass_g']*.001*(2*math.pi/period)**2,'k = m * (2 * pi / T)^2',{'m':p['mass_g']*.001,'T':period}
    if eid=='trifilar':
        pos(c['period_s']);pos(list(p.values()))
        factor=p['mass_kg']*p['gravity_m_s2']*p['upper_radius_m']*p['lower_radius_m']/(4*math.pi**2*p['length_m'])
        return avg([factor*t*t for t in c['period_s']])
    if eid=='shear_modulus':
        pos(c['twist_deg']);pos(c['torque_mNm']);pos(list(p.values()))
        return line([math.radians(v) for v in c['twist_deg']],[v*.001 for v in c['torque_mNm']],'扭转角（rad）','力矩（N·m）',2*p['length_m']/(math.pi*(p['radius_mm']*.001)**4)*1e-9)
    if eid=='forced_resonance':
        pos(c['frequency_Hz']);nonneg(c['amplitude_mm']);ordered(c['frequency_Hz'])
        peak=max(range(len(c['amplitude_mm'])),key=c['amplitude_mm'].__getitem__)
        if peak in {0,len(c['amplitude_mm'])-1}:notes.append('最大振幅落在扫描边界，应扩展频率范围，当前值不是已确认的共振峰。')
        curve('受迫振动幅频曲线',c['frequency_Hz'],c['amplitude_mm'],'驱动频率（Hz）','振幅（mm）')
        notes.append('返回采样最大值所对应频率，没有自动拟合连续共振峰；驱动力幅度和稳态等待时间需核实。')
        return descriptive(c['frequency_Hz'][peak])
    if eid=='collision':
        pos([p['mass1_kg'],p['mass2_kg']])
        before=[p['mass1_kg']*a+p['mass2_kg']*b for a,b in zip(c['v1_before'],c['v2_before'])]
        after=[p['mass1_kg']*a+p['mass2_kg']*b for a,b in zip(c['v1_after'],c['v2_after'])]
        if any(abs(v)<1e-12 for v in before):raise ValueError('初始总动量接近零时，此比值无效，须改用绝对差。')
        curve('碰撞前后总动量',before,after,'碰撞前动量（kg·m/s）','碰撞后动量（kg·m/s）',before)
        return avg([b/a for a,b in zip(before,after)])
    if eid=='air_heat_ratio':
        pos(c['initial_height_mm']);pos(c['restored_height_mm'])
        if any(a<=b for a,b in zip(c['initial_height_mm'],c['restored_height_mm'])):raise ValueError('要求 0 < h₂ < h₁。')
        notes.append('小压差近似下 γ=h₁/(h₁−h₂)；开阀绝热与关阀后的恒容恢复阶段不可混淆。')
        return avg([a/(a-b) for a,b in zip(c['initial_height_mm'],c['restored_height_mm'])])
    if eid=='ice_latent_heat':
        pos(c['ice_mass_g']);pos([p['water_mass_g'],p['water_specific_heat']]);pos(c['final_C'])
        if any(a<=b for a,b in zip(c['initial_water_C'],c['final_C'])):raise ValueError('初始水温须高于最终水温。')
        return avg([(p['water_mass_g']*p['water_specific_heat']*(a-b)-m*p['water_specific_heat']*b)/m/1000 for a,b,m in zip(c['initial_water_C'],c['final_C'],c['ice_mass_g'])])
    if eid=='vapor_latent_heat':
        pos(c['evaporated_g']);pos(c['corrected_energy_kJ'])
        return line([v*.001 for v in c['evaporated_g']],c['corrected_energy_kJ'],'蒸发质量（kg）','扣除散热的输入能量（kJ）')
    if eid=='temperature_pid':
        ordered(c['time_s']);pos([p['tolerance_K']]);error=[abs(v-p['target_C']) for v in c['temperature_C']]
        area=integrate(c['time_s'],error)
        metric('采样最大超调',max(0,max(c['temperature_C'])-p['target_C']),'K')
        indices=[i for i in range(len(error)) if all(e<=p['tolerance_K'] for e in error[i:])]
        if indices:metric('至记录末尾保持在容差内的起点',c['time_s'][indices[0]],'s')
        else:notes.append('记录末尾仍未稳定进入填写的温度容差，不能报告已完成调节。')
        curve('温控响应',c['time_s'],c['temperature_C'],'时间（s）','温度（°C）',[p['target_C']]*len(error))
        notes.append('只评价采集窗口内的响应，不自动推荐真实装置 PID 参数；积分绝对误差随观察窗口变化。')
        return area,'IAE = integral_error',{'integral_error':area}
    if eid=='heat_engine':
        pos(c['volume_ml']);pos(c['pressure_kPa']);pos([p['input_heat_J']])
        if c['volume_ml'][0]!=c['volume_ml'][-1] or c['pressure_kPa'][0]!=c['pressure_kPa'][-1]:raise ValueError('循环记录须首尾回到同一 P–V 点，不能自动补闭合。')
        work=integrate(c['volume_ml'],c['pressure_kPa'])*.001
        metric('按采集方向的净功',work,'J');metric('功的绝对值 / 输入热量',100*abs(work)/p['input_heat_J'],'%')
        curve('按采集顺序连接的 P–V 循环',c['volume_ml'],c['pressure_kPa'],'体积（mL）','压强（kPa）')
        notes.append('功的正负取决于循环方向；不得为获得期望符号重新排序。取功的绝对值不等于确认热机方向。')
        return abs(work),'work = absolute_loop_work',{'absolute_loop_work':abs(work)}
    if eid=='temperature_viscosity':
        pos(c['terminal_speed_mm_s']);pos([p['radius_mm'],p['density_difference'],p['gravity_m_s2']])
        if any(t<=-273.15 for t in c['temperature_C']):raise ValueError('温度须高于绝对零度。')
        etas=[2*p['density_difference']*p['gravity_m_s2']*(p['radius_mm']*.001)**2/(9*v*.001) for v in c['terminal_speed_mm_s']]
        curve('由终速得到的各温度黏度',c['temperature_C'],etas,'温度（°C）','黏度（Pa·s）')
        return line([1/(t+273.15) for t in c['temperature_C']],[math.log(v) for v in etas],'绝对温度倒数（1/K）','ln(η / 1 Pa·s)')
    if eid=='wheatstone':
        for key in ['R1_ohm','R2_ohm','R3_ohm']:pos(c[key])
        pos([p['null_tolerance_mV']])
        if any(abs(v)>p['null_tolerance_mV'] for v in c['null_mV']):raise ValueError('检流零位未达到填写的平衡容差，不能套用平衡桥公式。')
        return avg([b*d/a for a,b,d in zip(c['R1_ohm'],c['R2_ohm'],c['R3_ohm'])])
    if eid=='potentiometer':
        pos(c['standard_length_mm']);pos(c['unknown_length_mm']);pos([p['standard_emf_V']])
        return avg([p['standard_emf_V']*b/a for a,b in zip(c['standard_length_mm'],c['unknown_length_mm'])])
    if eid=='dc_source':
        nonneg(c['current_mA']);pos(c['terminal_V'])
        x=[v*.001 for v in c['current_mA']]
        slope=fit(x,c['terminal_V'],'负载电流（A）','端电压（V）',decreasing=True)
        metric('带截距直线估计电动势',mean(c['terminal_V'])-slope*mean(x),'V')
        notes.append('线性源模型 U=E−rI 仅在所测区间适用；稳压源限流或非线性区不能沿用单一内阻。')
        return -slope,'r = -slope',{'slope':slope}
    if eid=='diode':
        pos(c['forward_V']);pos(c['current_mA']);pos([p['temperature_K']])
        curve('正向伏安曲线',c['forward_V'],c['current_mA'],'正向电压（V）','正向电流（mA）')
        return line(c['forward_V'],[math.log(v) for v in c['current_mA']],'正向电压（V）','ln(I / 1 mA)',E_CHARGE/(K_B*p['temperature_K']),inverse=True)
    if eid=='thermistor':
        pos(c['resistance_ohm'])
        if any(t<=-273.15 for t in c['temperature_C']):raise ValueError('温度须高于绝对零度。')
        curve('NTC 电阻温度特性',c['temperature_C'],c['resistance_ohm'],'温度（°C）','电阻（Ω）')
        return line([1/(t+273.15) for t in c['temperature_C']],[math.log(v) for v in c['resistance_ohm']],'绝对温度倒数（1/K）','ln(R / 1 Ω)')
    if eid=='hall_effect':
        pos([p['thickness_mm']]);pos(c['current_mA']);pos(c['field_mT']);pos(c['hall_mV'])
        # Magnitude mode does not infer carrier sign. Four-polarity measurements belong in the lab record.
        x=[a*b*1e-6 for a,b in zip(c['current_mA'],c['field_mT'])]
        return line(x,[v*.001 for v in c['hall_mV']],'I B（A·T）','已反向消偏后的霍尔电压大小（V）',p['thickness_mm']*.001)
    if eid=='helmholtz':
        pos([p['coil_radius_m'],p['current_A']]);pos(c['field_mT']);r=p['coil_radius_m']; current=p['current_A']
        x=[MU0*current*r*r/2*((r*r+(z-r/2)**2)**-1.5+(r*r+(z+r/2)**2)**-1.5) for z in c['axial_m']]
        curve('轴线上磁场分布',c['axial_m'],c['field_mT'],'轴向位置（m）','磁场（mT）')
        return line(x,[v*.001 for v in c['field_mT']],'单匝线圈对模型系数（T/匝）','磁场（T）')
    if eid=='rlc_series':
        ordered(c['frequency_Hz']);pos(c['frequency_Hz']);pos(c['current_mA']);pos(list(p.values()))
        peak=max(range(len(c['current_mA'])),key=c['current_mA'].__getitem__);f=c['frequency_Hz'][peak];threshold=c['current_mA'][peak]/math.sqrt(2)
        theory=1/(2*math.pi*math.sqrt(p['inductance_mH']*.001*p['capacitance_uF']*1e-6));metric('元件参数理论谐振频率',theory,'Hz')
        left=crossing(c['frequency_Hz'][:peak+1],c['current_mA'][:peak+1],threshold);right=crossing(c['frequency_Hz'][peak:],c['current_mA'][peak:],threshold)
        if left and right:
            width=right[0]-left[-1]
            if width>0:metric('半功率插值估计 Q',f/width)
        else:notes.append('扫描未包住两个半功率点，当前记录不能给出带宽和 Q。')
        curve('电流幅频特性',c['frequency_Hz'],c['current_mA'],'频率（Hz）','电流有效值（mA）')
        curve('电路相位特性',c['frequency_Hz'],c['phase_deg'],'频率（Hz）','电流相对源相位（°）')
        notes.append('主结果是采样电流最大值的频率；半功率点采用相邻读数插值，频率步进限制精度。')
        return descriptive(f)
    if eid=='hysteresis':
        h,b=c['field_A_m'],c['flux_T']
        if h[0]!=h[-1] or b[0]!=b[-1]:raise ValueError('磁滞回线须按采集顺序记录完整闭合循环。')
        area=abs(sum((a+d)*(q-v)/2 for a,d,v,q in zip(h,h[1:],b,b[1:])))
        zeros=crossing(h,b,0)
        if zeros:metric('零 B 交点绝对值均值',mean(abs(v) for v in zeros),'A/m')
        curve('磁滞回线：保留方向与顺序',h,b,'磁场强度 H（A/m）','磁感应强度 B（T）')
        notes.append('面积按 ∮H dB 估计每周期单位体积磁损耗；测量链相位误差与积分器漂移需独立校正。')
        return area,'loss = loop_area',{'loop_area':area}
    if eid=='curie_temperature':
        ordered(c['temperature_C']);nonneg(c['remanence_mT']);pos([p['remaining_fraction']])
        if p['remaining_fraction']>=1:raise ValueError('剩余磁性判据须在 0 与 1 之间。')
        threshold=max(c['remanence_mT'])*p['remaining_fraction'];hits=crossing(c['temperature_C'],c['remanence_mT'],threshold)
        if not hits:raise ValueError('采集范围未跨过填写的磁性消失判据，应补测而非外推。')
        curve('随温度的剩磁变化',c['temperature_C'],c['remanence_mT'],'温度（°C）','剩磁（mT）',[threshold]*len(c['temperature_C']))
        notes.append('输出为按填写剩磁比例定义的转变温度估计，不是无条件的热力学居里温度；需考虑热滞后、升降温与背景。')
        return descriptive(hits[0])
    if eid=='electrostatic_field':
        # Complete rectangular grid; central/one-sided differences, no plane assumption.
        xs=sorted(set(c['x_cm']));ys=sorted(set(c['y_cm']));grid={}
        for x,y,v in zip(c['x_cm'],c['y_cm'],c['potential_V']):
            if (x,y) in grid:raise ValueError('坐标格点重复。')
            grid[x,y]=v
        if len(xs)<2 or len(ys)<2 or len(grid)!=len(xs)*len(ys):raise ValueError('请填写至少 2×2 的完整矩形坐标网格。')
        field=[]
        for x,y in zip(c['x_cm'],c['y_cm']):
            i,j=xs.index(x),ys.index(y);a,d=xs[max(0,i-1)],xs[min(len(xs)-1,i+1)];v,q=ys[max(0,j-1)],ys[min(len(ys)-1,j+1)]
            ex=-(grid[d,y]-grid[a,y])/((d-a)*.01);ey=-(grid[x,q]-grid[x,v])/((q-v)*.01);field.append(math.hypot(ex,ey))
        # A genuine spatial map, rendered as coloured grid points in the frontend.
        return_value=mean(field)
        chart('二维电势测量图',c['x_cm'],c['y_cm'],'x（cm）','y（cm）')
        metric('网格最大场强估计',max(field),'V/m')
        notes.append('用内部中心差分、边界单边差分估计 E=−∇V；结果是网格各点场强大小均值，不能替代完整电场矢量分布。网格间距会影响估计。')
        return return_value,'E_mean = measured_value',{'measured_value':return_value}
    if eid=='solar_cell':
        nonneg(c['voltage_V']);nonneg(c['current_mA']);ordered(c['voltage_V'])
        if c['voltage_V'][0]!=0 or c['current_mA'][-1]!=0:raise ValueError('完整伏安记录须包含 U=0 的短路点和 I=0 的开路点。')
        powers=[v*i for v,i in zip(c['voltage_V'],c['current_mA'])];pm=max(powers)
        metric('开路电压',c['voltage_V'][-1],'V');metric('短路电流',c['current_mA'][0],'mA')
        pos([c['voltage_V'][-1],c['current_mA'][0]])
        metric('采样填充因子',pm/(c['voltage_V'][-1]*c['current_mA'][0]))
        curve('太阳能电池伏安特性',c['voltage_V'],c['current_mA'],'负载电压（V）','输出电流（mA）')
        curve('功率与工作电压',c['voltage_V'],powers,'负载电压（V）','电功率（mW）')
        notes.append('最大功率取采样点，不自动找连续最优点；没有测量入射辐射功率时不能报告光电转换效率。')
        return descriptive(pm)
    if eid=='magnetoresistance':
        nonneg(c['field_T']);pos(c['resistance_ohm']);pos([p['zero_field_resistance']])
        return line([v*v for v in c['field_T']],[(v-p['zero_field_resistance'])/p['zero_field_resistance'] for v in c['resistance_ohm']],'B²（T²）','电阻相对变化')
    if eid=='magnetic_pendulum':
        pos(c['field_uT']);pos(c['period_s']);pos([p['inertia_kg_m2']])
        return line([1/(v*1e-6) for v in c['field_uT']],[v*v for v in c['period_s']],'总磁场倒数（1/T）','周期平方（s²）',4*math.pi**2*p['inertia_kg_m2'],inverse=True)
    if eid=='wireless_power':
        nonneg(c['distance_cm']);pos(c['input_W']);nonneg(c['received_W']);pos([p['frequency_kHz']])
        ratios=[100*b/a for a,b in zip(c['input_W'],c['received_W'])]
        curve('同一供电条件下的传输效率',c['distance_cm'],ratios,'线圈距离（cm）','电功率传输比例（%）')
        if max(ratios)>100:notes.append('比例超过 100%，应检查同时测量、功率定义和标定，不能当真实效率。')
        return descriptive(max(ratios))
    if eid=='fuel_cell':
        nonneg(c['current_A']);pos(c['terminal_V']);powers=[a*b for a,b in zip(c['current_A'],c['terminal_V'])]
        curve('燃料电池极化曲线',c['current_A'],c['terminal_V'],'输出电流（A）','端电压（V）')
        curve('采样工作点电功率',c['current_A'],powers,'输出电流（A）','电功率（W）')
        notes.append('主结果为所扫工作点的最大电功率；没有燃料流量和热值记录时不计算能量效率。')
        return descriptive(max(powers))
    if eid=='railgun':
        ordered(c['time_ms']);nonneg(c['current_A']);nonneg(c['voltage_V']);pos([p['projectile_mass_g'],p['exit_speed_m_s']])
        energy=integrate([v*.001 for v in c['time_ms']],[a*b for a,b in zip(c['current_A'],c['voltage_V'])]);pos([energy])
        kinetic=.5*p['projectile_mass_g']*.001*p['exit_speed_m_s']**2;metric('记录窗口电能',energy,'J');metric('出射动能',kinetic,'J')
        curve('教学演示装置的电功率脉冲',c['time_ms'],[a*b for a,b in zip(c['current_A'],c['voltage_V'])],'时间（ms）','输入功率（W）')
        notes.append('此比例仅对填写的脉冲窗口；需另记储能剩余、机械损耗及装置记录，不据此设计高能发射装置。')
        return 100*kinetic/energy,'eta_percent = 100 * kinetic / input_energy',{'kinetic':kinetic,'input_energy':energy}
    if eid in {'prism_refraction','abbe_refractometer','lens_group','lens_bessel','optical_flatness','color_design','optical_cloaking','dancing_coin'}:
        if eid=='prism_refraction':
            pos([p['apex_deg']]);pos(c['minimum_deviation_deg'])
            if p['apex_deg']>=180 or any(p['apex_deg']+d>=180 for d in c['minimum_deviation_deg']):raise ValueError('顶角与最小偏向角须符合透射棱镜几何。')
            return avg([math.sin(math.radians((p['apex_deg']+d)/2))/math.sin(math.radians(p['apex_deg']/2)) for d in c['minimum_deviation_deg']])
        if eid=='abbe_refractometer':
            pos([p['prism_index']])
            if any(not 0<a<90 for a in c['critical_angle_deg']):raise ValueError('临界角在 0° 与 90° 之间。')
            return avg([p['prism_index']*math.sin(math.radians(v)) for v in c['critical_angle_deg']])
        if eid=='lens_group':
            for v in c.values():pos(v)
            den=[a+b-d for a,b,d in zip(c['f1_cm'],c['f2_cm'],c['separation_cm'])];pos(den,'正有效焦距分母')
            values=[a*b/v for a,b,v in zip(c['f1_cm'],c['f2_cm'],den)]
            metric('第一主平面相对第一镜片的模型位移',mean(d*a/v for a,d,v in zip(c['f1_cm'],c['separation_cm'],den)),'cm')
            metric('第二主平面相对第二镜片的模型位移',mean(-d*b/v for b,d,v in zip(c['f2_cm'],c['separation_cm'],den)),'cm')
            return avg(values)
        if eid=='lens_bessel':
            pos(c['object_screen_cm']);nonneg(c['lens_displacement_cm'])
            if any(a<=b for a,b in zip(c['object_screen_cm'],c['lens_displacement_cm'])):raise ValueError('屏物距离应大于两次清晰成像的透镜位移。')
            return avg([(a*a-b*b)/(4*a) for a,b in zip(c['object_screen_cm'],c['lens_displacement_cm'])])
        if eid=='optical_flatness':
            pos(c['fringe_spacing_mm']);pos([p['wavelength_nm']]);nonneg(c['fringe_bend_mm'])
            heights=[p['wavelength_nm']/2*a/b for a,b in zip(c['fringe_bend_mm'],c['fringe_spacing_mm'])]
            curve('条纹弯曲得到的局部高度估计',list(range(1,len(heights)+1)),heights,'测点','局部相对高度（nm）')
            notes.append('报告采样点最大相对高度，不自动认证整个工件平整度；必须核实条纹级次、参考平晶和反射双程。')
            return descriptive(max(heights))
        if eid=='color_design':
            if any(not 0<=v<=255 for values in c.values() for v in values):raise ValueError('sRGB 码值范围为 0–255。')
            def decode(v):
                v=v/255;return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
            values=[.2126*decode(r)+.7152*decode(g)+.0722*decode(b) for r,g,b in zip(c['red'],c['green'],c['blue'])]
            notes.append('使用标准 sRGB 解码和相对亮度系数；码值不是线性光强。未标定显示器时这是编码计算练习，不是照度实测。')
            return avg(values)
        if eid=='optical_cloaking':
            pos(c['reference_contrast']);nonneg(c['cloak_contrast'])
            ratios=[100*b/a for a,b in zip(c['reference_contrast'],c['cloak_contrast'])]
            curve('各观测角的可见对比度比例',c['view_angle_deg'],ratios,'观察角（°）','装置 / 基准对比度（%）')
            notes.append('评价有限视角下目标对比度，不等同于普遍隐身；需另记录背景透射、视场、像差及未放装置的照片。')
            return descriptive(mean(ratios))
        if eid=='dancing_coin':
            pos([p['initial_K'],p['ambient_Pa'],p['opening_radius_mm']]);pos(c['coin_mass_g'])
            t=[v+273.15 for v in c['lift_temperature_C']];pos(t)
            area=math.pi*(p['opening_radius_mm']*.001)**2
            pressure=[p['ambient_Pa']*(v/p['initial_K']-1) for v in t]
            metric('硬币重量 / 孔口面积的均值',mean(c['coin_mass_g'])*.001*9.81/area,'Pa')
            curve('观测抬升温度与硬币质量',c['coin_mass_g'],c['lift_temperature_C'],'硬币质量（g）','抬升时气体温度（°C）')
            notes.append('恒定密闭气量模型只在抬升前使用；抬升后泄气使周期过程不能继续直接用定容气体比例。')
            return avg(pressure)
    if eid in {'fresnel_biprism','grating_characteristics','wire_diffraction','holography','infrared_radiation','stereo_display','white_light_interference','doppler','acoustic_levitation','ultrasonic_echo','hydrogen_spectrum','thermionic_work_function','nuclear_decay','microwave_properties','microwave_bragg','light_speed'}:
        if eid=='light_speed':
            pos(c['optical_path_m']);pos(c['delay_ns'])
            return line(c['optical_path_m'],c['delay_ns'],'实际单程光路长度（m）','传播时延（ns）',1e9,inverse=True)
        if eid=='fresnel_biprism':
            integer(c['order']);pos([p['virtual_separation_mm'],p['screen_distance_m']])
            return line(c['order'],c['position_mm'],'亮纹级次','位置（mm）',p['virtual_separation_mm']/p['screen_distance_m']*1000)
        if eid=='grating_characteristics':
            pos(c['wavelength_nm']);pos([p['order'],p['illuminated_width_mm']])
            if not p['order'].is_integer() or any(not 0<a<90 for a in c['angle_deg']):raise ValueError('级次须为正整数，正侧角须在 0° 与 90° 内。')
            result=line(c['wavelength_nm'],[math.sin(math.radians(v)) for v in c['angle_deg']],'已知波长（nm）','sin θ',1e6/p['order'])
            lines=result[0];metric('理想分辨本领 mN',p['order']*lines*p['illuminated_width_mm'])
            metric('平均角处的理论角色散',180/math.pi*p['order']*lines*1e-6/math.cos(math.radians(mean(c['angle_deg']))),'°/nm')
            return result
        if eid=='wire_diffraction':
            integer(c['dark_order']);pos(c['dark_angle_deg']);pos([p['wavelength_nm']])
            if any(v>=90 for v in c['dark_angle_deg']):raise ValueError('衍射角须小于 90°。')
            return line(c['dark_order'],[math.sin(math.radians(v)) for v in c['dark_angle_deg']],'暗纹级次','sin θ',p['wavelength_nm']*.001,inverse=True)
        if eid=='holography':
            if any(not 0<a<180 for a in c['beam_angle_deg']):raise ValueError('两束光夹角须在 0° 与 180° 内。')
            pos(c['fringe_pitch_um'])
            notes.append('由记录夹角与条纹间距核对记录几何；光源相干性、曝光、振动和再现图像需另行观察，此计算不生成全息照片。')
            return line([2*math.sin(math.radians(v/2)) for v in c['beam_angle_deg']],[1/v for v in c['fringe_pitch_um']],'2 sin(记录夹角/2)','条纹间距倒数（1/μm）',1000,inverse=True)
        if eid=='infrared_radiation':
            pos(c['temperature_K']);pos(c['net_power_mW']);pos([p['ambient_K'],p['area_m2']])
            if any(v<=p['ambient_K'] for v in c['temperature_K']):raise ValueError('物体温度須高于环境。')
            notes.append('黑体总波段功率关系只适用于已标定总辐射测量；窄带红外相机不能直接按 T⁴ 处理。')
            return line([v**4-p['ambient_K']**4 for v in c['temperature_K']],[v*.001 for v in c['net_power_mW']],'T⁴−T环境⁴（K⁴）','净辐射功率（W）',1/(5.670374419e-8*p['area_m2']))
        if eid=='stereo_display':
            pos(c['depth_m']);pos(c['parallax_mm']);pos([p['focal_length_mm']])
            notes.append('使用已校正平行双视点的几何视差，不自动确认显示器串扰、眼位或舒适范围；正深度与零视差参考须另记。')
            return line([1/(v*1000) for v in c['depth_m']],c['parallax_mm'],'物距倒数（1/mm）','校正视差（mm）',1/p['focal_length_mm'])
        if eid=='white_light_interference':
            integer(c['envelope_order']);pos(c['mirror_shift_um']);pos([p['known_step_nm']])
            metric('填写的已知台阶高度',p['known_step_nm'],'nm')
            # Sample heights derived from separation of the two zero-path-difference envelopes.
            notes.append('输入同一方向扫描中已识别的两反射面包络位移差；反射光程的因子 2 在两边抵消。包络不是单色条纹级次。')
            return avg([v*1000 for v in c['mirror_shift_um']])
        if eid=='doppler':
            pos(c['radial_speed_m_s']);pos(c['frequency_shift_Hz']);pos([p['source_Hz']])
            notes.append('这里采用低速同轴反射的一阶关系 Δf≈2f₀v/c；有限速度修正、径向投影和直接接收法的因子不同。')
            return line(c['radial_speed_m_s'],c['frequency_shift_Hz'],'目标径向速度（m/s）','反射频移（Hz）',2*p['source_Hz'],inverse=True)
        if eid in {'acoustic_levitation','microwave_properties'}:
            integer(c['node_order']);ordered(c['node_order']);pos(c['node_position_mm']);pos([p['frequency_kHz'] if eid=='acoustic_levitation' else p['frequency_GHz']])
            freq=p['frequency_kHz']*1000 if eid=='acoustic_levitation' else p['frequency_GHz']*1e9
            return line(c['node_order'],c['node_position_mm'],'相邻节点序号','节点位置（mm）',2*.001*freq)
        if eid=='ultrasonic_echo':
            pos(c['known_depth_mm']);pos(c['echo_time_us'])
            return line(c['known_depth_mm'],c['echo_time_us'],'已知反射面深度（mm）','往返回波时间（μs）',2000,inverse=True)
        if eid=='hydrogen_spectrum':
            integer(c['upper_n']);pos(c['wavelength_nm'])
            if any(v<=2 for v in c['upper_n']):raise ValueError('巴耳末系上能级 n 须大于 2。')
            return line([.25-1/v**2 for v in c['upper_n']],[1e9/v for v in c['wavelength_nm']],'1/2²−1/n²','波长倒数（1/m）')
        if eid=='thermionic_work_function':
            pos(c['temperature_K']);pos(c['saturation_current_A'])
            slope=fit([1/v for v in c['temperature_K']],[math.log(i/(t*t)) for t,i in zip(c['temperature_K'],c['saturation_current_A'])],'温度倒数（1/K）','ln(I/T² 的数值)',decreasing=True)
            return -slope*K_B/E_CHARGE,'work_eV = -slope * k / e',{'slope':slope,'k':K_B,'e':E_CHARGE}
        if eid=='nuclear_decay':
            ordered(c['elapsed_s']);nonneg(c['elapsed_s']);nonneg(c['rate_cps']);nonneg([p['background_cps']])
            rates=[v-p['background_cps'] for v in c['rate_cps']];pos(rates,'扣除本底后的计数率')
            curve('本底扣除后的衰减曲线',c['elapsed_s'],rates,'时间（s）','净计数率（1/s）')
            slope=fit(c['elapsed_s'],[math.log(v) for v in rates],'时间（s）','ln(净计数率 / 1 s⁻¹)',decreasing=True)
            return -math.log(2)/slope,'half_life = -ln2 / slope',{'ln2':math.log(2),'slope':slope}
        if eid=='microwave_bragg':
            integer(c['order']);pos([p['lattice_spacing_cm']])
            if any(not 0<a<90 for a in c['bragg_angle_deg']):raise ValueError('布拉格角须在 0° 和 90° 之间。')
            return line(c['order'],[math.sin(math.radians(v)) for v in c['bragg_angle_deg']],'衍射级次','sin(布拉格角)',2*p['lattice_spacing_cm'])
    if eid=='diffraction_intensity':
        ordered(c['position_mm']);nonneg(c['intensity']);pos([p['wavelength_nm'],p['screen_distance_m']])
        positions=c['position_mm'];signal=c['intensity'];peak=max(range(len(signal)),key=signal.__getitem__)
        candidates=[i for i in range(peak+1,len(signal)-1) if signal[i]<=signal[i-1] and signal[i]<signal[i+1] and signal[i]<=.1*signal[peak]]
        if not candidates:raise ValueError('正侧扫描未出现可识别的第一个极小值，应扩大扫描范围。')
        first=candidates[0];offset=positions[first]-positions[peak];pos([offset])
        angle=math.atan(offset*.001/p['screen_distance_m']);width=p['wavelength_nm']*1e-6/math.sin(angle)
        curve('衍射光强扫描',positions,signal,'屏位置（mm）','背景扣除后的相对光强')
        metric('采样第一极小相对位置',offset,'mm')
        notes.append('寻找低于中央峰 10% 的正侧首个局部极小，避免把主峰顶部小波动当暗纹。强噪声仍可能误认，需要手工核对中央峰、极小和背景；不是通用峰识别。')
        return width,'width_mm = measured_width',{'measured_width':width}
    if eid=='chaos':
        ordered(c['time_s']);signal=c['x_V'];pos([stdev(signal)],'信号变化')
        curve('时域记录',c['time_s'],signal,'时间（s）','x 通道（V）')
        curve('同步双通道相图',signal,c['y_V'],'x 通道（V）','y 通道（V）')
        peaks=[v for i,v in enumerate(signal[1:-1],1) if v>signal[i-1] and v>=signal[i+1]]
        if len(peaks)>2:curve('相邻峰值返回图',peaks[:-1],peaks[1:],'本次峰值（V）','下一次峰值（V）')
        notes.append('主结果只是信号样本标准差；复杂相图或宽谱不等同于混沌证据。需补参数扫描、分岔、截面、初值敏感性与噪声排查。')
        return descriptive(stdev(signal))
    if eid=='millikan':
        for v in c.values():pos(v)
        integer(c['charge_number']);pos(list(p.values()))
        eta=p['air_viscosity'];rho=p['density_difference'];g=p['gravity_m_s2'];gap=p['plate_gap_mm']*.001;pressure=p['pressure_Pa'];b=p['slip_constant_Pa_m']
        charges=[]
        for speed,u in zip(c['fall_speed_mm_s'],c['balance_voltage_V']):
            v=speed*.001;r0=math.sqrt(9*eta*v/(2*rho*g));correction=1+b/(pressure*r0)
            charges.append(6*math.pi*eta*v*r0*gap/u/correction**1.5)
        # Assigned integer n is supplied by the student, not inferred from q/e by the software.
        notes.append('使用静态平衡法和 b/(p r₀) 黏性修正。整数电荷数须独立提出并论证；软件不会自动按已知 e 四舍五入来“验证”量子化。')
        curve('各油滴修正后的电荷',c['charge_number'],[q/E_CHARGE for q in charges],'独立指定电荷数 n','q / 已知 e（仅对照）')
        return line(c['charge_number'],charges,'独立指定电荷数 n','修正电荷（C）')
    if eid=='electron_em':
        for v in c.values():pos(v)
        pos([p['coil_radius_m'],p['turns']])
        if not p['turns'].is_integer():raise ValueError('线圈匝数须为正整数。')
        coefficient=(4/5)**1.5*MU0*p['turns']/p['coil_radius_m']
        return avg([2*u/((coefficient*i)**2*(r*.001)**2) for u,i,r in zip(c['accelerating_V'],c['coil_current_A'],c['orbit_radius_mm'])])
    if eid=='nuclear_counts':
        pos(c['gate_s']);nonneg(c['counts']);nonneg([p['background_counts']]);pos([p['background_gate_s']])
        if any(not float(v).is_integer() for v in c['counts']) or not p['background_counts'].is_integer():raise ValueError('累计计数应为非负整数。')
        bg=p['background_counts']/p['background_gate_s'];rates=[n/t-bg for n,t in zip(c['counts'],c['gate_s'])]
        if mean(rates)<=0:raise ValueError('本底扣除后的均值不为正，应增加计数时间并检查信号。')
        metric('本底计数率',bg,'1/s')
        curve('独立计数窗的净计数率',list(range(1,len(rates)+1)),rates,'计数窗','净计数率（1/s）')
        notes.append('泊松统计适用于独立计数；同一份本底在各窗间相关，不能把本底不确定度当独立项简单除以 √N。')
        metric('平均计数率的泊松标准不确定度',math.sqrt(sum(n/t**2 for n,t in zip(c['counts'],c['gate_s']))/len(rates)**2+p['background_counts']/p['background_gate_s']**2),'1/s')
        return avg(rates)
    raise ValueError('教材实验缺少对应的数据模型。')
