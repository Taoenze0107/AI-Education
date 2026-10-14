"""Five verified publisher catalogues, with original concise topic labels."""
BOOKS=[]
def book(bid,title,authors,publisher,url,text):
    items=[]
    for row in text.strip().splitlines():
        label,ids,*note=row.split('|')
        items.append(dict(label=label,experiment_ids=ids.split(),note=note[0] if note else '对应数据分析与分步练习；实际仪器操作按课程说明。'))
    BOOKS.append(dict(book_id=bid,title=title,authors=authors,publisher=publisher,url=url,items=items))
book('tup-chen-2','大学物理实验（第2版）','陈春彩等','清华大学出版社','https://www.tup.com.cn/booksCenter/bookcatalog?id=11691001','''
固体密度|solid_density density_buoyancy
转动惯量|rotational_inertia torsion_pendulum trifilar
弹性模量|young_modulus shear_modulus
单臂桥|wheatstone
电动势补偿|potentiometer
电表扩程校正|meter_conversion
磁悬浮|magnetic_levitation
示波器|oscilloscope virtual_daq
霍尔|hall_effect
牛顿环|newton_rings
棱镜折射|prism_angle prism_refraction
光栅波长|grating_diffraction
迈克耳孙|michelson
气体声速|sound_resonance sound_timeflight
液体黏度|stokes_viscosity temperature_viscosity
不良导体传热|thermal_conduction
场模拟|electrostatic_field
双棱镜|fresnel_biprism
单缝远场|single_slit diffraction_intensity
偏振|malus_law
硅电池|solar_cell
三线摆|trifilar
表头内阻|meter_resistance
扩程设计|meter_conversion
光栅分辨|grating_characteristics
细丝与平面|wire_diffraction optical_flatness
光敏阻值|photoresistor
''')
book('tup-ma-2','大学物理实验教程（第2版）','马颖等','清华大学出版社','https://www.tup.com.cn/booksCenter/bookcatalog?id=05210104','''
基础仪器|length_measurement mass_measurement multimeter
物体密度|solid_density density_buoyancy
示波训练|oscilloscope
弹性模量|young_modulus shear_modulus
光电效应|photoelectric_effect
油滴|millikan
伏安电阻|ohms_law
电荷与荷质比|millikan electron_em
等厚干涉|newton_rings optical_flatness
电势模拟|electrostatic_field
表头扩程|meter_conversion
激光干涉|michelson
三线悬摆|trifilar
弦波|string_waves
线膨胀|thermal_expansion
液面张力|surface_tension
传感器|temperature_sensor strain_gauge magnetoresistance|提供三种标定专题；具体器件与系统按课程选择。
透镜组合|thin_lens lens_bessel lens_group
衍射扫描|diffraction_intensity
偏振分析|malus_law
光速|light_speed
光栅与色散|grating_diffraction grating_characteristics
旋光|optical_rotation
平衡桥|wheatstone
非线性伏安|diode
电位差计|potentiometer
RLC响应|rlc_series
粒子运动|electron_em|处理均匀磁场圆轨道；其他粒子装置需另定分析模型。
热发射|thermionic_work_function
微波|microwave_properties microwave_bragg
铁磁温度转变|curie_temperature hysteresis
冰相变|ice_latent_heat
导热及比热|thermal_conduction calorimetry
天文成像|astronomical_imaging|提供暗场校准与成像观察，不代替天体测光软件。
重力加速度|simple_pendulum free_fall
分光参数|prism_angle prism_refraction grating_characteristics
霍尔磁场|hall_effect helmholtz
介质超声|ultrasonic_echo sound_timeflight
变温黏度|temperature_viscosity
材料导热|thermal_conduction
''')
book('tup-chenq','大学物理实验','陈巧玲等','清华大学出版社','https://www.tup.com.cn/booksCenter/bookcatalog?id=04359403','''
固体密度|solid_density density_buoyancy mass_measurement
导轨动力学|uniform_acceleration newtons_second_law collision
弹性材料|young_modulus shear_modulus
转动惯量|rotational_inertia torsion_pendulum trifilar
膨胀与温控|thermal_expansion temperature_pid
黏度温变|temperature_viscosity
空气比热比|air_heat_ratio
场分布|electrostatic_field
电桥应用|wheatstone unbalanced_bridge
万用表|multimeter
中阻桥测|wheatstone
表头改装|meter_conversion
二极管|diode
电池补偿|potentiometer
霍尔效应|hall_effect
示波测量|oscilloscope
声速|sound_timeflight sound_resonance
薄透镜|thin_lens lens_bessel
牛顿环|newton_rings
分光仪顶角|prism_angle
光栅|grating_diffraction
激光干涉|michelson
油滴电荷|millikan
超声光栅|grating_diffraction ultrasonic_echo|衍射与声速专题组合；声致光栅常数需按课程装置另行校准。
原子激发|franck_hertz
非线性动力学|chaos
光电量子|photoelectric_effect
动力综合一|uniform_acceleration newtons_second_law|目录只给综合名称，提供运动合力训练，不推定内部装置。
动力综合二|collision work_energy|目录只给综合名称，提供碰撞能量训练，不推定内部装置。
动力综合三|rotational_inertia centripetal_force|目录只给综合名称，提供旋转训练，不推定内部装置。
动力综合四|spring_oscillation forced_resonance|目录只给综合名称，提供振动训练，不推定内部装置。
波尔共振|forced_resonance
多普勒|doppler
微波分光|microwave_properties microwave_bragg
光学综合|lens_group prism_refraction grating_characteristics optical_flatness|目录只给系列名称，提供可选择的专题路径。
空气热机|heat_engine
燃料电池|fuel_cell
磁滞回线|hysteresis
''')
book('hep-foundation','大学物理实验（第一册）','张增明等','高等教育出版社','https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=65e7504c74ce561611bd9d94','''
质量|mass_measurement
导轨与碰撞|uniform_acceleration collision
金属丝拉伸|young_modulus
切变模量|shear_modulus
液体黏度|stokes_viscosity
表面张力|surface_tension
驻波|string_waves
声速|sound_timeflight sound_resonance
固体比热|calorimetry
空气比热比|air_heat_ratio
汽化热|vapor_latent_heat
直流源|dc_source
热敏特性|thermistor
半导体温度计|thermistor temperature_sensor
数字示波|oscilloscope virtual_daq
整流滤波|rectifier
磁针振动|magnetic_pendulum
硅光电池|solar_cell
色彩混合|color_design
分光仪|prism_angle prism_refraction
透镜参数|thin_lens lens_bessel lens_group
微小几何量|michelson wire_diffraction optical_flatness
光速|light_speed
光电效应|photoelectric_effect
电子电荷|millikan
氢光谱|hydrogen_spectrum
旋转球|magnus_ball
热气体与硬币|dancing_coin
声悬浮|acoustic_levitation
无线供电|wireless_power
有限视场隐身|optical_cloaking
立体显示|stereo_display
''')
book('hep-integrated','大学物理实验（下册）','陈聪','高等教育出版社','https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=5b940113f18f967ee7f37713','''
音叉共振|forced_resonance
应变称重|strain_gauge unbalanced_bridge
温度探测|temperature_sensor thermistor
红外特性|infrared_radiation
超声速度|ultrasonic_echo
狭缝衍射|single_slit diffraction_intensity
等厚干涉|newton_rings
光栅波长|grating_diffraction
干涉仪|michelson
全息再现|holography|记录几何与观察任务；曝光、处理和再现须在实际仪器中完成。
虚拟测量|virtual_daq
非线性电路|diode chaos
示波磁化|hysteresis
线圈分布|helmholtz
磁阻|magnetoresistance
油滴|millikan
原子激发|franck_hertz
光电量子|photoelectric_effect
磁致分裂|zeeman
核自旋共振|nuclear_magnetic_resonance
电磁发射原理|railgun|仅分析既有低能教学记录，不提供制作或能量升级设计。
太阳电池|solar_cell
超声成像|ultrasonic_echo|回波标定和扫描记录训练，不代替完整层析重建。
热像扫描|thermal_imaging infrared_radiation
光栅微振动|double_grating
磁阻传感|magnetoresistance
微波与晶格|microwave_properties microwave_bragg
超声悬浮|acoustic_levitation
几何光学|lens_group lens_bessel
白光应用|white_light_interference
传感器综合|temperature_sensor strain_gauge magnetoresistance|按器件选专题，完整系统设计需另留电路和校准。
核计数衰减|nuclear_counts nuclear_decay|计数与单指数衰减训练，不推定目录未说明的其他核仪器项目。
''')
EXTRA_SOURCES={
 'abbe_refractometer':('清华大学深圳国际研究生院 · 阿贝原理','https://mdtc.sz.tsinghua.edu.cn/home/instrument/details/id/41.html'),
 'millikan':('哈尔滨工程大学 · 油滴讲义','https://pec.hrbeu.edu.cn/_upload/article/files/c6/b3/c4a680af493f8d8aba2c1edb828f/bfb3ae65-b0c9-4ec1-9122-e33dc2744ad9.pdf'),
 'franck_hertz':('哈尔滨工程大学 · 弗兰克—赫兹讲义','https://pec.hrbeu.edu.cn/_upload/article/files/f6/59/b538fcff4bc6a283350e033db3dc/d2842d00-3d5d-42b3-bae0-7a838a76400d.pdf'),
 'hall_effect':('大连理工大学 · 霍尔实验','https://phyedu.dlut.edu.cn/info/1046/1017.htm'),
 'zeeman':('天津理工大学 · 塞曼讲义','https://physics.tjut.edu.cn/wlsyzx/info/1282/1079.htm'),
}
