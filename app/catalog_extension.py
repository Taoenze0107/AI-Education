"""Additional laboratory models. No evaluation of user-provided expressions."""
import math

# id, title, area, input key/label/unit, output key/label/unit, transform,
# slope-to-result factor, invert slope, ideal slope, intercept, raw x,
# relation, reported quantity/unit, apparatus, applicability, field check, error.
SPECS = [
('photoelectric_effect','光电效应测普朗克常量','optics','frequency_THz','光频率','THz','stopping_voltage_V','截止电压','V','identity',1.602176634e-31,False,0.004135667696,-1.9,[520,560,600,650,700,750,820],'e U_s = h f - W','普朗克常量','J·s','光电效应仪、单色光源','截止电压取反向电压的正值大小；光频率高于红限','核查暗电流与接触电势，并重复寻找截止电压','把 THz 当 Hz 会造成 10¹² 倍错误'),
('malus_law','马吕斯定律：偏振光强','optics','angle_deg','检偏夹角','°','intensity_lux','透射照度','lx','cos2',1,False,800,15,[10,20,30,40,50,60,70],'I = I0 cos²(theta) + I_background','偏振分量照度','lx','偏振片、检偏器、照度计','入射光近似线偏振，探测器在线性范围内','遮光测背景并固定光源与探测器距离','把角度制直接交给弧度三角函数'),
('single_slit','单缝衍射测缝宽','optics','order','暗纹级次','1','sin_angle','衍射角正弦','1','identity',632.8e-6,True,0.003164,0,[1,2,3,4,5,6,7],'a sin(theta) = m lambda；lambda=632.8 nm','缝宽','mm','单缝、632.8 nm 激光器、屏尺','垂直入射；输入正侧暗纹正整数级次','核查中央亮纹和第一级暗纹，独立确认激光波长','混淆暗纹级次与亮纹级次'),
('michelson','迈克耳孙干涉测波长','optics','fringe_count','累计条纹数','1','mirror_shift_um','镜面位移','μm','identity',2000,False,0.3164,0,[10,20,30,40,50,60,70],'2 delta_d = N lambda','波长','nm','迈克耳孙干涉仪、微动机构','反射镜位移使光程改变两倍；使用同一方向读数','核查微动机构传动比并避免回程差','遗漏往返光程的因子 2'),
('newton_rings','牛顿环测透镜曲率半径','optics','order','暗环级次','1','diameter_mm','暗环直径','mm','square_y',1/(4*589.3e-3),False,2.3572,0,[2,4,6,8,10,12,14],'D_m² = 4 R lambda m；lambda=589.3 nm','曲率半径','m','牛顿环装置、读数显微镜、钠光灯','反射暗环、近轴球面与空气膜近似','直径须测左右两侧，核查级次与波长','把半径当直径或忘记直径平方'),
('optical_rotation','旋光法测溶液比旋光度','optics','concentration_g_ml','质量浓度','g/mL','rotation_deg','旋光角','°','identity',1,False,66.5,0,[0.02,0.04,0.06,0.08,0.10,0.12,0.14],'theta = [alpha] l c；l=1 dm','比旋光度','°·mL/(g·dm)','旋光仪、1 dm 样品管、标准溶液','固定波长及温度；样品管长为 1 dm','用溶剂调零并检查气泡和浓度配置','把百分浓度直接当 g/mL'),
('centripetal_force','向心力与角速度','mechanics','angular_speed_rad_s','角速度','rad/s','force_N','径向合力','N','square_x',1/0.1,False,0.02,0,[2,3,4,5,6,7,8],'F = m r omega²；r=0.10 m','转动质量','kg','向心力实验仪、转速计','圆周运动；半径固定为 0.10 m','测量旋转轴到质心的半径，并换算转速','将转每分直接代入角速度'),
('rotational_inertia','转动定律测转动惯量','mechanics','angular_accel','角加速度','rad/s²','net_torque_Nm','合力矩','N·m','identity',1,False,0.012,0,[1,2,3,4,5,6,7],'M_net = J alpha','转动惯量','kg·m²','转动惯量仪、力传感器、光电计时器','刚体定轴转动；输入关于同一转轴的合力矩','测量有效力臂并扣除已独立测得的摩擦力矩','把驱动力矩当合力矩'),
('kinetic_friction','水平滑动测动摩擦系数','mechanics','normal_force_N','支持力','N','friction_N','滑动摩擦力','N','identity',1,False,0.25,0,[1,2,3,4,5,6,7],'F_f = mu_k N','动摩擦系数','1','木块、砝码、拉力传感器','水平匀速滑动；拉力沿水平方向','检查速度稳定并区分起动峰值和滑动值','把最大静摩擦峰值作为动摩擦力'),
('hydrostatic_pressure','液体压强随深度变化','mechanics','depth_m','深度','m','gauge_pressure_Pa','表压','Pa','identity',1/9.81,False,9810,0,[0.02,0.04,0.06,0.08,0.10,0.12,0.14],'p_gauge = rho g h；g=9.81 m/s²','液体密度','kg/m³','液柱、深度尺、压差传感器','静止、均匀液体；测量相对液面的大气表压','探头调零并以液面为深度零点','混淆绝对压强与表压'),
('stokes_viscosity','落球法测液体黏度','mechanics','radius_mm','小球半径','mm','terminal_speed_mm_s','终端速度','mm/s','square_x',2*(7800-1260)*9.81*1e-3/9,True,2*(7800-1260)*9.81*1e-3/(9*1.2),0,[0.15,0.18,0.21,0.24,0.27,0.30,0.33],'v = 2(rho_ball-rho_liquid)g r²/(9 eta)','动力黏度','Pa·s','小球、宽量筒、黏性液体、计时器','低雷诺数、已达终速且壁效应可忽略；球/液密度7800/1260 kg/m³','比较两段计时，测温，并检查球径远小于容器直径','把直径作为半径或在加速段计时'),
('young_modulus','拉伸法测杨氏模量','mechanics','force_N','拉力','N','elongation_um','伸长量','μm','identity',1000,True,5,0,[2,4,6,8,10,12,14],'delta_L = F L/(E A)；L=1 m，A=1 mm²','杨氏模量','GPa','金属丝、砝码、微位移计','线弹性范围；原长1 m、截面积1 mm²','分级加卸载检查滞后，独立测量丝径','把直径误差忽略，或超过弹性限度'),
('charge_capacitance','电荷—电压法测电容','electricity','voltage_V','电压','V','charge_uC','电荷量','μC','identity',1,False,2.2,0,[1,2,3,4,5,6,7],'Q = C U','电容','μF','电容器、电荷计、直流源','线性电容，电压不超过额定值','调零电荷计并检查漏电与残余电荷','把 μC 当 C'),
('parallel_plate','平行板电容与板间距','electricity','gap_mm','板间距','mm','capacitance_pF','电容','pF','inverse_x',1/(8.8541878128*10),False,88.541878128,2,[0.5,0.7,0.9,1.1,1.3,1.5,1.7],'C = epsilon0 epsilon_r A/d + C_stray；A=0.01 m²','相对介电常数','1','平行板电容器、电容表、测微器','面积0.01 m²，均匀介质；边缘场相对较小','测量平行度及板间距，记录杂散电容','把杂散电容全部归入介质效应'),
('solenoid_field','螺线管磁场与电流','electricity','current_A','电流','A','field_mT','轴向磁感应强度','mT','identity',1/(4*math.pi*1e-4),False,4*math.pi*1e-4*1000,0,[0.1,0.2,0.3,0.4,0.5,0.6,0.7],'B = mu0 n I','有效匝密度','1/m','长螺线管、霍尔探头、恒流源','空气芯长螺线管中央区域；忽略端部修正','霍尔探头调零，方向与轴线一致并测量匝数/长度','把端部磁场当无限长螺线管中央场'),
('ampere_force','安培力测磁感应强度','electricity','current_A','导线电流','A','force_mN','安培力','mN','identity',0.01,False,20,0,[0.1,0.2,0.3,0.4,0.5,0.6,0.7],'F = B I L；L=0.10 m，导线垂直磁场','磁感应强度','T','磁体、直导线、电子天平、电流源','有效导线长0.10 m且垂直于均匀磁场','反转电流核查力的方向，扣除支架本底','混淆质量读数与力读数'),
('faraday_induction','法拉第电磁感应定律','electricity','field_rate_T_s','磁场变化率大小','T/s','emf_V','感应电动势大小','V','identity',1/0.01,False,2,0,[0.01,0.02,0.03,0.04,0.05,0.06,0.07],'abs(emf) = N A abs(dB/dt)；A=0.01 m²','有效线圈匝数','1','励磁线圈、探测线圈、示波器','固定线圈面积0.01 m²，磁场近似均匀且垂直线圈面','同步测量磁场变化率与电压，极性另行验证楞次定律','用磁场本身代替磁场变化率'),
('boyle_law','玻意耳定律：等温压缩','thermal','volume_ml','气体体积','mL','pressure_kPa','绝对压强','kPa','inverse_x',1,False,5000,0,[30,35,40,45,50,55,60],'P V = constant','等温 PV 常量','kPa·mL','密闭注射筒、压力传感器、温度计','固定气体量、缓慢等温、使用绝对压强','计入连接管死体积并等待温度稳定','把表压代入绝对压强公式'),
('constant_volume_gas','定容气体压强与温度','thermal','temperature_C','温度','°C','pressure_kPa','绝对压强','kPa','kelvin_x',1,False,0.34,0,[5,15,25,35,45,55,65],'P = (n R/V) T_K','压强温度系数','kPa/K','定容气室、水浴、温压传感器','体积及物质的量不变，气体近似理想气体','检漏、恒温后读数并使用开尔文温度','把摄氏温度直接用于气体比例定律'),
('newton_cooling','牛顿冷却定律','thermal','time_s','冷却时间','s','temperature_C','物体温度','°C','cooling',1,True,0.01,math.log(60),[0,20,40,60,80,100,120],'T-20 = A exp(-t/tau)','冷却时间常数','s','温度探头、热水容器、计时器','环境恒为20°C；温度均匀、换热系数近似恒定','记录环境温度，搅拌均匀并核查探头响应','直接对摄氏温度取对数而未减环境温度'),
('thermal_conduction','稳态导热测导热系数','thermal','temperature_difference_K','两端温差','K','heat_power_W','通过样品热功率','W','identity',0.01/0.001,False,0.02,0,[5,10,15,20,25,30,35],'P = k A delta_T/L；L=0.01 m，A=0.001 m²','导热系数','W/(m·K)','平板样品、热流计、两端温度探头','一维稳态导热；厚0.01 m、面积0.001 m²','等待稳态并检查侧向散热和接触热阻','未经修正就把电加热功率当通过样品的热流'),
('torsion_pendulum','扭摆测扭转系数','waves','inertia_kg_m2','转动惯量','kg·m²','period_s','周期','s','square_y',4*math.pi**2,True,4*math.pi**2/0.04,0.4,[0.001,0.002,0.003,0.004,0.005,0.006,0.007],'T² = 4 pi² (J + J0)/kappa','扭转系数','N·m/rad','扭摆、标准惯量附件、计时器','小扭角、线性回复力矩；附件同轴','多周期计时，核查附件惯量和平台本底惯量','强制过原点忽略平台本底惯量'),
('sound_timeflight','声波飞行时间测声速','waves','distance_m','传播距离','m','transit_time_ms','单程传播时间','ms','identity',1000,True,1000/343,0.05,[0.2,0.3,0.4,0.5,0.6,0.7,0.8],'t = d/v + t_delay','声速','m/s','声波发射器、接收器、示波器','使用单程直达声；同一触发延迟','记录温湿度并区分直达波和回波','把往返时间当单程时间'),
('damped_oscillation','阻尼振动的振幅衰减','waves','time_s','峰值时刻','s','amplitude_mm','正峰包络振幅','mm','log_decay',1,False,0.08,math.log(20),[0,2,4,6,8,10,12],'A = A0 exp(-beta t)','振幅衰减系数','1/s','阻尼振子、位移传感器、记录仪','欠阻尼自由振动，取同号峰值包络；零位已校正','从平衡位置测幅值，检查摩擦与空气阻力是否近似线性','把能量衰减系数当振幅衰减系数'),
]
BY_ID = {s[0]: s for s in SPECS}

