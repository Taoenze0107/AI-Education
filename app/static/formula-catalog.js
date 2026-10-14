'use strict';

window.LabFormulaCatalog = Object.freeze({
  "ohms_law": {
    source: "U = RI",
    lines: [
      { tex: String.raw`U=RI` },
    ],
  },
  "rc_time_constant": {
    source: "τ = RC；Vc = V₀ + (V∞−V₀)(1−e^(−t/τ))",
    lines: [
      { tex: String.raw`\tau=RC` },
      { tex: String.raw`V_c=V_0+(V_\infty-V_0)\left(1-e^{-\frac{t}{\tau}}\right)` },
    ],
  },
  "simple_pendulum": {
    source: "g = 4π²L / T²",
    lines: [
      { tex: String.raw`g=\frac{4\pi^2L}{T^2}` },
    ],
  },
  "hookes_law": {
    source: "F = kx",
    lines: [
      { tex: String.raw`F=kx` },
    ],
  },
  "spring_oscillation": {
    source: "T² = (4π²/k)m + 截距",
    lines: [
      { tex: String.raw`T^2=\frac{4\pi^2}{k}m+\text{截距}` },
    ],
  },
  "free_fall": {
    source: "h = ½gt²",
    lines: [
      { tex: String.raw`h=\frac{1}{2}gt^2` },
    ],
  },
  "inclined_friction": {
    source: "μs = tanθc",
    lines: [
      { tex: String.raw`\mu_s=\tan\theta_c` },
    ],
  },
  "thin_lens": {
    source: "1/f = 1/u + 1/v",
    lines: [
      { tex: String.raw`\frac{1}{f}=\frac{1}{u}+\frac{1}{v}` },
    ],
  },
  "snell_refraction": {
    source: "n₁sin i = n₂sin r",
    lines: [
      { tex: String.raw`n_1\sin i=n_2\sin r` },
    ],
  },
  "double_slit": {
    source: "λ = Δy·d / D",
    lines: [
      { tex: String.raw`\lambda=\frac{\Delta y\,d}{D}` },
    ],
  },
  "calorimetry": {
    source: "mₘcₘ(Tₕ−T𝒻) = m𝑤c𝑤(T𝒻−T𝒸)",
    lines: [
      { tex: String.raw`m_m c_m(T_h-T_f)=m_w c_w(T_f-T_c)` },
    ],
  },
  "sound_resonance": {
    source: "v = 2f(L₂−L₁)",
    lines: [
      { tex: String.raw`v=2f(L_2-L_1)` },
    ],
  },
  "uniform_acceleration": {
    source: "v=v₀+at",
    lines: [
      { tex: String.raw`v=v_0+at` },
    ],
  },
  "newtons_second_law": {
    source: "F合=ma",
    lines: [
      { tex: String.raw`F_{\text{合}}=ma` },
    ],
  },
  "work_energy": {
    source: "W合=½m(v²−v₀²)",
    lines: [
      { tex: String.raw`W_{\text{合}}=\frac{1}{2}m(v^2-v_0^2)` },
    ],
  },
  "archimedes": {
    source: "F浮=ρ液gV排",
    lines: [
      { tex: String.raw`F_{\text{浮}}=\rho_{\text{液}}gV_{\text{排}}` },
    ],
  },
  "resistivity": {
    source: "R=ρL/A，A=πd²/4",
    lines: [
      { tex: String.raw`R=\frac{\rho L}{A}` },
      { tex: String.raw`A=\frac{\pi d^2}{4}` },
    ],
  },
  "joule_heating": {
    source: "P电=I²R，η水=mc(dT/dt)/P电",
    lines: [
      { tex: String.raw`P_{\text{电}}=I^2R` },
      { tex: String.raw`\eta_{\text{水}}=\frac{mc\,\frac{dT}{dt}}{P_{\text{电}}}` },
    ],
  },
  "capacitor_discharge": {
    source: "V=V₀e^(−t/τ)，ln(V/1 V)=b−t/τ",
    lines: [
      { tex: String.raw`V=V_0e^{-\frac{t}{\tau}}` },
      { tex: String.raw`\ln\!\left(\frac{V}{1\,\mathrm{V}}\right)=b-\frac{t}{\tau}` },
    ],
  },
  "transformer_ratio": {
    source: "V₂/V₁≈N₂/N₁",
    lines: [
      { tex: String.raw`\frac{V_2}{V_1}\approx\frac{N_2}{N_1}` },
    ],
  },
  "grating_diffraction": {
    source: "d sinθ=mλ，d=1/线密度",
    lines: [
      { tex: String.raw`d\sin\theta=m\lambda` },
      { tex: String.raw`d=\frac{1}{\text{线密度}}` },
    ],
  },
  "total_internal_reflection": {
    source: "sinθc=n低/n高",
    lines: [
      { tex: String.raw`\sin\theta_c=\frac{n_{\text{低}}}{n_{\text{高}}}` },
    ],
  },
  "thermal_expansion": {
    source: "ΔL=αL₀ΔT",
    lines: [
      { tex: String.raw`\Delta L=\alpha L_0\Delta T` },
    ],
  },
  "string_waves": {
    source: "f₁=(1/2L)√(F/μ)",
    lines: [
      { tex: String.raw`f_1=\frac{1}{2L}\sqrt{\frac{F}{\mu}}` },
    ],
  },
  "photoelectric_effect": {
    source: "e U_s = h f - W",
    lines: [
      { tex: String.raw`eU_s=hf-W` },
    ],
  },
  "malus_law": {
    source: "I = I0 cos²(theta) + I_background",
    lines: [
      { tex: String.raw`I=I_0\cos^2\theta+I_{\text{background}}` },
    ],
  },
  "single_slit": {
    source: "a sin(theta) = m lambda；lambda=632.8 nm",
    lines: [
      { tex: String.raw`a\sin\theta=m\lambda` },
      { tex: String.raw`\lambda=632.8\,\mathrm{nm}` },
    ],
  },
  "michelson": {
    source: "2 delta_d = N lambda",
    lines: [
      { tex: String.raw`2\Delta d=N\lambda` },
    ],
  },
  "newton_rings": {
    source: "D_m² = 4 R lambda m；lambda=589.3 nm",
    lines: [
      { tex: String.raw`D_m^2=4R\lambda m` },
      { tex: String.raw`\lambda=589.3\,\mathrm{nm}` },
    ],
  },
  "optical_rotation": {
    source: "theta = [alpha] l c；l=1 dm",
    lines: [
      { tex: String.raw`\theta=[\alpha]lc` },
      { tex: String.raw`l=1\,\mathrm{dm}` },
    ],
  },
  "centripetal_force": {
    source: "F = m r omega²；r=0.10 m",
    lines: [
      { tex: String.raw`F=mr\omega^2` },
      { tex: String.raw`r=0.10\,\mathrm{m}` },
    ],
  },
  "rotational_inertia": {
    source: "M_net = J alpha",
    lines: [
      { tex: String.raw`M_{\text{net}}=J\alpha` },
    ],
  },
  "kinetic_friction": {
    source: "F_f = mu_k N",
    lines: [
      { tex: String.raw`F_f=\mu_kN` },
    ],
  },
  "hydrostatic_pressure": {
    source: "p_gauge = rho g h；g=9.81 m/s²",
    lines: [
      { tex: String.raw`p_{\text{gauge}}=\rho gh` },
      { tex: String.raw`g=9.81\,\mathrm{m/s^2}` },
    ],
  },
  "stokes_viscosity": {
    source: "v = 2(rho_ball-rho_liquid)g r²/(9 eta)",
    lines: [
      { tex: String.raw`v=\frac{2(\rho_{\text{ball}}-\rho_{\text{liquid}})gr^2}{9\eta}` },
    ],
  },
  "young_modulus": {
    source: "delta_L = F L/(E A)；L=1 m，A=1 mm²",
    lines: [
      { tex: String.raw`\Delta L=\frac{FL}{EA}` },
      { tex: String.raw`L=1\,\mathrm{m}` },
      { tex: String.raw`A=1\,\mathrm{mm^2}` },
    ],
  },
  "charge_capacitance": {
    source: "Q = C U",
    lines: [
      { tex: String.raw`Q=CU` },
    ],
  },
  "parallel_plate": {
    source: "C = epsilon0 epsilon_r A/d + C_stray；A=0.01 m²",
    lines: [
      { tex: String.raw`C=\frac{\epsilon_0\epsilon_rA}{d}+C_{\text{stray}}` },
      { tex: String.raw`A=0.01\,\mathrm{m^2}` },
    ],
  },
  "solenoid_field": {
    source: "B = mu0 n I",
    lines: [
      { tex: String.raw`B=\mu_0nI` },
    ],
  },
  "ampere_force": {
    source: "F = B I L；L=0.10 m，导线垂直磁场",
    lines: [
      { tex: String.raw`F=BIL` },
      { tex: String.raw`L=0.10\,\mathrm{m}` },
      { text: "导线垂直磁场" },
    ],
  },
  "faraday_induction": {
    source: "abs(emf) = N A abs(dB/dt)；A=0.01 m²",
    lines: [
      { tex: String.raw`\lvert\mathrm{emf}\rvert=NA\left\lvert\frac{dB}{dt}\right\rvert` },
      { tex: String.raw`A=0.01\,\mathrm{m^2}` },
    ],
  },
  "boyle_law": {
    source: "P V = constant",
    lines: [
      { tex: String.raw`PV=\text{constant}` },
    ],
  },
  "constant_volume_gas": {
    source: "P = (n R/V) T_K",
    lines: [
      { tex: String.raw`P=\frac{nR}{V}T_{\mathrm{K}}` },
    ],
  },
  "newton_cooling": {
    source: "T-20 = A exp(-t/tau)",
    lines: [
      { tex: String.raw`T-20=A\exp\!\left(-\frac{t}{\tau}\right)` },
    ],
  },
  "thermal_conduction": {
    source: "P = k A delta_T/L；L=0.01 m，A=0.001 m²",
    lines: [
      { tex: String.raw`P=\frac{kA\Delta T}{L}` },
      { tex: String.raw`L=0.01\,\mathrm{m}` },
      { tex: String.raw`A=0.001\,\mathrm{m^2}` },
    ],
  },
  "torsion_pendulum": {
    source: "T² = 4 pi² (J + J0)/kappa",
    lines: [
      { tex: String.raw`T^2=\frac{4\pi^2(J+J_0)}{\kappa}` },
    ],
  },
  "sound_timeflight": {
    source: "t = d/v + t_delay",
    lines: [
      { tex: String.raw`t=\frac{d}{v}+t_{\text{delay}}` },
    ],
  },
  "damped_oscillation": {
    source: "A = A0 exp(-beta t)",
    lines: [
      { tex: String.raw`A=A_0\exp(-\beta t)` },
    ],
  },
  "length_measurement": {
    source: "x=读数−零位；u_A=s/√N，u_分辨率=分辨率/√12",
    lines: [
      { tex: String.raw`x=\text{读数}-\text{零位}` },
      { tex: String.raw`u_A=\frac{s}{\sqrt{N}}` },
      { tex: String.raw`u_{\text{分辨率}}=\frac{\text{分辨率}}{\sqrt{12}}` },
    ],
  },
  "mass_measurement": {
    source: "m=读数−零位；重复测量与分辨率分别评定",
    lines: [
      { tex: String.raw`m=\text{读数}-\text{零位}` },
      { text: "重复测量与分辨率分别评定" },
    ],
  },
  "solid_density": {
    source: "ρ=m/(πd²h/4)",
    lines: [
      { tex: String.raw`\rho=\frac{m}{\frac{\pi d^2h}{4}}` },
    ],
  },
  "density_buoyancy": {
    source: "ρ物=ρ液 m空气/(m空气−m浸液)",
    lines: [
      { tex: String.raw`\rho_{\text{物}}=\frac{\rho_{\text{液}}m_{\text{空气}}}{m_{\text{空气}}-m_{\text{浸液}}}` },
    ],
  },
  "multimeter": {
    source: "U显示=k U标准+b",
    lines: [
      { tex: String.raw`U_{\text{显示}}=kU_{\text{标准}}+b` },
    ],
  },
  "oscilloscope": {
    source: "f=1/(周期格数×时基)；Upp=幅度格数×垂直刻度×探头倍率",
    lines: [
      { tex: String.raw`f=\frac{1}{\text{周期格数}\times\text{时基}}` },
      { tex: String.raw`\begin{aligned}U_{\mathrm{pp}}&=\text{幅度格数}\times\text{垂直刻度}\\&\quad\times\text{探头倍率}\end{aligned}` },
    ],
  },
  "virtual_daq": {
    source: "Uac,rms=√mean((U−mean U)²)",
    lines: [
      { tex: String.raw`U_{\mathrm{ac,rms}}=\sqrt{\operatorname{mean}\!\left((U-\operatorname{mean}U)^2\right)}` },
    ],
  },
  "trifilar": {
    source: "J=M g R r T²/(4π²L)",
    lines: [
      { tex: String.raw`J=\frac{MgRrT^2}{4\pi^2L}` },
    ],
  },
  "shear_modulus": {
    source: "M=Gπr⁴θ/(2L)",
    lines: [
      { tex: String.raw`M=\frac{G\pi r^4\theta}{2L}` },
    ],
  },
  "forced_resonance": {
    source: "共振频率取扫描振幅最大值位置",
    lines: [
      { text: "共振频率取扫描振幅最大值位置" },
    ],
  },
  "collision": {
    source: "p=m₁v₁+m₂v₂",
    lines: [
      { tex: String.raw`p=m_1v_1+m_2v_2` },
    ],
  },
  "magnetic_levitation": {
    source: "k有效=m(2π/T)²",
    lines: [
      { tex: String.raw`k_{\text{有效}}=m\left(\frac{2\pi}{T}\right)^2` },
    ],
  },
  "air_heat_ratio": {
    source: "γ≈h₁/(h₁−h₂)",
    lines: [
      { tex: String.raw`\gamma\approx\frac{h_1}{h_1-h_2}` },
    ],
  },
  "surface_tension": {
    source: "F=γ l cosθ",
    lines: [
      { tex: String.raw`F=\gamma l\cos\theta` },
    ],
  },
  "ice_latent_heat": {
    source: "m水c(T初−T末)=m冰L+m冰cT末",
    lines: [
      { tex: String.raw`m_{\text{水}}c(T_{\text{初}}-T_{\text{末}})=m_{\text{冰}}L+m_{\text{冰}}cT_{\text{末}}` },
    ],
  },
  "vapor_latent_heat": {
    source: "Q修正=L Δm + 本底项",
    lines: [
      { tex: String.raw`Q_{\text{修正}}=L\Delta m+\text{本底项}` },
    ],
  },
  "temperature_pid": {
    source: "IAE=∫|T−T设定|dt",
    lines: [
      { tex: String.raw`\mathrm{IAE}=\int\lvert T-T_{\text{设定}}\rvert\,dt` },
    ],
  },
  "heat_engine": {
    source: "W=∮P dV",
    lines: [
      { tex: String.raw`W=\oint P\,dV` },
    ],
  },
  "temperature_viscosity": {
    source: "η=2Δρgr²/(9v)；lnη≈A+B/T",
    lines: [
      { tex: String.raw`\eta=\frac{2\Delta\rho\,gr^2}{9v}` },
      { tex: String.raw`\ln\eta\approx A+\frac{B}{T}` },
    ],
  },
  "wheatstone": {
    source: "R1/R2=R3/Rx；Rx=R2R3/R1",
    lines: [
      { tex: String.raw`\frac{R_1}{R_2}=\frac{R_3}{R_x}` },
      { tex: String.raw`R_x=\frac{R_2R_3}{R_1}` },
    ],
  },
  "potentiometer": {
    source: "Ex=Es Lx/Ls",
    lines: [
      { tex: String.raw`E_x=\frac{E_sL_x}{L_s}` },
    ],
  },
  "meter_conversion": {
    source: "R分流=IgRg/(I量程−Ig)；R串联=U量程/Ig−Rg",
    lines: [
      { tex: String.raw`R_{\text{分流}}=\frac{I_gR_g}{I_{\text{量程}}-I_g}` },
      { tex: String.raw`R_{\text{串联}}=\frac{U_{\text{量程}}}{I_g}-R_g` },
    ],
  },
  "meter_resistance": {
    source: "U=Rg I+b",
    lines: [
      { tex: String.raw`U=R_gI+b` },
    ],
  },
  "diode": {
    source: "I≈Is exp(eU/nkT)，I≫Is",
    lines: [
      { tex: String.raw`I\approx I_s\exp\!\left(\frac{eU}{nkT}\right)` },
      { tex: String.raw`I\gg I_s` },
    ],
  },
  "thermistor": {
    source: "lnR=A+B/TK",
    lines: [
      { tex: String.raw`\ln R=A+\frac{B}{T_{\mathrm{K}}}` },
    ],
  },
  "unbalanced_bridge": {
    source: "U输出≈U激励 ΔR/(4R)",
    lines: [
      { tex: String.raw`U_{\text{输出}}\approx\frac{U_{\text{激励}}\Delta R}{4R}` },
    ],
  },
  "hall_effect": {
    source: "|VH|=|RH| I B/d",
    lines: [
      { tex: String.raw`\lvert V_H\rvert=\frac{\lvert R_H\rvert IB}{d}` },
    ],
  },
  "helmholtz": {
    source: "B(z)=Nμ0IR²/2×[(R²+(z−R/2)²)^−3/2+(R²+(z+R/2)²)^−3/2]",
    lines: [
      { tex: String.raw`\begin{aligned}B(z)&=\frac{N\mu_0IR^2}{2}\times\Bigl[\bigl(R^2+(z-\frac{R}{2})^2\bigr)^{-\frac{3}{2}}\\&\qquad+\bigl(R^2+(z+\frac{R}{2})^2\bigr)^{-\frac{3}{2}}\Bigr]\end{aligned}` },
    ],
  },
  "rlc_series": {
    source: "f0=1/(2π√LC)；Q≈f峰/(f2−f1)",
    lines: [
      { tex: String.raw`f_0=\frac{1}{2\pi\sqrt{LC}}` },
      { tex: String.raw`Q\approx\frac{f_{\text{峰}}}{f_2-f_1}` },
    ],
  },
  "hysteresis": {
    source: "单位体积每周期损耗=|∮H dB|",
    lines: [
      { tex: String.raw`\text{单位体积每周期损耗}=\left\lvert\oint H\,dB\right\rvert` },
    ],
  },
  "curie_temperature": {
    source: "按填写剩磁比例插值转变温度",
    lines: [
      { text: "按填写剩磁比例插值转变温度" },
    ],
  },
  "electrostatic_field": {
    source: "E=−∇V；矩形网格差分",
    lines: [
      { tex: String.raw`E=-\nabla V` },
      { text: "矩形网格差分" },
    ],
  },
  "photoresistor": {
    source: "R≈A E^−γ",
    lines: [
      { tex: String.raw`R\approx AE^{-\gamma}` },
    ],
  },
  "solar_cell": {
    source: "P=UI；FF=P最大/(U开路I短路)",
    lines: [
      { tex: String.raw`P=UI` },
      { tex: String.raw`\mathrm{FF}=\frac{P_{\text{最大}}}{U_{\text{开路}}I_{\text{短路}}}` },
    ],
  },
  "magnetoresistance": {
    source: "(R−R0)/R0≈βB²",
    lines: [
      { tex: String.raw`\frac{R-R_0}{R_0}\approx\beta B^2` },
    ],
  },
  "strain_gauge": {
    source: "ΔR/R0=K ε",
    lines: [
      { tex: String.raw`\frac{\Delta R}{R_0}=K\epsilon` },
    ],
  },
  "temperature_sensor": {
    source: "U≈S T+b（限定标定温区）",
    lines: [
      { tex: String.raw`U\approx ST+b` },
      { text: "限定标定温区" },
    ],
  },
  "rectifier": {
    source: "纹波系数=交流分量有效值/平均直流电压",
    lines: [
      { tex: String.raw`\text{纹波系数}=\frac{\text{交流分量有效值}}{\text{平均直流电压}}` },
    ],
  },
  "magnetic_pendulum": {
    source: "T²=4π²J/(μB)",
    lines: [
      { tex: String.raw`T^2=\frac{4\pi^2J}{\mu B}` },
    ],
  },
  "wireless_power": {
    source: "η=P负载/P输入",
    lines: [
      { tex: String.raw`\eta=\frac{P_{\text{负载}}}{P_{\text{输入}}}` },
    ],
  },
  "fuel_cell": {
    source: "P=UI",
    lines: [
      { tex: String.raw`P=UI` },
    ],
  },
  "railgun": {
    source: "W电=∫UI dt；K=mv²/2",
    lines: [
      { tex: String.raw`W_{\text{电}}=\int UI\,dt` },
      { tex: String.raw`K=\frac{mv^2}{2}` },
    ],
  },
  "prism_angle": {
    source: "A=两反射方向差/2",
    lines: [
      { tex: String.raw`A=\frac{\text{两反射方向差}}{2}` },
    ],
  },
  "prism_refraction": {
    source: "n=sin((A+δmin)/2)/sin(A/2)",
    lines: [
      { tex: String.raw`n=\frac{\sin\!\left(\frac{A+\delta_{\mathrm{min}}}{2}\right)}{\sin\!\left(\frac{A}{2}\right)}` },
    ],
  },
  "abbe_refractometer": {
    source: "n液=n棱镜 sinθc",
    lines: [
      { tex: String.raw`n_{\text{液}}=n_{\text{棱镜}}\sin\theta_c` },
    ],
  },
  "lens_group": {
    source: "F=f1f2/(f1+f2−d)",
    lines: [
      { tex: String.raw`F=\frac{f_1f_2}{f_1+f_2-d}` },
    ],
  },
  "lens_bessel": {
    source: "f=(D²−d²)/(4D)",
    lines: [
      { tex: String.raw`f=\frac{D^2-d^2}{4D}` },
    ],
  },
  "fresnel_biprism": {
    source: "Δx=λD/d虚",
    lines: [
      { tex: String.raw`\Delta x=\frac{\lambda D}{d_{\text{虚}}}` },
    ],
  },
  "grating_characteristics": {
    source: "d sinθ=mλ；Dθ=m/(d cosθ)",
    lines: [
      { tex: String.raw`d\sin\theta=m\lambda` },
      { tex: String.raw`D_\theta=\frac{m}{d\cos\theta}` },
    ],
  },
  "wire_diffraction": {
    source: "a sinθ=mλ",
    lines: [
      { tex: String.raw`a\sin\theta=m\lambda` },
    ],
  },
  "optical_flatness": {
    source: "局部高度差=λ/2×条纹弯曲量/条纹间距",
    lines: [
      { tex: String.raw`\text{局部高度差}=\frac{\lambda}{2}\times\frac{\text{条纹弯曲量}}{\text{条纹间距}}` },
    ],
  },
  "diffraction_intensity": {
    source: "I∝(sinβ/β)²；a sinθ1=λ",
    lines: [
      { tex: String.raw`I\propto\left(\frac{\sin\beta}{\beta}\right)^2` },
      { tex: String.raw`a\sin\theta_1=\lambda` },
    ],
  },
  "holography": {
    source: "p=λ/(2 sin(夹角/2))",
    lines: [
      { tex: String.raw`p=\frac{\lambda}{2\sin\!\left(\frac{\text{夹角}}{2}\right)}` },
    ],
  },
  "infrared_radiation": {
    source: "P净=εσA(T⁴−T环境⁴)",
    lines: [
      { tex: String.raw`P_{\text{净}}=\epsilon\sigma A(T^4-T_{\text{环境}}^4)` },
    ],
  },
  "thermal_imaging": {
    source: "限定温区：计数≈S T+b",
    lines: [
      { text: "限定温区" },
      { tex: String.raw`\text{计数}\approx ST+b` },
    ],
  },
  "astronomical_imaging": {
    source: "暗场计数≈偏置+暗电流计数率×曝光",
    lines: [
      { tex: String.raw`\begin{aligned}\text{暗场计数}&\approx\text{偏置}\\&\quad+\text{暗电流计数率}\times\text{曝光}\end{aligned}` },
    ],
  },
  "color_design": {
    source: "解码sRGB后：Y=0.2126R线性+0.7152G线性+0.0722B线性",
    lines: [
      { text: "解码 sRGB 后" },
      { tex: String.raw`\begin{aligned}Y&=0.2126R_{\text{线性}}+0.7152G_{\text{线性}}\\&\quad+0.0722B_{\text{线性}}\end{aligned}` },
    ],
  },
  "optical_cloaking": {
    source: "可见对比度比例=C装置/C基准",
    lines: [
      { tex: String.raw`\text{可见对比度比例}=\frac{C_{\text{装置}}}{C_{\text{基准}}}` },
    ],
  },
  "stereo_display": {
    source: "d=fB/Z",
    lines: [
      { tex: String.raw`d=\frac{fB}{Z}` },
    ],
  },
  "white_light_interference": {
    source: "反射：2h=2Δz，因此h=Δz",
    lines: [
      { text: "反射" },
      { tex: String.raw`2h=2\Delta z` },
      { tex: String.raw`\text{因此 }h=\Delta z` },
    ],
  },
  "doppler": {
    source: "低速反射：Δf≈2f0v/c",
    lines: [
      { text: "低速反射" },
      { tex: String.raw`\Delta f\approx\frac{2f_0v}{c}` },
    ],
  },
  "acoustic_levitation": {
    source: "相邻节点间距=λ/2；c=fλ",
    lines: [
      { tex: String.raw`\text{相邻节点间距}=\frac{\lambda}{2}` },
      { tex: String.raw`c=f\lambda` },
    ],
  },
  "ultrasonic_echo": {
    source: "t回波=2d/c+t延迟",
    lines: [
      { tex: String.raw`t_{\text{回波}}=\frac{2d}{c}+t_{\text{延迟}}` },
    ],
  },
  "double_grating": {
    source: "f=1/(每周期事件数×事件间隔)",
    lines: [
      { tex: String.raw`f=\frac{1}{\text{每周期事件数}\times\text{事件间隔}}` },
    ],
  },
  "chaos": {
    source: "保留同步时域、相图和峰值返回图；σ仅描述波动",
    lines: [
      { text: "保留同步时域、相图和峰值返回图" },
      { tex: String.raw`\sigma\text{ 仅描述波动}` },
    ],
  },
  "millikan": {
    source: "r0=√(9ηv/(2Δρg))；q=6πηvr0d/[U(1+b/(pr0))^(3/2)]",
    lines: [
      { tex: String.raw`r_0=\sqrt{\frac{9\eta v}{2\Delta\rho\,g}}` },
      { tex: String.raw`q=\frac{6\pi\eta vr_0d}{U\left(1+\frac{b}{pr_0}\right)^{\frac{3}{2}}}` },
    ],
  },
  "electron_em": {
    source: "e/m=2U/(B²r²)，B=(4/5)^(3/2)μ0NI/R",
    lines: [
      { tex: String.raw`\frac{e}{m}=\frac{2U}{B^2r^2}` },
      { tex: String.raw`B=\left(\frac{4}{5}\right)^{\frac{3}{2}}\frac{\mu_0NI}{R}` },
    ],
  },
  "franck_hertz": {
    source: "U峰≈n ΔU+接触电势；激发能/e=ΔU",
    lines: [
      { tex: String.raw`U_{\text{峰}}\approx n\Delta U+\text{接触电势}` },
      { tex: String.raw`\frac{\text{激发能}}{e}=\Delta U` },
    ],
  },
  "hydrogen_spectrum": {
    source: "1/λ=RH(1/2²−1/n²)",
    lines: [
      { tex: String.raw`\frac{1}{\lambda}=R_H\left(\frac{1}{2^2}-\frac{1}{n^2}\right)` },
    ],
  },
  "thermionic_work_function": {
    source: "I/T²=A exp(−W/kT)",
    lines: [
      { tex: String.raw`\frac{I}{T^2}=A\exp\!\left(-\frac{W}{kT}\right)` },
    ],
  },
  "nuclear_magnetic_resonance": {
    source: "f=(γ/2π)B",
    lines: [
      { tex: String.raw`f=\frac{\gamma}{2\pi}B` },
    ],
  },
  "zeeman": {
    source: "Δf=g μB B/h（中心到单分量）",
    lines: [
      { tex: String.raw`\Delta f=\frac{g\mu_BB}{h}` },
      { text: "中心到单分量" },
    ],
  },
  "nuclear_counts": {
    source: "r净=N/t−N背景/t背景",
    lines: [
      { tex: String.raw`r_{\text{净}}=\frac{N}{t}-\frac{N_{\text{背景}}}{t_{\text{背景}}}` },
    ],
  },
  "nuclear_decay": {
    source: "r净=A exp(−λt)；T半=ln2/λ",
    lines: [
      { tex: String.raw`r_{\text{净}}=A\exp(-\lambda t)` },
      { tex: String.raw`T_{\text{半}}=\frac{\ln 2}{\lambda}` },
    ],
  },
  "microwave_properties": {
    source: "相邻节点间距=λ/2；c=fλ",
    lines: [
      { tex: String.raw`\text{相邻节点间距}=\frac{\lambda}{2}` },
      { tex: String.raw`c=f\lambda` },
    ],
  },
  "microwave_bragg": {
    source: "2d sinθ=mλ",
    lines: [
      { tex: String.raw`2d\sin\theta=m\lambda` },
    ],
  },
  "magnus_ball": {
    source: "小偏转段：y=y0+ay t²/2；F侧=may",
    lines: [
      { text: "小偏转段" },
      { tex: String.raw`y=y_0+\frac{a_yt^2}{2}` },
      { tex: String.raw`F_{\text{侧}}=ma_y` },
    ],
  },
  "dancing_coin": {
    source: "抬升前ΔP≈P0(T/T0−1)；阈值应与mg/A比较",
    lines: [
      { text: "抬升前" },
      { tex: String.raw`\Delta P\approx P_0\left(\frac{T}{T_0}-1\right)` },
      { tex: String.raw`\text{阈值应与 }\frac{mg}{A}\text{ 比较}` },
    ],
  },
  "light_speed": {
    source: "t=L光路/c+t电子延迟",
    lines: [
      { tex: String.raw`t=\frac{L_{\text{光路}}}{c}+t_{\text{电子延迟}}` },
    ],
  },
  "dc_source": {
    source: "U=E−rI（限定负载区间）",
    lines: [
      { tex: String.raw`U=E-rI` },
      { text: "限定负载区间" },
    ],
  },
});
