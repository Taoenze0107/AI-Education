"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const models = require("../app/static/academy.js");
const moduleNames = ["academy-motion-electric.js", "academy-motion-optics.js", "academy-motion-matter.js"];
const specs = {};
for (const file of moduleNames) {
  const values = require(path.join(__dirname, "../app/static", file));
  for (const [id, spec] of Object.entries(values)) { assert.ok(!Object.hasOwn(specs, id), `duplicate process module ${id}`); specs[id] = spec; }
}
assert.equal(Object.keys(specs).length, 15, "all fifteen formerly static lessons need process modules");

// Read the real course defaults, stopping before the page builds any DOM or starts a clock.
const core = fs.readFileSync(path.join(__dirname, "../app/static/academy.js"), "utf8"), metadataBoundary = core.indexOf("  window.LabAcademyCourseList =");
assert.ok(metadataBoundary > 0);
const sandbox = {window: {LabAcademyAnimationModules: specs}, document: {}, module: {exports: {}}};
vm.runInNewContext(core.slice(0, metadataBoundary) + "\n globalThis.courseDefaults = supported;\n})();", sandbox, {timeout: 1000});
const courses = sandbox.courseDefaults;
const originalAnimated = ["simple_pendulum", "hookes_law", "spring_oscillation", "uniform_acceleration", "newtons_second_law", "free_fall", "work_energy", "centripetal_force", "kinetic_friction", "damped_oscillation", "sound_resonance", "capacitor_discharge"];
assert.equal(Object.keys(courses).length, 27); assert.equal(originalAnimated.length + Object.keys(specs).length, 27);
assert.deepEqual([...originalAnimated, ...Object.keys(specs)].sort(), Object.keys(courses).sort());

// Tiny SVG data nodes let us test mount/paint contracts without browser access, timers or network calls.
class SvgNode {
  constructor(tag, values = {}, value = "") { this.tag = tag; this.attributes = {...values}; this.children = []; this.textContent = value; this.dataset = {}; this.classList = {add: (...names) => { this.attributes.class = [this.attributes.class || "", ...names].join(" ").trim(); }}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] == null ? null : String(this.attributes[key]); }
  matches(selector) {
    if (selector.startsWith("#")) return this.attributes.id === selector.slice(1);
    const attribute = selector.match(/^\[([a-zA-Z0-9_-]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
    if (attribute) return Object.hasOwn(this.attributes, attribute[1]) && (attribute[2] === undefined || String(this.attributes[attribute[1]]) === attribute[2]);
    if (selector.startsWith(".")) return String(this.attributes.class || "").split(/\s+/).includes(selector.slice(1));
    assert.match(selector, /^[a-zA-Z0-9_-]+$/); return this.tag === selector;
  }
  querySelectorAll(selector) {
    const found = [], visit = element => { if (element.matches(selector)) found.push(element); element.children.forEach(visit); };
    this.children.forEach(visit); return found;
  }
  querySelector(selector) {
    const found = this.matches(selector) ? this : this.querySelectorAll(selector)[0];
    assert.ok(found, `paint selector ${selector} must exist inside its current stage`); return found;
  }
}
const countNodes = node => 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
const geometryKeys = new Set(["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "transform", "opacity", "visibility"]);
const geometry = node => JSON.stringify([Object.entries(node.attributes).filter(([key]) => geometryKeys.has(key)), node.children.map(geometry)]);
const checkSvg = node => {
  for (const [key, value] of Object.entries(node.attributes)) {
    assert.ok(!/NaN|Infinity/.test(String(value)), `invalid ${key} in SVG: ${value}`);
    if (["width", "height", "r", "rx", "ry"].includes(key)) assert.ok(Number(value) >= 0);
  }
  node.children.forEach(checkSvg);
};
const checkData = item => {
  if (item === null || typeof item === "string" || typeof item === "boolean") return;
  if (typeof item === "number") { assert.ok(Number.isFinite(item), `sample must remain finite: ${item}`); return; }
  assert.equal(typeof item, "object"); Object.values(item).forEach(checkData);
};
const formatter = value => String(Number(value.toPrecision(4)));
for (const [id, spec] of Object.entries(specs)) {
  assert.ok(courses[id], `${id} must correspond to a catalog course`);
  const params = Object.freeze({...courses[id].initial}), before = JSON.stringify(params), state = Object.freeze({params}), readings = new SvgNode("div");
  const ctx = {state, params, models, number: formatter, readings, chart: new SvgNode("svg"), svgEl: (tag, values = {}, value) => new SvgNode(tag, values, value), schematic: (label, height) => new SvgNode("svg", {viewBox: `0 0 600 ${height}`, "aria-label": label}), newSvg: (label, height = 300) => new SvgNode("svg", {viewBox: `0 0 600 ${height}`, "aria-label": label}), reading: (parent, label, value) => parent.append(new SvgNode("span", {}, `${label}: ${value}`))};
  const drawing = spec.mount(ctx); assert.equal(drawing.tag, "svg", `${id} mount must return SVG`); ctx.stage = drawing;
  const initialCount = countNodes(drawing), frames = new Set();
  for (const progress of [0, .03, .17, .33, .57, .83, 1]) {
    const sample = spec.sample(params, progress, models); checkData(sample); spec.paint(ctx, sample); checkSvg(drawing);
    assert.equal(countNodes(drawing), initialCount, `${id} must reuse its mounted nodes`);
    frames.add(geometry(drawing));
    const readout = spec.readout(sample, params, formatter); assert.equal(typeof readout, "string"); assert.ok(!/NaN|Infinity|undefined/.test(readout));
    if (sample.cursor) {
      const cursor = sample.cursor; assert.ok(cursor.maxX > 0 && cursor.maxY > 0);
      assert.ok(cursor.x >= -1e-9 && cursor.x <= cursor.maxX + 1e-9, `${id} cursor x is outside its chart`);
      assert.ok(cursor.y >= -1e-9 && cursor.y <= cursor.maxY + 1e-9, `${id} cursor y is outside its chart`);
    }
  }
  assert.ok(frames.size > 1, `${id} geometry must change over time with parameters fixed`);
  assert.equal(JSON.stringify(params), before, `${id} cannot modify measured-data or probe inputs`);
}
console.log("All animation modules: fifteen mounted SVG processes plus twelve existing moving lessons cover all twenty-seven courses; finite samples, fixed inputs, chart bounds and persistent SVG nodes passed.");
