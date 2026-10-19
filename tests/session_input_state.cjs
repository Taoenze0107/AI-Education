"use strict";
// Execute the application's restore/write/context functions with inert DOM fields.
// This regression uses no browser, network, real database or model service.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app/static/app.js"), "utf8");
const tutor = fs.readFileSync(path.join(__dirname, "../app/static/tutor.js"), "utf8");
const guide = fs.readFileSync(path.join(__dirname, "../app/static/guide.js"), "utf8");
const flow = fs.readFileSync(path.join(__dirname, "../app/static/flow.js"), "utf8");
function section(text, first, next) {
  const start = text.indexOf(first), end = text.indexOf(next, start);
  assert.ok(start >= 0 && end > start, `source section ${first} exists`);
  return text.slice(start, end);
}
const plain = value => JSON.parse(JSON.stringify(value));
const fields = new Map();
function $(id) {
  if (!fields.has(id)) {
    let value = "";
    const field = {id, children: [], checked: false, hidden: false, textContent: "", tagName: id === "csvRunSelect" ? "SELECT" : "INPUT", type: "text",
      replaceChildren(...children) { this.children = children; children.forEach(child => { child.parent = this; }); if (this.tagName === "SELECT") this.value = children[0]?.value || ""; },
      contains(child) { return this.children.some(row => row === child || Object.values(row.fields || {}).includes(child)); },
      closest() { return null; }};
    Object.defineProperty(field, "value", {get() { return value; }, set(next) { value = String(next); }});
    fields.set(id, field);
  }
  return fields.get(id);
}
function row(containerId, values) {
  const element = {fields: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {value: String(value), dataset: {role: key}, validity: {badInput: false}}])),
    querySelector(selector) { return this.fields[selector.match(/data-role="([^"]+)"/)[1]]; },
    querySelectorAll() { return Object.values(this.fields); },
    remove() { const container = $(containerId); container.children = container.children.filter(child => child !== this); }};
  $(containerId).children.push(element);
  return element;
}
const calls = [], snapshots = [];
let history;
const env = {
  $, get: id => fields.get(id), clone: plain, pretty: value => JSON.stringify(value, null, 2), sourceVisibility() {},
  addKeyValue(id, key, value) { return row(id, {key, kind: Array.isArray(value) && value.every(item => typeof item === "number") ? "list" : value !== null && typeof value === "object" || value === null ? "json" : typeof value, value: Array.isArray(value) && value.every(item => typeof item === "number") ? value.join(", ") : value !== null && typeof value === "object" || value === null ? JSON.stringify(value) : value}); },
  addVariable(key, value) { return row("variableRows", {key, value}); },
  addCheck(check) { return row("checkRows", {name: check.name, passed: check.passed ?? ""}); },
  valueType(value) { return Array.isArray(value) && value.every(item => typeof item === "number") ? "list" : value !== null && typeof value === "object" || value === null ? "json" : typeof value; },
  invalid(errors) { const error = new Error(JSON.stringify(errors)); error.fields = errors; throw error; },
  window: {refreshLearning(options) { if (options.hydrate) env.hydrateSpecialInputs(); }, refreshAcademy() {}, refreshCatalog() {}},
  state: {session: null, mode: "guided"},
  touched: new Set(), selectedExperiment: "", selectedContent: null,
  catalogTopics: [{experiment_id: "ohms_law", columns: [{key: "voltage_V", label: "电压"}, {key: "current_mA", label: "电流"}], parameters: []}],
  location: {pathname: "/data"},
  document: {body: {dataset: {page: "data"}}, querySelectorAll() { return [...fields.values()]; }},
  importedMaterialFile: null, importedCsvRuns: new Map(), lastCharts: null,
  DYNAMIC_ROWS: ["variableRows", "checkRows", "measurementRows", "metadataRows"],
  btoa: text => Buffer.from(text, "binary").toString("base64"),
  announce() {}, focusElement() {}, clearOutcome() {},
  resetSession() { env.state.session = null; },
  addExperiment() {}, sessionLabel() {}, persist() {},
  renderHistory() {}, selectAttempt(response, outcome) { snapshots.push({response, outcome}); },
  applyPcEvidence() {}, renderMaterialCharts(charts) { env.lastCharts = charts; },
  percent: value => String(value),
  node(tag, text) { return {tagName: tag.toUpperCase(), textContent: text, value: ""}; },
  async request(url, options) {
    calls.push({url, body: options?.body ? JSON.parse(options.body) : null});
    if (url.includes("/history")) return history;
    if (url === "/api/v1/anomaly/import") {
      const csv = Buffer.from(calls.at(-1).body.content_base64, "base64").toString("utf8");
      const records = csv.trim().split("\n").slice(1).map(line => line.split(","));
      return {runs: [{run_id: "manual", voltage_V: records.map(record => Number(record[1])), current_mA: records.map(record => Number(record[2])), metadata: records[0][3] ? {expected_resistance_ohm: Number(records[0][3])} : {}}]};
    }
    if (url === "/api/v1/materials/analyze") return {run_id: "manual", charts: {scatter: []}};
    throw new Error(`unexpected request: ${url}`);
  }
};
env.value = id => fields.get(id)?.value.trim() || "";
vm.createContext(env);
vm.runInContext(section(source, "function setKeyValue(", "function parseCsv("), env);
vm.runInContext(section(source, "function fillFromCsvRun(", "function downloadCsvTemplate("), env);
vm.runInContext(section(source, "function fillPayload(payload)", "function guidedPayload("), env);
vm.runInContext(section(guide, "function rawLearningValues(", "function learningProgress("), env);
vm.runInContext(section(guide, "function hydrateSpecialInputs(", "function restoreSpecialChart("), env);
vm.runInContext(section(tutor, "  function context() {", "  function open("), env);
vm.runInContext(section(source, "function setSession(", "async function ensureSession("), env);
vm.runInContext(section(source, "async function resumeSession(", "async function findSessions("), env);
vm.runInContext(section(source, "async function runFullMaterialAnalysis(", "function parsePayload("), env);
vm.runInContext(section(flow, "function captureDraft(", "function saveDraft("), env);
const raw = () => plain(env.readKeyValues("measurementRows", []));
const metadata = () => plain(env.readKeyValues("metadataRows", []));
const payload = (voltage, current, resistance) => ({
  anomaly: null, consistency: null,
  mathematics: {formula: "R = U / I", variables: {U: voltage.at(-1), I: current.at(-1) / 1000}, student_result: resistance, reference_result: resistance, unit: "Ω", tolerance_percent: 5, student_steps: ["将电流 mA 换算为 A 后代入公式"]},
  raw_measurements: {voltage_V: voltage, current_mA: current},
  metadata: resistance == null ? {} : {expected_resistance_ohm: resistance}, student_explanation: "保留本轮说明"
});
function oldImport() {
  $("quickVoltage").value = "1, 2, 3"; $("quickCurrent").value = "4, 8, 12"; $("quickResistance").value = "250";
  env.importedMaterialFile = {filename: "A.xlsx", content_base64: "old-A"};
  env.importedCsvRuns = new Map([["A-run", {voltage_V: [1, 2, 3], current_mA: [4, 8, 12]}]]);
  $("csvFile").value = "A.xlsx";
  $("csvRunSelect").replaceChildren({value: "A-run"}); $("csvRunSelect").value = "A-run";
  $("csvRunFields").hidden = false;
  $("csvImportStatus").textContent = "已导入 A.xlsx"; $("materialAnalysisStatus").textContent = "A 已分析";
  $("materialCharts").replaceChildren({textContent: "A 图表"}); $("materialCharts").hidden = false;
  $("catalogAnalysisCache").value = "A 缓存"; env.lastCharts = {session: "A"};
}
function assertImportCleared() {
  assert.equal(env.importedMaterialFile, null);
  assert.equal(env.importedCsvRuns.size, 0);
  assert.equal($("csvFile").value, "");
  assert.equal($("csvRunSelect").children.length, 0);
  assert.equal($("csvRunFields").hidden, true);
  assert.equal($("materialAnalysisStatus").textContent, "");
  assert.equal($("materialCharts").hidden, true);
  assert.equal($("materialCharts").children.length, 0);
  assert.equal($("catalogAnalysisCache").value, "");
  assert.equal(env.lastCharts, null);
}
(async () => {
  const A = payload([1, 2, 3], [4, 8, 12], 250);
  const B = payload([2, 4, 6], [2, 4, 6], 1000);
  $("experimentId").value = "ohms_law"; $("studentId").value = "student-A";
  env.state.session = {session_id: "session-A", experiment_id: "ohms_law"};
  env.fillPayload(A); oldImport();
  history = {session: {session_id: "session-B", experiment_id: "ohms_law", student_id: "student-B", course_id: "course-B"}, attempts: [{request: B, response: {attempt_id: "attempt-B"}, outcome: null}], summary: {attempt_count: 1}};
  await env.resumeSession("session-B");
  assert.deepEqual(raw(), B.raw_measurements, "history B owns the authoritative raw readings");
  assert.equal($("quickVoltage").value, "2, 4, 6");
  assert.equal($("quickCurrent").value, "2, 4, 6", "raw currents remain mA, never preconverted to A");
  assert.equal($("quickResistance").value, "1000", "reference resistance is restored in ohms");
  assert.equal($("studentResult").value, "1000");
  assert.deepEqual(plain(env.namedLearningVariables()), {U: 6, I: 0.006}, "calculation variables retain their A conversion");
  assert.equal($("studentExplanation").value, "保留本轮说明");
  assert.equal(env.state.session.session_id, "session-B"); assert.equal($("studentId").value, "student-B");
  assert.equal($("courseId").value, "course-B"); assert.equal($("sessionStudentId").value, "student-B");
  assertImportCleared();
  const ctx = plain(env.context());
  assert.equal(ctx.session_id, "session-B");
  assert.deepEqual(ctx.columns, B.raw_measurements, "tutor context must read B rather than A's hidden shortcut controls");
  assert.deepEqual(ctx.variables, {U: 6, I: 0.006});
  const draft = plain(env.captureDraft());
  assert.equal(draft.sessionId, "session-B");
  assert.equal(draft.fields.quickCurrent.value, "2, 4, 6");
  assert.equal(draft.file, null); assert.deepEqual(draft.runs, []);
  await assert.rejects(env.runFullMaterialAnalysis(), error => error.fields[0].field === "csvFile", "restored history cannot silently reanalyse A's old upload");
  const beforeRunSwitch = plain(raw()); env.fillFromCsvRun();
  assert.deepEqual(raw(), beforeRunSwitch, "the previous run selector cannot overwrite B after restore");

  // Repeating the UI's write -> import -> analyse path must generate B's CSV only.
  env.fillQuickMeasurements();
  assert.deepEqual(raw(), B.raw_measurements);
  assert.deepEqual(metadata(), B.metadata);
  const csv = "run_id,voltage_V,current_mA,expected_resistance_ohm\n" + B.raw_measurements.voltage_V.map((value, i) => `manual,${value},${B.raw_measurements.current_mA[i]},${$("quickResistance").value}`).join("\n");
  await env.importCsvFile({name: "manual_measurements.csv", arrayBuffer: async () => Uint8Array.from(Buffer.from(csv)).buffer});
  await env.runFullMaterialAnalysis();
  const imported = calls.find(call => call.url === "/api/v1/anomaly/import");
  assert.equal(Buffer.from(imported.body.content_base64, "base64").toString("utf8"), csv);
  assert.equal(calls.at(-1).body.content_base64, imported.body.content_base64);
  assert.equal(calls.at(-1).body.run_id, "manual");
  assert.equal(calls.at(-1).body.student_result, 1000);
  assert.deepEqual(raw(), B.raw_measurements);

  // Clearing the optional reference must also remove the old metadata value.
  $("quickResistance").value = ""; $("quickVoltage").value = "2，4，6"; $("quickCurrent").value = "2，4，6";
  setExtraMetadata(); env.fillQuickMeasurements();
  assert.equal($("quickResistance").value, "");
  assert.equal(metadata().expected_resistance_ohm, undefined);
  assert.equal(metadata().apparatus, "instrument-B", "unrelated metadata is preserved");
  assert.equal(env.importedMaterialFile, null, "manual edits invalidate older upload provenance");
  assert.deepEqual(raw(), B.raw_measurements, "supported punctuation is normalized before CSV generation");

  oldImport(); const beforeInvalid = plain(raw()); $("quickCurrent").value = "2, invalid, 6";
  assert.throws(env.fillQuickMeasurements);
  assert.deepEqual(raw(), beforeInvalid, "invalid input cannot discard the committed readings");
  assert.equal(env.importedMaterialFile.filename, "A.xlsx", "validation failure does not clear the previous valid import prematurely");

  env.importedCsvRuns.set("B-no-reference", {...B.raw_measurements, metadata: {}});
  $("csvRunSelect").value = "B-no-reference"; env.fillFromCsvRun();
  assert.deepEqual(raw(), B.raw_measurements);
  assert.equal($("quickResistance").value, ""); assert.equal(metadata().expected_resistance_ohm, undefined);
  assert.equal(env.lastCharts, null); assert.equal($("materialAnalysisStatus").textContent, "");
  assert.equal(env.importedMaterialFile.filename, "A.xlsx", "switching runs retains the current multi-run upload while invalidating its old chart");

  env.fillPayload({anomaly: null, consistency: null, mathematics: null, raw_measurements: {}, metadata: {}});
  assertImportCleared(); assert.deepEqual(raw(), {}); assert.deepEqual(metadata(), {});
  for (const id of ["quickVoltage", "quickCurrent", "quickResistance"]) assert.equal($(id).value, "", "clear evidence clears shortcut projections");
  assert.deepEqual(plain(env.context()).columns, {});
  env.touched.add("quickCurrent");
  assert.deepEqual(plain(env.context()).columns, {voltage_V: [], current_mA: []}, "previously touched shortcut inputs cannot leak cleared readings");

  const incomplete = {...B, raw_measurements: {voltage_V: [2, 4, 6], current_mA: [2, null, 6]}};
  env.fillPayload(incomplete);
  assert.equal($("quickCurrent").value, "2, , 6");
  assert.deepEqual(plain(env.context()).columns.current_mA, [2, null, 6], "missing readings stay missing rather than turning into a zero or A's old value");
  assert.deepEqual(raw(), incomplete.raw_measurements);

  // Restoring another experiment keeps its own raw readings/units and clears only Ohm projections.
  $("experimentId").value = "rc_time_constant";
  const rc = {anomaly: null, consistency: null, mathematics: {variables: {R: 10000, C: 0.000001}}, raw_measurements: {time_ms: [0, 5, 10], capacitor_voltage_V: [0, 1.9, 3.2], resistance_ohm: 10000, capacitance_F: 0.000001, final_voltage_V: 5}, metadata: {source: "manual-entry"}};
  env.fillPayload(rc);
  assert.deepEqual(raw(), rc.raw_measurements);
  assert.equal($("rcResistance").value, "10"); assert.equal($("rcCapacitance").value, "1");
  assert.equal($("rcTimes").value, "0, 5, 10");
  for (const id of ["quickVoltage", "quickCurrent", "quickResistance"]) assert.equal($(id).value, "");
  assert.equal(plain(env.context()).experiment_id, "rc_time_constant");
  assert.equal(plain(env.context()).parameters.resistance_kohm, 10);
  assert.equal(plain(env.context()).session_id, null, "a different experiment cannot inherit the prior session identity");
  console.log("Session input state passed: A→B restore, original V/mA and calculation A, Ω reference, tutor B context, draft B, fresh manual analysis, removed optional reference, invalid-input recovery, cleared import/run/charts, and RC hydration.");
})();
function setExtraMetadata() { env.setKeyValue("metadataRows", "apparatus", "instrument-B"); }
