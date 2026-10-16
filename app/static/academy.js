"use strict";
(() => {
  // These functions describe ideal teaching models. They never modify measured data.
  const finiteResult = result => { if (Object.values(result).some(value => typeof value === "number" && !Number.isFinite(value))) throw new RangeError("参数超出本教学模型的数值范围。"); return result; };
  const models = {
    pendulum(lengthM, gravity = 9.81) {
      if (![lengthM, gravity].every(Number.isFinite) || !(lengthM > 0) || !(gravity > 0)) throw new RangeError("摆长与重力加速度必须为正数。");
      const period = 2 * Math.PI * Math.sqrt(lengthM / gravity);
      return {length_m: lengthM, period_s: period, period_squared_s2: period * period, gravity_m_s2: gravity};
    },
    ohms(resistanceOhm, voltageV) {
      if (![resistanceOhm, voltageV].every(Number.isFinite) || !(resistanceOhm > 0) || !(voltageV >= 0)) throw new RangeError("电阻须为正数，电压不能为负。");
      return {resistance_ohm: resistanceOhm, voltage_V: voltageV, current_mA: voltageV / resistanceOhm * 1000};
    },
    hooke(stiffnessNPerM, forceN) {
      if (![stiffnessNPerM, forceN].every(Number.isFinite) || !(stiffnessNPerM > 0) || !(forceN >= 0)) throw new RangeError("劲度系数须为正数，载荷不能为负。");
      return finiteResult({stiffness_N_m: stiffnessNPerM, force_N: forceN, extension_m: forceN / stiffnessNPerM, extension_cm: forceN / stiffnessNPerM * 100});
    },
    spring(massKg, stiffnessNPerM) {
      if (![massKg, stiffnessNPerM].every(Number.isFinite) || !(massKg > 0) || !(stiffnessNPerM > 0)) throw new RangeError("质量与劲度系数必须为正数。");
      const period = 2 * Math.PI * Math.sqrt(massKg / stiffnessNPerM);
      return finiteResult({mass_kg: massKg, stiffness_N_m: stiffnessNPerM, period_s: period, period_squared_s2: period * period});
    },
    lens(focalCm, objectCm) {
      if (![focalCm, objectCm].every(Number.isFinite) || !(focalCm > 0) || !(objectCm > focalCm)) throw new RangeError("本实像模型要求正焦距且物距大于焦距。");
      const image = focalCm / (1 - focalCm / objectCm);
      return finiteResult({focal_cm: focalCm, object_cm: objectCm, image_cm: image, magnification: -image / objectCm});
    },
    refraction(index2, incidenceDeg) {
      if (![index2, incidenceDeg].every(Number.isFinite) || !(index2 >= 1) || !(incidenceDeg >= 0 && incidenceDeg < 90)) throw new RangeError("本模型从空气入射，介质折射率至少为 1，入射角须在 0° 至 90° 之间。");
      const sine = Math.sin(incidenceDeg * Math.PI / 180), refracted = Math.asin(sine / index2);
      return finiteResult({index_1: 1, index_2: index2, incidence_deg: incidenceDeg, refraction_deg: refracted * 180 / Math.PI, sine_incidence: sine, sine_refraction: Math.sin(refracted)});
    },
    doubleSlit(wavelengthNm, distanceM, slitSpacingMm) {
      if (![wavelengthNm, distanceM, slitSpacingMm].every(Number.isFinite) || !(wavelengthNm > 0 && distanceM > 0 && slitSpacingMm > 0)) throw new RangeError("波长、屏距和缝距必须为正数。");
      const spacing = wavelengthNm * 1e-6 * distanceM / slitSpacingMm * 1000;
      return finiteResult({wavelength_nm: wavelengthNm, distance_m: distanceM, slit_spacing_mm: slitSpacingMm, fringe_spacing_mm: spacing});
    },
    fringeIntensity(positionMm, fringeSpacingMm) {
      if (![positionMm, fringeSpacingMm].every(Number.isFinite) || !(fringeSpacingMm > 0)) throw new RangeError("屏幕位置须为有限数，条纹间距须为正数。");
      const phase = Math.PI * (positionMm / fringeSpacingMm);
      if (!Number.isFinite(phase)) throw new RangeError("条纹相位超出数值范围。");
      return Math.cos(phase) ** 2;
    },
    calorimetry(metalMassG, waterMassG, waterTempC, metalTempC, metalSpecificJkgK = 900) {
      if (![metalMassG, waterMassG, waterTempC, metalTempC, metalSpecificJkgK].every(Number.isFinite) || !(metalMassG > 0 && waterMassG > 0 && metalSpecificJkgK > 0) || !(waterTempC >= 0 && waterTempC < metalTempC && metalTempC <= 100)) throw new RangeError("质量与比热容须为正数，温度要求 0 ≤ 水初温 < 金属初温 ≤ 100 ℃。");
      const metalCapacity = metalMassG / 1000 * metalSpecificJkgK, waterCapacity = waterMassG / 1000 * 4180;
      const equilibrium = waterTempC + (metalTempC - waterTempC) * metalCapacity / (metalCapacity + waterCapacity);
      const absorbed = waterCapacity * (equilibrium - waterTempC), released = metalCapacity * (metalTempC - equilibrium);
      return finiteResult({metal_mass_g: metalMassG, water_mass_g: waterMassG, water_temp_C: waterTempC, metal_temp_C: metalTempC, metal_specific_J_kg_K: metalSpecificJkgK, equilibrium_C: equilibrium, absorbed_J: absorbed, released_J: released, recovered_specific_J_kg_K: absorbed / (metalMassG / 1000 * (metalTempC - equilibrium))});
    },
    rc(resistanceKohm, capacitanceUf, timeMs, discharge = false, sourceV = 5) {
      if (![resistanceKohm, capacitanceUf, timeMs, sourceV].every(Number.isFinite) || !(resistanceKohm > 0) || !(capacitanceUf > 0) || !(timeMs >= 0) || !(sourceV > 0)) throw new RangeError("RC 参数与电源须为正数，时间不能为负。");
      const tau = resistanceKohm * capacitanceUf;
      const fraction = discharge ? Math.exp(-timeMs / tau) : 1 - Math.exp(-timeMs / tau);
      return {resistance_kohm: resistanceKohm, capacitance_uF: capacitanceUf, time_ms: timeMs, tau_ms: tau, voltage_V: sourceV * fraction, fraction, discharge};
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = models;
  if (typeof document === "undefined") return;
  window.LabAcademy = models;

  const supported = {
    simple_pendulum: {title: "单摆：摆长如何改变周期？", subtitle: "先作一个预测，再用摆动和图线检验。", goal: "理解小角度条件下的周期、摆长与重力加速度。", formula: "T = 2π√(L/g)", tex: "T = 2\\pi\\sqrt{\\frac{L}{g}}", condition: "理想单摆；小角度、无阻尼；g = 9.81 m/s²。", initial: {length: 1}, symbols: [["T", "周期 T：完成一次完整往返所需的时间，单位 s。"], ["L", "摆长 L：从悬点到摆球质心的距离，单位 m。"], ["g", "重力加速度 g：本仿真固定为 9.81 m/s²。"]]},
    ohms_law: {title: "伏安法：图线的斜率意味着什么？", subtitle: "改变电阻与电压，观察同一个欧姆元件的读数。", goal: "联系电压、电流、电阻，辨别坐标轴和单位。", formula: "U = IR", tex: "U = IR", condition: "恒温欧姆元件；电表理想化；忽略导线电阻。", initial: {resistance: 250, voltage: 3}, symbols: [["U", "电压 U：电阻两端的电势差，单位 V。"], ["I", "电流 I：公式使用 A；图中使用 mA。1 mA = 0.001 A。"], ["R", "电阻 R：U–I 图纵轴为 U、横轴为 I 时，斜率对应电阻。若横轴用 mA，斜率还要乘 1000 才得到 Ω。"]]},
    hookes_law: {title: "胡克定律：弹簧伸长与载荷", subtitle: "改变载荷和弹簧，比较 F–x 图的斜率。", goal: "理解弹性限度内的线性关系与劲度系数。", formula: "F = kx", tex: "F = kx", condition: "理想轻弹簧；处于弹性限度内；F 为外加拉力，x 为相对原长的伸长。", initial: {stiffness: 50, force: 2}, symbols: [["F", "外加拉力 F，单位 N；静力平衡时与弹簧恢复力大小相等。"], ["k", "劲度系数 k，单位 N/m；F–x 图中横轴若用 cm，斜率需乘 100 才得到 N/m。"], ["x", "伸长 x = F/k，公式使用 m，读数和图横轴显示 cm。"]]},
    spring_oscillation: {title: "弹簧振子：质量怎样改变周期？", subtitle: "保持弹簧不变，比较不同质量的周期平方。", goal: "区分质量与劲度系数对简谐振动周期的影响。", formula: "T = 2π√(m/k)", tex: "T = 2\\pi\\sqrt{\\frac{m}{k}}", condition: "理想轻弹簧和质点；无阻尼；在弹性限度内作简谐振动。", initial: {mass: .2, stiffness: 20}, symbols: [["T", "振动周期 T，单位 s；振幅在理想线性模型中不改变周期。"], ["m", "振子质量 m，单位 kg；本模型忽略弹簧自身质量。"], ["k", "劲度系数 k，单位 N/m；T²–m 图的斜率为 4π²/k。"]]},
    thin_lens: {title: "薄透镜：物体移动，像在哪里？", subtitle: "调整焦距和物距，观察倒立实像及光路。", goal: "理解实像位置、放大率与物距的非线性关系。", formula: "1/f = 1/u + 1/v", tex: "\\frac{1}{f}=\\frac{1}{u}+\\frac{1}{v}", condition: "薄凸透镜；近轴光线；本课只研究 u > f 的实像。光路按几何关系绘制，坐标使用 cm。", initial: {focal: 10, distance: 30}, symbols: [["f", "焦距 f，单位 cm；本模型取正值。"], ["u", "物距 u，单位 cm；滑杆范围保证 u > f，避免在焦点处无有限像距。"], ["v", "像距 v，单位 cm；本课实像位于透镜另一侧，v 为正。"], ["M", "横向放大率 M = −v/u；负号表示实像倒立。"]]},
    snell_refraction: {title: "折射：光线为什么向法线偏折？", subtitle: "改变入射角和介质，比较角度与正弦关系。", goal: "把斯涅尔定律与光路、折射率联系起来。", formula: "n₁ sin θ₁ = n₂ sin θ₂", tex: "n_1\\sin\\theta_1=n_2\\sin\\theta_2", condition: "单色光由空气 n₁ = 1 入射均匀介质 n₂ ≥ 1；角度从法线量起。此方向不会发生全反射。", initial: {index: 1.5, angle: 45}, symbols: [["n₁", "入射介质为空气，折射率 n₁ 固定为 1。"], ["n₂", "下方介质折射率 n₂，无量纲；本课范围 1.1–2.0。"], ["θ₁", "入射角 θ₁：入射光与界面法线的夹角，读数使用 °。"], ["θ₂", "折射角 θ₂：折射光与法线的夹角。sin θ₂–sin θ₁ 图的斜率为 1/n₂。"]]},
    double_slit: {title: "双缝干涉：条纹间距由什么决定？", subtitle: "改变波长、屏距和缝距，比较相邻亮纹的距离。", goal: "理解条纹间距与波长、屏距成正比，与缝距成反比。", formula: "Δx = λD/d", tex: "\\Delta x=\\frac{\\lambda D}{d}", condition: "理想相干、等强双缝；远场小角度近似；忽略单缝衍射包络。亮度示意采用相对强度。", initial: {wavelength: 550, distance: 1, spacing: .5}, symbols: [["λ", "波长 λ，滑杆使用 nm；代入 SI 公式时乘 10⁻⁹ 换算为 m。"], ["D", "双缝到屏幕的距离 D，单位 m；缝距远小于屏距。"], ["d", "双缝间距 d，滑杆使用 mm；SI 公式需换算为 m。"], ["Δx", "相邻亮纹的间距 Δx；图示与读数使用 mm。"]]},
    calorimetry: {title: "量热法：怎样测出金属的比热容？", subtitle: "把热金属放入水中，观察平衡温度与能量交换。", goal: "用水的吸热量回算金属比热容，辨别质量与温差的作用。", formula: "m金c金(T热−T) = m水c水(T−T冷)", tex: "\\begin{aligned}&m_m c_m(T_h-T)\\\\&\\quad=m_w c_w(T-T_c)\\end{aligned}", condition: "热金属与水达到热平衡；水的比热容 c水 = 4180 J/(kg·K)；忽略量热器吸热、散热、蒸发与相变。", initial: {metalMass: 100, waterMass: 150, waterTemp: 20, metalTemp: 80, specific: 900}, symbols: [["m金", "金属质量，读数使用 g，计算热量时换算为 kg。"], ["c金", "金属比热容，单位 J/(kg·K)；本模型可设置，再用水的吸热量回算验证。"], ["m水", "水的质量；水比热容固定为 4180 J/(kg·K)，质量使用 kg 代入。"], ["T", "最终平衡温度应位于水和金属的初温之间。温差 1 ℃ 与 1 K 相等。"], ["Q", "水吸热量等于金属放热量，单位 J；实际实验须考虑量热器与散热修正。"]]},
    rc_time_constant: {title: "RC：为什么是 63.2%？", subtitle: "改变电阻和电容，追踪充电与放电的同一时刻。", goal: "把时间常数与曲线上的电压比例对应起来。", formula: "τ = RC", tex: "\\tau = RC", condition: "理想一阶 RC 电路；电源 5 V；充电从 0 V 开始，放电从 5 V 开始。", initial: {resistance: 10, capacitance: 1, time: 1, discharge: false}, symbols: [["τ", "时间常数 τ = RC：R 用 Ω、C 用 F 时，τ 的单位是 s。此处 R 用 kΩ、C 用 μF，因此读数为 ms。"], ["R", "电阻 R：增大电阻，会按相同比例增大充电与放电的时间常数。"], ["C", "电容 C：增大电容，会按相同比例增大时间常数。"], ["Vc", "电容电压 Vc：充电时为 5(1−e^(−t/τ)) V，放电时为 5e^(−t/τ) V。"]]}
  };
  window.LabAcademyCourseList = Object.entries(supported).map(([experiment_id, config]) => ({experiment_id, title: config.title, summary: config.goal}));
  const get = id => document.getElementById(id);
  const make = (tag, text, cls) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; };
  const button = (text, callback, cls = "academy-button") => { const el = make("button", text, cls); el.type = "button"; el.addEventListener("click", callback); return el; };
  const number = (value, precision = 3) => Number(value.toPrecision(precision)).toLocaleString("zh-CN", {maximumSignificantDigits: precision});
  const supportedPages = new Set(["experiment", "topic", "data", "review", "observations", "checks", "calculation", "diagnosis", "revision"]);
  const records = new Map();
  let activeId = "", activePage = "", root = null, frame = null, generation = 0, observer, focusedLesson = "";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const record = id => { if (!records.has(id)) records.set(id, {params: {...supported[id].initial}, course: null, loading: false, loadedAt: 0, lastLoadAttempt: 0, error: "", explored: false, transferOpen: false, results: {}, answers: {}, selected: null, symbol: 0, pause: false, busy: new Set()}); return records.get(id); };
  function stopAnimation() { if (frame != null) cancelAnimationFrame(frame); frame = null; }
  function routeExperiment() { const match = location.pathname.match(/^\/experiments\/([a-z0-9_]+)$/); return match ? match[1] : get("experimentId")?.value; }
  function ask(question, selection) { window.dispatchEvent(new CustomEvent("lab-academy-question", {detail: {question, experiment_id: activeId, selection}})); }
  async function api(path, data) {
    const response = await fetch(`/api/v1/learning/courses/${path}`, {method: data === undefined ? "GET" : "POST", credentials: "same-origin", headers: {Accept: "application/json", ...(data === undefined ? {} : {"Content-Type": "application/json"})}, ...(data === undefined ? {} : {body: JSON.stringify(data)})});
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "课程暂时无法连接，请稍后再试。");
    return body;
  }
  async function loadCourse(id, force = false) {
    const state = record(id); if (!window.tutorReady || state.loading || (state.course && !force)) return;
    state.loading = true; state.error = ""; state.lastLoadAttempt = Date.now(); const token = generation;
    try {
      const course = await api(id);
      if (token !== generation) return;
      state.course = course; state.loadedAt = Date.now();
      for (const item of course.progress || []) if (item.attempt_count > 0) {
        state.results[item.node_id] = {...item, correct: item.last_correct, restored: true};
        if (item.last_choice_id) state.answers[item.node_id] = item.last_choice_id;
        else if (Object.hasOwn(item, "last_choice_id")) delete state.answers[item.node_id];
      }
    } catch (error) { if (token === generation) state.error = error.message; }
    finally { if (token === generation) { state.loading = false; if (activeId === id) { renderContent(); focusLesson(); } } }
  }
  function answeredPrediction(state) { return Object.values(state.results).some(result => result.attempt_count > 0) && !!state.results.prediction; }
  function stageNav(state) {
    const nav = make("ol", null, "academy-stages"); nav.setAttribute("aria-label", "交互课路径");
    [["先预测", !!state.results.prediction?.correct], ["探索模型", state.explored], ["记录实测", false], ["再验证", !!state.results.transfer?.correct]].forEach(([label, done], index) => {
      const li = make("li", null, done ? "complete" : "");
      const current = !state.explored ? 0 : state.transferOpen ? 3 : 1;
      if (index === current) li.setAttribute("aria-current", "step");
      li.append(make("span", done ? "✓" : String(index + 1).padStart(2, "0")), make("b", label)); nav.append(li);
    }); return nav;
  }
  function entry(state) {
    const config = supported[activeId], section = make("section", null, "academy-entry");
    const copy = make("div"); copy.append(make("p", "INTERACTIVE LESSON / 交互课", "eyebrow"), make("h2", config.title), make("p", config.subtitle));
    const action = make("a", "进入交互课 →", "academy-entry-link"); action.href = "/data";
    if (activePage === "topic") action.addEventListener("click", event => { event.preventDefault(); window.startAcademyExperiment?.(activeId); });
    else action.dataset.route = "";
    section.append(copy, action); return section;
  }
  function renderContent() {
    if (!root || !activeId) return;
    stopAnimation(); const state = record(activeId), config = supported[activeId];
    root.replaceChildren();
    if (["experiment", "topic"].includes(activePage)) { root.append(entry(state)); return; }
    const contents = make("div", null, "academy-course-content");
    if (activePage !== "data") {
      const details = make("details", null, "academy-revisit"); details.append(make("summary", "回看交互课：预测、模型与理解检查"), contents); root.append(details);
      details.addEventListener("toggle", () => { if (details.open) beginAnimation(); else stopAnimation(); });
    } else root.append(contents);
    const header = make("header", null, "academy-heading");
    header.append(make("p", "INTERACTIVE LESSON / 交互课", "eyebrow"), make("h2", config.title), make("p", config.goal));
    contents.append(header, stageNav(state));
    const notice = make("p", "教学仿真 · 与下方实测分开。模型参数不会写入你的原始数据。", "academy-disclaimer"); contents.append(notice);
    const questionArea = make("section", null, "academy-prediction"); questionArea.setAttribute("aria-label", "先预测"); questionArea.append(make("p", "01 / 先预测", "academy-kicker"));
    if (state.loading) questionArea.append(make("p", "正在载入本次学习进度…", "academy-muted"));
    else if (state.error) {
      const error = make("p", `${state.error} 仍可探索模型；连接恢复后再记录答题进度。`, "academy-error"); error.setAttribute("role", "status"); questionArea.append(error, button("重新连接课程", () => loadCourse(activeId, true), "academy-text-button"));
    } else if (state.course) {
      const nodes = state.course.nodes.filter(item => item.stage === "prediction"); nodes.forEach(item => questionArea.append(question(item, state)));
    }
    contents.append(questionArea);
    const explore = button(state.explored ? "已开启模型探索" : "开始探索模型 →", () => { state.explored = true; renderContent(); root.querySelector(".academy-exploration h3")?.focus({preventScroll: true}); }, "academy-primary");
    explore.disabled = state.explored || (!answeredPrediction(state) && !state.error);
    contents.append(explore);
    if (!state.explored && !state.error) contents.append(make("p", "先提交你的预测。答错后也可以观察模型，再回来修改。", "academy-muted"));
    if (state.explored) {
      const exploration = make("section", null, "academy-exploration");
      const title = make("h3", "02 / 改变参数，看看会发生什么"); title.tabIndex = -1;
      exploration.append(title, make("p", config.condition, "academy-condition"));
      const layout = make("div", null, "academy-lab-layout"), controls = make("div", null, "academy-controls"), visual = make("div", null, "academy-visual");
      layout.append(controls, visual); exploration.append(layout); contents.append(exploration);
      buildControls(controls, state); buildFormula(controls, state, config); buildVisual(visual, state);
      const continueArea = make("div", null, "academy-continue");
      const note = make("div"); note.append(make("strong", "03 / 回到自己的实验"), make("p", "用真实读数检验模型，记录实际条件与偏差。仿真不能代替测量。"));
      continueArea.append(note, button("去记录实测 ↓", () => {
        const target = document.querySelector('[data-view="data"] > .card');
        if (target) { window.flowReveal?.(target); target.scrollIntoView({behavior: reducedMotion.matches ? "auto" : "smooth", block: "start"}); const first = [...target.querySelectorAll("input,button,select,textarea")].find(el => !el.disabled && el.offsetParent !== null); first?.focus({preventScroll: true}); }
      }, "academy-text-button")); contents.append(continueArea);
      const transfer = make("section", null, "academy-transfer");
      transfer.append(make("h3", "04 / 再验证一次理解"), make("p", "把模型用到一个新情境。可以先完成实测，再回来回答。", "academy-muted"));
      if (state.transferOpen) { (state.course?.nodes || []).filter(item => item.stage === "transfer").forEach(item => transfer.append(question(item, state))); if (!state.course) transfer.append(make("p", "课程连接恢复后即可提交理解检查。")); }
      else transfer.append(button("试一道迁移题 →", () => { state.transferOpen = true; renderContent(); root.querySelector(".academy-transfer")?.scrollIntoView({block: "nearest"}); }, "academy-button"));
      contents.append(transfer); beginAnimation();
    }
  }
  function question(item, state) {
    const id = item.id || item.node_id, wrap = make("div", null, "academy-question"); wrap.dataset.node = id;
    const fieldset = make("fieldset"), legend = make("legend", item.question); fieldset.append(legend);
    const choices = make("div", null, "academy-choices");
    (item.choices || []).forEach(choice => {
      const label = make("label", null, "academy-choice"), input = make("input"); input.type = "radio"; input.name = `academy-${activeId}-${id}`; input.value = choice.id;
      input.checked = state.answers[id] === choice.id; input.disabled = state.busy.has(id);
      input.addEventListener("change", () => { state.answers[id] = choice.id; submit.disabled = false; error.hidden = true; });
      label.append(input, make("span", choice.text)); choices.append(label);
    }); fieldset.append(choices); wrap.append(fieldset);
    const result = state.results[id];
    const submit = button(state.busy.has(id) ? "正在保存…" : result?.correct ? "再答一次" : result?.attempt_count ? "修改后再试" : "提交我的预测", () => submitAnswer(item, state, wrap), "academy-button");
    if (item.stage === "transfer" && !result?.attempt_count) submit.textContent = "提交理解检查";
    const locked = result?.correct && result.can_answer === false;
    submit.disabled = locked || !state.answers[id] || state.busy.has(id);
    if (locked) { submit.textContent = "本次理解检查已完成"; fieldset.disabled = true; }
    wrap.append(submit);
    const error = make("p", "", "academy-error"); error.hidden = true; error.setAttribute("role", "status"); wrap.append(error);
    if (result) {
      const response = make("div", null, `academy-response ${result.correct ? "is-correct" : "try-again"}`); response.setAttribute("role", "status");
      response.append(make("strong", result.status === "review_due" ? "到了独立复习的时间" : result.correct ? result.assisted ? "在提示帮助下完成了这道题" : "本题答对，继续验证" : "再观察一下，再作判断"));
      if (result.restored) response.append(make("p", result.status === "review_due" ? "先独立作答，提交后再根据反馈核对。之前的答案已收起。" : `已恢复学习记录：尝试 ${result.attempt_count} 次${result.assisted ? "，使用过提示" : ""}。${locked ? "本次已完成，可以回看解析；到期后再独立复习。" : "可以重新回答巩固理解。"}`));
      else {
        if (result.feedback) response.append(make("p", result.feedback));
        if (result.hint) response.append(make("p", `提示：${result.hint}`, "academy-answer-hint"));
      }
      if (result.explanation) { const explanation = make("details", null, "academy-explanation"); explanation.open = !result.restored; explanation.append(make("summary", "回看解释"), make("p", result.explanation)); response.append(explanation); }
      wrap.append(response);
      if (result.attempts?.length) {
        const changes = make("details", null, "academy-attempt-history"), history = make("ol");
        changes.append(make("summary", `作答与修改记录（本轮 ${result.total ?? result.cycle_attempt_count ?? result.attempt_count} 次）`));
        for (const attempt of result.attempts) {
          const choice = item.choices.find(option => option.id === attempt.choice_id), entry = make("li");
          entry.append(make("span", choice?.text || attempt.choice_id), make("small", `${attempt.correct ? "本题答对" : "待调整"}${attempt.assisted ? " · 根据提示再答" : ""}${attempt.answered_at ? ` · ${new Date(attempt.answered_at).toLocaleString("zh-CN")}` : ""}`)); history.append(entry);
        }
        changes.append(history); if (result.truncated || result.attempts_truncated) changes.append(make("p", "此处显示最近 8 次记录。", "academy-muted")); wrap.append(changes);
      }
    }
    return wrap;
  }
  async function submitAnswer(item, state, wrap) {
    const id = item.id || item.node_id, eid = activeId, token = generation;
    if (!state.answers[id] || state.busy.has(id)) return;
    state.busy.add(id); wrap.querySelectorAll("input,button").forEach(el => el.disabled = true);
    try {
      const response = await api(`${eid}/answers`, {node_id: id, choice_id: state.answers[id]});
      if (token !== generation) return;
      const attempts = [...(state.results[id]?.attempts || []), {choice_id: state.answers[id], correct: response.correct, assisted: response.assisted, answered_at: new Date().toISOString()}].slice(-8);
      state.results[id] = {...response, attempts, can_answer: response.correct ? false : true}; state.busy.delete(id);
      window.dispatchEvent(new CustomEvent("lab-learning-updated", {detail: {experiment_id: eid, node_id: id, correct: response.correct}}));
      if (activeId === eid) { renderContent(); const status = root.querySelector(`[data-node="${id}"] .academy-response`); if (status) { status.tabIndex = -1; status.focus({preventScroll: true}); } }
    } catch (error) {
      if (token !== generation) return;
      state.busy.delete(id); wrap.querySelectorAll("input,button").forEach(el => el.disabled = false);
      const note = wrap.querySelector(".academy-error"); note.textContent = `${error.message} 你的选项仍然保留，请重试。`; note.hidden = false;
    }
  }
  function range(parent, key, label, min, max, step, value, format, onInput) {
    const holder = make("div", null, "academy-range"), caption = make("div"), control = make("input"), output = make("output");
    control.id = `academy-${activeId}-${key}`; control.type = "range"; control.min = min; control.max = max; control.step = step; control.value = value;
    const l = make("label", label); l.htmlFor = control.id; output.htmlFor = control.id; output.value = format(value); caption.append(l, output);
    control.setAttribute("aria-valuetext", format(value));
    control.addEventListener("input", () => { const n = Number(control.value); output.value = format(n); control.setAttribute("aria-valuetext", format(n)); onInput(n); updateVisual(); });
    holder.append(caption, control); parent.append(holder);
  }
  function buildControls(parent, state) {
    const p = state.params;
    if (activeId === "simple_pendulum") {
      range(parent, "length", "摆长 L", .25, 1.5, .05, p.length, n => `${number(n)} m`, n => p.length = n);
      parent.append(make("p", "摆角固定为 8°。观察完整往返，区分周期与半周期。", "academy-muted"));
      const pause = button(state.pause ? "继续摆动" : "暂停摆动", () => { state.pause = !state.pause; pause.textContent = state.pause ? "继续摆动" : "暂停摆动"; if (state.pause) stopAnimation(); else beginAnimation(); }, "academy-text-button");
      parent.append(pause); if (reducedMotion.matches) parent.append(make("p", "已按减少动态效果设置，显示静态摆位与数值。", "academy-muted"));
    } else if (activeId === "ohms_law") {
      range(parent, "resistance", "电阻 R", 100, 1000, 50, p.resistance, n => `${number(n)} Ω`, n => p.resistance = n);
      range(parent, "voltage", "电压 U", .5, 5, .1, p.voltage, n => `${number(n)} V`, n => p.voltage = n);
      parent.append(make("p", "保持 R 不变，改变 U；再换一个 R，比较 U–I 图的斜率。", "academy-muted"));
    } else if (activeId === "rc_time_constant") {
      range(parent, "resistance", "电阻 R", 1, 50, 1, p.resistance, n => `${number(n)} kΩ`, n => p.resistance = n);
      range(parent, "capacitance", "电容 C", .5, 10, .5, p.capacitance, n => `${number(n)} μF`, n => p.capacitance = n);
      range(parent, "time", "观察时刻 t", 0, 5, .1, p.time, n => `${number(n)} τ`, n => p.time = n);
      const modes = make("div", null, "academy-modes"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "RC 模式");
      [false, true].forEach(discharge => { const b = button(discharge ? "放电" : "充电", () => { p.discharge = discharge; [...modes.children].forEach(el => el.setAttribute("aria-pressed", String(el === b))); updateVisual(); }, "academy-mode"); b.setAttribute("aria-pressed", String(discharge === p.discharge)); modes.append(b); }); parent.append(modes);
    } else if (activeId === "hookes_law") {
      range(parent, "stiffness", "劲度系数 k", 20, 100, 5, p.stiffness, n => `${number(n)} N/m`, n => p.stiffness = n);
      range(parent, "force", "外加拉力 F", 0, 4, .1, p.force, n => `${number(n)} N`, n => p.force = n);
      parent.append(make("p", "观察伸长 x，而不是弹簧总长。只在弹性限度内使用本关系。", "academy-muted"));
    } else if (activeId === "spring_oscillation") {
      range(parent, "mass", "振子质量 m", .05, .5, .025, p.mass, n => `${number(n)} kg`, n => p.mass = n);
      range(parent, "stiffness", "劲度系数 k", 10, 50, 2, p.stiffness, n => `${number(n)} N/m`, n => p.stiffness = n);
      parent.append(make("p", "图中质量沿平衡位置振动的示意为静态快照；周期由读数与 T²–m 图比较。", "academy-muted"));
    } else if (activeId === "thin_lens") {
      range(parent, "focal", "焦距 f", 5, 20, 1, p.focal, n => `${number(n)} cm`, n => p.focal = n);
      range(parent, "distance", "物距 u", 25, 100, 1, p.distance, n => `${number(n)} cm`, n => p.distance = n);
      parent.append(make("p", "焦距最多 20 cm、物距至少 25 cm，始终保持 u > f。图中物、像和焦点按同一尺度绘制。", "academy-muted"));
    } else if (activeId === "snell_refraction") {
      range(parent, "index", "介质折射率 n₂", 1.1, 2, .05, p.index, n => number(n), n => p.index = n);
      range(parent, "angle", "入射角 θ₁", 0, 75, 1, p.angle, n => `${number(n)}°`, n => p.angle = n);
      parent.append(make("p", "从法线量角；折射率保持不变时，比较正弦图上的不同点。", "academy-muted"));
    } else if (activeId === "double_slit") {
      range(parent, "wavelength", "单色光波长 λ", 400, 700, 10, p.wavelength, n => `${number(n)} nm`, n => p.wavelength = n);
      range(parent, "distance", "双缝到屏幕距离 D", .5, 2, .1, p.distance, n => `${number(n)} m`, n => p.distance = n);
      range(parent, "spacing", "双缝间距 d", .2, 1, .05, p.spacing, n => `${number(n)} mm`, n => p.spacing = n);
      parent.append(make("p", "屏幕示意固定显示中央 ±15 mm。改变 λ、D、d，比较同一尺度上的条纹疏密。", "academy-muted"));
    } else if (activeId === "calorimetry") {
      range(parent, "metalMass", "金属质量 m金", 50, 250, 10, p.metalMass, n => `${number(n)} g`, n => p.metalMass = n);
      range(parent, "waterMass", "水质量 m水", 50, 300, 10, p.waterMass, n => `${number(n)} g`, n => p.waterMass = n);
      range(parent, "waterTemp", "水初温 T冷", 10, 40, 1, p.waterTemp, n => `${number(n)} ℃`, n => p.waterTemp = n);
      range(parent, "metalTemp", "金属初温 T热", 50, 95, 1, p.metalTemp, n => `${number(n)} ℃`, n => p.metalTemp = n);
      range(parent, "specific", "金属比热容 c金", 200, 1000, 50, p.specific, n => `${number(n)} J/(kg·K)`, n => p.specific = n);
      parent.append(make("p", "温度范围始终保持金属比水热。改变质量或比热容，观察平衡温度靠近哪一侧。", "academy-muted"));
    }
  }
  function buildFormula(parent, state, config) {
    const panel = make("div", null, "academy-formula"), formula = button("", () => ask(`请解释教学仿真中的公式 ${config.formula}。当前模拟：${pointLabel(activeId, currentPoint(state))}。适用条件：${config.condition}`, {kind: "formula", label: config.formula, values: {...currentPoint(state), condition: config.condition}}), "academy-formula-button");
    if (window.katex) window.katex.render(config.tex, formula, {throwOnError: false, trust: false, displayMode: false}); else formula.textContent = config.formula;
    formula.setAttribute("aria-label", `向助教询问公式 ${config.formula}`); panel.append(make("p", "读懂模型", "academy-kicker"), formula);
    const symbols = make("div", null, "academy-symbols"), explanation = make("p", config.symbols[state.symbol][1], "academy-symbol-explanation"); explanation.setAttribute("aria-live", "polite");
    config.symbols.forEach(([symbol, text], index) => { const b = button(symbol, () => { state.symbol = index; explanation.textContent = text; [...symbols.children].forEach(el => el.setAttribute("aria-pressed", String(el === b))); }, "academy-symbol"); b.setAttribute("aria-pressed", String(index === state.symbol)); symbols.append(b); });
    panel.append(symbols, explanation, make("p", "点击公式可将问题带到助教，确认后再发送。", "academy-muted")); parent.append(panel);
  }
  const ns = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}, text) { const el = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value)); if (text != null) el.textContent = text; return el; }
  function newSvg(label, height = 300) { const svg = svgEl("svg", {viewBox: `0 0 600 ${height}`, role: "img", "aria-label": label, class: "academy-chart"}); svg.append(svgEl("title", {}, label)); return svg; }
  function plot({label, xLabel, yLabel, maxX, maxY, points, line, threshold, selected, onSelect}) {
    const svg = newSvg(label), left = 68, right = 575, top = 25, bottom = 243;
    svg.setAttribute("role", "group");
    const x = n => left + n / maxX * (right - left), y = n => bottom - n / maxY * (bottom - top);
    for (let i = 0; i <= 5; i++) {
      const px = x(maxX * i / 5), py = y(maxY * i / 5);
      svg.append(svgEl("line", {x1: left, x2: right, y1: py, y2: py, class: "academy-grid"}), svgEl("text", {x: left - 10, y: py + 4, "text-anchor": "end", class: "academy-tick"}, number(maxY * i / 5)), svgEl("text", {x: px, y: bottom + 22, "text-anchor": "middle", class: "academy-tick"}, number(maxX * i / 5)));
    }
    svg.append(svgEl("path", {d: `M${left},${top}V${bottom}H${right}`, class: "academy-axis"}), svgEl("text", {x: (left + right) / 2, y: 292, "text-anchor": "middle", class: "academy-axis-label"}, xLabel), svgEl("text", {x: 10, y: 14, class: "academy-axis-label"}, yLabel));
    if (threshold) {
      svg.append(svgEl("path", {d: `M${x(threshold.x)},${bottom}V${y(threshold.y)}H${left}`, class: "academy-threshold"}), svgEl("text", {x: Math.min(x(threshold.x) + 9, right - 125), y: y(threshold.y) - 10, class: "academy-threshold-label"}, threshold.label));
    }
    if (line) svg.append(svgEl("path", {d: line.map((point, index) => `${index ? "L" : "M"}${x(point.x).toFixed(3)},${y(point.y).toFixed(3)}`).join(" "), class: "academy-model-line"}));
    points.forEach((point, index) => {
      const circle = svgEl("circle", {cx: x(point.x), cy: y(point.y), r: selected === index ? 7 : 5, class: `academy-chart-point${selected === index ? " selected" : ""}`, tabindex: 0, role: "button", "aria-label": `${point.label}，选择这个教学模拟点`, "aria-pressed": String(selected === index)});
      const choose = () => onSelect(index); circle.addEventListener("click", choose); circle.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); choose(); } }); svg.append(circle);
    }); return svg;
  }
  function currentPoint(state) {
    const p = state.params;
    if (activeId === "simple_pendulum") return models.pendulum(p.length);
    if (activeId === "ohms_law") return models.ohms(p.resistance, p.voltage);
    if (activeId === "rc_time_constant") return models.rc(p.resistance, p.capacitance, p.time * p.resistance * p.capacitance, p.discharge);
    if (activeId === "hookes_law") return models.hooke(p.stiffness, p.force);
    if (activeId === "spring_oscillation") return models.spring(p.mass, p.stiffness);
    if (activeId === "thin_lens") return models.lens(p.focal, p.distance);
    if (activeId === "snell_refraction") return models.refraction(p.index, p.angle);
    if (activeId === "double_slit") return models.doubleSlit(p.wavelength, p.distance, p.spacing);
    if (activeId === "calorimetry") return models.calorimetry(p.metalMass, p.waterMass, p.waterTemp, p.metalTemp, p.specific);
    throw new RangeError("未配置的教学模型。");
  }
  function buildVisual(parent, state) {
    parent.id = "academyVisual";
    const readings = make("div", null, "academy-readings"); readings.id = "academyReadings";
    const graphic = make("div", null, "academy-graphic"); graphic.id = "academyGraphic";
    const selected = make("div", null, "academy-selected"); selected.id = "academySelected"; selected.setAttribute("aria-live", "polite");
    parent.append(readings, graphic, selected, make("p", "可点击曲线上的圆点，或用 Tab 键选择，再向助教询问。", "academy-plot-help")); updateVisual();
  }
  function reading(parent, label, value) { const item = make("div"); item.append(make("span", label), make("strong", value)); parent.append(item); }
  function pointLabel(eid, point) {
    if (eid === "simple_pendulum") return `L = ${number(point.length_m)} m，T = ${number(point.period_s)} s，T² = ${number(point.period_squared_s2)} s²`;
    if (eid === "ohms_law") return `I = ${number(point.current_mA)} mA，U = ${number(point.voltage_V)} V，R = ${number(point.resistance_ohm)} Ω`;
    if (eid === "hookes_law") return `F = ${number(point.force_N)} N，x = ${number(point.extension_cm)} cm，k = ${number(point.stiffness_N_m)} N/m`;
    if (eid === "spring_oscillation") return `m = ${number(point.mass_kg)} kg，k = ${number(point.stiffness_N_m)} N/m，T = ${number(point.period_s)} s，T² = ${number(point.period_squared_s2)} s²`;
    if (eid === "thin_lens") return `f = ${number(point.focal_cm)} cm，u = ${number(point.object_cm)} cm，v = ${number(point.image_cm)} cm，M = ${number(point.magnification)}`;
    if (eid === "snell_refraction") return `n₂ = ${number(point.index_2)}，θ₁ = ${number(point.incidence_deg)}°，θ₂ = ${number(point.refraction_deg)}°，sin θ₁ = ${number(point.sine_incidence)}，sin θ₂ = ${number(point.sine_refraction)}`;
    if (eid === "double_slit") return `λ = ${number(point.wavelength_nm)} nm，D = ${number(point.distance_m)} m，d = ${number(point.slit_spacing_mm)} mm，Δx = ${number(point.fringe_spacing_mm)} mm`;
    if (eid === "calorimetry") return `m金 = ${number(point.metal_mass_g)} g，m水 = ${number(point.water_mass_g)} g，T热 = ${number(point.metal_temp_C)} ℃，T冷 = ${number(point.water_temp_C)} ℃，c金 = ${number(point.metal_specific_J_kg_K)} J/(kg·K)，T = ${number(point.equilibrium_C)} ℃，吸热 = 放热 = ${number(point.absorbed_J)} J`;
    return `t = ${number(point.time_ms)} ms，Vc = ${number(point.voltage_V)} V，τ = ${number(point.tau_ms)} ms（${point.discharge ? "放电" : "充电"}）`;
  }
  function updateVisual(preserveSelected = false) {
    const graphic = get("academyGraphic"), readings = get("academyReadings"), holder = get("academySelected");
    if (!graphic || !activeId) return;
    const state = record(activeId), p = state.params, current = currentPoint(state); if (!preserveSelected) state.selected = current;
    readings.replaceChildren(); graphic.replaceChildren();
    const choose = (point, focusChart = false) => { state.selected = point; updateVisual(true); if (focusChart) get("academyGraphic")?.querySelector('.academy-chart[role="group"] .selected')?.focus({preventScroll: true}); };
    let points, curve, chart;
    if (activeId === "simple_pendulum") {
      reading(readings, "单周期 T", `${number(current.period_s)} s`); reading(readings, "周期平方 T²", `${number(current.period_squared_s2)} s²`);
      const drawing = newSvg("小角度单摆示意：摆长从悬点量至摆球质心。", 170); drawing.classList.add("academy-pendulum");
      drawing.append(svgEl("line", {x1: 190, x2: 410, y1: 14, y2: 14, class: "academy-support"}), svgEl("line", {x1: 300, x2: 300, y1: 14, y2: 157, class: "academy-rest-line"}), svgEl("line", {id: "academyPendulumString", x1: 300, y1: 14, x2: 300, y2: 130, class: "academy-string"}), svgEl("circle", {id: "academyPendulumBob", cx: 300, cy: 130, r: 11, class: "academy-bob"}), svgEl("text", {x: 400, y: 88, class: "academy-axis-label"}, `L = ${number(p.length)} m`)); graphic.append(drawing);
      points = [.25, .5, .75, 1, 1.25, 1.5].map(length => models.pendulum(length));
      if (!points.some(point => Math.abs(point.length_m - p.length) < 1e-6)) points.push(current);
      points.sort((a, b) => a.length_m - b.length_m);
      chart = plot({label: "单摆周期平方与摆长的教学模型", xLabel: "摆长 L / m", yLabel: "周期平方 T² / s²", maxX: 1.5, maxY: 7, line: [{x: 0, y: 0}, {x: 1.5, y: models.pendulum(1.5).period_squared_s2}], points: points.map(point => ({x: point.length_m, y: point.period_squared_s2, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.length_m - state.selected.length_m) < 1e-6), onSelect: index => choose(points[index], true)});
      const theta = reducedMotion.matches || state.pause ? .1396 : 0; positionPendulum(theta, p.length);
    } else if (activeId === "ohms_law") {
      reading(readings, "模拟电流 I", `${number(current.current_mA)} mA`); reading(readings, "U/I（I 换算为 A）", `${number(p.resistance)} Ω`);
      points = [0, 1, 2, 3, 4, 5].map(voltage => models.ohms(p.resistance, voltage)); if (!points.some(point => Math.abs(point.voltage_V - p.voltage) < 1e-6)) points.push(current); points.sort((a, b) => a.voltage_V - b.voltage_V);
      chart = plot({label: "恒温欧姆元件 U–I 教学模型；横轴电流毫安，纵轴电压伏特", xLabel: "电流 I / mA", yLabel: "电压 U / V", maxX: 50, maxY: 5.5, line: points.map(point => ({x: point.current_mA, y: point.voltage_V})), points: points.map(point => ({x: point.current_mA, y: point.voltage_V, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.voltage_V - state.selected.voltage_V) < 1e-6), onSelect: index => choose(points[index], true)});
    } else if (activeId === "rc_time_constant") {
      reading(readings, "时间常数 τ", `${number(current.tau_ms)} ms`); reading(readings, `t = ${number(p.time)} τ 时的 Vc`, `${number(current.voltage_V)} V`);
      const threshold = models.rc(p.resistance, p.capacitance, current.tau_ms, p.discharge);
      curve = Array.from({length: 101}, (_, i) => models.rc(p.resistance, p.capacitance, current.tau_ms * i / 20, p.discharge));
      points = [0, .5, 1, 2, 3, 4, 5].map(time => models.rc(p.resistance, p.capacitance, time * current.tau_ms, p.discharge)); if (!points.some(point => Math.abs(point.time_ms - current.time_ms) < 1e-8)) points.push(current); points.sort((a, b) => a.time_ms - b.time_ms);
      chart = plot({label: `RC ${p.discharge ? "放电" : "充电"}教学曲线，标出一个时间常数的电压比例`, xLabel: "时间 t / ms", yLabel: "电容电压 Vc / V", maxX: 5 * current.tau_ms, maxY: 5.5, threshold: {x: threshold.time_ms, y: threshold.voltage_V, label: `τ · ${p.discharge ? "36.8%" : "63.2%"}`}, line: curve.map(point => ({x: point.time_ms, y: point.voltage_V})), points: points.map(point => ({x: point.time_ms, y: point.voltage_V, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.time_ms - state.selected.time_ms) < 1e-8), onSelect: index => choose(points[index], true)});
    }
    if (!chart) ({points, chart} = extendedVisual(state, current, graphic, readings, choose));
    graphic.append(chart); holder.replaceChildren();
    const pointChoice = make("select"), pointChoiceLabel = make("label", "选择模拟点"); pointChoice.id = `academy-point-${activeId}`; pointChoiceLabel.htmlFor = pointChoice.id;
    points.forEach((point, index) => { const option = make("option", `${index + 1}. ${pointLabel(activeId, point)}`); option.value = index; option.selected = pointLabel(activeId, point) === pointLabel(activeId, state.selected); pointChoice.append(option); });
    pointChoice.addEventListener("change", () => { const index = Number(pointChoice.value); choose(points[index]); get(`academy-point-${activeId}`)?.focus({preventScroll: true}); });
    holder.append(pointChoiceLabel, pointChoice, make("span", "已选模拟点", "academy-kicker"), make("p", pointLabel(activeId, state.selected)));
    holder.append(button("解释这个点 ↗", () => { const point = {...state.selected}, label = pointLabel(activeId, point); ask(`这是教学仿真的点（不是我的实测数据）：${label}。适用条件：${supported[activeId].condition}。请解释它在图中的含义、单位与模型条件。`, {kind: "simulation_point", label, values: {...point, condition: supported[activeId].condition}}); }, "academy-text-button"));
  }
  // All diagrams use the same SI-derived readings as the plots; no readings are written to the experiment form.
  function schematic(label, height = 205) {
    const drawing = newSvg(label, height); drawing.classList.add("academy-schematic"); return drawing;
  }
  function springDrawing(drawing, endX, blockWidth = 45, note = "") {
    drawing.append(svgEl("line", {x1: 45, x2: 45, y1: 35, y2: 145, class: "academy-support"}));
    const start = 55, tail = endX - 15, steps = 20;
    const d = [`M45,90L${start},90`];
    for (let i = 0; i <= steps; i++) d.push(`L${start + (tail - start) * i / steps},${i === 0 || i === steps ? 90 : i % 2 ? 76 : 104}`);
    d.push(`L${endX},90`); drawing.append(svgEl("path", {d: d.join(" "), class: "academy-model-line"}), svgEl("rect", {x: endX, y: 64, width: blockWidth, height: 52, rx: 3, class: "academy-mass"}), svgEl("line", {x1: endX + blockWidth, x2: endX + blockWidth + 55, y1: 90, y2: 90, class: "academy-ray"}), svgEl("path", {d: `M${endX + blockWidth + 48},84l7,6l-7,6`, class: "academy-ray"}));
    drawing.append(svgEl("text", {x: 55, y: 175, class: "academy-axis-label"}, note));
  }
  function extendedVisual(state, current, graphic, readings, choose) {
    const p = state.params; let points, chart;
    // The currently adjusted value is always a selectable point, even between the fixed reference samples.
    function drawPlot(config, samples, key, curve) {
      points = samples;
      if (!points.some(point => Math.abs(point[key] - current[key]) < 1e-8)) points.push(current);
      points.sort((a, b) => a[key] - b[key]);
      const x = config.x, y = config.y;
      chart = plot({...config, line: (curve || points).map(point => ({x: x(point), y: y(point)})), points: points.map(point => ({x: x(point), y: y(point), label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point[key] - state.selected[key]) < 1e-8), onSelect: index => choose(points[index], true)});
    }
    if (activeId === "hookes_law") {
      reading(readings, "伸长 x（相对原长）", `${number(current.extension_cm)} cm`); reading(readings, "劲度系数 k", `${number(current.stiffness_N_m)} N/m`);
      const drawing = schematic(`弹簧伸长示意，外加拉力 ${number(current.force_N)} N，伸长 ${number(current.extension_cm)} cm。`);
      springDrawing(drawing, 165 + current.extension_cm * 12, 45, `F = ${number(p.force)} N · 伸长 x = ${number(current.extension_cm)} cm`);
      drawing.append(svgEl("line", {x1: 165, x2: 165, y1: 35, y2: 145, class: "academy-rest-line"}), svgEl("text", {x: 125, y: 28, class: "academy-tick"}, "零载荷位置")); graphic.append(drawing);
      drawPlot({label: "弹性限度内拉力与伸长的关系", xLabel: "伸长 x / cm", yLabel: "拉力 F / N", maxX: 20, maxY: 4.5, x: point => point.extension_cm, y: point => point.force_N}, [0, 1, 2, 3, 4].map(force => models.hooke(p.stiffness, force)), "force_N");
    } else if (activeId === "spring_oscillation") {
      reading(readings, "振动周期 T", `${number(current.period_s)} s`); reading(readings, "周期平方 T²", `${number(current.period_squared_s2)} s²`);
      const drawing = schematic(`弹簧振子示意，质量 ${number(p.mass)} kg，劲度系数 ${number(p.stiffness)} N/m。`);
      springDrawing(drawing, 280, 35 + p.mass * 90, `m = ${number(p.mass)} kg · k = ${number(p.stiffness)} N/m`);
      drawing.append(svgEl("line", {x1: 250, x2: 410, y1: 137, y2: 137, class: "academy-rest-line"}), svgEl("text", {x: 325, y: 125, class: "academy-tick"}, "往返振动")); graphic.append(drawing);
      drawPlot({label: "理想弹簧振子的周期平方与质量关系", xLabel: "质量 m / kg", yLabel: "周期平方 T² / s²", maxX: .5, maxY: 2.1, x: point => point.mass_kg, y: point => point.period_squared_s2}, [.05, .1, .2, .3, .4, .5].map(mass => models.spring(mass, p.stiffness)), "mass_kg");
    } else if (activeId === "thin_lens") {
      reading(readings, "实像像距 v", `${number(current.image_cm)} cm`); reading(readings, "放大率 M（负号表示倒立）", number(current.magnification));
      const drawing = schematic(`薄凸透镜近轴实像光路，物距 ${number(p.distance)} cm，像距 ${number(current.image_cm)} cm，焦距 ${number(p.focal)} cm。`, 265);
      const origin = 300, axis = 125, scale = 230 / Math.max(current.object_cm, current.image_cm, 2 * p.focal), objectX = origin - p.distance * scale, imageX = origin + current.image_cm * scale, height = Math.min(32, 55 / Math.abs(current.magnification)), objectY = axis - height, imageY = axis - height * current.magnification;
      drawing.append(svgEl("line", {x1: 25, x2: 575, y1: axis, y2: axis, class: "academy-rest-line"}), svgEl("path", {d: "M300,25Q275,125 300,225Q325,125 300,25", class: "academy-lens"}));
      for (const direction of [-1, 1]) drawing.append(svgEl("circle", {cx: origin + direction * p.focal * scale, cy: axis, r: 3, class: "academy-bob"}), svgEl("text", {x: origin + direction * p.focal * scale, y: axis + 22, "text-anchor": "middle", class: "academy-tick"}, "F"));
      drawing.append(svgEl("path", {d: `M${objectX},${objectY}L${origin},${objectY}L${imageX},${imageY}`, class: "academy-ray"}), svgEl("path", {d: `M${objectX},${objectY}L${imageX},${imageY}`, class: "academy-model-line"}), svgEl("path", {d: `M${objectX},${axis}V${objectY}m-5,7l5,-7l5,7`, class: "academy-object"}), svgEl("path", {d: `M${imageX},${axis}V${imageY}m-5,-7l5,7l5,-7`, class: "academy-image"}), svgEl("text", {x: objectX, y: 235, "text-anchor": "middle", class: "academy-axis-label"}, `物 · ${number(p.distance)} cm`), svgEl("text", {x: imageX, y: 255, "text-anchor": "middle", class: "academy-axis-label"}, `像 · ${number(current.image_cm)} cm`)); graphic.append(drawing);
      const curve = Array.from({length: 76}, (_, i) => models.lens(p.focal, 25 + i));
      drawPlot({label: "固定焦距下实像像距与物距关系", xLabel: "物距 u / cm", yLabel: "像距 v / cm", maxX: 100, maxY: Math.max(20, Math.ceil(models.lens(p.focal, 25).image_cm / 10) * 10), x: point => point.object_cm, y: point => point.image_cm}, [25, 40, 60, 80, 100].map(distance => models.lens(p.focal, distance)), "object_cm", curve);
    } else if (activeId === "snell_refraction") {
      reading(readings, "折射角 θ₂", `${number(current.refraction_deg)}°`); reading(readings, "sin θ₁ / sin θ₂", p.angle === 0 ? "0 / 0 · 未定义" : number(p.index));
      const drawing = schematic(`空气进入折射率为 ${number(p.index)} 的介质，入射角 ${number(p.angle)}°，折射角 ${number(current.refraction_deg)}°。`, 240), boundary = 112, radius = 85, incidence = p.angle * Math.PI / 180, refracted = current.refraction_deg * Math.PI / 180;
      drawing.append(svgEl("rect", {x: 25, y: boundary, width: 550, height: 112, class: "academy-medium"}), svgEl("line", {x1: 25, x2: 575, y1: boundary, y2: boundary, class: "academy-axis"}), svgEl("line", {x1: 300, x2: 300, y1: 15, y2: 222, class: "academy-rest-line"}), svgEl("path", {d: `M${300 - radius * Math.sin(incidence)},${boundary - radius * Math.cos(incidence)}L300,${boundary}L${300 + radius * Math.sin(refracted)},${boundary + radius * Math.cos(refracted)}`, class: "academy-ray"}), svgEl("text", {x: 42, y: 38, class: "academy-axis-label"}, "空气 n₁ = 1"), svgEl("text", {x: 42, y: 205, class: "academy-axis-label"}, `介质 n₂ = ${number(p.index)}`), svgEl("text", {x: 315, y: 25, class: "academy-tick"}, "法线"), svgEl("text", {x: 420, y: 75, class: "academy-axis-label"}, `θ₁ = ${number(p.angle)}°`), svgEl("text", {x: 420, y: 158, class: "academy-axis-label"}, `θ₂ = ${number(current.refraction_deg)}°`)); graphic.append(drawing);
      drawPlot({label: "空气折射至均匀介质的角度正弦关系", xLabel: "sin θ₁（无量纲）", yLabel: "sin θ₂（无量纲）", maxX: 1, maxY: 1, x: point => point.sine_incidence, y: point => point.sine_refraction}, [0, 15, 30, 45, 60, 75].map(angle => models.refraction(p.index, angle)), "incidence_deg");
    } else if (activeId === "double_slit") {
      reading(readings, "相邻亮纹间距 Δx", `${number(current.fringe_spacing_mm)} mm`); reading(readings, "波长 λ", `${number(p.wavelength)} nm`);
      const drawing = schematic(`双缝干涉屏幕中央正负 15 毫米，亮纹间距 ${number(current.fringe_spacing_mm)} 毫米。`, 190);
      drawing.append(svgEl("rect", {x: 40, y: 35, width: 520, height: 90, fill: "#081622"}));
      for (let i = 0; i < 520; i++) {
        const positionMm = (i / 519 - .5) * 30, intensity = models.fringeIntensity(positionMm, current.fringe_spacing_mm);
        drawing.append(svgEl("rect", {x: 40 + i, y: 35, width: 1.1, height: 90, fill: "#f2d298", opacity: intensity}));
      }
      for (const value of [-15, 0, 15]) { const x = 300 + value / 30 * 520; drawing.append(svgEl("text", {x, y: 148, "text-anchor": "middle", class: "academy-tick"}, `${value} mm`)); }
      drawing.append(svgEl("text", {x: 300, y: 179, "text-anchor": "middle", class: "academy-axis-label"}, "屏幕位置（中央亮纹为 0）")); graphic.append(drawing);
      drawPlot({label: "固定波长与缝距，亮纹间距与屏距关系", xLabel: "屏距 D / m", yLabel: "条纹间距 Δx / mm", maxX: 2, maxY: 7.5, x: point => point.distance_m, y: point => point.fringe_spacing_mm}, [.5, .75, 1, 1.25, 1.5, 2].map(distance => models.doubleSlit(p.wavelength, distance, p.spacing)), "distance_m");
    } else if (activeId === "calorimetry") {
      reading(readings, "最终平衡温度 T", `${number(current.equilibrium_C)} ℃`); reading(readings, "回算金属比热容", `${number(current.recovered_specific_J_kg_K)} J/(kg·K)`);
      const drawing = schematic(`理想量热能量平衡，金属放热和水吸热均为 ${number(current.absorbed_J)} J。`, 205), barWidth = current.absorbed_J / 20000 * 370;
      drawing.append(svgEl("text", {x: 30, y: 29, class: "academy-axis-label"}, `金属 ${number(p.metalTemp)} ℃ + 水 ${number(p.waterTemp)} ℃ → ${number(current.equilibrium_C)} ℃`));
      [["金属放热", 63, "academy-heat-release"], ["水吸热", 113, "academy-heat-absorb"]].forEach(([label, y, cls]) => { drawing.append(svgEl("text", {x: 30, y: y + 19, class: "academy-axis-label"}, label), svgEl("rect", {x: 130, y, width: barWidth, height: 26, class: cls}), svgEl("text", {x: 130 + barWidth + 8, y: y + 19, class: "academy-tick"}, `${number(current.absorbed_J)} J`)); });
      drawing.append(svgEl("text", {x: 30, y: 177, class: "academy-tick"}, "能量条共用 0–20,000 J 尺度；理想条件下 Q放 = Q吸。")); graphic.append(drawing);
      const curve = Array.from({length: 41}, (_, i) => models.calorimetry(50 + i * 5, p.waterMass, p.waterTemp, p.metalTemp, p.specific));
      drawPlot({label: "水质量和初温固定时平衡温度与金属质量关系", xLabel: "金属质量 m金 / g", yLabel: "平衡温度 T / ℃", maxX: 250, maxY: 100, x: point => point.metal_mass_g, y: point => point.equilibrium_C}, [50, 100, 150, 200, 250].map(mass => models.calorimetry(mass, p.waterMass, p.waterTemp, p.metalTemp, p.specific)), "metal_mass_g", curve);
    } else throw new RangeError("未配置的模型视图。");
    return {points, chart};
  }
  function positionPendulum(theta, length) { const line = get("academyPendulumString"), bob = get("academyPendulumBob"); if (!line || !bob) return; const pixels = 55 + length / 1.5 * 80, x = 300 + pixels * Math.sin(theta), y = 14 + pixels * Math.cos(theta); line.setAttribute("x2", x); line.setAttribute("y2", y); bob.setAttribute("cx", x); bob.setAttribute("cy", y); }
  function beginAnimation() {
    stopAnimation(); if (activeId !== "simple_pendulum" || !root || root.hidden || document.hidden || reducedMotion.matches) return;
    const state = record(activeId); if (!state.explored || state.pause || !get("academyPendulumBob") || (activePage !== "data" && !root.querySelector("details")?.open)) return;
    const started = performance.now();
    const animate = time => { const period = models.pendulum(state.params.length).period_s; positionPendulum(.139626 * Math.cos((time - started) / 1000 * 2 * Math.PI / period), state.params.length); frame = requestAnimationFrame(animate); };
    frame = requestAnimationFrame(animate);
  }
  window.refreshAcademy = function () {
    const page = document.body.dataset.page || "home", id = routeExperiment();
    const oldGuide = get("learningGuide-data"), guideWrapper = get("academyMeasurementGuide");
    if (guideWrapper && (page !== "data" || !supported[id])) { guideWrapper.before(oldGuide); guideWrapper.remove(); }
    if (!supportedPages.has(page) || !supported[id]) { stopAnimation(); if (root) root.hidden = true; activePage = page; activeId = ""; return; }
    const changed = activeId !== id || activePage !== page;
    activeId = id; activePage = page;
    if (!root) {
      root = make("section", null, "lab-academy"); root.id = "academyRoot"; root.setAttribute("aria-label", "实验交互课");
      // Lesson controls have their own persistence; keep them out of measured-data listeners.
      root.addEventListener("input", event => event.stopPropagation());
      root.addEventListener("change", event => event.stopPropagation());
    }
    root.hidden = false;
    const view = document.querySelector(`[data-view="${page}"]`); if (!view) return;
    const before = page === "data" ? view.querySelector(":scope > .card") : page === "topic" ? get("topicContent") : page === "experiment" ? view.querySelector(":scope > .card") : view.querySelector(":scope > .card, :scope > .page-actions");
    if (page === "data") {
      view.querySelector(".page-heading").after(root);
      let guide = get("academyMeasurementGuide");
      if (!guide && oldGuide) {
        guide = make("details", null, "academy-measurement-guide"); guide.id = "academyMeasurementGuide";
        guide.append(make("summary", "测量前的操作提示"), oldGuide);
      }
      if (guide) root.after(guide);
    } else if (root.parentElement !== view || (before && root.nextElementSibling !== before)) view.insertBefore(root, before);
    if (changed || !root.children.length) renderContent();
    const data = record(id), stale = Date.now() - data.lastLoadAttempt > 30000;
    const due = Object.values(data.results).some(item => item.can_answer === false && item.due_at && Date.parse(item.due_at) <= Date.now());
    loadCourse(id, !!data.course && stale && (changed || due));
    focusLesson();
  };
  function focusLesson() {
    const lesson = new URLSearchParams(location.search).get("lesson");
    if (activePage !== "data" || !["prediction", "transfer"].includes(lesson) || !record(activeId).course) return;
    const key = `${generation}:${activeId}:${location.pathname + location.search}`; if (focusedLesson === key) return;
    const state = record(activeId);
    if (lesson === "transfer" && !state.transferOpen) { state.explored = true; state.transferOpen = true; renderContent(); }
    const question = root.querySelector(`[data-node="${lesson}"] legend`);
    if (question) {
      focusedLesson = key;
      requestAnimationFrame(() => {
        if (activePage !== "data" || key !== `${generation}:${activeId}:${location.pathname + location.search}` || !question.isConnected) return;
        const explanation = root.querySelector(`[data-node="${lesson}"] .academy-explanation`);
        if (explanation && state.results[lesson]?.correct) explanation.open = true;
        question.tabIndex = -1; question.focus({preventScroll: true}); question.scrollIntoView({block: "center", behavior: reducedMotion.matches ? "auto" : "smooth"});
      });
    }
  }
  window.addEventListener("lab-account-changed", () => { generation++; records.clear(); if (activeId) { renderContent(); loadCourse(activeId); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAnimation(); else beginAnimation(); });
  window.addEventListener("pagehide", stopAnimation);
  window.addEventListener("tutor-ready", () => window.refreshAcademy());
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) { stopAnimation(); if (activeId === "simple_pendulum" && record(activeId).explored) updateVisual(); } else beginAnimation(); });
  // Flow navigation is normally wired by refreshAcademy; this also handles direct loads.
  observer = new MutationObserver(() => { if (document.body.dataset.page !== activePage) window.refreshAcademy(); });
  observer.observe(document.body, {attributes: true, attributeFilter: ["data-page"]});
  window.refreshAcademy();
})();
