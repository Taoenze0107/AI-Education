"use strict";
(() => {
  // Automatic model calls belong to measured-record work, never resource browsing.
  const autoRecordingAllowed = (stage, lesson) => ["data", "review", "observations", "checks", "calculation", "diagnosis", "revision"].includes(stage) && !["prediction", "transfer"].includes(lesson);
  if (typeof module === "object" && module.exports) module.exports = {autoRecordingAllowed};
  if (typeof document === "undefined") return;
  const get = id => document.getElementById(id);
  const make = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const value = id => get(id)?.value?.trim() || "";
  let status = null, currentKey = "", thread = "", busy = false;
  let revision = 0, feedbackController = null, timer = null, historyEpoch = 0, statusEpoch = 0;
  let lastFeedback = "", lastFeedbackAt = 0, lastContext = null;
  let autoEnabled = false, autoTimer = null, lastAutoAt = 0, statusConnected = false;
  let autoPauseNotice = "";
  let historyPromise = Promise.resolve();
  const autoSeen = new Set();
  const touched = new Set();
  const previousChecks = new Map();
  let selectedContent = null, selectedExperiment = "";
  const root = make("div", null, "lab-tutor");
  root.id = "labTutor";
  // Static markup only. Every student/model string is inserted with textContent below.
  root.innerHTML = `<button type="button" id="tutorToggle" class="tutor-toggle" aria-expanded="false" aria-controls="tutorPanel"><span aria-hidden="true">?</span> 问实验助教</button>
    <aside id="tutorPanel" class="tutor-panel" role="dialog" aria-labelledby="tutorHeading" aria-describedby="tutorContext" hidden>
      <header class="tutor-header"><h2 id="tutorHeading">一起检查这一步。</h2><button type="button" id="tutorClose" class="tutor-close" aria-label="关闭实验助教">×</button></header>
      <div id="tutorBody" class="tutor-body" tabindex="0" aria-label="实验背景、对话与助教设置">
        <p id="tutorContext" class="tutor-context"></p><p id="tutorMode" class="tutor-mode">正在连接助教…</p>
        <div id="tutorMessages" class="tutor-messages" role="log" aria-label="你与实验助教的对话" aria-live="polite" aria-relevant="additions"></div>
        <div class="tutor-prompts" aria-label="常用问题"><button type="button">这一步应该先检查什么？</button><button type="button">这些数据能说明什么？</button><button type="button">为什么要这样换算单位？</button></div>
        <details class="tutor-settings"><summary>助教设置与自动提示</summary><div id="tutorSettings"><label class="tutor-detail-option"><input type="checkbox" id="tutorExplain"> 希望看到更详细的解释或推导</label></div></details>
        <p id="tutorError" class="tutor-error" role="status" hidden></p>
      </div>
      <form id="tutorForm" class="tutor-form"><label for="tutorQuestion">写下你的疑问</label><textarea id="tutorQuestion" rows="2" maxlength="2000" placeholder="例如：结果偏小，先核查哪里？" required></textarea><div class="tutor-compose-actions"><span>结合当前实验与填写内容</span><button type="submit" id="tutorSend">发送问题 →</button></div></form>
    </aside>`;
  document.body.append(root);
  const panel = get("tutorPanel"), messages = get("tutorMessages"), scrollBody = get("tutorBody");
  const selectionBox = make("div", null, "tutor-selected-content");
  selectionBox.id = "tutorSelectedContent"; selectionBox.hidden = true;
  get("tutorContext").after(selectionBox);
  let returnFocus = null, lastExternalTrigger = null;
  const drawerViewport = matchMedia("(max-width:600px), (max-height:480px)");
  const inertBackground = new Map();
  function syncPanelViewport() {
    const modal = !panel.hidden && drawerViewport.matches;
    panel.setAttribute("aria-modal", String(modal));
    document.documentElement.classList.toggle("tutor-drawer-open", modal);
    if (modal) {
      for (const sibling of document.body.children) {
        if (sibling === root || inertBackground.has(sibling)) continue;
        inertBackground.set(sibling, sibling.inert); sibling.inert = true;
      }
    } else {
      for (const [sibling, wasInert] of inertBackground) sibling.inert = wasInert;
      inertBackground.clear();
    }
    const viewport = window.visualViewport;
    if (viewport && modal) {
      panel.style.setProperty("--tutor-viewport-height", `${viewport.height}px`);
      panel.style.setProperty("--tutor-viewport-top", `${viewport.offsetTop}px`);
    } else {
      panel.style.removeProperty("--tutor-viewport-height"); panel.style.removeProperty("--tutor-viewport-top");
    }
  }
  drawerViewport.addEventListener("change", syncPanelViewport);
  window.visualViewport?.addEventListener("resize", syncPanelViewport);
  window.visualViewport?.addEventListener("scroll", syncPanelViewport);
  // Capture the actual opener before lesson handlers dispatch their question event.
  document.addEventListener("click", event => {
    const trigger = event.target?.closest?.('button,a[href],input,select,textarea,[tabindex]');
    if (trigger && !panel.contains(trigger)) lastExternalTrigger = trigger;
  }, true);
  function scrollToLatestMessage() {
    if (panel.hidden || !messages.lastElementChild) return;
    const message = messages.lastElementChild.getBoundingClientRect(), viewport = scrollBody.getBoundingClientRect();
    if (message.bottom > viewport.bottom) scrollBody.scrollTop += message.bottom - viewport.bottom;
  }
  function showError() {
    get("tutorError").hidden = false;
    get("tutorError").scrollIntoView({block: "nearest"});
  }

  async function api(path, data, signal) {
    const response = await fetch("/api/v1/tutor" + path, {
      method: data === undefined ? "GET" : "POST", credentials: "same-origin", signal,
      headers: {Accept: "application/json", ...(data === undefined ? {} : {"Content-Type": "application/json"})},
      ...(data === undefined ? {} : {body: JSON.stringify(data)})
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(typeof body.detail === "string" ? body.detail : "请检查当前内容后再试。");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function context() {
    const errors = [];
    const number = (text, label) => {
      if (text == null || String(text).trim() === "") return null;
      const n = Number(text);
      if (!Number.isFinite(n)) { errors.push(`${label}含无效数值，请核对原始记录。`); return null; }
      return n;
    };
    const numbers = (text, label) => {
      if (!String(text || "").trim()) return [];
      const raw = /[,，;；\n]/.test(text) ? text.split(/[,，;；\n]/) : text.trim().split(/\s+/);
      if (raw.length > 500) errors.push(`${label}超过 500 组，请分批处理。`);
      return raw.slice(0, 500).map(v => number(v.trim(), label));
    };
    const topics = typeof catalogTopics === "undefined" ? [] : catalogTopics;
    const topicPath = location.pathname.match(/^\/experiments\/([a-z0-9_]+)$/);
    const practicePath = location.pathname.match(/^\/practice\/([a-z0-9_-]+)$/);
    let eid = value("experimentId") || "generic", practice = null;
    if (topicPath) eid = topicPath[1];
    if (practicePath) {
      practice = topics.find(t => t.cases.some(c => c.case_id === practicePath[1]));
      eid = practice?.experiment_id || "generic";
    }
    const topic = topics.find(t => t.experiment_id === eid);
    const stage = document.body.dataset.page || "experiment";
    const columns = {}, parameters = {};
    const resource = !!(topicPath || practicePath);
    const raw = !resource && typeof rawLearningValues === "function" ? rawLearningValues() : {};
    if (topic && !resource) {
      for (const c of topic.columns) {
        const field = get(`catalog-${eid}-${c.key}`);
        if (field) columns[c.key] = numbers(field.value, c.label);
        else if (Array.isArray(raw[c.key])) columns[c.key] = raw[c.key].map(v => number(v, c.label));
      }
      for (const p of topic.parameters) {
        const field = get(`catalog-${eid}-${p.key}`);
        parameters[p.key] = number(field ? field.value : raw[p.key], p.label);
      }
    }
    if (!resource && eid === "ohms_law") {
      if (value("quickVoltage") || value("quickCurrent") || touched.has("quickVoltage") || touched.has("quickCurrent")) {
        columns.voltage_V = numbers(value("quickVoltage"), "电压列");
        columns.current_mA = numbers(value("quickCurrent"), "电流列");
      }
    }
    if (!resource && eid === "simple_pendulum") {
      columns.total_time_s = numbers(value("pendulumTimes"), "计时列");
      parameters.length_cm = number(value("pendulumLength"), "摆长");
      parameters.cycles = number(value("pendulumCount"), "周期数");
    }
    if (!resource && eid === "rc_time_constant") {
      columns.time_ms = numbers(value("rcTimes"), "时间列");
      columns.capacitor_voltage_V = numbers(value("rcVoltage"), "电压列");
      parameters.resistance_kohm = number(value("rcResistance"), "电阻");
      parameters.capacitance_uF = number(value("rcCapacitance"), "电容");
      parameters.final_voltage_V = number(value("rcFinalVoltage"), "终值电压");
    }
    const fieldValue = (row, role) => row.querySelector(`[data-role="${role}"]`)?.value || "";
    const variables = {};
    if (!resource && get("includeMath")?.checked) {
      for (const row of [...(get("variableRows")?.children || [])].slice(0, 24)) {
        const key = fieldValue(row, "key").trim();
        if (key) variables[key.slice(0, 100)] = number(fieldValue(row, "value"), key);
      }
    }
    const checks = !resource && get("includeConsistency")?.checked ? [...get("checkRows").children].slice(0, 30).map(row => ({
      name: fieldValue(row, "name").slice(0, 120),
      passed: fieldValue(row, "passed") === "true" ? true : fieldValue(row, "passed") === "false" ? false : null
    })).filter(c => c.name.trim()) : [];
    const session = typeof state === "undefined" ? null : state.session;
    const math = !resource && !!get("includeMath")?.checked;
    return {
      experiment_id: eid, session_id: !resource && session?.experiment_id === eid ? session.session_id : null,
      practice_id: practice ? practicePath[1] : null, stage, columns, parameters,
      parse_errors: errors.slice(0, 12), formula: math ? value("formula").slice(0, 500) : "", variables,
      student_result: math ? number(value("studentResult"), "计算结果") : null,
      tolerance_percent: Math.min(100, Math.max(0, value("tolerance") === "" ? 5 : Number(value("tolerance")) || 0)),
      unit: math ? value("mathUnit").slice(0, 60) : "",
      steps: math ? value("studentSteps").split(/\n/).filter(Boolean).slice(0, 20).map(v => v.slice(0, 1500)) : [],
      explanation: resource ? "" : value("studentExplanation").slice(0, 1500),
      observation: !resource && get("includeAnomaly")?.checked ? value("anomalySummary").slice(0, 1500) : "",
      checks, practice_answers: practice ? [...document.querySelectorAll("#practiceExercises textarea")].slice(0, 3).map(el => el.value.slice(0, 1500)) : [],
      selected_content: selectedExperiment === eid ? selectedContent : null
    };
  }

  function open(trigger = lastExternalTrigger || document.activeElement) {
    if (panel.hidden) returnFocus = trigger && !panel.contains(trigger) ? trigger : get("tutorToggle");
    panel.hidden = false; syncPanelViewport(); get("tutorToggle").setAttribute("aria-expanded", "true");
    refreshContext(); refreshStatus(); get("tutorQuestion").focus({preventScroll: true});
    scrollToLatestMessage();
  }
  function close() {
    panel.hidden = true; syncPanelViewport(); get("tutorToggle").setAttribute("aria-expanded", "false");
    const target = returnFocus?.isConnected && !returnFocus.disabled && returnFocus.getClientRects().length ? returnFocus : get("tutorToggle");
    target.focus({preventScroll: true}); returnFocus = null;
  }
  get("tutorToggle").addEventListener("click", event => panel.hidden ? open(event.currentTarget) : close());
  get("tutorClose").addEventListener("click", close);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); close(); return; }
    if (event.key === "Tab" && !panel.hidden && drawerViewport.matches) {
      const controls = [...panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
  });
  for (const button of root.querySelectorAll(".tutor-prompts button")) button.addEventListener("click", () => { get("tutorQuestion").value = button.textContent; get("tutorQuestion").focus(); });
  function renderSelection() {
    selectionBox.replaceChildren(); selectionBox.hidden = !selectedContent;
    if (!selectedContent) return;
    selectionBox.append(make("strong", "提问将引用：" + selectedContent.label), make("small", "教学仿真 · 与你的实测读数分别解释"));
    const clear = make("button", "取消引用", "plain"); clear.type = "button";
    clear.addEventListener("click", () => { selectedContent = null; selectedExperiment = ""; renderSelection(); });
    selectionBox.append(clear);
  }
  window.addEventListener("lab-academy-question", event => {
    const detail = event.detail;
    if (!detail || detail.experiment_id !== context().experiment_id || !detail.selection) return;
    const selection = detail.selection;
    selectedContent = {kind: String(selection.kind || "simulation_point").slice(0, 40), label: String(selection.label || "当前仿真内容").slice(0, 240), data_source: "teaching_simulation", values: Object.fromEntries(Object.entries(selection.values || {}).slice(0, 24).filter(([key, v]) => key.length > 0 && key.length <= 80 && (typeof v === "string" || typeof v === "number" && Number.isFinite(v))).map(([key, v]) => [key, typeof v === "string" ? v.slice(0, 240) : v]))};
    selectedExperiment = detail.experiment_id; renderSelection(); open(detail.trigger || lastExternalTrigger || document.activeElement);
    get("tutorQuestion").value = String(detail.question || "请解释我选中的这个仿真点，并问我一个自检问题。").slice(0, 2000);
    get("tutorQuestion").focus();
  });

  function richText(holder, text) {
    const pieces = text.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/g);
    for (const piece of pieces) {
      if (/^(\\\(|\\\[|\$\$)/.test(piece) && window.katex) {
        const span = make("span"), block = piece.startsWith("\\[") || piece.startsWith("$$");
        window.katex.render(piece.slice(2, -2), span, {throwOnError: false, trust: false, displayMode: block, maxExpand: 100, strict: "ignore"});
        holder.append(span);
      } else holder.append(document.createTextNode(piece));
    }
  }
  function bubble(role, text) {
    const item = make("article", null, `tutor-message ${role}`);
    item.append(make("strong", role === "student" ? "你" : "实验助教"));
    const content = make("div", null, "tutor-message-text"); richText(content, text); item.append(content); messages.append(item);
    return item;
  }
  function answerBubble(result) {
    const reply = result.reply, item = bubble("assistant", reply.answer);
    if (reply.suggestions.length) { const list = make("ul"); reply.suggestions.forEach(s => list.append(make("li", s))); item.append(list); }
    if (reply.next_question) item.append(make("p", reply.next_question, "tutor-next-question"));
    item.append(make("small", result.mode === "openai" ? "AI · 结合当前实验" : result.notice, "tutor-answer-origin"));
    if (result.citations.length) {
      const details = make("details"), links = make("div"); details.append(make("summary", "参考的课程知识"));
      result.citations.forEach(c => {
        const link = make("a", c.title); link.href = `/library?q=${encodeURIComponent(c.title)}`;
        links.append(link);
      }); details.append(links); item.append(details);
    }
    scrollToLatestMessage();
  }
  async function refreshStatus() {
    const epoch = ++statusEpoch;
    try {
      const next = await api("/status"); if (epoch !== statusEpoch) return;
      if (status && status.scope !== next.scope) { autoEnabled = false; autoPauseNotice = "账号已变更，自动提示已关闭。请按需要重新开启。"; clearTimeout(autoTimer); }
      status = next; statusConnected = true; syncAutoControls(); refreshContext();
    }
    catch (_) {
      if (epoch !== statusEpoch) return;
      statusConnected = false; syncAutoControls();
      get("tutorMode").textContent = "暂时未连接，实验资料仍可继续使用。";
    }
  }

  function autoAvailability() {
    if (!statusConnected) return {ready: false, reason: status ? "暂时无法确认 AI 连接。重新检查连接后再开启；实测数据页的自动检查仍可使用。" : "正在确认 AI 连接，请稍候。", retry: true};
    if (!status?.configured) return {ready: false, reason: "AI 服务尚未启用，暂不能开启自动提示。实测数据页的自动检查和课程资料仍可使用。"};
    if (!status.signed_in) return {ready: false, reason: "请先登录班级账号，再开启 AI 自动提示。实测数据页的自动检查可直接使用。", login: true};
    return {ready: true};
  }

  function syncAutoControls() {
    const availability = autoAvailability();
    if (!availability.ready && autoEnabled) { autoEnabled = false; clearTimeout(autoTimer); }
    document.querySelectorAll(".tutor-auto-controls").forEach(controls => {
      const toggle = controls.querySelector('input[type="checkbox"]');
      toggle.checked = autoEnabled; toggle.disabled = !availability.ready;
      controls.dataset.enabled = String(autoEnabled);
      controls.querySelector(".tutor-auto-state").textContent = autoEnabled ? "已开启" : availability.ready ? "已关闭" : "暂不可用";
      controls.querySelector(".tutor-auto-status").textContent = availability.ready ? (autoEnabled ? "已开启：仅在实测记录步骤暂停录入后给出提示，浏览资料与体验模型不会自动提问。可再次点击方框关闭。" : autoPauseNotice || "已关闭：勾选方框后开启 AI 自动提示。") : availability.reason;
      controls.querySelector(".tutor-auto-login").hidden = !availability.login;
      controls.querySelector(".tutor-auto-retry").hidden = !availability.retry;
    });
  }

  function autoControls(ctx, box) {
    const controls = make("div", null, "tutor-auto-controls");
    const option = make("label", null, "tutor-auto-option"), toggle = make("input");
    const descriptionId = `tutor-auto-status-${ctx.stage}`, limitsId = `tutor-auto-limits-${ctx.stage}`;
    toggle.type = "checkbox"; toggle.id = `tutor-auto-${ctx.stage}`;
    toggle.setAttribute("aria-describedby", `${descriptionId} ${limitsId}`);
    option.append(toggle, make("span", "让 AI 在我暂停录入后给出下一步提示"), make("strong", "", "tutor-auto-state"));
    const description = make("p", null, "tutor-auto-status"); description.id = descriptionId;
    description.setAttribute("role", "status"); description.setAttribute("aria-live", "polite"); description.setAttribute("aria-atomic", "true");
    const login = make("a", "去登录 →", "tutor-auto-login"); login.href = "/classroom"; login.hidden = true;
    const retry = make("button", "重新检查连接", "tutor-auto-retry"); retry.type = "button"; retry.hidden = true;
    retry.addEventListener("click", () => { refreshStatus(); });
    const limits = make("small", "自动提示与主动提问共用每日额度，最多每 20 秒一次；实测数据页的自动检查不消耗 AI 提问额度。", "tutor-auto-note"); limits.id = limitsId;
    controls.append(option, description, login, retry, limits);
    toggle.addEventListener("change", () => {
      // Preserve the native checkbox state in one shared setting, including keyboard changes.
      // Read the current draft so an earlier feedback response cannot schedule stale data.
      const availability = autoAvailability();
      autoEnabled = availability.ready && toggle.checked; autoPauseNotice = ""; clearTimeout(autoTimer);
      syncAutoControls();
      if (autoEnabled) {
        const current = context(), currentBox = document.querySelector(`.tutor-feedback[data-tutor-stage="${current.stage}"]`);
        if (currentBox) scheduleAuto(current, JSON.stringify(current), currentBox);
      }
    });
    return controls;
  }
  function refreshContext() {
    const ctx = context(); lastContext = ctx;
    if (selectedContent && selectedExperiment !== ctx.experiment_id) { selectedContent = null; selectedExperiment = ""; renderSelection(); }
    const topics = typeof catalogTopics === "undefined" ? [] : catalogTopics;
    const title = topics.find(t => t.experiment_id === ctx.experiment_id)?.title || (ctx.experiment_id === "generic" ? "实验学习" : get("experimentId")?.selectedOptions[0]?.textContent || "当前实验");
    get("tutorContext").textContent = `${title} · ${document.querySelector('[data-view="' + ctx.stage + '"] h1')?.textContent || "随时提问"}`;
    if (status) get("tutorMode").textContent = status.configured ? (status.signed_in ? `AI 已连接 · 每账号每天最多 ${status.daily_limit} 次提问` : "登录班级账号后可向 AI 提问；数据检查可直接使用。") : "当前为课程资料模式；AI 服务尚未启用。";
    const key = `${status?.scope || "waiting"}:${ctx.experiment_id}`;
    if (key !== currentKey && status) {
      currentKey = key; thread = ""; messages.replaceChildren();
      try { thread = localStorage.getItem(`at-tutor-thread-${key}`) || ""; } catch (_) {}
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(thread)) {
        thread = crypto.randomUUID();
        try { localStorage.setItem(`at-tutor-thread-${key}`, thread); } catch (_) {}
      }
      const epoch = ++historyEpoch;
      historyPromise = api(`/history?thread_id=${encodeURIComponent(thread)}&experiment_id=${encodeURIComponent(ctx.experiment_id)}`).then(data => {
        if (epoch !== historyEpoch) return;
        messages.replaceChildren();
        if (!data.turns.length) bubble("assistant", "可以问实验原理、读数、单位或计算。我会结合当前步骤，和你一起找出下一项需要核实的地方。");
        for (const turn of data.turns) { bubble("student", turn.message); answerBubble(turn.response); }
      }).catch(() => { if (epoch === historyEpoch) bubble("assistant", "可以从当前疑问开始。暂时未能载入之前的对话。"); });
    }
    document.querySelectorAll(".tutor-feedback").forEach(el => el.hidden = el.dataset.tutorStage !== ctx.stage);
    if (["experiment", "data", "review", "observations", "checks", "calculation", "diagnosis", "revision"].includes(ctx.stage)) {
      let box = document.querySelector(`.tutor-feedback[data-tutor-stage="${ctx.stage}"]`);
      if (!box) {
        box = make("section", null, "tutor-feedback"); box.dataset.tutorStage = ctx.stage;
        box.setAttribute("aria-label", "当前步骤的检查与问题");
      }
      const lesson = ctx.stage === "data" && (window.LabAcademyCourseList || []).some(course => course.experiment_id === ctx.experiment_id);
      const anchor = document.querySelector(ctx.stage === "experiment" ? '[data-view="experiment"] > .card' : lesson ? '[data-view="data"] > .card' : `[data-view="${ctx.stage}"] .page-heading`);
      if (anchor && box.previousElementSibling !== anchor) anchor.after(box);
      scheduleFeedback();
    }
  }

  function focusCheckTarget(target, ctx) {
    let field = null;
    const special = {voltage_V:"quickVoltage", current_mA:"quickCurrent", total_time_s:"pendulumTimes", length_cm:"pendulumLength", cycles:"pendulumCount", time_ms:"rcTimes", capacitor_voltage_V:"rcVoltage", resistance_kohm:"rcResistance", capacitance_uF:"rcCapacitance", final_voltage_V:"rcFinalVoltage"};
    if (target.kind === "field" && ["formula", "mathUnit", "studentResult"].includes(target.key)) field = get(target.key);
    if (["column", "parameter"].includes(target.kind)) {
      field = get(`catalog-${ctx.experiment_id}-${target.key}`) || get(special[target.key]);
      if (!field) {
        const row = [...(get("measurementRows")?.children || [])].find(r => r.querySelector('[data-role="key"]')?.value === target.key);
        field = row?.querySelector('[data-role="value"]');
      }
    }
    if (!field) return;
    if (typeof focusElement === "function") focusElement(field); else field.focus();
    field.scrollIntoView({block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
    if (Number.isInteger(target.index) && field.setSelectionRange) {
      const parts = field.value.split(/[,，;；\n]/), index = target.index;
      if (index >= 0 && index < parts.length) {
        const start = parts.slice(0, index).reduce((n, p) => n + p.length + 1, 0);
        try { field.setSelectionRange(start, start + parts[index].length); } catch (_) {}
      }
    }
  }
  function scheduleFeedback() {
    revision++; clearTimeout(timer); feedbackController?.abort();
    const generation = revision;
    timer = setTimeout(async () => {
      const ctx = context(), fingerprint = JSON.stringify(ctx);
      if (!status || (fingerprint === lastFeedback && Date.now() - lastFeedbackAt < 30000)) return;
      const box = document.querySelector(`.tutor-feedback[data-tutor-stage="${ctx.stage}"]`);
      if (!box || document.hidden) return;
      feedbackController = new AbortController();
      try {
        const response = await api("/feedback", ctx, feedbackController.signal);
        if (generation !== revision || JSON.stringify(context()) !== fingerprint) return;
        box.replaceChildren();
        const title = make("div", null, "tutor-feedback-heading"); title.append(make("h2", "边记录，边检查"), make("span", "自动检查 · 不消耗 AI 提问额度")); box.append(title);
        const list = make("ul", null, "tutor-check-list");
        for (const item of response.items) {
          const li = make("li", null, item.level); li.append(make("strong", item.title), make("p", item.detail));
          if (item.target) {
            const button = make("button", Number.isInteger(item.target.index) ? `定位第 ${item.target.index + 1} 组读数 →` : "定位到需要核对的位置 →", "tutor-check-target");
            button.type = "button"; button.addEventListener("click", () => focusCheckTarget(item.target, ctx)); li.append(button);
          }
          list.append(li);
        }
        box.append(list, make("p", response.next_question, "tutor-step-question"));
        const checkKey = ctx.experiment_id + ":" + ctx.stage;
        const pending = response.items.filter(i => ["warning", "pending"].includes(i.level)).map(i => i.title);
        const cleared = (previousChecks.get(checkKey) || []).filter(t => !pending.includes(t));
        if (cleared.length) box.append(make("p", "本次检查不再提示：" + cleared.join("、") + "。仍需核实原始记录与实验条件。", "tutor-check-cleared"));
        previousChecks.set(checkKey, pending);
        syncAutoControls();
        const ask = make("button", "问助教：这一步怎么检查 →", "tutor-inline-ask"); ask.type = "button"; ask.addEventListener("click", () => { open(ask); get("tutorQuestion").value = "请结合我当前的步骤和数据，帮我找出下一项需要检查的问题。"; }); box.append(ask);
        lastFeedback = fingerprint; lastFeedbackAt = Date.now();
        scheduleAuto(ctx, fingerprint, box);
      } catch (error) {
        if (error.name !== "AbortError" && generation === revision) {
          box.replaceChildren(make("p", error.status === 429 ? "已暂停自动检查，稍后继续。你仍可填写实验记录。" : "暂时无法获取自动检查。请保留原始读数，可继续填写。", "tutor-check-error"));
          lastFeedback = fingerprint; lastFeedbackAt = Date.now();
        }
      }
    }, 1100);
  }

  function autoRecordingTarget(ctx, box) {
    return autoRecordingAllowed(ctx.stage, new URLSearchParams(location.search).get("lesson")) && !!box?.isConnected && !box.hidden && box.dataset.tutorStage === ctx.stage;
  }
  function scheduleAuto(ctx, fingerprint, box) {
    clearTimeout(autoTimer);
    if (!autoRecordingTarget(ctx, box) || !autoEnabled || !autoAvailability().ready || autoSeen.has(fingerprint) || ctx.selected_content) return;
    autoTimer = setTimeout(async () => {
      if (!autoRecordingTarget(ctx, box) || !autoEnabled || busy || document.hidden || JSON.stringify(context()) !== fingerprint) return;
      await refreshStatus(); await historyPromise;
      if (!autoRecordingTarget(ctx, box) || !autoEnabled || busy || !autoAvailability().ready || JSON.stringify(context()) !== fingerprint) return;
      autoSeen.add(fingerprint); lastAutoAt = Date.now(); busy = true;
      get("tutorSend").disabled = true; get("tutorSend").textContent = "正在检查…";
      const key = currentKey;
      const note = make("div", "AI 正在结合这一步检查…", "tutor-auto-reply"); note.setAttribute("role", "status"); box.append(note);
      try {
        const question = "请结合我刚刚填写的内容，指出当前最需要核实的一项问题，给一个可操作的提示，并问我一个下一步问题。不要直接给完整答案。";
        const result = await api("/chat", {thread_id: thread, message: question, context: ctx, explain_more: false});
        if (currentKey === key) { bubble("student", "请帮我检查刚刚填写的这一步。"); answerBubble(result); }
        if (JSON.stringify(context()) === fingerprint && note.isConnected) {
          note.replaceChildren(make("strong", result.mode === "openai" ? "AI 随行提示" : "课程资料提示"));
          const text = make("p"); richText(text, result.reply.answer); note.append(text, make("p", result.reply.next_question), make("small", result.notice));
        }
        if (result.mode !== "openai") { autoEnabled = false; autoPauseNotice = "AI 暂未返回模型回答，已关闭自动提示。你仍可使用课程资料或主动提问。"; syncAutoControls(); }
      } catch (error) {
        if (note.isConnected) note.textContent = error.message || "暂未取得提示，可继续录入或主动提问。";
        if (error.status === 429 || error.status === 401) {
          autoEnabled = false;
          if (error.status === 401 && status) status = {...status, signed_in: false};
          autoPauseNotice = error.status === 429 ? "请求或每日额度达到限制，自动提示已关闭。实测数据页的自动检查仍可使用。" : "登录状态已失效，自动提示已关闭。请重新登录。";
          syncAutoControls();
        }
      } finally { busy = false; get("tutorSend").disabled = false; get("tutorSend").textContent = "发送问题 →"; }
    }, Math.max(1800, 20000 - (Date.now() - lastAutoAt)));
  }

  get("tutorForm").addEventListener("submit", async event => {
    event.preventDefault();
    const question = value("tutorQuestion"); if (!question || busy) return;
    get("tutorError").hidden = true;
    // Initial public requests may establish an anonymous cookie concurrently.
    // Re-resolve the actual owner before choosing the persistent chat thread.
    await refreshStatus(); await historyPromise;
    if (busy) return;
    if (!status) { get("tutorError").textContent = "连接尚未就绪，请稍后重试。"; showError(); refreshStatus(); return; }
    if (status.configured && !status.signed_in) {
      get("tutorError").replaceChildren(document.createTextNode("请先登录班级账号，再向 AI 提问。"));
      const link = make("a", "去登录 →"); link.href = "/classroom"; get("tutorError").append(link); showError(); return;
    }
    const ctx = context(), key = currentKey;
    busy = true; get("tutorSend").disabled = true; get("tutorSend").textContent = "正在检查…"; messages.setAttribute("aria-busy", "true");
    bubble("student", question); get("tutorQuestion").value = "";
    try {
      const result = await api("/chat", {thread_id: thread, message: question, context: ctx, explain_more: get("tutorExplain").checked});
      if (currentKey === key) answerBubble(result);
    } catch (error) {
      if (currentKey === key) {
        get("tutorError").textContent = error.message || "回复暂未取得，请稍后检查对话记录再重试。";
        showError();
        if (!value("tutorQuestion")) get("tutorQuestion").value = question;
      }
    } finally { busy = false; get("tutorSend").disabled = false; get("tutorSend").textContent = "发送问题 →"; messages.removeAttribute("aria-busy"); }
  });
  document.addEventListener("input", event => {
    if (root.contains(event.target) || event.target.closest(".tutor-feedback,#academyRoot,.learning-review")) return;
    clearTimeout(autoTimer);
    if (event.target.id) touched.add(event.target.id);
    refreshContext();
  });
  document.addEventListener("change", event => { if (!root.contains(event.target) && !event.target.closest(".tutor-feedback,#academyRoot,.learning-review")) refreshContext(); });
  document.addEventListener("click", event => { if (!root.contains(event.target) && !event.target.closest(".tutor-feedback,#academyRoot,.learning-review")) setTimeout(refreshContext, 0); });
  new MutationObserver(refreshContext).observe(document.body, {attributes: true, attributeFilter: ["data-page"]});
  window.addEventListener("tutor-ready", refreshContext);
  window.addEventListener("lab-account-changed", () => { autoEnabled = false; autoPauseNotice = ""; statusConnected = false; clearTimeout(autoTimer); syncAutoControls(); historyEpoch++; messages.replaceChildren(); currentKey = ""; previousChecks.clear(); selectedContent = null; selectedExperiment = ""; renderSelection(); refreshStatus(); });
  window.addEventListener("focus", refreshStatus);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshStatus(); });
  get("tutorSettings").append(autoControls({stage: "panel"}, get("tutorSettings")));
  refreshStatus();
})();
