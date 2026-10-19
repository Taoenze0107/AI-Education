"use strict";

const $ = (id) => document.getElementById(id);
const EXPERIMENTS = {
  ohms_law: "伏安法测电阻",
  rc_time_constant: "RC 时间常数",
  simple_pendulum: "单摆测重力加速度",
  hookes_law: "胡克定律与弹簧劲度",
  spring_oscillation: "弹簧振子测劲度",
  free_fall: "自由落体测重力加速度",
  inclined_friction: "斜面临界角与静摩擦",
  thin_lens: "凸透镜焦距",
  snell_refraction: "折射定律与折射率",
  double_slit: "双缝干涉测波长",
  calorimetry: "量热法测比热容",
  sound_resonance: "共鸣管测声速",
  generic: "通用规范",
};
const ISSUES = {
  data_error: "数据错误",
  calculation_error: "计算错误",
  concept_misunderstanding: "概念理解偏差",
  mixed: "混合问题",
  no_error: "未发现错误",
  insufficient_evidence: "证据不足",
};
const STATUSES = {
  needs_more_evidence: "需要补充证据",
  teaching_intervention: "进行教学引导",
  completed: "诊断完成",
};
const OUTCOMES = {
  corrected: "已纠正",
  partially_corrected: "部分纠正",
  unchanged: "未变化",
  abandoned: "结束尝试",
};
const SOURCES = {
  anomaly_model: "异常观察",
  consistency_checks: "一致性核查",
  mathematical_judgement: "数学计算",
  anomaly: "异常观察",
  consistency: "一致性检查",
  mathematics: "数学计算",
};
const ENGINES = {
  openai: "大模型诊断",
  rules_fallback: "规则回退诊断",
  rules_only: "规则诊断",
};
const STORAGE_KEY = "at-lab-tutor-session-v2";
const state = {
  busy: false,
  epoch: 0,
  session: null,
  attempt: null,
  attemptPayload: null,
  history: null,
  mode: "guided",
  savedOutcomes: new Set(),
  offset: 0,
  total: 0,
  searchStudent: "",
  uncertainSave: false,
};
let rowNumber = 0;
let importedCsvRuns = new Map();
let importedMaterialFile = null;
const pretty = (value) => JSON.stringify(value, null, 2);
const clone = (value) => JSON.parse(JSON.stringify(value));
const lines = (value) =>
  value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const optional = (value) => value.trim() || null;
