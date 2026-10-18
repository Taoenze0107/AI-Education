"use strict";
const assert = require("node:assert/strict");
const specs = require("../app/static/academy-motion-optics.js");
const models = require("../app/static/academy.js");
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const angle = (dx, dy) => Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
const finite = value => {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (value && typeof value === "object") Object.values(value).forEach(finite);
};
const ids = ["thin_lens", "snell_refraction", "double_slit", "grating_diffraction", "total_internal_reflection"];
assert.deepEqual(Object.keys(specs), ids);
for (const spec of Object.values(specs)) {
  assert.equal(spec.duration, 6); assert.equal(spec.loop, true); assert.equal(spec.timeMode, "teaching");
  assert.ok(spec.note.includes("非真实光速")); assert.ok(spec.conditionNote);
}

// Both lens rays must meet the same real image. One crosses the far focal
// point after entering parallel to the axis; the other passes undeviated
// through the optical center. Object and image positions stay fixed over time.
for (const focal of [5, 10, 20]) for (const distance of [25, 30, 100]) {
  const p = Object.freeze({focal, distance}), spec = specs.thin_lens;
  const s = spec.sample(p, .2, models), later = spec.sample(p, .4, models);
  near(1 / focal, 1 / distance + 1 / s.image_cm);
  assert.deepEqual(s.object, later.object); assert.deepEqual(s.image, later.image);
  assert.notDeepEqual(s.packets, later.packets);
  s.rays.forEach(ray => assert.deepEqual(ray.at(-1), s.image));
  const parallelAtLens = s.rays[0][1], focalX = s.origin + focal * s.scale;
  const focalY = parallelAtLens.y + (s.image.y - parallelAtLens.y) * (focalX - s.origin) / (s.image.x - s.origin);
  near(focalY, s.axis);
  const a = s.object, b = s.rays[1][1], c = s.image;
  near((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), 0);
  near((s.axis - s.image.y) / (s.axis - s.object.y), s.magnification);
  assert.ok(s.magnification < 0);
}

// Reconstruct the actual drawn angles from geometry, not only the scalar
// model result. The refraction normal is vertical and Snell's law holds.
for (const index of [1.1, 1.5, 2]) for (const incidence of [0, 30, 75]) {
  const s = specs.snell_refraction.sample(Object.freeze({index, angle: incidence}), .3, models);
  const i = angle(s.incident.x - s.center.x, s.incident.y - s.center.y);
  const r = angle(s.transmitted.x - s.center.x, s.transmitted.y - s.center.y);
  near(i, incidence); near(r, s.refraction_deg); near(Math.sin(i * Math.PI / 180), index * Math.sin(r * Math.PI / 180));
  assert.ok(r <= i + 1e-9); assert.ok(s.incident.y < s.center.y && s.transmitted.y > s.center.y);
}

// Below/at/above the critical angle use different paths. A total-reflection
// sample may never contain an outgoing transmitted position, even at wrap.
const critical = models.totalReflection(1.5, 1, 0).critical_deg;
for (const [incidence, expected] of [[0, "refracting"], [40, "refracting"], [critical, "critical"], [50, "total"], [80, "total"]]) {
  const p = Object.freeze({index: 1.5, angle: incidence}), s = specs.total_internal_reflection.sample(p, .7, models);
  assert.equal(s.state, expected);
  near(angle(s.reflected.x - s.center.x, s.reflected.y - s.center.y), incidence);
  assert.ok(s.reflected.y > s.center.y);
  if (expected === "total") for (const phase of [0, .2, .45, .7, .99, 1]) {
    const v = specs.total_internal_reflection.sample(p, phase, models);
    assert.equal(v.transmitted, null); assert.equal(v.transmittedPacket, null);
  }
  else if (expected === "critical") near(s.transmitted.y, s.center.y);
  else near(angle(s.transmitted.x - s.center.x, s.transmitted.y - s.center.y), s.refraction_deg);
}

// Diffraction order existence is a physical boundary, not a value to clamp
// into a fabricated outgoing ray. Grazing propagates along the grating plane.
for (const [p, expected] of [
  [{lines: 600, wavelength: 550, order: 1}, "propagating"],
  [{lines: 1000, wavelength: 500, order: 2}, "grazing"],
  [{lines: 1200, wavelength: 700, order: 3}, "absent"]
]) {
  Object.freeze(p);
  for (const progress of [0, .2, .45, .7, .99, 1]) {
    const s = specs.grating_diffraction.sample(p, progress, models); assert.equal(s.state, expected);
    if (expected === "absent") { assert.equal(s.outgoing, null); assert.equal(s.outgoingPacket, null); assert.ok(s.incidentPacket); }
    else if (expected === "grazing") near(s.outgoing.x, s.center.x);
    else {
      const theta = Math.atan2(s.center.y - s.outgoing.y, s.outgoing.x - s.center.x) * 180 / Math.PI;
      near(theta, s.diffraction_deg); near(Math.sin(theta * Math.PI / 180), s.required_sine);
    }
  }
}

