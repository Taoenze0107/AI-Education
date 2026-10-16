"use strict";
(() => {
  const courseList = () => window.LabAcademyCourseList || [];
  const make = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  let epoch = 0, loadedAt = 0, busy = false, filter = "due", data = null;
  const view = document.querySelector('[data-view="history"]');
  if (!view) return;
  const root = make("section", null, "learning-review");
  root.id = "learningReview"; root.setAttribute("aria-labelledby", "learningReviewHeading");
  view.querySelector(".page-heading").after(root);

  window.startAcademyExperiment = (eid, nodeId) => {
    if (!courseList().some(course => course.experiment_id === eid) || (typeof state !== "undefined" && state.busy)) return;
    const path = "/data" + (["prediction", "transfer"].includes(nodeId) ? "?lesson=" + nodeId : "");
    if (document.getElementById("experimentId")?.value === eid) { goPage(path); return; }
    const topic = typeof catalogTopic === "function" ? catalogTopic(eid) : null;
    if (!topic) { goPage("/experiments/" + eid); return; }
    catalogReplaceDraft(() => { catalogStartTopic(topic); goPage(path); });
  };
  function start(text, eid, nodeId, cls) {
    const button = make("button", text, cls); button.type = "button";
    button.addEventListener("click", () => window.startAcademyExperiment(eid, nodeId));
    return button;
  }
  function render() {
    root.replaceChildren();
    const heading = make("div", null, "learning-review-heading");
    const text = make("div"); text.append(make("p", "REFLECT & REVISIT", "eyebrow"));
    const h = make("h2", "从上次的问题继续。"); h.id = "learningReviewHeading";
    text.append(h, make("p", "回看自检中需要帮助的地方，再用一个问题验证理解。", "hint"));
    const refresh = make("button", busy ? "正在载入…" : "刷新复习安排", "secondary");
    refresh.type = "button"; refresh.disabled = busy; refresh.addEventListener("click", () => load(true));
    heading.append(text, refresh); root.append(heading);
    if (!data) {
      root.append(make("p", busy ? "正在查找你的课程自检记录…" : "复习记录暂时无法载入。原有实验记录仍可继续查看。", "hint"));
      return;
    }
    const due = data.items.filter(i => i.status !== "scheduled");
    const stats = make("div", null, "learning-review-stats");
    for (const [label, count] of [["需要重试", data.summary.needs_retry || 0], ["到期复习", data.summary.review_due || 0], ["已安排回顾", data.summary.scheduled || 0]]) {
      const item = make("div"); item.append(make("strong", count), make("span", label)); stats.append(item);
    }
    root.append(stats);
    const controls = make("div", null, "learning-review-filters");
    for (const [key, label] of [["due", `待复习（${due.length}）`], ["all", "全部自检记录"]]) {
      const b = make("button", label, "plain"); b.type = "button"; b.setAttribute("aria-pressed", String(filter === key));
      b.addEventListener("click", () => { filter = key; render(); }); controls.append(b);
    }
    root.append(controls);
    const items = filter === "all" ? data.items : due;
    if (!items.length) root.append(make("p", data.items.length ? "目前没有到期项目。可以回顾已完成的自检，或继续录入实测数据。" : "还没有课程自检记录。从下面任一交互实验开始，回答后会形成复习安排。", "learning-review-empty"));
    const list = make("div", null, "learning-review-list");
    for (const item of items) {
      const card = make("article", null, "learning-review-item");
      const status = item.status === "needs_retry" ? "需要再试一次" : item.status === "review_due" ? "到了回顾时间" : item.assisted ? "提示后答对 · 已安排复习" : "本题独立答对 · 已安排复习";
      card.append(make("small", `${item.title} · ${item.tag}`, "learning-review-topic"), make("h3", item.question), make("p", status, "learning-review-status"));
      if (item.due_at && item.status === "scheduled") card.append(make("p", "下次回顾：" + new Date(item.due_at).toLocaleString("zh-CN", {month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"}), "hint"));
      card.append(start(item.status === "scheduled" ? "回看解释 →" : "用一道题再检查 →", item.experiment_id, item.node_id, "secondary"));
      list.append(card);
    }
    root.append(list);
    const directory = make("details", null, "learning-review-directory");
    directory.open = !data.items.length;
    directory.append(make("summary", `继续交互实验（${courseList().length} 门）`));
    const courses = make("div", null, "learning-review-courses");
    for (const course of courseList()) courses.append(start(course.title + " →", course.experiment_id));
    directory.append(courses);
    root.append(directory, make("p", "这里记录的是概念自检表现；填写完成、提示后答对和独立答对分别保留，不作为实验成绩或掌握全部知识的证明。", "hint"));
  }
  async function load(force = false) {
    if (!window.tutorReady || document.body.dataset.page !== "history" || busy || (!force && Date.now() - loadedAt < 30000)) return;
    busy = true; const generation = ++epoch; render();
    try {
      const response = await fetch("/api/v1/learning/review", {credentials: "same-origin", headers: {Accept: "application/json"}});
      if (!response.ok) throw new Error("review unavailable");
      const result = await response.json();
      if (generation !== epoch) return;
      data = result; loadedAt = Date.now();
    } catch (_) { if (generation === epoch) data = null; }
    finally { if (generation === epoch) { busy = false; render(); } }
  }
  window.refreshLearningReview = () => load();
  window.addEventListener("lab-learning-updated", () => { loadedAt = 0; load(); });
  window.addEventListener("lab-account-changed", () => { epoch++; busy = false; data = null; loadedAt = 0; render(); load(true); });
  window.addEventListener("tutor-ready", () => load());
  render(); load();
})();