const percent = (value) => `${Math.round((value || 0) * 100)}%`;
const date = (value) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function list(items, empty = "暂无") {
  if (!items?.length) return node("p", empty, "hint");
  const element = node("ul");
  items.forEach((item) => element.append(node("li", item)));
  return element;
}
function block(title, content, kind = "") {
  const element = node("div", null, `result-block ${kind}`);
  element.append(node("h4", title));
  if (typeof content === "string") element.append(node("p", content));
  else if (content) element.append(content);
  return element;
}
function detail(title, content) {
  const element = node("details");
  element.append(node("summary", title), content);
  return element;
}
function announce(message) {
  $("liveStatus").textContent = message;
}
function focusElement(element) {
  if (!element) return;
  if (window.flowReveal) window.flowReveal(element);
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  )
    if (parent.tagName === "DETAILS") parent.open = true;
  element.focus();
}
function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      pretty({
        session_id: state.session?.session_id || null,
        student_id: $("studentId").value.trim(),
        experiment_id: $("experimentId").value,
        course_id: $("courseId").value.trim(),
      }),
    );
  } catch (_) {
    /* Storage is optional; sessions remain on the server. */
  }
}
// Keep unresolved validation attached to its task; navigation must not carry a stale banner.
let validationErrors = [];
let validationPage = document.body.dataset.page || "home";
function removeRenderedErrors() {
  $("errorSummary").hidden = true;
  $("errorList").replaceChildren();
  document.querySelectorAll(".field-error").forEach((item) => item.remove());
  document.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute("aria-invalid");
    const ids = (element.getAttribute("aria-describedby") || "")
      .split(" ")
      .filter((id) => id && !id.startsWith("error-"));
    if (ids.length) element.setAttribute("aria-describedby", ids.join(" "));
    else element.removeAttribute("aria-describedby");
  });
}
function clearErrors() {
  validationErrors = [];
  removeRenderedErrors();
}
function resolvedValidationError(error) {
  const field = error.field ? $(error.field) : null;
  if (!field) return !!error.hadField; // A removed dynamic row no longer needs a correction.
  if (field.validity?.valid === false) return false;
  if (error.requiredValue) return !!String(field.value || "").trim();
  return error.nativeInvalid && field.validity?.valid === true;
}
function renderValidationErrors(page = document.body.dataset.page || validationPage) {
  validationPage = page;
  validationErrors = validationErrors.filter((error) => !resolvedValidationError(error));
  removeRenderedErrors();
  const visible = validationErrors.filter((error) => error.page === page);
  visible.forEach((error, index) => {
    const field = error.field ? $(error.field) : null;
    const message = field?.labels?.[0]
      ? `${field.labels[0].textContent.trim()}：${error.message}`
      : error.message;
    const item = node("li");
    if (field) {
      const link = node("a", message);
      link.href = `#${field.id}`;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        focusElement(field);
      });
      item.append(link);
      field.setAttribute("aria-invalid", "true");
      const inline = node("p", message, "field-error");
      inline.id = `error-${index}`;
      field.insertAdjacentElement("afterend", inline);
      field.setAttribute(
        "aria-describedby",
        `${field.getAttribute("aria-describedby") || ""} ${inline.id}`.trim(),
      );
    } else item.textContent = error.message;
    $("errorList").append(item);
  });
  $("errorSummary").hidden = !visible.length;
  return visible.length;
}
function showErrors(errors) {
  const page = document.body.dataset.page || validationPage;
  validationErrors = errors.map((error) => {
    const field = error.field ? $(error.field) : null;
    return {
      ...error,
      page: field?.closest("[data-view]")?.dataset.view || page,
      requiredValue: !!field && !String(field.value || "").trim() &&
        /请.*(?:填写|输入|选择)|不能为空|必填|at least 1 character|required/i.test(error.message),
      nativeInvalid: field?.validity?.valid === false,
      hadField: !!field,
    };
  });
  // A submission can discover a problem in another task. Reveal that task first.
  if (!validationErrors.some((error) => error.page === page)) {
    const firstField = validationErrors.find((error) => error.field);
    if (firstField) window.flowReveal?.($(firstField.field));
  }
  if (renderValidationErrors(document.body.dataset.page || page)) $("errorSummary").focus();
  announce("操作未完成，请查看当前步骤的问题提示。");
}
window.reconcileValidationErrors = (page) => renderValidationErrors(page);
window.clearFieldValidationErrors = (fieldId) => {
  validationErrors = validationErrors.filter((error) => error.field !== fieldId);
  renderValidationErrors();
};
for (const eventName of ["input", "change"]) document.addEventListener(eventName, (event) => {
  if (event.target?.id && validationErrors.some((error) => error.field === event.target.id)) {
    renderValidationErrors();
  }
});
function invalid(errors) {
  const error = new Error("请检查输入");
  error.fields = errors;
  throw error;
}
function pathField(path) {
  if (
    state.mode === "json" &&
    ![
      "student_id",
      "experiment_id",
      "course_id",
      "student_revision",
      "final_result",
      "self_check_notes",
    ].includes(path)
  )
    return "payload";
  const fields = [...document.querySelectorAll("[data-path]")];
  return (
    fields.find((field) => field.dataset.path === path)?.id ||
    fields.find((field) => path.startsWith(`${field.dataset.path}.`))?.id
  );
}
async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        typeof data.detail === "string"
          ? data.detail
          : `服务返回错误（${response.status}）`,
      );
      error.httpStatus = response.status;
      if (Array.isArray(data.detail))
        error.fields = data.detail.map((item) => {
          const path = (item.loc || [])
            .filter((part) => part !== "body")
            .join(".");
          return {
            field: pathField(path),
            message: `${path || "请求"}：${item.msg}`,
          };
        });
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof TypeError || error.name === "AbortError") {
      const message =
        options.method === "POST"
          ? "暂时无法确认是否保存成功。请先刷新实验记录，再重试。"
          : "无法连接服务。请确认服务已启动，然后重试。";
      const network = new Error(message);
      network.uncertain = options.method === "POST";
      throw network;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function refreshLocks() {
  document
    .querySelectorAll("button,input,select,textarea")
    .forEach((element) => {
      if (element.closest("#labTutor,.tutor-feedback,#academyRoot,.learning-review")) return;
      element.disabled = state.busy;
    });
  if (!state.busy) {
    $("previousSessionsButton").disabled = state.offset <= 0;
    $("nextSessionsButton").disabled = state.offset + 20 >= state.total;
    $("refreshHistoryButton").disabled = !state.session;
    $("exportHistoryButton").disabled = !state.history;
    $("outcomeButton").disabled =
      !state.attempt ||
      state.savedOutcomes.has(state.attempt.attempt_id) ||
      state.uncertainSave;
    $("runButton").disabled = state.uncertainSave;
  }
  $("diagnosisForm").setAttribute("aria-busy", String(state.busy));
  $("runButton").textContent = state.busy
    ? "正在处理，请稍候…"
    : state.session
      ? "提交下一轮诊断"
      : "提交诊断";
}
async function action(message, work) {
  if (state.busy) return;
  clearErrors();
  const trigger = document.activeElement;
  state.busy = true;
  refreshLocks();
  announce(message);
  try {
    await work();
  } catch (error) {
    showErrors(
      error.fields || [{ message: error.message || "操作失败，请重试。" }],
    );
  } finally {
    state.busy = false;
    refreshLocks();
    window.refreshLearning?.();
    if (typeof saveDraft === "function") saveDraft();
    if (
      document.activeElement === document.body &&
      trigger?.isConnected &&
      !trigger.disabled &&
      trigger.getClientRects().length
    )
      focusElement(trigger);
  }
}
function clearOutcome() {
  state.attempt = null;
  state.attemptPayload = null;
  $("outcomeCard").hidden = true;
  $("outcomeForm").reset();
  $("outcomeSaved").hidden = true;
}
function resetSession(message) {
  state.epoch += 1;
  state.session = null;
  state.history = null;
  state.uncertainSave = false;
  clearOutcome();
  $("resultHeading").textContent = "本轮诊断";
  $("result").replaceChildren(
    node(
      "p",
      "提交后，这里会显示证据判断、问题分析、知识条目与下一步提示。",
      "empty",
    ),
  );
  $("rawDetails").hidden = true;
  $("raw").textContent = "";
  $("historyContent").replaceChildren(
    node("p", "还没有实验记录。请提交诊断，或查找已有记录。", "empty"),
  );
  $("sessionState").textContent = "提交诊断后会自动保存记录。";
  persist();
  refreshLocks();
  if (message) announce(message);
}

function sampleFor(experiment, kind) {
  const settings = {
    ohms_law: {
      formula: "R = U / I",
      variables: { U: 5, I: 0.02 },
      wrong: 25,
      right: 250,
      unit: "Ω",
      features: ["结果数量级偏小", "公式结构基本正确"],
      checks: [
        {
          name: "电压量程",
          passed: true,
          observed: 5,
          expected: "0–6 V",
          deviation_percent: 0,
          note: "读数在量程内",
        },
        {
          name: "电流重复性",
          passed: true,
          observed: 20,
          expected: "19–21 mA",
          deviation_percent: 0,
          note: "三次读数稳定",
        },
      ],
      wrongSteps: ["R=U/I", "R=5/0.2", "R=25 Ω"],
      rightSteps: ["20 mA = 0.02 A", "R=U/I=5/0.02", "R=250 Ω"],
      raw: { voltage_V: [1, 2, 3, 4, 5], current_mA: [4, 8, 12, 16, 20] },
      wrongText: "电阻等于电压除以电流，我直接代入了 5 和 0.2。",
      rightText:
        "已将 20 mA 换算为 0.02 A，再计算 R=250 Ω；多组电压与电流比值一致。",
    },
    rc_time_constant: {
      formula: "tau = R * C",
      variables: { R: 10000, C: 0.000001 },
      wrong: 10,
      right: 0.01,
      unit: "s",
      features: ["时间常数比预期大 1000 倍", "电阻与电容乘积的单位待核实"],
      checks: [
        {
          name: "电阻读数",
          passed: true,
          observed: 10000,
          expected: "10 kΩ = 10000 Ω",
          deviation_percent: 0,
          note: "量程正确",
        },
        {
          name: "充电曲线 63.2% 点",
          passed: true,
          observed: 0.01,
          expected: "约 0.01 s",
          deviation_percent: 0,
          note: "曲线重复稳定",
        },
      ],
      wrongSteps: ["tau=R*C", "1 μF 被写为 0.001 F", "tau=10000*0.001=10 s"],
      rightSteps: [
        "10 kΩ=10000 Ω，1 μF=0.000001 F",
        "tau=10000*0.000001",
        "tau=0.01 s=10 ms",
      ],
      raw: {
        time_ms: [0, 5, 10, 15, 20],
        capacitor_voltage_V: [0, 1.967, 3.161, 3.884, 4.323],
      },
      wrongText: "公式是 R*C，但我把 1 μF 换成了 0.001 F。",
      rightText: "统一单位后得到 0.01 s，和充电达到终值 63.2% 的时间相符。",
    },
    simple_pendulum: {
      formula: "g = 4 * pi^2 * L / T^2",
      variables: { L: 1, T: 2.006 },
      wrong: 0.0981,
      right: (4 * Math.PI ** 2) / 2.006 ** 2,
      unit: "m/s²",
      features: ["重力加速度小了约 100 倍", "可能将多周期总时间当作单周期"],
      checks: [
        {
          name: "摆长测量",
          passed: true,
          observed: 1,
          expected: "悬点到摆球质心 1 m",
          deviation_percent: 0,
          note: "已量到质心",
        },
        {
          name: "初始摆角",
          passed: true,
          observed: 4,
          expected: "小于 5°",
          deviation_percent: 0,
          note: "释放时未施加推力",
        },
      ],
      wrongSteps: [
        "测得 10 个周期总时间 20.06 s",
        "直接令 T=20.06 s",
        "g=4*pi^2*1/20.06^2≈0.0981 m/s²",
      ],
      rightSteps: [
        "10 个周期共 20.06 s",
        "单周期 T=20.06/10=2.006 s",
        "g=4*pi^2*1/2.006^2≈9.81 m/s²",
      ],
      raw: {
        length_m: 1,
        periods_per_trial: 10,
        total_time_s: [20.05, 20.06, 20.07],
        initial_angle_degrees: 4,
      },
      wrongText: "我把 10 个周期的计时总和直接代入了周期 T。",
      rightText:
        "将总时间除以 10 得到单周期，再计算重力加速度；摆长量到质心，摆角小于 5°。",
    },
  };
  const s = settings[experiment] || settings.ohms_law;
  if (kind === "insufficient")
    return {
      anomaly: {
        status: "uncertain",
        predicted_issue: null,
        confidence: 0.42,
        observed_features: [
          experiment === "ohms_law"
            ? "末端数据轻微偏离"
            : "观察到的数据似乎偏离预期",
        ],
        summary: "单一路证据无法确定错误类型",
        model_version: "demo-anomaly-v1",
      },
      consistency: { checks: [] },
      mathematics: null,
      raw_measurements:
        experiment === "ohms_law"
          ? { voltage_V: [1, 2, 3] }
          : { observation: "尚未完成测量记录" },
      student_explanation: "我觉得最后一个点可能不对。",
      metadata: { source: "web-demo" },
    };
  const corrected = kind === "corrected";
  return {
    anomaly: {
      status: corrected ? "normal" : "anomalous",
      predicted_issue: corrected ? "no_error" : "calculation_error",
      confidence: 0.93,
      observed_features: corrected
        ? ["单位已经统一", "计算结果与实验预期一致"]
        : s.features,
      summary: corrected
        ? "修正后未观察到明显异常"
        : "模型怀疑单位换算或小数点错误",
      model_version: "demo-anomaly-v1",
    },
    consistency: { checks: s.checks },
    mathematics: {
      formula: s.formula,
      variables: s.variables,
      student_result: corrected ? s.right : s.wrong,
      reference_result: null,
      tolerance_percent: 5,
      unit: s.unit,
      student_steps: corrected ? s.rightSteps : s.wrongSteps,
    },
    raw_measurements: s.raw,
    student_explanation: corrected ? s.rightText : s.wrongText,
    metadata: { source: "web-demo" },
  };
}
const emptyPayload = () => ({
  anomaly: null,
  consistency: null,
  mathematics: null,
  raw_measurements: {},
  student_explanation: null,
  metadata: {},
});
function rowField(row, labelText, options = {}) {
  const field = node("div", null, "field");
  const id = `row-${++rowNumber}`;
  const input = node(
    options.select ? "select" : options.textarea ? "textarea" : "input",
  );
  input.id = id;
  if (options.select)
    for (const [value, title] of options.select) {
      const choice = node("option", title);
      choice.value = value;
      input.append(choice);
    }
  else {
    if (!options.textarea) input.type = options.type || "text";
    if (input.type === "number") input.step = "any";
    if (options.textarea) input.rows = 2;
  }
  if (labelText.includes("必填")) input.required = true;
  if (options.path) input.dataset.path = options.path;
  input.dataset.role = options.role || "";
  input.value = options.value ?? "";
  if (options.min != null) input.min = options.min;
  if (options.max != null) input.max = options.max;
  const label = node("label", labelText);
  label.htmlFor = id;
  field.append(label, input);
  row.append(field);
  return input;
}
function makeRow(container, title, className = "") {
  const row = node("fieldset", null, `data-row ${className}`);
  row.append(node("legend", title));
  container.append(row);
  return row;
}
function removal(row, label, focusFallback) {
  const end = node("div", null, "row-end");
  const button = node("button", label, "remove");
  button.type = "button";
  button.addEventListener("click", () => {
    if (state.busy) return;
    row.remove();
    clearErrors();
    focusElement($(focusFallback));
    window.refreshLearning?.();
    if (typeof saveDraft === "function") saveDraft();
  });
  end.append(button);
  row.append(end);
}
function addVariable(name = "", value = "") {
  const row = makeRow($("variableRows"), "计算变量", "variable-row");
  const fields = node("div", null, "row-fields");
  row.append(fields);
  rowField(fields, "变量名（必填）", { value: name, role: "key" });
  rowField(fields, "变量数值（必填）", {
    type: "number",
    value,
    role: "value",
    path: `mathematics.variables.${name}`,
  });
  removal(row, `移除变量${name ? ` ${name}` : ""}`, "addVariableButton");
  return row;
}
function addCheck(value = {}) {
  const row = makeRow(
    $("checkRows"),
    `一致性检查 ${$("checkRows").children.length + 1}`,
  );
  const headline = node("div", null, "grid-2");
  row.append(headline);
  rowField(headline, "检查名称（必填）", { value: value.name, role: "name" });
  rowField(headline, "检查结论", {
    value:
      value.passed === true ? "true" : value.passed === false ? "false" : "",
    role: "passed",
    select: [
      ["", "待确认"],
      ["true", "通过"],
      ["false", "未通过"],
    ],
  });
  const evidence = node("details", null, "check-evidence");
  evidence.append(node("summary", "添加或查看读数依据（选填）"));
  row.append(evidence);
  const fields = node("div", null, "grid-2");
  evidence.append(fields);
  for (const key of ["observed", "expected"]) {
    const group = node("div");
    fields.append(group);
    const label = key === "observed" ? "观察值" : "预期值";
    rowField(group, `${label}类型`, {
      role: `${key}Type`,
      value: typeof value[key] === "number" ? "number" : "text",
      select: [
        ["text", "文字"],
        ["number", "数值"],
      ],
    });
    rowField(group, `${label}（选填）`, { role: key, value: value[key] });
  }
  rowField(evidence, "偏差百分比（选填）", {
    type: "number",
    role: "deviation_percent",
    value: value.deviation_percent,
  });
  rowField(evidence, "说明（选填）", { role: "note", value: value.note });
  removal(row, "移除此检查项", "addCheckButton");
  return row;
}
function valueType(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "number")
    ? "list"
    : (value != null && typeof value === "object") || value === null
      ? "json"
      : typeof value === "number"
        ? "number"
        : typeof value === "boolean"
          ? "boolean"
          : "text";
}
function addKeyValue(containerId, key = "", value = "") {
  const row = makeRow(
    $(containerId),
    containerId === "measurementRows" ? "原始测量项" : "补充信息项",
  );
  rowField(row, "名称（必填）", { role: "key", value: key });
  const kind = valueType(value);
  rowField(row, "内容类型", {
    role: "kind",
    value: kind,
    select: [
      ["text", "文字"],
      ["number", "数值"],
      ["list", "数值列表（逗号分隔）"],
      ["boolean", "是 / 否（true / false）"],
      ["json", "复杂结构 JSON（高级）"],
    ],
  });
  rowField(row, "内容", {
    role: "value",
    value:
      kind === "json"
        ? pretty(value)
        : kind === "list"
          ? value.join(", ")
          : String(value),
    textarea: true,
  });
  removal(
    row,
    "移除此项目",
    containerId === "measurementRows"
      ? "addMeasurementButton"
      : "addMetadataButton",
  );
  return row;
}
function setKeyValue(containerId, key, value) {
  const row = [...$(containerId).children].find(
    (item) => fieldValue(item, "key")?.value.trim() === key,
  ) || addKeyValue(containerId, key, value);
  const kind = valueType(value);
  fieldValue(row, "key").value = key;
  fieldValue(row, "kind").value = kind;
  fieldValue(row, "value").value =
    kind === "list" ? value.join(", ") : kind === "json" ? pretty(value) : String(value);
}
function numberList(text, field, errors) {
  const items = text.split(/[,，\s]+/).filter(Boolean);
  if (items.length < 2)
    errors.push({ field, message: "请至少填写两个数值，并用逗号分开。" });
  const values = items.map(Number);
  if (values.some((value) => !Number.isFinite(value)))
    errors.push({ field, message: "只能填写有限数值，例如 1, 2, 3。" });
  return values;
}
function clearMaterialAnalysis() {
  // A chart/result belongs to the readings that produced it, not the next loaded record.
  $("materialCharts").replaceChildren();
  $("materialCharts").hidden = true;
  $("materialAnalysisStatus").textContent = "";
  if (typeof lastCharts !== "undefined") lastCharts = null;
  if ($("catalogAnalysisCache")) $("catalogAnalysisCache").value = "";
}
function resetImportedMaterial() {
  importedMaterialFile = null;
  importedCsvRuns.clear();
  $("csvFile").value = "";
  $("csvRunSelect").replaceChildren();
  $("csvRunFields").hidden = true;
  $("csvImportStatus").textContent = "";
  clearMaterialAnalysis();
}
function hydrateQuickMeasurements(payload) {
  const raw = payload.raw_measurements || {};
  const isOhms = $("experimentId").value === "ohms_law";
  // These controls show original V/mA readings. Conversion to A belongs to calculation.
  $("quickVoltage").value = isOhms && Array.isArray(raw.voltage_V) ? raw.voltage_V.join(", ") : "";
  $("quickCurrent").value = isOhms && Array.isArray(raw.current_mA) ? raw.current_mA.map(value => value ?? "").join(", ") : "";
  $("quickResistance").value = isOhms ? payload.metadata?.expected_resistance_ohm ?? "" : "";
}
function writeMeasurements(voltage, current, resistance = null, source = "") {
  clearMaterialAnalysis();
  $("measurementRows").replaceChildren();
  addKeyValue("measurementRows", "voltage_V", voltage);
  addKeyValue("measurementRows", "current_mA", current);
  if (resistance != null) setKeyValue("metadataRows", "expected_resistance_ohm", resistance);
  else [...$("metadataRows").children]
    .filter(row => fieldValue(row, "key")?.value.trim() === "expected_resistance_ohm")
    .forEach(row => row.remove());
  $("quickVoltage").value = voltage.join(", ");
  $("quickCurrent").value = current.map((value) => value ?? "").join(", ");
  $("quickResistance").value = resistance ?? "";
  $("csvImportStatus").textContent = source;
}
function fillQuickMeasurements() {
  const errors = [];
  const voltage = numberList($("quickVoltage").value, "quickVoltage", errors);
  const current = numberList($("quickCurrent").value, "quickCurrent", errors);
  const resistanceText = $("quickResistance").value.trim();
  const resistance = resistanceText ? Number(resistanceText) : null;
  if (resistanceText && (!Number.isFinite(resistance) || resistance <= 0))
    errors.push({ field: "quickResistance", message: "参考电阻应为大于 0 的数值。" });
  if (voltage.length !== current.length)
    errors.push({ field: "quickCurrent", message: "电压与电流的数据个数必须相同。" });
  if (errors.length) invalid(errors);
  // A manually edited table must never retain an older upload as its analysis source.
  resetImportedMaterial();
  writeMeasurements(voltage, current, resistance, `已写入 ${voltage.length} 组电压、电流数据。`);
}
function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  const pushValue = () => { row.push(value.trim()); value = ""; };
  const pushRow = () => { pushValue(); if (row.some((item) => item)) rows.push(row); row = []; };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) pushValue();
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
    } else value += char;
  }
  if (value || row.length) pushRow();
  return rows;
}
function csvColumn(row, headers, ...names) {
  const normalized = new Map(headers.map((name, index) => [name.toLowerCase().replace(/^\uFEFF/, "").trim(), index]));
  for (const name of names) {
    const index = normalized.get(name.toLowerCase());
    if (index != null) return row[index] ?? "";
  }
  return "";
}
function loadCsvRuns(text) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("CSV 至少应包含标题行和一条实验记录。");
  const headers = table[0];
  const headerNames = headers.map((item) => item.toLowerCase().replace(/^\uFEFF/, "").trim());
  if (!headerNames.some((item) => ["voltage_v", "voltage", "电压_v", "电压"].includes(item)) ||
      !headerNames.some((item) => ["current_ma", "current", "电流_ma", "电流"].includes(item)))
    throw new Error("CSV 必须包含 voltage_V（电压）和 current_mA（电流）两列。");
  const runs = new Map();
  for (const row of table.slice(1)) {
    const runId = csvColumn(row, headers, "run_id") || "导入数据";
    const voltageText = csvColumn(row, headers, "voltage_v", "voltage", "电压_v", "电压");
    const currentText = csvColumn(row, headers, "current_ma", "current", "电流_ma", "电流");
    const voltage = Number(voltageText);
    const current = currentText === "" ? null : Number(currentText);
    if (!Number.isFinite(voltage) || (current !== null && !Number.isFinite(current)))
      throw new Error(`实验组 ${runId} 含有无法识别的数值。`);
    const point = Number(csvColumn(row, headers, "point_index")) || Number.MAX_SAFE_INTEGER;
    if (!runs.has(runId)) runs.set(runId, []);
    runs.get(runId).push({ point, voltage, current });
  }
  for (const entries of runs.values()) entries.sort((left, right) => left.point - right.point);
  return runs;
}
function fillFromCsvRun() {
  const run = importedCsvRuns.get($("csvRunSelect").value);
  if (!run) return;
  writeMeasurements(
    run.voltage_V,
    run.current_mA,
    run.metadata?.expected_resistance_ohm ?? null,
    `已载入实验组“${$("csvRunSelect").value}”，共 ${run.voltage_V.length} 个点。`,
  );
}
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(text);
}
async function importCsvFile(file) {
  if (!file) return;
  const suffix = file.name.toLowerCase().split(".").pop();
  if (!["csv", "xlsx"].includes(suffix))
    throw new Error("请选择 CSV 或 XLSX 格式的实验表。\n");
  const content_base64 = bufferToBase64(await file.arrayBuffer());
  const result = await request("/api/v1/anomaly/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, content_base64 }),
  });
  importedMaterialFile = { filename: file.name, content_base64 };
  importedCsvRuns = new Map(result.runs.map((run) => [run.run_id, run]));
  const select = $("csvRunSelect");
  select.replaceChildren(...[...importedCsvRuns.keys()].map((runId) => {
    const option = node("option", runId);
    option.value = runId;
    return option;
  }));
  $("csvRunFields").hidden = importedCsvRuns.size <= 1;
  fillFromCsvRun();
  announce(`已读入 ${file.name}。可以开始自动分析。`);
}
function downloadCsvTemplate() {
  const content = "run_id,point_index,voltage_V,current_mA,label,fault_channel,fault_location,fault_strength\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = node("a");
  link.href = url;
  link.download = "ohms_law_real_data_template.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("已下载真实实验数据 CSV 模板。");
}
function sourceVisibility() {
  $("anomalyFields").hidden = !$("includeAnomaly").checked;
  $("consistencyFields").hidden = !$("includeConsistency").checked;
  $("mathFields").hidden = !$("includeMath").checked;
}
function fillPayload(payload) {
  const p = clone(payload);
  // The payload is authoritative when restoring history, loading a sample or clearing evidence.
  // Original upload bytes are not stored with an attempt, so require a fresh import for file analysis.
  resetImportedMaterial();
  hydrateQuickMeasurements(p);
  $("includeAnomaly").checked = p.anomaly != null;
  const a = p.anomaly || {};
  $("anomalyStatus").value = a.status || "uncertain";
  $("anomalyConfidence").value = a.confidence ?? 0.5;
  $("predictedIssue").value = a.predicted_issue || "";
  $("observedFeatures").value = (a.observed_features || []).join("\n");
  $("anomalySummary").value = a.summary || "";
  $("modelVersion").value = a.model_version || "";
  $("includeConsistency").checked = p.consistency != null;
  $("checkRows").replaceChildren();
  (p.consistency?.checks || []).forEach(addCheck);
  $("includeMath").checked = p.mathematics != null;
  const m = p.mathematics || {};
  for (const [id, key] of Object.entries({
    formula: "formula",
    studentResult: "student_result",
    referenceResult: "reference_result",
    mathUnit: "unit",
  }))
    $(id).value = m[key] ?? "";
  $("tolerance").value = m.tolerance_percent ?? 5;
  $("studentSteps").value = (m.student_steps || []).join("\n");
  $("variableRows").replaceChildren();
  Object.entries(m.variables || {}).forEach(([key, value]) =>
    addVariable(key, value),
  );
  $("studentExplanation").value = p.student_explanation || "";
  for (const [id, key] of [
    ["measurementRows", "raw_measurements"],
    ["metadataRows", "metadata"],
  ]) {
    $(id).replaceChildren();
    Object.entries(p[key] || {}).forEach(([name, value]) =>
      addKeyValue(id, name, value),
    );
  }
  $("payload").value = pretty(p);
  sourceVisibility();
  window.refreshLearning?.({ hydrate: true });
  window.refreshAcademy?.();
  window.refreshCatalog?.({ hydrate: true });
}
function fieldValue(row, role) {
  return row.querySelector(`[data-role="${role}"]`);
}
function readNumber(
  input,
  errors,
  required = false,
  min = -Infinity,
  max = Infinity,
) {
  if (!input.value.trim()) {
    if (required || input.validity.badInput)
      errors.push({ field: input.id, message: "请填写有效数值。" });
    return null;
  }
  const number = Number(input.value);
  if (!Number.isFinite(number) || number < min || number > max) {
    errors.push({
      field: input.id,
      message:
        Number.isFinite(min) && Number.isFinite(max)
          ? `数值必须介于 ${min} 和 ${max} 之间。`
          : "请填写有限数值。",
    });
    return null;
  }
  return number;
}
function readKeyValues(containerId, errors) {
  const object = Object.create(null);
  [...$(containerId).children].forEach((row) => {
    const keyInput = fieldValue(row, "key");
    const key = keyInput.value.trim();
    const input = fieldValue(row, "value");
    const kind = fieldValue(row, "kind").value;
    if (!key) {
      errors.push({
        field: keyInput.id,
        message: "请填写项目名称，或移除空白项目。",
      });
      return;
    }
    if (Object.hasOwn(object, key))
      errors.push({ field: keyInput.id, message: `项目名称 ${key} 重复。` });
    let value = input.value;
    if (kind === "number") value = readNumber(input, errors, true);
    if (kind === "list") {
      value = input.value.trim()
        ? input.value
            .split(/[,，\s]+/)
            .filter(Boolean)
            .map(Number)
        : [];
      if (!value.every(Number.isFinite))
        errors.push({
          field: input.id,
          message: "请填写由逗号分隔的数值列表。",
        });
    }
    if (kind === "boolean") {
      if (!["true", "false"].includes(input.value.trim()))
        errors.push({
          field: input.id,
          message: "是请填写 true，否请填写 false。",
        });
      value = input.value.trim() === "true";
    }
    if (kind === "json") {
      try {
        value = JSON.parse(input.value);
      } catch (_) {
        errors.push({
          field: input.id,
          message: "复杂结构不是有效 JSON；普通文字请选择“文字”类型。",
        });
      }
    }
    object[key] = value;
  });
  return object;
}
function guidedPayload() {
  const errors = [];
  const payload = emptyPayload();
  if ($("includeAnomaly").checked)
    payload.anomaly = {
      status: $("anomalyStatus").value,
      predicted_issue: $("predictedIssue").value || null,
      confidence: readNumber($("anomalyConfidence"), errors, true, 0, 1),
      observed_features: lines($("observedFeatures").value),
      summary: optional($("anomalySummary").value),
      model_version: optional($("modelVersion").value),
    };
  if ($("includeConsistency").checked)
    payload.consistency = {
      checks: [...$("checkRows").children].map((row, index) => {
        const name = fieldValue(row, "name");
        const check = {
          name: name.value.trim(),
          passed:
            { true: true, false: false }[fieldValue(row, "passed").value] ??
            null,
        };
        if (!check.name)
          errors.push({
            field: name.id,
            message: "请填写检查名称，或移除空白检查项。",
          });
        for (const key of ["observed", "expected"]) {
          const input = fieldValue(row, key);
          input.dataset.path = `consistency.checks.${index}.${key}`;
          check[key] =
            fieldValue(row, `${key}Type`).value === "number"
              ? readNumber(input, errors)
              : optional(input.value);
        }
        check.deviation_percent = readNumber(
          fieldValue(row, "deviation_percent"),
          errors,
        );
        check.note = optional(fieldValue(row, "note").value);
        for (const key of ["name", "passed", "deviation_percent", "note"])
          fieldValue(row, key).dataset.path =
            `consistency.checks.${index}.${key}`;
        return check;
      }),
    };
  if ($("includeMath").checked) {
    const variables = Object.create(null);
    [...$("variableRows").children].forEach((row) => {
      const key = fieldValue(row, "key"),
        value = fieldValue(row, "value"),
        name = key.value.trim();
      if (!/^[\p{ID_Start}_][\p{ID_Continue}]*$/u.test(name))
        errors.push({
          field: key.id,
          message: "变量名应以字母或下划线开头，只包含字母、数字或下划线。",
        });
      if (Object.hasOwn(variables, name))
        errors.push({ field: key.id, message: `变量 ${name} 重复。` });
      value.dataset.path = `mathematics.variables.${name}`;
      variables[name] = readNumber(value, errors, true);
    });
    payload.mathematics = {
      formula: optional($("formula").value),
      variables,
      student_result: readNumber($("studentResult"), errors),
      reference_result: readNumber($("referenceResult"), errors),
      tolerance_percent: readNumber($("tolerance"), errors, true, 0, 100),
      unit: optional($("mathUnit").value),
      student_steps: lines($("studentSteps").value),
    };
  }
  payload.student_explanation = optional($("studentExplanation").value);
  payload.raw_measurements = readKeyValues("measurementRows", errors);
  payload.metadata = readKeyValues("metadataRows", errors);
  if (errors.length) invalid(errors);
  return payload;
}
function anomalyInput() {
  if (state.mode === "json") {
    const payload = parsePayload();
    return {
      experiment_id: $("experimentId").value,
      raw_measurements: payload.raw_measurements || {},
      metadata: payload.metadata || {},
    };
  }
  const errors = [];
  const raw_measurements = readKeyValues("measurementRows", errors);
  const metadata = readKeyValues("metadataRows", errors);
  if (errors.length) invalid(errors);
  return { experiment_id: $("experimentId").value, raw_measurements, metadata };
}
async function runAutoAnomaly() {
  const result = await request("/api/v1/anomaly/analyze", {
    method: "POST",
    body: pretty(anomalyInput()),
  });
  applyAnomalyResult(result);
  announce(
    `自动分析完成：${result.details.anomaly_type}，异常分数 ${percent(result.details.anomaly_score)}。`,
  );
}
function applyAnomalyResult(result) {
  if (state.mode === "json") {
    const payload = parsePayload();
    payload.anomaly = result.anomaly;
    $("payload").value = pretty(payload);
  } else {
    const anomaly = result.anomaly;
    $("includeAnomaly").checked = true;
    $("anomalyStatus").value = anomaly.status;
    $("anomalyConfidence").value = anomaly.confidence;
    $("predictedIssue").value = anomaly.predicted_issue || "";
    $("observedFeatures").value = anomaly.observed_features.join("\n");
    $("anomalySummary").value = [
      anomaly.summary,
      ...result.details.locations.map((item) =>
        `${item.channel}${item.point_index ? ` 第${item.point_index}点` : ""}：${item.reason}`,
      ),
    ].filter(Boolean).join("\n");
    $("modelVersion").value = anomaly.model_version || "";
    sourceVisibility();
  }
}
function applyPcEvidence(result) {
  if (state.mode === "json") {
    const payload = parsePayload();
    payload.anomaly = result.anomaly.anomaly;
    payload.consistency = result.consistency;
    payload.mathematics = result.mathematics;
    $("payload").value = pretty(payload);
    return;
  }
  applyAnomalyResult(result.anomaly);
  $("includeConsistency").checked = true;
  $("checkRows").replaceChildren();
  result.consistency.checks.forEach(addCheck);
  $("includeMath").checked = true;
  const math = result.mathematics;
  $("formula").value = math.formula || "";
  $("referenceResult").value = math.reference_result ?? "";
  $("tolerance").value = math.tolerance_percent ?? 5;
  $("mathUnit").value = math.unit || "";
  $("studentSteps").value = (math.student_steps || []).join("\n");
  $("variableRows").replaceChildren();
  Object.entries(math.variables || {}).forEach(([name, value]) => addVariable(name, value));
  sourceVisibility();
}
function svgChart(title, points, fitted, yLabel) {
  if (window.learningPlot) return window.learningPlot(title, points, fitted?.length ? [{ name: "线性拟合", points: fitted }] : [], "电压 / V", yLabel === "电流 mA" ? "电流 / mA" : "残差 / mA");
  const width = 520, height = 260, padding = 42;
  const all = [...points, ...fitted];
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 0);
  const scaleX = (value) => padding + ((value - minX) / Math.max(maxX - minX, 1e-9)) * (width - padding * 2);
  const scaleY = (value) => height - padding - ((value - minY) / Math.max(maxY - minY, 1e-9)) * (height - padding * 2);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", title);
  const axis = document.createElementNS(ns, "path");
  axis.setAttribute("d", `M ${padding} ${padding} V ${height - padding} H ${width - padding}`);
  axis.setAttribute("class", "chart-axis");
  svg.append(axis);
  if (fitted?.length) {
    const line = document.createElementNS(ns, "polyline");
    line.setAttribute("points", fitted.map((point) => `${scaleX(point.x)},${scaleY(point.y)}`).join(" "));
    line.setAttribute("class", "chart-fit");
    svg.append(line);
  }
  points.forEach((point) => {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", scaleX(point.x));
    circle.setAttribute("cy", scaleY(point.y));
    circle.setAttribute("r", "4");
    circle.setAttribute("class", "chart-point");
    svg.append(circle);
  });
  const caption = document.createElementNS(ns, "text");
  caption.setAttribute("x", padding);
  caption.setAttribute("y", 20);
  caption.setAttribute("class", "chart-label");
  caption.textContent = `${title}（横轴：电压 V；纵轴：${yLabel}）`;
  svg.append(caption);
  return svg;
}
function renderMaterialCharts(charts) {
  if (typeof lastCharts !== "undefined") lastCharts = charts;
  const holder = $("materialCharts");
  holder.replaceChildren();
  const scatter = node("section", null, "chart-card");
  scatter.append(svgChart("伏安散点与拟合线", charts.scatter || [], charts.fitted || [], "电流 mA"));
  const residual = node("section", null, "chart-card");
  residual.append(svgChart("拟合残差图", charts.residuals || [], [], "残差 mA"));
  holder.append(scatter, residual);
  holder.hidden = false;
}
async function runFullMaterialAnalysis() {
  if (!importedMaterialFile)
    invalid([{ field: "csvFile", message: "请先选择并导入 CSV 或 Excel 实验表。" }]);
  if ($("experimentId").value !== "ohms_law")
    invalid([{ field: "experimentId", message: "当前一键材料分析仅支持伏安法测电阻。" }]);
  const studentText = $("studentResult").value.trim();
  const studentResult = studentText ? Number(studentText) : null;
  if (studentText && !Number.isFinite(studentResult))
    invalid([{ field: "studentResult", message: "学生计算结果必须是有限数值。" }]);
  const result = await request("/api/v1/materials/analyze", {
    method: "POST",
    body: pretty({
      ...importedMaterialFile,
      run_id: $("csvRunSelect").value || null,
      student_result: studentResult,
      tolerance_percent: Number($("tolerance").value || 5),
    }),
  });
  applyPcEvidence(result);
  renderMaterialCharts(result.charts);
  $("materialAnalysisStatus").textContent =
    `已完成“${result.run_id}”的数据解析、复算、一致性检查和异常检测。`;
  announce("实验材料自动分析完成，三路证据已写入表单。");
}
function parsePayload(forGuided = false) {
  let payload;
  try {
    payload = JSON.parse($("payload").value);
  } catch (_) {
    invalid([
      {
        field: "payload",
        message: "JSON 格式无效。请检查引号、逗号和括号，或重新载入样例。",
      },
    ]);
  }
  if (payload === null || Array.isArray(payload) || typeof payload !== "object")
    invalid([{ field: "payload", message: "诊断请求必须是一个 JSON 对象。" }]);
  const finite = (value) =>
    typeof value === "number"
      ? Number.isFinite(value)
      : value !== null && typeof value === "object"
        ? Object.values(value).every(finite)
        : true;
  if (!finite(payload))
    invalid([
      { field: "payload", message: "数值超出可处理范围，请使用有限数值。" },
    ]);
  if (forGuided) validateGuidedShape(payload);
  return payload;
}
function validateGuidedShape(payload) {
  const object = (value) =>
    value && typeof value === "object" && !Array.isArray(value);
  const arrays = (value) =>
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"));
  let good = true;
  const allowed = [
    "anomaly",
    "consistency",
    "mathematics",
    "raw_measurements",
    "student_explanation",
    "metadata",
  ];
  if (Object.keys(payload).some((key) => !allowed.includes(key))) good = false;
  for (const key of ["anomaly", "consistency", "mathematics"])
    if (payload[key] != null && !object(payload[key])) good = false;
  for (const key of ["raw_measurements", "metadata"])
    if (payload[key] !== undefined && !object(payload[key])) good = false;
  if (
    payload.student_explanation != null &&
    typeof payload.student_explanation !== "string"
  )
    good = false;
  const a = payload.anomaly;
  if (
    a &&
    object(a) &&
    (!arrays(a.observed_features) ||
      !["normal", "anomalous", "uncertain"].includes(a.status) ||
      typeof a.confidence !== "number" ||
      a.confidence < 0 ||
      a.confidence > 1 ||
      (a.predicted_issue != null &&
        !Object.hasOwn(ISSUES, a.predicted_issue)) ||
      ["summary", "model_version"].some(
        (key) => a[key] != null && typeof a[key] !== "string",
      ) ||
      Object.keys(a).some(
        (key) =>
          ![
            "status",
            "predicted_issue",
            "confidence",
            "observed_features",
            "summary",
            "model_version",
          ].includes(key),
      ))
  )
    good = false;
  const c = payload.consistency;
  if (
    c &&
    object(c) &&
    (Object.keys(c).some((key) => key !== "checks") ||
      (c.checks !== undefined &&
        (!Array.isArray(c.checks) ||
          c.checks.some(
            (check) =>
              !object(check) ||
              typeof check.name !== "string" ||
              ![true, false, null].includes(check.passed) ||
              ["observed", "expected"].some(
                (key) =>
                  check[key] != null &&
                  !["string", "number"].includes(typeof check[key]),
              ) ||
              (check.deviation_percent != null &&
                typeof check.deviation_percent !== "number") ||
              (check.note != null && typeof check.note !== "string") ||
              Object.keys(check).some(
                (key) =>
                  ![
                    "name",
                    "passed",
                    "observed",
                    "expected",
                    "deviation_percent",
                    "note",
                  ].includes(key),
              ),
          ))))
  )
    good = false;
  const m = payload.mathematics;
  if (
    m &&
    object(m) &&
    (!arrays(m.student_steps) ||
      (m.variables !== undefined &&
        (!object(m.variables) ||
          Object.values(m.variables).some(
            (value) => typeof value !== "number" || !Number.isFinite(value),
          ))) ||
      ["student_result", "reference_result", "tolerance_percent"].some(
        (key) => m[key] != null && typeof m[key] !== "number",
      ) ||
      ["formula", "unit"].some(
        (key) => m[key] != null && typeof m[key] !== "string",
      ) ||
      Object.keys(m).some(
        (key) =>
          ![
            "formula",
            "variables",
            "student_result",
            "reference_result",
            "tolerance_percent",
            "unit",
            "student_steps",
          ].includes(key),
      ))
  )
    good = false;
  if (!good)
    invalid([
      {
        field: "payload",
        message:
          "部分字段结构或类型不符合表单要求。请参考 API 文档修正，或继续在高级 JSON 模式提交以查看逐项校验。",
      },
    ]);
}
function changeMode(target) {
  if (state.busy || state.mode === target) return;
  clearErrors();
  try {
    if (target === "json") $("payload").value = pretty(guidedPayload());
    else fillPayload(parsePayload(true));
    state.mode = target;
    document.querySelector('[data-view="calculation"] .evidence-group').hidden = target === "json";
  $("studentExplanation").parentElement.hidden = target === "json";
    $("jsonFields").hidden = target !== "json";
    announce(
      target === "json"
        ? "已切换到高级 JSON，当前表单内容已同步。"
        : "已切换到引导式填写，JSON 内容已同步。",
    );
  } catch (error) {
    document.querySelector(
      `input[name="entryMode"][value="${state.mode}"]`,
    ).checked = true;
    showErrors(error.fields || [{ message: error.message }]);
  }
}

