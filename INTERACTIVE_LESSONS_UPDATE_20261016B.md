# 18 门交互实验 · 2026-10-16 扩展版

## 本轮新增

交互课从 9 门增加到 18 门，分步概念自检从 18 题增加到 36 题。原有 9 门课程与进度保留，原始测量与教学仿真继续分别保存和解释。

| 新增课程 | 学生可以探索的关系 | 特别核查 |
|---|---|---|
| 阿基米德原理 | 密度、排液体积与浮力 | 排液体积，cm³ 转 m³ |
| 导线电阻率 | 长度、直径与电阻 | 直径需平方，接触电阻 |
| 电热转换 | 电流、时间与水温升 | g 转 kg，进入水的热量比例 |
| 变压器 | 交流有效值与匝数比 | 同频交流，理想空载模型 |
| 光栅衍射 | 线密度、波长与级次 | 不存在的级次与掠射边界 |
| 全反射 | 高低折射率、入射角与临界角 | 大于临界角才是全反射 |
| 线性热膨胀 | 杆长、温升与伸长 | 微量系数及 cm/mm 换算 |
| 弦驻波 | 张力、弦长、线密度与基频 | 两端节点，基频一个波腹 |
| 马吕斯定律 | 检偏角、光强与背景 | 已线偏振入射，先扣背景 |

每课沿用预测 → 调参观察 → 实测 → 迁移自检流程，配有分层提示、解释、图点和公式提问。仿真本地运行，不消耗模型调用额度；AI 提问仍沿用已配置服务和额度。

资料库新增“可调交互课”筛选，可与学科、教材、关键词组合查找，并从目录直接进入课程。首页也提供交互课入口。原有 128 个实验资料主题、504 组教学模拟数据、1512 道分级练习保持不变；18 门是其中提供完整交互课的主题数量。

本包包含上一轮复选框对号与状态修复，即使还没上传 9 门版本，也可以直接使用本次累计更新包。

## 手动更新

1. 解压本轮 GitHub 累计更新包，共 16 个文件（含说明和文件清单）。
2. 将里面的文件按原路径上传原仓库：保留 app、tests 的目录层级；根目录说明与清单也放在根目录。不要删除其余原文件，不要直接上传 ZIP。
3. 提交 GitHub 更新后，在 Render 原服务中点 Manual Deploy → Deploy latest commit。
4. 部署成功后刷新网站，从首页“浏览交互实验”进入，检查“可调交互课（18）”。

本轮无需更改环境变量、数据库或 API Key。完整源码包供备份或新建项目使用。

## 原理核查来源

以下链接用于核查公式与适用条件；题目、提示和图示由项目编写。

- [OpenStax：阿基米德原理](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy)
- [OpenStax：电阻率与电阻](https://openstax.org/books/university-physics-volume-2/pages/9-3-resistivity-and-resistance)
- [OpenStax：电能与功率](https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power)
- [OpenStax：变压器](https://openstax.org/books/university-physics-volume-2/pages/15-6-transformers)
- [OpenStax：光栅衍射](https://openstax.org/books/university-physics-volume-3/pages/4-4-diffraction-gratings)
- [OpenStax：全反射](https://openstax.org/books/university-physics-volume-3/pages/1-4-total-internal-reflection)
- [OpenStax：热膨胀](https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion)
- [OpenStax：驻波与共振](https://openstax.org/books/university-physics-volume-1/pages/16-6-standing-waves-and-resonance)
- [OpenStax：偏振](https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization)

## 验证记录

- 课程后端 48 项测试通过，覆盖 18 门课程、36 道题、144 种选项评分，以及答案披露、提示、进度隔离、复习和原 9 门内容一致性。
- 助教与页面导航 19 项测试通过。本轮共 67 项后端测试通过。
- 18 类数值模型的单位换算、比例、端点与非法输入检查通过。光栅额外检查允许、掠射和不存在状态；全反射检查临界上下边界。
- 18 个课程公式通过项目随附 KaTeX 渲染。
- 浏览器逐一走查新增 9 门预测与模型；检查滑杆、选点和公式展示；验证迁移题答错提示、修改后答对、提示使用记录及复习安排。
- 验证模型调参不改写已录入的数据；跨实验换课前可取消并保留草稿。
- 目录正确显示 18 个交互入口，支持关键词与模式筛选。重点页面在 1280、375 和 320 像素宽度下无整页横向溢出，未发现页面脚本或公式渲染错误。
- 验证只使用本机临时数据库，模型服务关闭；未调用付费 AI，未连接生产数据库。

本轮未替用户上传或部署；在 GitHub 提交并完成 Render 部署后，公网页面才会更新。
