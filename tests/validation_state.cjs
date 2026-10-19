"use strict";
// Exercise the actual validation renderer without browser automation or network access.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app/static/app.js"), "utf8");
const start = source.indexOf("let validationErrors = [];");
const end = source.indexOf("function invalid(errors)", start);
assert.ok(start > 0 && end > start);
const nodes = [], fields = new Map(), listeners = {};
class Node {
  constructor(tag, text = null, className = "") {
    this.tagName = tag.toUpperCase(); this.textContent = text; this.className = className;
    this.attributes = {}; this.children = []; this.isConnected = true; nodes.push(this);
  }
  append(...children) { this.children.push(...children); children.forEach(child => { child.parent = this; }); }
  replaceChildren(...children) { this.children.forEach(child => { child.isConnected = false; }); this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener() {}
  closest() { return this.view ? {dataset: {view: this.view}} : null; }
  insertAdjacentElement(position, element) { assert.equal(position, "afterend"); element.ownerField = this; }
  remove() { this.isConnected = false; }
  focus() { this.focused = true; }
}
const document = {
  body: {dataset: {page: "experiment"}},
  addEventListener(name, listener) { listeners[name] = listener; },
  querySelectorAll(selector) {
    if (selector === ".field-error") return nodes.filter(n => n.isConnected && n.className === "field-error");
    assert.equal(selector, '[aria-invalid="true"]');
    return [...fields.values()].filter(n => n.getAttribute("aria-invalid") === "true");
  }
};
for (const id of ["errorSummary", "errorList"]) { const item = new Node("div"); item.id = id; fields.set(id, item); }
function field(id, view, value, validity = true) {
  const item = new Node("input"); Object.assign(item, {id, view, value, validity: {valid: validity}, labels: [{textContent: id}]}); fields.set(id, item); return item;
}
const student = field("studentId", "experiment", "", false);
student.setAttribute("aria-describedby", "recordHint");
const result = field("studentResult", "calculation", "25");
const sandbox = {document, window: {}, $: id => fields.get(id), node: (...args) => new Node(...args), announce() {}, focusElement() {}};
vm.runInNewContext(source.slice(start, end), sandbox, {timeout: 1000});
const {window} = sandbox;
window.flowReveal = item => { document.body.dataset.page = item.view; window.reconcileValidationErrors(item.view); };
const show = errors => sandbox.showErrors(errors);
const navigate = page => { document.body.dataset.page = page; window.reconcileValidationErrors(page); };
const summary = fields.get("errorSummary"), list = fields.get("errorList");
const edit = (item, value, valid = true) => { item.value = value; item.validity.valid = valid; listeners.input({target: item}); };

show([{field: "studentId", message: "请先填写用于查找记录的编号。"}]);
assert.equal(summary.hidden, false); assert.equal(student.getAttribute("aria-invalid"), "true");
edit(student, "   ");
assert.equal(summary.hidden, false, "whitespace cannot satisfy the record ID requirement");
edit(student, "learner-19");
assert.equal(summary.hidden, true, "correcting a required ID immediately removes its stale error");
assert.equal(student.getAttribute("aria-invalid"), null);
assert.equal(student.getAttribute("aria-describedby"), "recordHint", "correction must retain the field's helpful description");

navigate("calculation");
show([{field: "studentResult", message: "结果与复算有差异，请核对单位。"}]);
assert.equal(summary.hidden, false);
navigate("data");
assert.equal(summary.hidden, true, "an unresolved calculation error must not follow navigation to data");
assert.equal(result.getAttribute("aria-invalid"), null);
assert.equal(result.value, "25", "navigation cannot change the student's result");
navigate("calculation");
assert.equal(summary.hidden, false, "unresolved errors should return with their owning task");
edit(result, "50");
assert.equal(summary.hidden, false, "editing a server-checked value does not falsely claim the error is resolved");
window.clearFieldValidationErrors("studentResult");
assert.equal(summary.hidden, true);

const confidence = field("anomalyConfidence", "observations", "5", false);
navigate("observations");
show([{field: "anomalyConfidence", message: "置信度须在 0 和 1 之间。"}]);
edit(confidence, "2", false); assert.equal(summary.hidden, false);
edit(confidence, "0.93"); assert.equal(summary.hidden, true, "native validity can verify a corrected range");

navigate("calculation");
edit(student, "", false);
show([{field: "studentId", message: "请填写记录编号。"}]);
assert.equal(document.body.dataset.page, "experiment", "a cross-page submission error reveals the task that can fix it");
assert.equal(summary.hidden, false);
edit(student, "new-learner");
assert.equal(summary.hidden, true);

navigate("history");
show([{message: "服务暂时不可用，请重试。"}]);
navigate("data"); assert.equal(summary.hidden, true);
navigate("history"); assert.equal(summary.hidden, false, "unresolved service errors remain attached to their original task");
show([{field: "unknown-field", message: "无法匹配的字段仍须显示问题。"}]);
assert.equal(summary.hidden, false); assert.equal(list.children.length, 1, "unmatched server paths cannot silently disappear");
const dynamic = field("row-42", "history", "");
show([{field: "row-42", message: "请填写变量名。"}]);
fields.delete(dynamic.id); window.reconcileValidationErrors("history");
assert.equal(summary.hidden, true, "a removed dynamic row no longer has an actionable error");
console.log("Validation state: corrected IDs and ranges, preserved field hints, cross-page errors, navigation recovery, unknown paths and unchanged student data passed.");