// All network-backed controls share one action lock to keep session/attempt targets stable.
function addExperiment(id, title = EXPERIMENTS[id] || id) {
  for (const select of [$("experimentId"), $("knowledgeExperiment")]) {
    const existing = [...select.options].find((option) => option.value === id);
    if (existing) {
      existing.textContent = title;
    } else {
      const option = node("option", title);
      option.value = id;
      select.append(option);
    }
  }
}
function sessionLabel(count = state.history?.summary.attempt_count || 0) {
  $("sessionState").textContent = state.session
    ? `已完成 ${count} 轮诊断`
    : "提交诊断后会自动保存记录。";
}
function setSession(session) {
  state.session = session;
  addExperiment(session.experiment_id);
  $("studentId").value = session.student_id;
  $("experimentId").value = session.experiment_id;
  $("courseId").value = session.course_id || "";
  $("sessionStudentId").value = session.student_id;
  sessionLabel();
  persist();
}
async function ensureSession() {
  if (state.session) return state.session;
  const student = $("studentId").value.trim();
  if (!student) invalid([{ field: "studentId", message: "请填写记录编号。" }]);
  const session = await request("/api/v1/sessions", {
    method: "POST",
    body: pretty({
      student_id: student,
      experiment_id: $("experimentId").value,
      course_id: optional($("courseId").value),
    }),
  });
  setSession(session);
  return session;
}
function knowledgeCard(document, headingTag = "h3") {
  const card = node("article", null, "knowledge-document");
  card.append(
    node(
      "p",
      EXPERIMENTS[document.experiment_id] || document.experiment_id,
      "eyebrow",
    ),
    node(headingTag, document.title),
  );
  const subheading = headingTag === "h3" ? "h4" : "h5";
  card.append(node("p", document.principles?.[0] || "", "knowledge-preview"));
  const body = node("div");
  for (const [key, title] of [
    ["principles", "实验原理"],
    ["data_standards", "数据规范"],
    ["typical_errors", "典型错误"],
  ]) {
    body.append(node(subheading, title), list(document[key]));
  }
  if (document.keywords?.length)
    body.append(node("p", `关键词：${document.keywords.join("、")}`, "meta"));
  if (document.check_questions?.length) body.append(node(subheading, "做完后问自己"), list(document.check_questions));
  card.append(detail("展开原理、数据规范与自查问题", body));
  if (document.sources?.length) {
    const refs = node("p", "参考来源：", "knowledge-sources");
    for (const source of document.sources) {
      if (!/^https:\/\//.test(source.url)) continue;
      const a = node("a", source.title); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; refs.append(a);
    }
    card.append(refs);
  }
  return card;
}
function diagnosisContent(data, payload = null) {
  const content = node("div");
  const assessment = data.evidence_assessment;
  if (window.renderLearningDiagnosis) content.append(window.renderLearningDiagnosis(data, payload));
  else content.append(block(`证据${assessment.sufficient ? "充分" : "不足"} · 完整度 ${percent(assessment.completeness_score)}`, `已就绪：${assessment.ready_sources.map(s => SOURCES[s] || s).join("、") || "无"}`));
  if (assessment.missing_fields.length) content.append(block("先补充这些内容", list(assessment.missing_fields.map(field => field.startsWith("anomaly") ? "在观察页描述实际看见的特征与判断。" : field.startsWith("consistency") ? "在核查页核实至少一项条件，留下结论。" : field.startsWith("mathematics") ? "在计算页补充公式、变量、自己的结果与步骤。" : field)), "warn"));
  if (assessment.conflicts.length) content.append(block("这些证据还需要核对", list(assessment.conflicts), "warn"));
  if (data.follow_up) content.append(block(data.follow_up.message, list(data.follow_up.questions), "warn"));
  const basis = node("div");
  if (assessment.findings.length) basis.append(block("规则检查依据", list(assessment.findings.map(item => item.message.replace(/data_error|calculation_error|concept_misunderstanding|no_error|mixed|insufficient_evidence/g, value => ISSUES[value] || value)))));
  if (assessment.computed_math_result != null) basis.append(block("独立复算结果", `${assessment.computed_math_result} ${payload?.mathematics?.unit || ""}；相对差异：${assessment.math_relative_error_percent == null ? "无法计算" : `${assessment.math_relative_error_percent.toFixed(2)}%`}`));
  if (data.diagnosis) {
    const diagnosis = data.diagnosis;
    content.append(node("p", `本轮判断：${ISSUES[diagnosis.issue_type] || diagnosis.issue_type} · 置信度 ${percent(diagnosis.confidence)}`, "diagnosis-verdict"));
    if (!window.renderLearningDiagnosis) content.append(block("问题分析", diagnosis.summary));
    basis.append(block("诊断依据", list(diagnosis.evidence_basis)));
    if (data.intervention) {
      const intervention = node("div"); intervention.append(node("p", data.intervention.content));
      if (data.intervention.checklist.length) intervention.append(list(data.intervention.checklist));
      content.append(block(`现在可以做什么 · ${data.intervention.level_name}`, intervention));
    }
    if (diagnosis.knowledge_gaps.length) content.append(detail("相关知识提醒", block("可结合本轮数据核对", list(diagnosis.knowledge_gaps))));
    const plan = diagnosis.teaching_plan, hints = node("div");
    hints.append(block("1 · 定位检查环节", plan.module_location), block("2 · 想一想", plan.socratic_question), block("3 · 逐项检查", list(plan.concrete_checks)), block("4 · 解释与方法", plan.full_explanation));
    content.append(detail("需要更多帮助？查看逐级提示", hints));
  }
  if (basis.children.length) content.append(detail("查看复算与完整检查依据", basis));
  if (data.knowledge_matches.length) {
    const matches = node("div"); data.knowledge_matches.forEach(match => matches.append(knowledgeCard(match, "h4")));
    content.append(detail(`阅读相关知识与来源（${data.knowledge_matches.length} 条）`, matches));
  }
  content.append(node("p", `本轮使用${ENGINES[data.engine_mode] || "证据诊断"}。结果依据你提供的记录。`, "meta"));
  return content;
}
function selectAttempt(data, outcome = null, moveFocus = false, payload = null) {
  clearOutcome();
  state.attempt = data;
  state.attemptPayload = payload || state.history?.attempts.find(a => a.attempt_id === data.attempt_id)?.request || null;
  $("result").replaceChildren(diagnosisContent(data, state.attemptPayload));
  $("resultHeading").textContent =
    `第 ${data.attempt_number} 轮诊断 · ${STATUSES[data.status] || data.status}`;
  $("raw").textContent = pretty(data);
  $("rawDetails").hidden = true;
  $("outcomeCard").hidden = false;
  $("outcomeTarget").textContent =
    `为第 ${data.attempt_number} 轮诊断记录修改。`;
  if (outcome) {
    state.savedOutcomes.add(data.attempt_id);
    $("outcomeForm").hidden = true;
    $("outcomeSaved").hidden = false;
    $("outcomeSaved").textContent =
      `本轮修改已保存：${OUTCOMES[outcome.result]}。${outcome.student_revision || ""}`;
  } else {
    $("outcomeForm").hidden = false;
  }
  if (moveFocus) focusElement($("resultHeading"));
}
function readableEvidence(payload) {
  const content = node("div");
  if (payload.anomaly)
    content.append(
      block(
        "异常观察",
        `${payload.anomaly.summary || "无摘要"}；置信度 ${percent(payload.anomaly.confidence)}`,
      ),
    );
  if (payload.consistency)
    content.append(
      block(
        "一致性检查",
        list(
          payload.consistency.checks.map(
            (check) =>
              `${check.name}：${check.passed === true ? "通过" : check.passed === false ? "未通过" : "待确认"}；观察 ${check.observed ?? "未提供"}；预期 ${check.expected ?? "未提供"}${check.note ? `；${check.note}` : ""}`,
          ),
        ),
      ),
    );
  if (payload.mathematics) {
    const math = payload.mathematics;
    content.append(
      block(
        "数学计算",
        `${math.formula || "未提供公式"}；学生结果 ${math.student_result ?? "未提供"} ${math.unit || ""}；参考结果 ${math.reference_result ?? "由公式复算"}`,
      ),
    );
    content.append(
      list(
        Object.entries(math.variables).map(
          ([key, value]) => `${key} = ${value}`,
        ),
      ),
      list(math.student_steps, "未提供计算步骤。"),
    );
  }
  if (payload.student_explanation)
    content.append(block("学生解释", payload.student_explanation));
  return content;
}
function renderHistory(history) {
  state.history = history;
  const summary = history.summary;
  const content = node("div");
  const metrics = node("div", null, "metrics");
  for (const [label, value] of [
    ["诊断次数", summary.attempt_count],
    ["修改次数", summary.modification_count],
    ["已纠正次数", summary.corrected_count],
    ["最新修改结果", OUTCOMES[summary.latest_result] || "尚未记录"],
  ]) {
    const metric = node("div", null, "metric");
    metric.append(node("strong", value), node("span", label));
    metrics.append(metric);
  }
  content.append(metrics);
  if (window.renderLearningHistory) content.append(window.renderLearningHistory(history));
  if (!history.attempts.length)
    content.append(
      node("p", "这次实验还没有诊断结果，填写证据后即可开始。", "empty"),
    );
  for (const attempt of history.attempts) {
    if (attempt.outcome) state.savedOutcomes.add(attempt.attempt_id);
    const record = node("details", null, "history-attempt");
    record.append(
      node(
        "summary",
        `第 ${attempt.attempt_number} 轮 · ${STATUSES[attempt.status] || attempt.status} · ${date(attempt.created_at)}`,
      ),
    );
    record.append(
      detail("查看本轮证据", readableEvidence(attempt.request)),
      diagnosisContent(attempt.response, attempt.request),
    );
    if (attempt.outcome) {
      const outcome = attempt.outcome;
      const revision = node("div");
      revision.append(
        node("p", `结果：${OUTCOMES[outcome.result] || outcome.result}`),
        node("p", outcome.student_revision),
      );
      if (outcome.final_result)
        revision.append(node("p", `最终结果：${outcome.final_result}`));
      if (outcome.self_check_notes)
        revision.append(node("p", `自查笔记：${outcome.self_check_notes}`));
      revision.append(node("p", date(outcome.recorded_at), "meta"));
      record.append(block("修改记录", revision));
    }
    const controls = node("div", null, "actions");
    const view = node(
      "button",
      attempt.outcome ? "查看本轮诊断" : "为本轮记录修改",
      "secondary",
    );
    view.type = "button";
    view.addEventListener("click", () => {
      if (state.busy) return;
      clearErrors();
      selectAttempt(attempt.response, attempt.outcome, true);
      refreshLocks();
    });
    const reuse = node("button", "将本轮输入载入表单", "plain");
    reuse.type = "button";
    reuse.addEventListener("click", () => {
      if (state.busy) return;
      clearErrors();
      fillPayload(attempt.request);
      focusElement(
        state.mode === "json" ? $("payload") : $("studentExplanation"),
      );
      announce(
        `已载入第 ${attempt.attempt_number} 轮证据。修改后可继续提交诊断。`,
      );
    });
    controls.append(view, reuse);
    record.append(controls);
    content.append(record);
  }
  $("historyContent").replaceChildren(content);
  sessionLabel(summary.attempt_count);
}
async function loadHistory({ resume = false, moveFocus = false } = {}) {
  if (!state.session) return;
  const history = await request(
    `/api/v1/sessions/${encodeURIComponent(state.session.session_id)}/history`,
  );
  renderHistory(history);
  if (resume) {
    const latest = history.attempts.at(-1);
    if (latest) {
      fillPayload(latest.request);
      selectAttempt(latest.response, latest.outcome);
    } else {
      clearOutcome();
      fillPayload(emptyPayload());
      $("rawDetails").hidden = true;
      $("result").replaceChildren(node("p", "这次实验还没有诊断结果。", "empty"));
    }
  } else if (state.attempt) {
    const selected = history.attempts.find(
      (item) => item.attempt_id === state.attempt.attempt_id,
    );
    if (selected?.outcome) selectAttempt(selected.response, selected.outcome);
  }
  if (moveFocus) focusElement($("historyHeading"));
  return history;
}
async function resumeSession(id) {
  const history = await request(
    `/api/v1/sessions/${encodeURIComponent(id)}/history`,
  );
  resetSession();
  setSession(history.session);
  renderHistory(history);
  const latest = history.attempts.at(-1);
  if (latest) {
    fillPayload(latest.request);
    selectAttempt(latest.response, latest.outcome);
  } else fillPayload(emptyPayload());
  if (window.tutorReady) focusElement($("resultHeading"));
  announce(
    `已恢复上次实验记录，共 ${history.summary.attempt_count} 轮诊断。`,
  );
}
async function findSessions(offset = 0) {
  const student = $("sessionStudentId").value.trim();
  const params = new URLSearchParams({ limit: "20", offset: String(offset) });
  if (student) params.set("student_id", student);
  const data = await request(`/api/v1/sessions?${params}`);
  state.offset = data.offset;
  state.total = data.total;
  state.searchStudent = student;
  const content = document.createDocumentFragment();
  for (const session of data.sessions) {
    const item = node("div", null, "session-item");
    const info = node("div");
    info.append(
      node(
        "h3",
        `${session.student_id} · ${EXPERIMENTS[session.experiment_id] || session.experiment_id}`,
      ),
    );
    info.append(
      node(
        "p",
        `${date(session.created_at)} · ${session.attempt_count} 次诊断 · ${session.modification_count} 次修改`,
        "meta",
      ),
    );
    const resume = node("button", "继续实验", "secondary");
    resume.type = "button";
    resume.setAttribute(
      "aria-label",
      `继续 ${session.student_id} 的${EXPERIMENTS[session.experiment_id] || session.experiment_id}实验，创建于 ${date(session.created_at)}`,
    );
    resume.addEventListener("click", () =>
      action("正在打开实验记录…", () => resumeSession(session.session_id)),
    );
    item.append(info, resume);
    content.append(item);
  }
  if (!data.sessions.length)
    content.append(
      node("p", "未找到你的实验记录。可以更改编号筛选，或留空查看自己的全部记录。", "empty"),
    );
  $("sessionList").replaceChildren(content);
  $("sessionListSummary").textContent =
    `共 ${data.total} 条实验记录${data.total ? `，显示第 ${data.offset + 1}–${Math.min(data.offset + data.limit, data.total)} 个` : ""}。`;
  announce($("sessionListSummary").textContent);
}
async function runDiagnosis() {
  const payload = state.mode === "json" ? parsePayload() : guidedPayload();
  const session = await ensureSession();
  let data;
  try {
    data = await request(
      `/api/v1/sessions/${encodeURIComponent(session.session_id)}/attempts`,
      { method: "POST", body: pretty(payload) },
    );
  } catch (error) {
    if (error.uncertain) state.uncertainSave = true;
    throw error;
  }
  selectAttempt(data, null, true, payload);
  sessionLabel(data.attempt_number);
  announce(`第 ${data.attempt_number} 轮诊断完成：${STATUSES[data.status]}。`);
  try {
    await loadHistory();
  } catch (_) {
    announce("诊断已保存。历史暂未加载，请使用“刷新历史”。");
  }
}
async function recordOutcome() {
  if (!state.attempt) return;
  if (!$("revision").value.trim())
    invalid([{ field: "revision", message: "请说明本轮做了什么修改。" }]);
  const payload = {
    result: $("outcomeResult").value,
    student_revision: $("revision").value.trim(),
    final_result: optional($("finalResult").value),
    self_check_notes: optional($("selfCheckNotes").value),
  };
  try {
    await request(
      `/api/v1/attempts/${encodeURIComponent(state.attempt.attempt_id)}/outcome`,
      { method: "POST", body: pretty(payload) },
    );
  } catch (error) {
    if (error.uncertain) state.uncertainSave = true;
    if (error.httpStatus === 409) await loadHistory();
    throw error;
  }
  selectAttempt(state.attempt, payload);
  focusElement($("outcomeHeading"));
  announce("修改记录已保存。更新证据后，可提交下一轮诊断。");
  try {
    await loadHistory();
  } catch (_) {
    announce("修改已保存。历史暂未加载，请稍后刷新历史。");
  }
}
async function browseKnowledge() {
  const query = $("knowledgeQuery").value.trim();
  const experiment = $("knowledgeExperiment").value;
  const params = new URLSearchParams();
  if (experiment) params.set("experiment_id", experiment);
  if (query) {
    params.set("q", query);
    params.set("top_k", "10");
  }
  let documents = await request(
    `/api/v1/knowledge/${query ? "search" : "documents"}?${params}`,
  );
  if (query && experiment)
    documents = documents.filter((item) =>
      [experiment, "generic"].includes(item.experiment_id),
    );
  if (experiment) documents.sort((a,b) => Number(b.experiment_id === experiment) - Number(a.experiment_id === experiment));
  $("knowledgeResults").replaceChildren(
    ...documents.map((document) => knowledgeCard(document)),
  );
  if (!documents.length)
    $("knowledgeResults").append(
      node("p", "没有匹配的条目。尝试其他关键词或浏览全部条目。", "empty"),
    );
  $("knowledgeSummary").textContent = query
    ? `找到 ${documents.length} 条相关知识（最多展示 10 条）。`
    : `显示 ${documents.length} 条知识。`;
  documents.forEach((document) =>
    addExperiment(
      document.experiment_id,
      EXPERIMENTS[document.experiment_id] || document.title,
    ),
  );
  return documents;
}
async function refreshHealth() {
  try {
    const health = await request("/api/v1/health");
    $("healthBadge").textContent = "服务正常";
    $("serviceDetails").replaceChildren(node("p", "连接正常，可以继续填写和查看实验记录。"));
  } catch (error) {
    $("healthBadge").textContent = "服务未连接";
    $("serviceDetails").replaceChildren(
      node("p", "无法连接服务。请运行项目启动器，再刷新服务状态。"),
    );
    throw error;
  }
}
function exportHistory() {
  if (!state.history) return;
  const url = URL.createObjectURL(
    new Blob([pretty(state.history)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const link = node("a");
  link.href = url;
  const student = state.history.session.student_id.replace(/[\\/:*?"<>|]/g, "_");
  link.download = `实验记录-${student}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("实验记录已下载，请在浏览器下载列表中查看。");
}

$("diagnosisForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (document.body.dataset.page !== "calculation") return;
  action("正在诊断，请稍候…", runDiagnosis);
});
$("outcomeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  action("正在保存修改…", recordOutcome);
});
$("newSessionButton").addEventListener("click", () =>
  action("正在保存实验信息…", async () => {
    // Explicit session creation is possible without also submitting an attempt.
    if (!$("studentId").value.trim())
      invalid([{ field: "studentId", message: "请填写记录编号。" }]);
    resetSession();
    await ensureSession();
    await loadHistory();
    announce("新的实验记录已准备好，请填写证据并提交诊断。");
  }),
);
for (const id of ["studentId", "experimentId", "courseId"])
  $(id).addEventListener("change", () => {
    if (state.busy) return;
    resetSession(
      "实验信息已更改，提交后会保存为新的记录。原有记录可在历史中找到。",
    );
    if (id === "experimentId") {
      importedMaterialFile = null; importedCsvRuns.clear();
      $("csvImportStatus").textContent = ""; $("materialAnalysisStatus").textContent = "";
      $("materialCharts").hidden = true; if (typeof lastCharts !== "undefined") lastCharts = null;
      fillPayload(emptyPayload());
      announce("已切换实验并清空上一实验的证据。可载入当前实验的样例。");
    }
  });
$("addExperimentButton").addEventListener("click", () => {
  if (state.busy) return;
  clearErrors();
  const id = $("customExperimentId").value.trim();
  if (!id) {
    showErrors([{ field: "customExperimentId", message: "请填写实验编号。" }]);
    return;
  }
  addExperiment(id);
  $("experimentId").value = id;
  resetSession();
  fillPayload(emptyPayload());
  focusElement($("experimentId"));
  announce(`已选择实验 ${id}。填写证据后即可提交诊断。`);
});
$("loadSampleButton").addEventListener("click", () => {
  if (state.busy) return;
  clearErrors();
  const experiment = $("experimentId").value;
  if (
    !["ohms_law", "rc_time_constant", "simple_pendulum"].includes(experiment)
  ) {
    fillPayload(emptyPayload());
    announce("此实验暂无内置样例，请填写自己的证据。");
    return;
  }
  importedMaterialFile = null; importedCsvRuns.clear();
  $("materialCharts").hidden = true; if (typeof lastCharts !== "undefined") lastCharts = null;
  $("csvImportStatus").textContent = ""; $("materialAnalysisStatus").textContent = "";
  fillPayload(sampleFor(experiment, $("sampleKind").value));
  announce("样例已载入，可修改证据或直接提交诊断。");
});
$("clearEvidenceButton").addEventListener("click", () => {
  if (!state.busy) {
    clearErrors();
    importedMaterialFile = null; importedCsvRuns.clear();
    $("materialCharts").hidden = true; if (typeof lastCharts !== "undefined") lastCharts = null;
    $("csvImportStatus").textContent = ""; $("materialAnalysisStatus").textContent = "";
    fillPayload(emptyPayload());
    announce("证据已清空，已保存的实验记录仍可查看。");
  }
});
$("fillQuickButton").addEventListener("click", () => {
  if (!state.busy) action("正在写入原始测量…", async () => {
    fillQuickMeasurements();
    const voltage = $("quickVoltage").value.split(",").map(Number);
    const current = $("quickCurrent").value.split(",").map(Number);
    const resistance = $("quickResistance").value.trim();
    const csv = "run_id,voltage_V,current_mA,expected_resistance_ohm\n" + voltage.map((v,i)=>`manual,${v},${current[i]},${resistance}`).join("\n");
    await importCsvFile(new File([csv],"manual_measurements.csv",{type:"text/csv"}));
    await runFullMaterialAnalysis();
  });
});
$("csvFile").addEventListener("change", () => {
  const file = $("csvFile").files?.[0];
  if (file && !state.busy)
    action("正在读取实验表…", async () => importCsvFile(file));
});
$("csvRunSelect").addEventListener("change", () => {
  if (!state.busy) fillFromCsvRun();
});
$("fullMaterialAnalysisButton").addEventListener("click", () => {
  if (!state.busy)
    action("正在完成数据解析、复算与异常检测…", async () => runFullMaterialAnalysis());
});
$("downloadCsvTemplateButton").addEventListener("click", downloadCsvTemplate);
$("autoAnomalyButton").addEventListener("click", () => {
  if (!state.busy)
    action("正在分析原始测量数据…", runAutoAnomaly);
});
for (const input of document.querySelectorAll('input[name="entryMode"]'))
  input.addEventListener("change", () => changeMode(input.value));
for (const id of ["includeAnomaly", "includeConsistency", "includeMath"])
  $(id).addEventListener("change", sourceVisibility);
for (const [id, add] of [
  ["addVariableButton", () => addVariable()],
  ["addCheckButton", () => addCheck()],
  ["addMeasurementButton", () => addKeyValue("measurementRows")],
  ["addMetadataButton", () => addKeyValue("metadataRows")],
]) {
  $(id).addEventListener("click", () => {
    if (!state.busy) focusElement(add().querySelector("input"));
  });
}
$("sessionStudentId").addEventListener("input", () => {
  state.offset = 0;
  state.total = 0;
  refreshLocks();
});
$("sessionSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  action("正在查找实验记录…", () => findSessions());
});
$("previousSessionsButton").addEventListener("click", () =>
  action("正在载入实验记录…", () => findSessions(Math.max(0, state.offset - 20))),
);
$("nextSessionsButton").addEventListener("click", () =>
  action("正在载入实验记录…", () => findSessions(state.offset + 20)),
);
$("refreshHistoryButton").addEventListener("click", () =>
  action("正在刷新历史…", async () => {
    const history = await loadHistory({ moveFocus: true });
    if (state.uncertainSave) {
      const latest = history?.attempts.at(-1);
      if (
        latest &&
        (latest.attempt_id !== state.attempt?.attempt_id || latest.outcome)
      ) {
        state.uncertainSave = false;
        selectAttempt(latest.response, latest.outcome);
      }
      announce(
        state.uncertainSave
          ? "历史已刷新，暂未确认上次写入。请稍后再次刷新，或在记录列表中重新打开这次实验。"
          : "已在历史中确认上次写入，可继续操作。",
      );
    } else announce("实验记录已更新。");
  }),
);
$("exportHistoryButton").addEventListener("click", exportHistory);
$("knowledgeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  action("正在查找知识…", async () => {
    await browseKnowledge();
    announce($("knowledgeSummary").textContent);
  });
});
$("browseKnowledgeButton").addEventListener("click", () =>
  action("正在浏览全部知识…", async () => {
    $("knowledgeQuery").value = "";
    $("knowledgeExperiment").value = "";
    await browseKnowledge();
    announce($("knowledgeSummary").textContent);
  }),
);
$("refreshHealthButton").addEventListener("click", () =>
  action("正在检查服务…", async () => {
    await refreshHealth();
    announce("服务状态已更新。");
  }),
);
$("reloadKnowledgeButton").addEventListener("click", () =>
  action("正在重新加载知识库…", async () => {
    const result = await request("/api/v1/knowledge/reload", {
      method: "POST",
    });
    await browseKnowledge();
    await refreshHealth();
    announce(`知识库已重新加载，共 ${result.document_count} 条。`);
  }),
);

async function initialize() {
  fillPayload(emptyPayload());
  addExperiment("generic");
  await action("正在恢复上次的实验记录…", async () => {
    // One failed optional read must not suppress other working sections.
    const checks = await Promise.allSettled([
      refreshHealth(),
      browseKnowledge(),
    ]);
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      /* Optional browser storage. */
    }
    const assignedWork = new URLSearchParams(location.search).get('work');
    if (assignedWork) saved = {session_id: assignedWork};
    if (saved?.session_id) {
      try {
        await resumeSession(saved.session_id);
      } catch (error) {
        if (error.httpStatus === 404) {
          resetSession();
          announce("当前账号或浏览器无法打开这条记录。请查看自己的历史记录，或联系老师确认。");
        } else throw error;
      }
    } else {
      if (saved?.student_id) $("studentId").value = saved.student_id;
      if (saved?.experiment_id) {
        addExperiment(saved.experiment_id);
        $("experimentId").value = saved.experiment_id;
        fillPayload(emptyPayload());
      }
      if (saved?.course_id) $("courseId").value = saved.course_id;
      announce("已准备就绪。可以载入样例，或填写自己的实验记录。");
    }
    const failed = checks.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  });
}
initialize().then(() => window.dispatchEvent(new Event("tutor-ready")));