// A monochromatic source has a stable time-averaged screen pattern.
// Propagation animation must never translate fringes or modulate brightness.
for (const wavelength of [400, 550, 700]) for (const distance of [.5, 2]) for (const spacing of [.2, 1]) {
  const p = Object.freeze({wavelength, distance, spacing});
  const a = specs.double_slit.sample(p, 0, models), b = specs.double_slit.sample(p, .4, models);
  near(a.fringe_spacing_mm, wavelength * 1e-3 * distance / spacing);
  near(a.center_intensity, 1); near(a.half_spacing_intensity, 0);
  assert.equal(a.center_intensity, b.center_intensity); assert.equal(a.half_spacing_intensity, b.half_spacing_intensity);
  assert.notEqual(a.front_x, b.front_x); assert.notDeepEqual(a.packets, b.packets);
  a.slits.forEach((slit, i) => near(slit.y - a.target.y, -(a.slits[1 - i].y - a.target.y)));
}

// Minimal SVG fixture exercises the real mount/paint selectors. No browser,
// model requests, physics timer, or synthetic implementation mirror needed.
class Element {
  constructor(tag, attributes = {}, value = null) { this.tagName = tag; this.attributes = {}; this.children = []; this.textContent = value; Object.entries(attributes).forEach(([k, v]) => this.setAttribute(k, v)); }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const role = selector.match(/^\[data-role="([^"]+)"\]$/)?.[1];
    const all = this.children.flatMap(child => [child, ...child.querySelectorAll("*")]);
    return selector === "*" ? all : all.filter(child => child.getAttribute("data-role") === role);
  }
}
const initial = {
  thin_lens: {focal: 10, distance: 30}, snell_refraction: {index: 1.5, angle: 45},
  double_slit: {wavelength: 550, distance: 1, spacing: .5},
  grating_diffraction: {lines: 600, wavelength: 550, order: 1}, total_internal_reflection: {index: 1.5, angle: 50}
};
const context = p => ({params: Object.freeze({...p}), state: Object.freeze({}), models, number: n => String(Number(n.toPrecision(3))),
  svgEl: (tag, attrs = {}, text) => new Element(tag, attrs, text),
  schematic: (label, height) => new Element("svg", {viewBox: `0 0 600 ${height}`, role: "img", "aria-label": label})});
for (const id of ids) {
  const spec = specs[id], ctx = context(initial[id]); ctx.stage = spec.mount(ctx);
  const count = ctx.stage.querySelectorAll("*").length;
  const intensity = id === "double_slit" ? Array.from({length: 520}, (_, i) => ctx.stage.querySelector(`[data-role="slit-intensity-${i}"]`).getAttribute("opacity")) : null;
  const before = JSON.stringify(ctx.params);
  let previous = null, moved = false;
  for (let frame = 0; frame < 20; frame++) {
    const s = spec.sample(ctx.params, frame / 20, models); finite(s); spec.paint(ctx, s);
    assert.equal(ctx.stage.querySelectorAll("*").length, count);
    const positions = ctx.stage.querySelectorAll("*").filter(el => el.tagName === "circle").map(el => [el.getAttribute("cx"), el.getAttribute("cy"), el.getAttribute("visibility")]);
    if (previous && JSON.stringify(positions) !== previous) moved = true; previous = JSON.stringify(positions);
    assert.ok(spec.readout(s, ctx.params, ctx.number).length > 10);
    for (const el of ctx.stage.querySelectorAll("*")) {
      for (const attribute of ["cx", "x1", "x2"]) if (el.getAttribute(attribute) != null) assert.ok(+el.getAttribute(attribute) >= 0 && +el.getAttribute(attribute) <= 600);
      for (const attribute of ["cy", "y1", "y2"]) if (el.getAttribute(attribute) != null) assert.ok(+el.getAttribute(attribute) >= 0 && +el.getAttribute(attribute) <= 350);
    }
  }
  assert.ok(moved, `${id}: moving packets must advance at fixed parameters`); assert.equal(JSON.stringify(ctx.params), before);
  if (intensity) assert.deepEqual(Array.from({length: 520}, (_, i) => ctx.stage.querySelector(`[data-role="slit-intensity-${i}"]`).getAttribute("opacity")), intensity);
}
// Directly inspect hidden branch selectors after paint, not just sample state.
for (const [id, p, selector] of [
  ["total_internal_reflection", {index: 1.5, angle: 50}, "tir-transmitted-packet"],
  ["grating_diffraction", {lines: 1200, wavelength: 700, order: 3}, "grating-outgoing-packet"]
]) {
  const ctx = context(p), spec = specs[id]; ctx.stage = spec.mount(ctx);
  for (const t of [.1, .5, .9]) { spec.paint(ctx, spec.sample(ctx.params, t, models)); assert.equal(ctx.stage.querySelector(`[data-role="${selector}"]`).getAttribute("visibility"), "hidden"); }
}
for (const id of ids) assert.throws(() => specs[id].sample(initial[id], NaN, models), RangeError);
console.log("Five optical propagation modules: ray geometry, Snell/reflection/order boundaries, fixed fringes, moving SVG nodes and read-only parameters passed.");
