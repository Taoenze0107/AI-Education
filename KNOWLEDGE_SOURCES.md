# 当前教材资料版本

2026-10-12：共128专题、504组模拟案例、1512道问题、393条知识。新增内容、五本教材目录对照及模型范围见《本轮教材资料扩充_20261012.md》。下文保留此前版本的来源和验证记录，其规模与验证结论仅对应当时版本。

# 知识库与引导内容说明

2026-10-11扩展后共153条中文知识说明、48个实验专题、264组模拟数据、792道练习。新增主题的物理公式参考OpenStax大学物理各卷入口，数据及练习为本轮编写的教学模拟材料。具体新增清单、固定装置常量限制与验证见《本轮扩充说明_20261011.md》。下文为原24主题版的来源和历史验证记录。

原24主题版含81条知识，覆盖力学、电学、光学、热学、声学，以及单位、拟合和不确定度。诊断根据提交的观察、条件核查和计算证据进行，不会自动核实真实仪器或实验操作。

物理关系参考 OpenStax《University Physics》Volume 1 / Volume 2 / Volume 3 及计量指南，页面保留可点击来源。链接用于核对物理依据；中文讲解、练习与模拟数据由本项目原创，未转载教材文字、图片或教材题目。

- [OpenStax · Ohm’s Law](https://openstax.org/books/university-physics-volume-2/pages/9-4-ohms-law)
- [OpenStax · RC Circuits](https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits)
- [OpenStax · Pendulums](https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums)
- [NIST TN 1297 · Reporting uncertainty](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-7-reporting-uncertainty)
- [NIST e-Handbook · Model validation](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd44.htm)
- [NIST e-Handbook · Least squares](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm)
- [OpenStax · Resistivity and Resistance](https://openstax.org/books/university-physics-volume-2/pages/9-3-resistivity-and-resistance)
- [NIST TN 1297 · Type A uncertainty](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-3-type-evaluation-standard-uncertainty)
- [NIST · SI prefixes](https://www.nist.gov/pml/special-publication-330/sp-330-section-3)
- [NIST TN 1297 · Type B uncertainty](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-4-type-b-evaluation-standard-uncertainty)
- [NIST TN 1297 · Combined uncertainty](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-5-combined-standard-uncertainty)
- [OpenStax · Significant Figures](https://openstax.org/books/university-physics-volume-1/pages/1-6-significant-figures)

## 可视化的范围

- 伏安法：原有数据解析、拟合与残差，图上增加坐标刻度、单位与图例。
- RC：仅支持充电读数快速录入；虚线由用户填写的 R、C、初始值及终值构造，不是拟合。63.2% 时间使用相邻点线性插值；未跨过阈值时不报告测量时间常数。
- 单摆：总时间除以完整周期数，显示均值、样本标准差及小角度模型计算值；标准差不等同于全部测量不确定度。
- 诊断：对比本轮已提交的学生结果与独立复算，未使用当前编辑草稿替代历史输入；条长表示绝对值，数字保留符号。
- 历史：只绘制可复算相对差异的轮次，改善趋势不代表所有实验问题都已纠正。

演示读数标记为 synthetic-example，基于演示修改后标记 edited-example；新快速录入不会自动将仪器接线、摆角等物理条件标为通过。

## 早期版本验证

79 项 Python 测试通过；另有 Node 数值边界检查，覆盖单位换算、非零初始电压、RC 阈值插值及无效输入、单摆周期与样本标准差。浏览器验证三个实验输入、两轮诊断、历史趋势、刷新恢复、知识来源及 320/375 像素宽度布局。手机宽度为浏览器模拟。

## 实验资料库与练习

目录结构借鉴 [MadAsMaths](https://www.madasmaths.com/) 的主题分类与练习、解答配套方式。未复制其题目、解答、图片或品牌标志。中文练习、分层提示和模拟数据为本项目原创内容。

共 24 个主题，每个主题有基础、标准、探究三个层次，共 132 组、396 道问题。所有教学数据明确标为模拟；探究组包含预设的异常或偏移，不可当作实测证据。下载练习页和解答为独立 HTML 文件，可用浏览器打印为 PDF。

新增模型：胡克定律（F–x 拟合）、弹簧振子（T²–m 拟合）、自由落体（h–t² 拟合）、斜面临界角（逐次 tan 后平均）、凸透镜（逐组 uv/(u+v) 后平均）、折射（sin i–sin r 拟合）、双缝（亮纹位置–级次拟合）、量热法（基础热平衡后平均）、共鸣管（相邻长度差后平均）。拟合均保留截距和所有数据点；未自动删点或将物理条件标记为通过。

CSV 参数列必须完整，缺失参数不会自动替换为默认值。新增实验支持 CSV；原有伏安法的 CSV/Excel 功能保留。练习思路和未提交输入仅保存在当前浏览器；需要长期保存时提交诊断或下载记录。

- [OpenStax · Simple Harmonic Motion](https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion)
- [OpenStax · Free Fall](https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall)
- [OpenStax · Friction](https://openstax.org/books/university-physics-volume-1/pages/6-2-friction)
- [OpenStax · Thin Lenses](https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses)
- [OpenStax · Refraction](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction)
- [OpenStax · Mathematics of Interference](https://openstax.org/books/university-physics-volume-3/pages/3-2-mathematics-of-interference)
- [OpenStax · Specific Heat and Calorimetry](https://openstax.org/books/university-physics-volume-2/pages/1-4-heat-transfer-specific-heat-and-calorimetry)
- [OpenStax · Standing Sound Waves](https://openstax.org/books/university-physics-volume-1/pages/17-4-normal-modes-of-a-standing-sound-wave)

资料库初版验证：103 项 Python 测试（含理想物理值、36 组数据、模型边界、下载与 CSV 往返）；另验证 JavaScript 数值工具，以及实际浏览器的筛选、练习恢复、输入恢复、示例载入、CSV 上传、知识跳转与手机宽度布局。

### 上一版：30 组数据扩充

在原有 36 组基础上新增 30 组，三个层次各 10 组，覆盖全部主题。基础组使用不同理想参数；标准组加入确定的小扰动；探究组演示非线性、计数偏差、窗口不足、零点偏移、容器热容或单侧共鸣长度偏移。所有读数标记为 synthetic-example，不写入真实试用历史。每组附独立场景说明、问题、提示、按现有模型处理的数值和复查建议。

上一版验证：116 项 Python 测试通过，覆盖全部 66 组数据、30 组新增 CSV 往返、10 组新理想参数和多种预设偏差；JavaScript 语法检查通过。实际浏览器确认层次筛选、查询参数刷新保留、同层次练习衔接、图表、解答和示例载入；375 像素宽度的目录与专题无页面横向溢出。

## 本版：主题、数据与练习翻倍

从 12 / 66 / 198 扩展到 24 / 132 / 396。新主题增加 36 条知识，涵盖模型、数据规范、典型偏差与自查问题；每条都可按实验筛选。原有 45 条知识和 66 组练习完整保留。

| 新主题 | 数据处理与适用范围 | 物理依据 |
| --- | --- | --- |
| 匀加速运动：速度与时间 | v–t 带截距拟合；处理正向匀加速段，保留初速度。 | [OpenStax · 3 4 Motion With Constant Acceleration](https://openstax.org/books/university-physics-volume-1/pages/3-4-motion-with-constant-acceleration) |
| 牛顿第二定律：合力与加速度 | F合–a 斜率估计质量；系统质量不变，所填力必须是合外力。 | [OpenStax · 5 3 Newtons Second Law](https://openstax.org/books/university-physics-volume-1/pages/5-3-newtons-second-law) |
| 功与动能：用图线估计质量 | W合–(v²−v₀²) 斜率的两倍估计质量；处理速度增大的平动过程。 | [OpenStax · 7 3 Work Energy Theorem](https://openstax.org/books/university-physics-volume-1/pages/7-3-work-energy-theorem) |
| 阿基米德原理：浮力测液体密度 | 浮力–排液体积斜率除以 g 得液体密度；cm³ 先转 m³。 | [OpenStax · 14 4 Archimedes Principle And Buoyancy](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy) |
| 导线电阻率：长度与电阻 | R–L 斜率乘截面积；均匀圆导线、恒温，显示 μΩ·m。 | [OpenStax · 9 3 Resistivity And Resistance](https://openstax.org/books/university-physics-volume-2/pages/9-3-resistivity-and-resistance) |
| 电热转换：温升与输入电能 | 温升–时间斜率求进入水的表观热转换比例；恒定 I、R，忽略容器储热。 | [OpenStax · 9 5 Electrical Energy And Power](https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power) |
| 电容放电：对数图与时间常数 | ln(V/1 V)–t 负斜率求 τ；零终值、单指数、正电压。同时绘制电压、对数拟合和残差。 | [OpenStax · 10 5 Rc Circuits](https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits) |
| 变压器：匝数比与电压比 | 次级–初级交流有效值斜率与理想匝数比对照；频率相同、正弦交流。 | [OpenStax · 15 6 Transformers](https://openstax.org/books/university-physics-volume-2/pages/15-6-transformers) |
| 光栅衍射：正弦图测波长 | sinθ–正侧整数级次拟合；垂直入射，不使用小角度替代正弦。 | [OpenStax · 4 4 Diffraction Gratings](https://openstax.org/books/university-physics-volume-3/pages/4-4-diffraction-gratings) |
| 全反射：临界角与相对折射率 | 逐组 1/sinθc 后平均；结果为 n高/n低，仅从高折射率向低折射率传播。 | [OpenStax · 1 4 Total Internal Reflection](https://openstax.org/books/university-physics-volume-3/pages/1-4-total-internal-reflection) |
| 线性热膨胀：伸长与温升 | 伸长–温升斜率除初始长度；系数在温区近似恒定，显示 10⁻⁶/K。 | [OpenStax · 1 3 Thermal Expansion](https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion) |
| 弦驻波：基频与线密度 | 基频–弦长倒数拟合；两端节点、一个波腹、张力恒定，显示线密度 g/m。 | [OpenStax · 16 6 Standing Waves And Resonance](https://openstax.org/books/university-physics-volume-1/pages/16-6-standing-waves-and-resonance) |

本版验证：159 项 Python 检查通过，覆盖所有 132 组数据、每个新模型的独立理想值、全部 66 组新 CSV 导入与练习页 / 解答页，以及非法物理输入和预设偏差。高 R² 不会被解释为实验条件已通过。

页面验证：新增放电专题的图表、解答、CSV 文件上传与分步流程正常；知识跳转保留所选实验。375 像素目录以及 320 像素专题和知识页无页面横向溢出，浏览器未记录脚本错误。手机尺寸为浏览器模拟。