def transform(spec, x, y):
    mode = spec[9]
    if mode == 'cos2':
        if any(not 0 <= v <= 90 for v in x): raise ValueError('检偏夹角须在0到90度之间。')
        x = [math.cos(math.radians(v))**2 for v in x]
    elif mode == 'inverse_x': x = [1/v for v in x]
    elif mode == 'square_x': x = [v*v for v in x]
    elif mode == 'square_y': y = [v*v for v in y]
    elif mode == 'kelvin_x':
        if any(v <= -273.15 for v in x): raise ValueError('温度必须高于绝对零度。')
        x = [v+273.15 for v in x]
    elif mode in ('cooling','log_decay'):
        y = [math.log(v-20 if mode == 'cooling' else v) for v in y]
        x = [-v for v in x]
    return x,y

def process(spec, columns, fitted):
    x,y = columns[spec[3]],columns[spec[6]]
    mode = spec[9]
    if mode == 'kelvin_x':
        if any(v <= -273.15 for v in x): raise ValueError('温度低于绝对零度。')
    elif any(v < 0 or (v == 0 and mode not in ('cos2','cooling','log_decay')) for v in x):
        raise ValueError('本模型要求正的自变量；计时及检偏角允许为零。')
    if any(v <= (20 if mode == 'cooling' else 0) for v in y):
        raise ValueError('读数必须为正；冷却温度须高于20°C环境温度。')
    if spec[0] in ('single_slit','newton_rings','michelson') and any(not float(v).is_integer() for v in x):
        raise ValueError('级次或条纹数必须是正整数。')
    if spec[0] == 'single_slit' and any(v >= 1 for v in y): raise ValueError('衍射角正弦必须介于0和1之间。')
    if mode in ('cooling','log_decay') and any(b<=a for a,b in zip(x,x[1:])):
        raise ValueError('时间必须严格递增。')
    tx,ty = transform(spec,x,y)
    xl=f'{spec[4]}（{spec[5]}）'; yl=f'{spec[7]}（{spec[8]}）'
    if mode=='cos2': xl='cos²(检偏夹角)'
    if mode=='inverse_x': xl=f'{spec[4]}倒数（1/{spec[5]}）'
    if mode=='square_x': xl=f'{spec[4]}平方（{spec[5]}²）'
    if mode=='square_y': yl=f'{spec[7]}平方（{spec[8]}²）'
    if mode=='kelvin_x': xl='绝对温度（K）'
    if mode in ('cooling','log_decay'):
        xl='负时间（s）'; yl='ln((T-20°C)/1K)' if mode=='cooling' else 'ln(A/1mm)'
    slope=fitted(tx,ty,xl,yl)
    value=spec[10]/slope if spec[11] else spec[10]*slope
    return value, ('result = factor / slope' if spec[11] else 'result = factor * slope'), {'factor':spec[10],'slope':slope}
