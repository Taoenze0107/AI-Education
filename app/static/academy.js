"use strict";
(() => {
  // These functions describe ideal teaching models. They never modify measured data.
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
    rc_time_constant: {title: "RC：为什么是 63.2%？", subtitle: "改变电阻和电容，追踪充电与放电的同一时刻。", goal: "把时间常数与曲线上的电压比例对应起来。", formula: "τ = RC", tex: "\\tau = RC", condition: "理想一阶 RC 电路；电源 5 V；充电从 0 V 开始，放电从 5 V 开始。", initial: {resistance: 10, capacitance: 1, time: 1, discharge: false}, symbols: [["τ", "时间常数 τ = RC：R 用 Ω、C 用 F 时，τ 的单位是 s。此处 R 用 kΩ、C 用 μF，因此读数为 ms。"], ["R", "电阻 R：增大电阻，会按相同比例增大充电与放电的时间常数。"], ["C", "电容 C：增大电容，会按相同比例增大时间常数。"], ["Vc", "电容电压 Vc：充电时为 5(1−e^(−t/τ)) V，放电时为 5e^(−t/τ) V。"]]}
  };
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
    } else {
      range(parent, "resistance", "电阻 R", 1, 50, 1, p.resistance, n => `${number(n)} kΩ`, n => p.resistance = n);
      range(parent, "capacitance", "电容 C", .5, 10, .5, p.capacitance, n => `${number(n)} μF`, n => p.capacitance = n);
      range(parent, "time", "观察时刻 t", 0, 5, .1, p.time, n => `${number(n)} τ`, n => p.time = n);
      const modes = make("div", null, "academy-modes"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "RC 模式");
      [false, true].forEach(discharge => { const b = button(discharge ? "放电" : "充电", () => { p.discharge = discharge; [...modes.children].forEach(el => el.setAttribute("aria-pressed", String(el === b))); updateVisual(); }, "academy-mode"); b.setAttribute("aria-pressed", String(discharge === p.discharge)); modes.append(b); }); parent.append(modes);
    }
  }
  function buildFormula(parent, state, config) {
    const panel = make("div", null, "academy-formula"), formula = button("", () => ask(`请解释教学仿真中的公式 ${config.formula}，并说明适用条件。`, {kind: "formula", label: config.formula}), "academy-formula-button");
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
    return models.rc(p.resistance, p.capacitance, p.time * p.resistance * p.capacitance, p.discharge);
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
    } else {
      reading(readings, "时间常数 τ", `${number(current.tau_ms)} ms`); reading(readings, `t = ${number(p.time)} τ 时的 Vc`, `${number(current.voltage_V)} V`);
      const threshold = models.rc(p.resistance, p.capacitance, current.tau_ms, p.discharge);
      curve = Array.from({length: 101}, (_, i) => models.rc(p.resistance, p.capacitance, current.tau_ms * i / 20, p.discharge));
      points = [0, .5, 1, 2, 3, 4, 5].map(time => models.rc(p.resistance, p.capacitance, time * current.tau_ms, p.discharge)); if (!points.some(point => Math.abs(point.time_ms - current.time_ms) < 1e-8)) points.push(current); points.sort((a, b) => a.time_ms - b.time_ms);
      chart = plot({label: `RC ${p.discharge ? "放电" : "充电"}教学曲线，标出一个时间常数的电压比例`, xLabel: "时间 t / ms", yLabel: "电容电压 Vc / V", maxX: 5 * current.tau_ms, maxY: 5.5, threshold: {x: threshold.time_ms, y: threshold.voltage_V, label: `τ · ${p.discharge ? "36.8%" : "63.2%"}`}, line: curve.map(point => ({x: point.time_ms, y: point.voltage_V})), points: points.map(point => ({x: point.time_ms, y: point.voltage_V, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.time_ms - state.selected.time_ms) < 1e-8), onSelect: index => choose(points[index], true)});
    }
    graphic.append(chart); holder.replaceChildren();
    const pointChoice = make("select"), pointChoiceLabel = make("label", "选择模拟点"); pointChoice.id = `academy-point-${activeId}`; pointChoiceLabel.htmlFor = pointChoice.id;
    points.forEach((point, index) => { const option = make("option", `${index + 1}. ${pointLabel(activeId, point)}`); option.value = index; option.selected = pointLabel(activeId, point) === pointLabel(activeId, state.selected); pointChoice.append(option); });
    pointChoice.addEventListener("change", () => { const index = Number(pointChoice.value); choose(points[index]); get(`academy-point-${activeId}`)?.focus({preventScroll: true}); });
    holder.append(pointChoiceLabel, pointChoice, make("span", "已选模拟点", "academy-kicker"), make("p", pointLabel(activeId, state.selected)));
    holder.append(button("解释这个点 ↗", () => { const point = {...state.selected}, label = pointLabel(activeId, point); ask(`这是教学仿真的点（不是我的实测数据）：${label}。请解释它在图中的含义、单位与模型条件。`, {kind: "simulation_point", label, values: point}); }, "academy-text-button"));
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
