"use strict";

const LEARNING_PLANS = {
  ohms_law: {
    goal: "用电压、电流判断电阻，并检查单位与图线。",
    data: ["每个电压是否有一个对应的电流？", "图线接近直线吗？偏离点是否有记录依据？"],
    checks: ["电压表并联、电流表串联", "读数未超量程，极性已核对", "重复读数与温升情况已记录"],
    formula: "R = U / I", unit: "Ω", example: "20 mA = 0.020 A；R = 5 / 0.020 = 250 Ω。",
    notes: ["ohms-slope", "ohms-wiring", "generic-unit-prefixes"],
  },
  rc_time_constant: {
    goal: "由 R、C 估计时间常数，再用充电曲线核对。",
    data: ["时间轴是否以充电开始为零点？", "初始值、终值及 63.2% 阈值分别是多少？"],
    checks: ["时间轴单位与充电起点已核对", "电阻、电容及接线已核对", "初始电压、终值与阈值已记录"],
    formula: "tau = R * C", unit: "s", example: "10 kΩ = 10000 Ω；1 μF = 0.000001 F；τ = 0.01 s。",
    notes: ["rc-threshold", "rc-observation", "generic-unit-prefixes"],
  },
  simple_pendulum: {
    goal: "先求单周期，再用摆长和周期估计重力加速度。",
    data: ["每次计时包含多少个完整往返？", "摆长量到了质心吗？重复计时是否接近？"],
    checks: ["摆长从悬点量至质心", "初始摆角满足课程的小角度要求", "完整周期数、计时起止位置已核对"],
    formula: "g = 4 * pi^2 * L / T^2", unit: "m/s²", example: "100 cm = 1 m；10 个周期共 20.06 s，则 T = 2.006 s。",
    notes: ["pendulum-timing", "pendulum-length-angle", "generic-type-a"],
  },
  generic: {
    goal: "整理原始读数，用实验条件和计算共同支持结论。",
    data: ["每项读数都保留了单位吗？", "是否记录重复次数与实验条件？"],
    checks: ["测量单位和仪器量程已核对", "重复测量与实验条件已记录", "计算公式的适用条件已核对"],
    formula: "", unit: "", example: "先统一单位，写出公式、代入过程和结果。",
    notes: ["generic-unit-prefixes", "generic-residuals", "generic-report"],
  },
};
const guideViews = ["experiment", "data", "review", "observations", "checks", "calculation", "diagnosis", "revision", "history"];
let studyDocuments = [];
let currentStudyExperiment = "";
let learningBuilt = false;
const fmtLearning = n => {
  if (!Number.isFinite(n)) return "—";
  const rounded = Number(n.toPrecision(6));
  return rounded !== 0 && (Math.abs(rounded) < .0001 || Math.abs(rounded) >= 1e7)
    ? rounded.toExponential(5).replace(/\.?0+e/, "e")
    : rounded.toLocaleString("zh-CN", { maximumSignificantDigits: 6 });
};
function learningLink(text, path) {
  const a = node("a", text); a.href = path; a.dataset.route = ""; return a;
}
function learningQuestion(text, field) {
  const li = node("li");
  if (field) {
    const button = node("button", text, "question-link"); button.type = "button";
    button.addEventListener("click", () => {
      let target = $(field);
      if (["observedFeatures", "anomalyConfidence"].includes(field) && !$("includeAnomaly").checked) target = $("includeAnomaly");
      if (["formula", "studentSteps"].includes(field) && !$("includeMath").checked) target = $("includeMath");
      if (field === "addCheckButton" && !$("includeConsistency").checked) target = $("includeConsistency");
      if (target) focusElement(target);
    });
    li.append(button);
  } else li.textContent = text;
  return li;
}
function rawLearningValues() {
  try { return readKeyValues("measurementRows", []); } catch (_) { return {}; }
}
function namedLearningVariables() {
  return Object.fromEntries([...$("variableRows").children].filter(r => fieldValue(r, "key").value.trim() && fieldValue(r, "value").value.trim()).map(r => [fieldValue(r, "key").value.trim(), Number(fieldValue(r, "value").value)]));
}
function learningProgress() {
  const raw = rawLearningValues();
  const checks = [...$("checkRows").children].filter(r => fieldValue(r, "name").value.trim());
  return [
    ["实验", !!$("studentId").value.trim()],
    ["数据", Object.values(raw).some(v => Array.isArray(v) ? v.length > 0 : v !== null && v !== "")],
    ["核查", $("includeAnomaly").checked && !!$("observedFeatures").value.trim() && $("includeConsistency").checked && checks.some(r => ["true", "false"].includes(fieldValue(r, "passed").value))],
    ["计算", $("includeMath").checked && !!$("studentResult").value.trim() && !!$("studentSteps").value.trim()],
    ["反馈", !!state.attempt],
  ];
}
function questionsFor(page, plan) {
  return {
    experiment: { instruction: plan.goal, questions: [["准备用哪个匿名编号保存记录？", "studentId"], ["要测量的物理量是什么？选对实验了吗？", "experimentId"]], next: ["选好实验后，进入数据页。", "/data"] },
    data: { instruction: "先保留原始读数，再看图。填写示例只用于体验，不代表真实测量。", questions: plan.data.map(t => [t]), next: ["写入数据后，核对观察与实验条件。", "/review"] },
    review: { instruction: "观察描述数据特征；核查说明实验条件；计算记录处理过程。填写齐全并不等于结论正确。", questions: [["你看到的变化或异常，能对应到哪组读数？", "observedFeatures"], ["哪些条件已经核实，哪些还不能确认？", "includeConsistency"]], next: ["先完成下方观察和核查，再进入计算。", "/calculation"] },
    observations: { instruction: "描述你实际看见的现象。还不能判断原因时，选择“尚不确定”。", questions: [[plan.data[1], "observedFeatures"], ["你有多确定？置信度只表示这次观察判断的把握。", "anomalyConfidence"]], next: ["填写观察后，返回证据摘要。", "/review"] },
    checks: { instruction: "核实一项，再给一项结论。“通过”需要读数、接线或操作记录支持。", questions: plan.checks.slice(0, 2).map(t => [`是否确认：${t}？`, "addCheckButton"]), next: ["尚未核实的项目保留“待确认”。", "/review"] },
    calculation: { instruction: "写你自己的结果和计算步骤；自动得到的参考值用于核对。", questions: [["变量是否已经换成公式要求的单位？", "formula"], ["每一步代入了什么数？结果为什么合理？", "studentSteps"]], next: ["完成下面计算后，点击“提交诊断”。", null] },
    diagnosis: { instruction: "先看需要补什么，再看问题依据与建议。图中的完整度表示证据齐全程度。", questions: [["提示指向了哪个读数或哪一步计算？"], ["你准备改哪一项？用什么办法确认修改有效？"]], next: state.attempt ? ["修改后留下记录，再更新计算进行复查。", "/revision"] : ["先到计算页提交本次记录。", "/calculation"] },
    revision: { instruction: "说明修改前后差别，并留下复查依据。", questions: [["这次具体改了哪个数字、单位或步骤？", "revision"], ["修改后的结果是多少？如何验证？", "finalResult"]], next: ["保存修改后，更新计算并再次诊断。", "/calculation"] },
    history: { instruction: "按自己的学生编号查找，对比每一轮的输入、诊断与修改。", questions: [["修改前后，哪条证据或计算发生了变化？"], ["下次实验还需要检查什么？"]], next: ["需要继续时，选择对应记录的“继续实验”。", null] },
  }[page];
}
function refreshLearningGuides() {
  const plan = LEARNING_PLANS[$("experimentId").value] || LEARNING_PLANS.generic;
  const progress = learningProgress();
  for (const page of guideViews) {
    const guide = $(`learningGuide-${page}`); if (!guide) continue;
    const info = questionsFor(page, plan);
    guide.querySelector(".guide-instruction").textContent = info.instruction;
    guide.querySelector("ol").replaceChildren(...info.questions.map(([t, f]) => learningQuestion(t, f)));
    const next = guide.querySelector(".guide-next");
    next.replaceChildren(info.next[1] ? learningLink(info.next[0], info.next[1]) : node("span", info.next[0]));
  }
  const holder = $("learningProgress");
  holder.replaceChildren(...progress.map(([title, filled], i) => {
    const item = node("span", null, filled ? "filled" : "");
    item.append(node("b", filled ? "✓" : String(i + 1)), node("span", `${title} · ${filled ? "已记录" : "待记录"}`));
    return item;
  }));
  $("rcInputPanel").hidden = $("experimentId").value !== "rc_time_constant";
  $("pendulumInputPanel").hidden = $("experimentId").value !== "simple_pendulum";
  $("extendedDataPanel").hidden = !["rc_time_constant", "simple_pendulum"].includes($("experimentId").value);
  $("formula").placeholder = plan.formula || "填写本实验公式";
  $("mathUnit").placeholder = plan.unit || "填写结果单位";
  $("calculationExample").textContent = `换算示例（非你的测量）：${plan.example}`;
  $("learningCheckSuggestions").replaceChildren(...plan.checks.map(t => node("li", t)));
  renderStudyNotes(plan);
  renderMeasurementSummary();
}
function learningField(parent, id, label, placeholder, { type = "text", value = "" } = {}) {
  const field = node("div", null, "field");
  const l = node("label", label); l.htmlFor = id;
  const input = node("input"); input.id = id; input.type = type; input.value = value; input.placeholder = placeholder;
  if (type === "number") input.step = "any";
  field.append(l, input); parent.append(field); return input;
}
function learningButton(parent, text, callback, className = "secondary") {
  const b = node("button", text, className); b.type = "button";
  b.addEventListener("click", () => { if (!state.busy) callback(); }); parent.append(b); return b;
}
function buildSpecialData() {
  const holder = node("section", null, "extended-data"); holder.id = "extendedDataPanel"; holder.hidden = true;
  const origin = node("input"); origin.type = "hidden"; origin.id = "specialInputOrigin"; holder.append(origin);
  const rc = node("div"); rc.id = "rcInputPanel";
  rc.append(node("h3", "RC 充电读数"), node("p", "适用于充电过程。以充电开始为 0 ms，按时间顺序填写电容两端电压；终值须高于初始电压。", "hint"));
  const rg = node("div", null, "grid-2");
  learningField(rg, "rcTimes", "时间（ms，逗号分隔）", "例如：0, 5, 10, 15, 20");
  learningField(rg, "rcVoltage", "电容电压（V，逗号分隔）", "例如：0, 1.967, 3.161, 3.884, 4.323");
  learningField(rg, "rcResistance", "电阻（kΩ）", "例如：10", { type: "number" });
  learningField(rg, "rcCapacitance", "电容（μF）", "例如：1", { type: "number" });
  learningField(rg, "rcFinalVoltage", "充电终值（V）", "例如：5", { type: "number" });
  rc.append(rg);
  const ra = node("div", null, "actions");
  learningButton(ra, "写入数据并绘图", () => applySpecialData("rc"));
  learningButton(ra, "填入示例读数", () => { for (const [id, value] of Object.entries({ rcTimes: "0, 5, 10, 15, 20", rcVoltage: "0, 1.967, 3.161, 3.884, 4.323", rcResistance: "10", rcCapacitance: "1", rcFinalVoltage: "5" })) $(id).value = value; $("specialInputOrigin").value = "synthetic-example"; showSpecialStatus("示例已填入。点击“写入数据并绘图”体验；这些是合成演示读数。"); saveDraft(); }, "plain");
  rc.append(ra);
  const pend = node("div"); pend.id = "pendulumInputPanel";
  pend.append(node("h3", "单摆重复计时"), node("p", "记录每次 N 个完整周期的总时间。摆长从悬点量到摆球质心；此处换算与作图不会替你核实摆角或释放方式。", "hint"));
  const pg = node("div", null, "grid-2");
  learningField(pg, "pendulumLength", "摆长（cm）", "例如：100", { type: "number" });
  learningField(pg, "pendulumCount", "每次计时的完整周期数", "例如：10", { type: "number" });
  learningField(pg, "pendulumTimes", "各次总时间（s，逗号分隔）", "例如：20.05, 20.06, 20.07");
  pend.append(pg);
  const pa = node("div", null, "actions");
  learningButton(pa, "写入数据并绘图", () => applySpecialData("pendulum"));
  learningButton(pa, "填入示例读数", () => { $("pendulumLength").value = 100; $("pendulumCount").value = 10; $("pendulumTimes").value = "20.05, 20.06, 20.07"; $("specialInputOrigin").value = "synthetic-example"; showSpecialStatus("示例已填入。点击“写入数据并绘图”体验；这些是合成演示读数。"); saveDraft(); }, "plain");
  pend.append(pa);
  const status = node("p", "填写后点击“写入数据并绘图”，原始读数与换算后的计算变量会保存到本次草稿。", "hint"); status.id = "specialDataStatus"; status.setAttribute("role", "status");
  const charts = node("div", null, "learning-charts"); charts.id = "specialDataCharts"; charts.hidden = true;
  holder.append(rc, pend, status, charts);
  document.querySelector('[data-view="data"] > .card').prepend(holder);
}
function showSpecialStatus(text) { $("specialDataStatus").textContent = text; $("specialDataCharts").hidden = true; }
function specialInputNumber(id) {
  if (!$(id).value.trim() || !Number.isFinite(Number($(id).value))) throw new Error("请填写所有参数，数值必须有效。");
  return Number($(id).value);
}
function specialValues(kind) {
  return kind === "rc"
    ? { times: LabLearning.numberList($("rcTimes").value), voltage: LabLearning.numberList($("rcVoltage").value), resistance: specialInputNumber("rcResistance") * 1000, capacitance: specialInputNumber("rcCapacitance") / 1e6, finalVoltage: specialInputNumber("rcFinalVoltage") }
    : { length: specialInputNumber("pendulumLength") / 100, count: specialInputNumber("pendulumCount"), times: LabLearning.numberList($("pendulumTimes").value) };
}
function writeLearningVariable(name, value) {
  const row = [...$("variableRows").children].find(r => fieldValue(r, "key").value === name);
  if (row) fieldValue(row, "value").value = value; else addVariable(name, value);
}
function applySpecialData(kind) {
  try {
    const input = specialValues(kind);
    const result = kind === "rc" ? LabLearning.rc(input) : LabLearning.pendulum(input);
    if (kind === "rc") {
      for (const [key, value] of Object.entries({ time_ms: input.times, capacitor_voltage_V: input.voltage, resistance_ohm: input.resistance, capacitance_F: input.capacitance, final_voltage_V: input.finalVoltage })) setKeyValue("measurementRows", key, value);
      writeLearningVariable("R", input.resistance); writeLearningVariable("C", input.capacitance);
    } else {
      for (const [key, value] of Object.entries({ length_m: input.length, periods_per_trial: input.count, total_time_s: input.times })) setKeyValue("measurementRows", key, value);
      writeLearningVariable("L", input.length); writeLearningVariable("T", result.meanPeriod);
    }
    const plan = LEARNING_PLANS[$("experimentId").value];
    $("includeMath").checked = true; $("formula").value = plan.formula; $("mathUnit").value = plan.unit; sourceVisibility();
    // Keep the student's own result and physical-condition checks untouched.
    const origin = $("specialInputOrigin").value || "manual-entry";
    setKeyValue("metadataRows", "source", origin);
    $("specialDataStatus").textContent = `${origin.includes("example") ? "演示数据（非真实测量）已写入。" : "读数已写入。"}单位已换算到计算变量。请继续描述观察、核实条件，并填写你自己的计算结果。`;
    drawSpecialData(kind, input, result); refreshLearningGuides(); saveDraft();
  } catch (error) { showSpecialStatus(error.message); }
}
function learningStat(label, value, explanation = "") {
  const s = node("div", null, "learning-stat"); s.append(node("span", label), node("strong", value)); if (explanation) s.append(node("small", explanation)); return s;
}
function drawSpecialData(kind, input, result) {
  const holder = $("specialDataCharts"); holder.replaceChildren(); holder.hidden = false;
  const metrics = node("div", null, "learning-stats");
  if (kind === "rc") {
    metrics.append(learningStat("由 R、C 计算", `${fmtLearning(result.tau * 1000)} ms`, "理想模型的 τ"), learningStat("63.2% 目标电压", `${fmtLearning(result.threshold)} V`, "相对于本次初始值与终值"), learningStat("曲线阈值时间", result.measuredTau == null ? "尚未覆盖阈值" : `${fmtLearning(result.measuredTau * 1000)} ms`, "相邻实测点线性插值"));
    holder.append(metrics, learningPlot("RC 充电曲线", result.points, [{ name: "R、C 对应的理想模型", points: result.model, dashed: true }], "时间 / ms", "电容电压 / V"));
    holder.append(node("p", "点为实测读数，虚线是参数对应的理想模型，并非对实测数据的拟合。阈值插值只是估计；曲线噪声和采样间隔仍需核查。", "hint"));
  } else {
    metrics.append(learningStat("单周期均值", `${fmtLearning(result.meanPeriod)} s`, "每次总时间先除以周期数"), learningStat("周期样本标准差", `${fmtLearning(result.sd)} s`, "描述各次测量的离散程度"), learningStat("按均值估计 g", `${fmtLearning(result.g)} m/s²`, "小角度、质点近似下的计算值"));
    holder.append(metrics, learningPlot("各次计时得到的单周期", result.points, [{ name: "周期均值", points: [{ x: 1, y: result.meanPeriod }, { x: result.points.length, y: result.meanPeriod }], dashed: true }], "测量次序", "周期 / s", { tightY: true }));
    holder.append(node("p", "图中纵轴按读数范围展开，便于看清重复测量差异。标准差不是全部测量不确定度；摆长、仪器和人工计时也需考虑。", "hint"));
  }
}
function hydrateSpecialInputs() {
  const raw = rawLearningValues(), vars = namedLearningVariables();
  const data = {
    rcTimes: Array.isArray(raw.time_ms) ? raw.time_ms.join(", ") : "", rcVoltage: Array.isArray(raw.capacitor_voltage_V) ? raw.capacitor_voltage_V.join(", ") : "",
    rcResistance: raw.resistance_ohm != null ? raw.resistance_ohm / 1000 : vars.R != null ? vars.R / 1000 : "",
    rcCapacitance: raw.capacitance_F != null ? raw.capacitance_F * 1e6 : vars.C != null ? vars.C * 1e6 : "",
    rcFinalVoltage: raw.final_voltage_V ?? "",
    pendulumLength: raw.length_m != null ? raw.length_m * 100 : "", pendulumCount: raw.periods_per_trial ?? "",
    pendulumTimes: Array.isArray(raw.total_time_s) ? raw.total_time_s.join(", ") : "",
  };
  for (const [id, value] of Object.entries(data)) $(id).value = value;
  $("specialInputOrigin").value = readKeyValues("metadataRows", []).source || "";
  $("specialDataCharts").hidden = true;
  $("specialDataStatus").textContent = "填写后点击“写入数据并绘图”。如有实验记录，已载入对应读数。";
}
function restoreSpecialChart() {
  const kind = $("experimentId").value === "rc_time_constant" ? "rc" : $("experimentId").value === "simple_pendulum" ? "pendulum" : null;
  if (!kind) return;
  const raw = rawLearningValues();
  if (kind === "rc" ? !raw.final_voltage_V : !raw.total_time_s) return;
  try {
    const input = specialValues(kind); const result = kind === "rc" ? LabLearning.rc(input) : LabLearning.pendulum(input);
    const committed = kind === "rc" ? JSON.stringify(raw.time_ms) === JSON.stringify(input.times) && JSON.stringify(raw.capacitor_voltage_V) === JSON.stringify(input.voltage) && raw.resistance_ohm === input.resistance && raw.capacitance_F === input.capacitance && raw.final_voltage_V === input.finalVoltage : JSON.stringify(raw.total_time_s) === JSON.stringify(input.times) && raw.length_m === input.length && raw.periods_per_trial === input.count;
    if (committed) {
      drawSpecialData(kind, input, result);
      $("specialDataStatus").textContent = `${$("specialInputOrigin").value.includes("example") ? "已恢复演示数据（非真实测量）、" : "已恢复读数、"}计算变量和图表。修改读数后，请再次写入并绘图。`;
    } else showSpecialStatus("输入框与已写入的记录不同。确认后点击“写入数据并绘图”更新原始记录。");
  } catch (_) { /* Incomplete or unapplied input stays editable. */ }
}
function learningPlot(title, points, series, xLabel, yLabel, options = {}) {
  const all = [...points, ...series.flatMap(s => s.points)].filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!all.length) return node("p", "还没有可绘制的读数。", "hint");
  const width = 600, height = 310, left = 64, top = 35, right = 25, bottom = 55;
  let minX = Math.min(...all.map(p => p.x)), maxX = Math.max(...all.map(p => p.x));
  let minY = Math.min(...all.map(p => p.y)), maxY = Math.max(...all.map(p => p.y));
  if (options.tightY) {
    const scale = Math.max(Math.abs(minY), Math.abs(maxY));
    const margin = scale === 0 ? .0001 : Math.max((maxY - minY) * .35, scale * .001, Number.MIN_VALUE);
    minY -= margin; maxY += margin;
  }
  else { minY = Math.min(0, minY); maxY = Math.max(0, maxY); }
  if (minX === maxX) { minX -= .5; maxX += .5; }
  if (minY === maxY) { minY -= .5; maxY += .5; }
  const sx = x => left + (x - minX) / (maxX - minX) * (width - left - right);
  const sy = y => height - bottom - (y - minY) / (maxY - minY) * (height - top - bottom);
  const ns = "http://www.w3.org/2000/svg";
  const make = (tag, attrs, text) => { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); if (text != null) el.textContent = text; return el; };
  const figure = node("figure", null, "learning-plot"); figure.append(node("figcaption", title));
  const svg = make("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${title}；横轴 ${xLabel}；纵轴 ${yLabel}。${points.length} 个读数。` });
  svg.append(make("title", {}, title));
  for (let i = 0; i <= 4; i++) {
    const x = minX + (maxX - minX) * i / 4, y = minY + (maxY - minY) * i / 4;
    svg.append(make("line", { x1: left, y1: sy(y), x2: width - right, y2: sy(y), class: "learning-grid" }), make("text", { x: left - 10, y: sy(y) + 4, "text-anchor": "end", class: "learning-tick" }, Number(y.toPrecision(4))), make("text", { x: sx(x), y: height - bottom + 20, "text-anchor": "middle", class: "learning-tick" }, Number(x.toPrecision(4))));
  }
  svg.append(make("path", { d: `M${left} ${top}V${height - bottom}H${width - right}`, class: "chart-axis" }));
  if (minY < 0 && maxY > 0) svg.append(make("line", { x1: left, y1: sy(0), x2: width - right, y2: sy(0), class: "learning-zero" }));
  if (options.connectPoints) svg.append(make('polyline',{points:points.map(p=>`${sx(p.x)},${sy(p.y)}`).join(' '),class:'chart-fit',opacity:'.65'}));
  for (const s of series) svg.append(make("polyline", { points: [...s.points].sort((a, b) => a.x - b.x).map(p => `${sx(p.x)},${sy(p.y)}`).join(" "), class: "chart-fit", ...(s.dashed ? { "stroke-dasharray": "5 5" } : {}) }));
  for (const p of points) { const dot = make("circle", { cx: sx(p.x), cy: sy(p.y), r: 4, class: "chart-point" }); dot.append(make("title", {}, `${xLabel}: ${fmtLearning(p.x)}；${yLabel}: ${fmtLearning(p.y)}`)); svg.append(dot); }
  svg.append(make("text", { x: left, y: 18, class: "learning-axis-label" }, yLabel), make("text", { x: width - right, y: height - 5, "text-anchor": "end", class: "learning-axis-label" }, xLabel));
  figure.append(svg, node("p", `● ${options.pointLabel || "测量读数"}${series.length ? "　— " + series.map(s => s.name).join("；") : ""}`, "plot-legend"));
  return figure;
}
window.learningPlot = learningPlot;
window.renderLearningDiagnosis = function(data, payload) {
  const assessment = data.evidence_assessment;
  const holder = node("section", null, "diagnosis-visual"); holder.setAttribute("aria-label", "证据与计算概览");
  const header = node("div", null, "visual-heading");
  header.append(node("h4", "先看本轮记录"), node("span", `证据完整度 ${percent(assessment.completeness_score)}`));
  const meter = node("div", null, "evidence-meter"); meter.setAttribute("role", "meter"); meter.setAttribute("aria-label", "证据完整度"); meter.setAttribute("aria-valuemin", "0"); meter.setAttribute("aria-valuemax", "100"); meter.setAttribute("aria-valuenow", Math.round(assessment.completeness_score * 100));
  const fill = node("span"); fill.style.width = `${Math.max(0, Math.min(100, assessment.completeness_score * 100))}%`; meter.append(fill);
  const sources = node("div", null, "diagnosis-sources");
  for (const [source, title, path] of [["anomaly_model", "观察描述", "/observations"], ["consistency_checks", "条件核查", "/checks"], ["mathematical_judgement", "计算过程", "/calculation"]]) {
    const ready = assessment.ready_sources.includes(source);
    const item = learningLink(`${ready ? "✓" : "○"} ${title} · ${ready ? "可用于判断" : "需要补充"}`, path); item.className = ready ? "ready" : "pending"; sources.append(item);
  }
  holder.append(header, meter, sources, node("p", "完整度表示证据是否齐全，不表示诊断准确率。点击上方项目可返回对应步骤。", "hint"));
  const math = payload?.mathematics, reference = assessment.computed_math_result ?? math?.reference_result;
  const recomputed = assessment.computed_math_result != null;
  if (math?.student_result != null && reference != null && Number.isFinite(math.student_result) && Number.isFinite(reference)) {
    const comparison = node("div", null, "math-comparison"); comparison.append(node("h4", recomputed ? "自己的结果与独立复算" : "自己的结果与本轮参考"));
    const max = Math.max(Math.abs(math.student_result), Math.abs(reference), Number.MIN_VALUE);
    for (const [label, value, color] of [["你的结果", math.student_result, "student-bar"], [recomputed ? "独立复算" : "本轮参考", reference, "reference-bar"]]) {
      const row = node("div", null, "comparison-row"); row.append(node("span", label), node("strong", `${fmtLearning(value)} ${math.unit || ""}`));
      const track = node("div", null, "comparison-track"), bar = node("span", null, color); bar.style.width = `${Math.abs(value) / max * 100}%`; track.append(bar); row.append(track); comparison.append(row);
    }
    comparison.append(node("p", `条长表示绝对值，数字保留正负号。${assessment.math_relative_error_percent == null ? "参考值为零时，相对误差不可定义。" : `本轮相对差异 ${fmtLearning(assessment.math_relative_error_percent)}%；填写的允许值 ${fmtLearning(math.tolerance_percent)}%。`} ${recomputed ? "独立复算使用本轮提交的变量。" : "参考值取自本轮提交的记录。"}仍需核对原始读数、单位与模型条件。`, "hint"));
    holder.append(comparison);
  }
  if (data.diagnosis) {
    const reasoning = node("div", null, "reasoning-map");
    for (const [title, description] of [["发现", data.diagnosis.summary], ["依据", data.diagnosis.evidence_basis[0] || "请结合下方规则检查核对。"], ["下一步", data.intervention?.content || data.diagnosis.teaching_plan.socratic_question]]) {
      const item = node("div"); item.append(node("small", title), node("p", description)); reasoning.append(item);
    }
    holder.append(reasoning);
  } else if (data.follow_up) holder.append(node("p", "本轮证据尚不足以完成判断。先回答下方补充问题，再提交一次。", "calculation-example"));
  return holder;
};
window.renderLearningHistory = function(history) {
  const holder = node("section", null, "history-learning");
  const points = history.attempts.filter(a => Number.isFinite(a.response.evidence_assessment.math_relative_error_percent)).map(a => ({ x: a.attempt_number, y: a.response.evidence_assessment.math_relative_error_percent }));
  if (points.length >= 2) {
    holder.append(learningPlot("各轮计算与参考结果的相对差异", points, [{ name: "已记录轮次", points }], "诊断轮次", "相对差异 / %", {pointLabel:"本轮计算差异"}), node("p", "只展示能复算相对差异的轮次。差异变小不代表全部实验问题已解决，仍需对比每轮证据与修改原因。", "hint"));
  }
  return holder;
};
function renderMeasurementSummary() {
  const raw = rawLearningValues(), holder = $("measurementSummary");
  holder.replaceChildren();
  const v = raw.voltage_V, c = raw.current_mA;
  if ($("experimentId").value !== "ohms_law" || !Array.isArray(v) || !Array.isArray(c) || v.length !== c.length || !v.length) { holder.hidden = true; return; }
  const vv = v.filter(Number.isFinite), cc = c.filter(Number.isFinite);
  if (!vv.length || !cc.length) { holder.hidden = true; return; }
  holder.hidden = false;
  holder.append(learningStat("记录组数", `${v.length} 组`, "每组电压与电流一一对应"), learningStat("电压范围", `${fmtLearning(Math.min(...vv))}–${fmtLearning(Math.max(...vv))} V`), learningStat("电流范围", `${fmtLearning(Math.min(...cc))}–${fmtLearning(Math.max(...cc))} mA`));
}
function buildUnitTool() {
  const box = node("details", null, "unit-tool"); box.append(node("summary", "需要换算单位？打开换算尺"));
  const g = node("div", null, "grid-2 spaced");
  learningField(g, "conversionValue", "待换算数值", "例如：20", { type: "number" });
  const f = node("div", null, "field"), l = node("label", "原始单位"), select = node("select"); select.id = "conversionUnit"; l.htmlFor = select.id;
  for (const unit of ["mA", "kΩ", "μF", "nF", "ms", "cm"]) { const o = node("option", unit); o.value = unit; select.append(o); }
  f.append(l, select); g.append(f); box.append(g);
  const output = node("output", "输入数值后显示换算结果。", "conversion-output"); output.id = "conversionOutput"; output.htmlFor = "conversionValue conversionUnit"; output.setAttribute("aria-live", "polite"); box.append(output, node("p", "这是换算工具，不会覆盖实验读数。将换算后的数值与单位写进计算变量。", "hint"));
  document.querySelector('[data-view="calculation"] > .card').prepend(box);
  const update = () => { const value = $("conversionValue").value.trim(), result = value ? LabLearning.convert(Number(value), select.value) : null; output.textContent = result ? `${fmtLearning(Number(value))} ${select.value}  →  ${fmtLearning(result.value)} ${result.unit}` : "输入有效数值后显示换算结果。"; };
  g.addEventListener("input", update); g.addEventListener("change", update); window.refreshConversion = update;
}
function renderStudyNotes(plan) {
  if (!studyDocuments.length || currentStudyExperiment === $("experimentId").value) return;
  currentStudyExperiment = $("experimentId").value;
  for (const holder of document.querySelectorAll(".guide-study-notes")) {
    holder.replaceChildren();
    for (const id of plan.notes.slice(0, 2)) {
      const doc = studyDocuments.find(d => d.document_id === id); if (!doc) continue;
      const article = node("article"); article.append(node("strong", doc.title), node("p", doc.principles[0]), node("small", `想一想：${doc.check_questions[0]}`));
      const a = learningLink("阅读完整条目 →", "/library");
      a.addEventListener("click", () => { $("knowledgeQuery").value = doc.title; $("knowledgeExperiment").value = doc.experiment_id; action("正在查找知识…", browseKnowledge); });
      article.append(a); holder.append(article);
    }
  }
}
function buildLearningViews() {
  for (const page of guideViews) {
    const view = document.querySelector(`[data-view="${page}"]`), heading = view.querySelector(".page-heading");
    const guide = node("aside", null, "step-guide"); guide.id = `learningGuide-${page}`; guide.setAttribute("aria-label", "本步问题与指引");
    const task = node("div", null, "guide-task"); task.append(node("p", "这一步要做什么", "eyebrow"), node("p", "", "guide-instruction"), node("p", "", "guide-next"));
    const questions = node("div", null, "guide-questions"); questions.append(node("strong", "带着两个问题往下做"), node("ol"));
    guide.append(task, questions); heading.after(guide);
  }
  const progress = node("div", null, "learning-progress"); progress.id = "learningProgress"; progress.setAttribute("aria-label", "本次记录进度");
  document.querySelector(".flow-frame").append(progress);
  buildSpecialData(); buildUnitTool();
  const summary = node("div", null, "learning-stats"); summary.id = "measurementSummary"; summary.hidden = true;
  document.querySelector('.advanced-data').before(summary, $("materialCharts"));
  const example = node("p", "", "calculation-example"); example.id = "calculationExample";
  document.querySelector('[data-view="calculation"] .evidence-group').before(example);
  for (const [id, text] of Object.entries({ studentResult: "填写你自己算出的结果；自动分析的数值留在“参考结果”中。", studentSteps: "建议每行一步：单位换算 → 代入公式 → 运算结果 → 合理性检查。", observedFeatures: "写具体读数、图线形状或变化；暂时不确定原因，也可以如实记录。", anomalyConfidence: "0 表示没有把握，1 表示非常确定；这里不是系统诊断的准确率。" })) {
    const h = node("p", text, "hint"); h.id = `${id}-learningHint`; $(id).after(h); $(id).setAttribute("aria-describedby", [$(id).getAttribute("aria-describedby"), h.id].filter(Boolean).join(" "));
  }
  const checks = node("div", null, "check-suggestions"); checks.append(node("h4", "建议核对的条件"));
  const cl = node("ul"); cl.id = "learningCheckSuggestions"; checks.append(cl, node("p", "只填写你实际检查过的结论；尚未核实可保留待确认。", "hint"));
  learningButton(checks, "添加这些核查项（待确认）", () => {
    $("includeConsistency").checked = true;
    const plan = LEARNING_PLANS[$("experimentId").value] || LEARNING_PLANS.generic;
    for (const name of plan.checks) if (![...$("checkRows").children].some(r => fieldValue(r, "name").value === name)) addCheck({ name, passed: null });
    sourceVisibility(); refreshLearningGuides(); saveDraft();
  });
  $("consistencyFields").before(checks);
  for (const page of ["data", "review", "calculation"]) {
    const notes = node("details", null, "guide-study"); notes.append(node("summary", "遇到疑问？翻看本实验的知识提示"), node("div", null, "guide-study-notes"));
    document.querySelector(`[data-view="${page}"] .page-actions`).before(notes);
  }
  const chips = node("div", null, "knowledge-chips"); chips.setAttribute("aria-label", "常用知识主题");
  for (const text of ["单位换算", "接线", "斜率", "63.2%", "周期", "不确定度", "残差"]) learningButton(chips, text, () => { $("knowledgeQuery").value = text; $("knowledgeExperiment").value = ""; action("正在查找知识…", browseKnowledge); }, "plain");
  $("knowledgeForm").after(chips);
  learningBuilt = true;
  hydrateSpecialInputs(); refreshLearningGuides();
  request("/api/v1/knowledge/documents").then(docs => { studyDocuments = docs; document.querySelector('[data-view="library"] .page-description').textContent = `${docs.length} 条实验与数据处理知识，附自查问题和可查阅的教材、计量指南来源。`; currentStudyExperiment = ""; refreshLearningGuides(); }).catch(() => {});
}
window.refreshLearning = function({ hydrate = false } = {}) {
  if (!learningBuilt) return;
  if (hydrate) hydrateSpecialInputs();
  refreshLearningGuides();
};
document.addEventListener("input", event => {
  if (!learningBuilt) return;
  if (event.target.closest(".extended-data")) {
    if ($("specialInputOrigin").value.includes("example")) $("specialInputOrigin").value = "edited-example";
    showSpecialStatus("读数已修改，请点击“写入数据并绘图”更新原始记录。旧图已收起。");
  }
  refreshLearningGuides();
});
document.addEventListener("change", () => { if (learningBuilt) refreshLearningGuides(); });
window.addEventListener("tutor-ready", () => { refreshLearningGuides(); restoreSpecialChart(); refreshConversion(); });
buildLearningViews();
