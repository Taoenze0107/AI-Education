"use strict";
const assert = require("node:assert/strict");
const models = require("../app/static/academy.js");
const specs = require("../app/static/academy-motion-electric.js");
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
const finiteObject = value => {
  for (const item of Object.values(value)) {
    if (item && typeof item === "object") finiteObject(item);
    else assert.ok(typeof item === "boolean" || typeof item === "string" || (typeof item === "number" && Number.isFinite(item)));
  }
};
const samples = {
  ohms_law: Object.freeze({resistance: 250, voltage: 3}),
  rc_time_constant: Object.freeze({resistance: 10, capacitance: 1, time: 1, discharge: false}),
  resistivity: Object.freeze({rho: .49, length: 1, diameter: .5}),
  joule_heating: Object.freeze({current: 1, resistance: 10, time: 120, mass: 200, efficiency: .8}),
  transformer_ratio: Object.freeze({primary: 200, secondary: 100, voltage: 6})
};
assert.deepEqual(Object.keys(specs).sort(), Object.keys(samples).sort());
for (const [id, spec] of Object.entries(specs)) {
  assert.equal(spec.duration, 6); assert.equal(spec.timeMode, "teaching"); assert.equal(typeof spec.loop, "boolean");
  for (const key of ["sample", "readout", "mount", "paint"]) assert.equal(typeof spec[key], "function");
  assert.ok(spec.note.length > 10 && spec.conditionNote.length > 10);
  const before = JSON.stringify(samples[id]);
  for (let i = 0; i <= 40; i++) {
    const sample = spec.sample(samples[id], i / 40, models); finiteObject(sample);
    const readout = spec.readout(sample, samples[id], value => String(Number(value.toPrecision(4))));
    assert.equal(typeof readout, "string"); assert.ok(readout.length > 15); assert.ok(!/undefined|NaN|Infinity/.test(readout));
  }
  assert.equal(JSON.stringify(samples[id]), before, `${id} must not write probe parameters`);
  for (const progress of [-.1, 1.1, NaN, Infinity, -Infinity]) assert.throws(() => spec.sample(samples[id], progress, models), RangeError);
}

// Direction markers do not invent alternating or changing current for a constant DC input.
const ohms = specs.ohms_law;
assert.equal(ohms.loop, true);
for (const progress of [0, .25, .5, 1]) {
  const s = ohms.sample(samples.ohms_law, progress, models);
  near(s.current_mA, 12); near(s.current_mA / 1000 * s.resistance_ohm, s.voltage_V);
  near(s.flow_fraction, progress); assert.equal(s.active, true);
  const noCurrent = ohms.sample({resistance: 250, voltage: 0}, progress, models);
  near(noCurrent.current_mA, 0); near(noCurrent.flow_fraction, 0); assert.equal(noCurrent.active, false);
}
near(ohms.sample({resistance: 500, voltage: 3}, .5, models).current_mA, 6);
assert.match(ohms.conditionNote, /电子漂移方向.*相反/);

// RC animation uses physical milliseconds, while the selected probe remains at its original t/tau.
const rc = specs.rc_time_constant, rcParams = samples.rc_time_constant;
assert.equal(rc.loop, false);
const rcAtTau = rc.sample(rcParams, .2, models);
near(rcAtTau.tau_ms, 10); near(rcAtTau.time_ms, 10); near(rcAtTau.time_in_tau, 1);
near(rcAtTau.voltage_V, 5 * (1 - Math.exp(-1))); near(rcAtTau.current_fraction, Math.exp(-1));
near(rcAtTau.probe_time_ms, 10); near(rcAtTau.probe_voltage_V, rcAtTau.voltage_V);
for (const progress of [0, .2, .6, 1]) {
  const charge = rc.sample(rcParams, progress, models), discharge = rc.sample({...rcParams, discharge: true}, progress, models);
  near(charge.voltage_V + discharge.voltage_V, 5);
  near(charge.current_fraction, discharge.current_fraction);
  near(charge.cursor.x, charge.time_ms); near(charge.cursor.y, charge.voltage_V); near(charge.cursor.maxX, 50); near(charge.cursor.maxY, 5.5);
  near(charge.probe_time_ms, 10); near(charge.probe_voltage_V, rcAtTau.voltage_V);
  near(rc.sample({...rcParams, resistance: 20}, progress, models).fraction, charge.fraction);
}
near(rc.sample(rcParams, 0, models).voltage_V, 0); near(rc.sample({...rcParams, discharge: true}, 0, models).voltage_V, 5);
near(rc.sample(rcParams, 1, models).time_ms, 50); near(rc.sample({...rcParams, discharge: true}, 1, models).fraction, Math.exp(-5));

// Resistivity keeps geometry and resistance tied to rho L/A; its optional current uses an explicit 1 V assumption.
const wire = specs.resistivity, wireValue = wire.sample(samples.resistivity, .3, models);
assert.equal(wire.loop, true); near(wireValue.assumed_voltage_V, 1);
near(wireValue.resistance_ohm * wireValue.assumed_current_A, wireValue.assumed_voltage_V);
const wireLong = wire.sample({...samples.resistivity, length: 2}, .3, models), wireWide = wire.sample({...samples.resistivity, diameter: 1}, .3, models);
near(wireLong.resistance_ohm / wireValue.resistance_ohm, 2); near(wireLong.assumed_current_A / wireValue.assumed_current_A, .5);
near(wireWide.area_mm2 / wireValue.area_mm2, 4); near(wireWide.assumed_current_A / wireValue.assumed_current_A, 4);
near(wire.sample(samples.resistivity, .9, models).resistance_ohm, wireValue.resistance_ohm);
assert.match(wire.conditionNote, /不模拟导线发热/);

// Joule heat accumulates linearly with physical time; the efficiency affects absorbed heat, not electrical input.
const joule = specs.joule_heating, heatParams = samples.joule_heating;
assert.equal(joule.loop, false);
for (const progress of [0, .25, .5, 1]) {
  const s = joule.sample(heatParams, progress, models);
  near(s.time_s, progress * 120); near(s.electrical_energy_J, progress * 1200); near(s.water_heat_J, .8 * s.electrical_energy_J);
  near(s.water_mass_g / 1000 * 4180 * s.temperature_rise_C, s.water_heat_J);
  near(s.final_C, 20 + s.temperature_rise_C); near(s.cursor.x, s.time_s); near(s.cursor.y, s.temperature_rise_C);
  near(s.cursor.maxX, 180); near(s.cursor.maxY, 18);
  for (const changed of [{current: 0}, {time: 0}]) {
    const zero = joule.sample({...heatParams, ...changed}, progress, models);
    near(zero.electrical_energy_J, 0); near(zero.water_heat_J, 0); near(zero.final_C, 20);
  }
}
near(joule.sample({...heatParams, current: 2}, .5, models).water_heat_J / joule.sample(heatParams, .5, models).water_heat_J, 4);
near(joule.sample({...heatParams, efficiency: .4}, .5, models).electrical_energy_J, joule.sample(heatParams, .5, models).electrical_energy_J);

// The two ideal unloaded voltages share a 50 Hz phase and have the turns ratio at every instant.
const transformer = specs.transformer_ratio, tParams = samples.transformer_ratio;
assert.equal(transformer.loop, true);
const peak = transformer.sample(tParams, 1 / 12, models), negativePeak = transformer.sample(tParams, 1 / 4, models);
near(peak.primary_instant_V, 6 * Math.SQRT2); near(peak.secondary_instant_V, 3 * Math.SQRT2);
near(negativePeak.primary_instant_V, -6 * Math.SQRT2); near(negativePeak.secondary_instant_V, -3 * Math.SQRT2);
near(transformer.sample(tParams, 1 / 3, models).physical_time_ms, 20);
near(transformer.sample(tParams, 1 / 3, models).teaching_time_s, 2);
near(transformer.sample(tParams, 1 / 3, models).primary_instant_V, 0);
near(transformer.sample(tParams, 0, models).primary_instant_V, transformer.sample(tParams, 1, models).primary_instant_V);
let primarySquares = 0, secondarySquares = 0, primarySum = 0;
for (let i = 0; i < 120; i++) {
  const s = transformer.sample(tParams, i / 360, models);
  near(s.secondary_instant_V, s.primary_instant_V * s.turns_ratio);
  primarySquares += s.primary_instant_V ** 2; secondarySquares += s.secondary_instant_V ** 2; primarySum += s.primary_instant_V;
}
near(Math.sqrt(primarySquares / 120), 6); near(Math.sqrt(secondarySquares / 120), 3); near(primarySum / 120, 0);
near(transformer.sample({...tParams, secondary: 400}, 1 / 12, models).secondary_instant_V / peak.secondary_instant_V, 4);
assert.match(transformer.conditionNote, /同名端/); assert.match(transformer.conditionNote, /不表示负载功率或能量传输/);

// Representative slider endpoints remain finite; geometry and energy stay inside the displayed chart scales.
for (const resistance of [100, 1000]) for (const voltage of [0, 5]) for (const phase of [0, 1]) finiteObject(ohms.sample({resistance, voltage}, phase, models));
for (const resistance of [1, 50]) for (const capacitance of [.1, 10]) for (const time of [0, 5]) for (const discharge of [false, true]) for (const phase of [0, 1]) finiteObject(rc.sample({resistance, capacitance, time, discharge}, phase, models));
for (const rho of [.02, 1.1]) for (const length of [.2, 2]) for (const diameter of [.2, 1.2]) for (const phase of [0, 1]) finiteObject(wire.sample({rho, length, diameter}, phase, models));
for (const current of [0, 2]) for (const resistance of [2, 20]) for (const time of [0, 180]) for (const mass of [200, 500]) for (const efficiency of [.2, 1]) for (const phase of [0, 1]) {
  const s = joule.sample({current, resistance, time, mass, efficiency}, phase, models); finiteObject(s);
  assert.ok(s.temperature_rise_C <= s.cursor.maxY); assert.ok(s.electrical_energy_J <= 15000); assert.ok(s.water_heat_J <= s.electrical_energy_J);
}
for (const primary of [100, 600]) for (const secondary of [100, 600]) for (const voltage of [0, 1, 12]) for (const phase of [0, 1 / 12, 1]) finiteObject(transformer.sample({primary, secondary, voltage}, phase, models));
assert.throws(() => ohms.sample({resistance: 0, voltage: 3}, .5, models), RangeError);
assert.throws(() => rc.sample({...rcParams, capacitance: 0}, .5, models), RangeError);
assert.throws(() => wire.sample({...samples.resistivity, diameter: 0}, .5, models), RangeError);
assert.throws(() => joule.sample({...heatParams, mass: 0}, .5, models), RangeError);
assert.throws(() => transformer.sample({...tParams, primary: 0}, .5, models), RangeError);

// A minimal SVG test double checks the module contract without starting a browser or a second animation loop.
// Mount allocates the drawing once; paint must update only nodes within that same drawing.
class SvgNode {
  constructor(tag, values = {}, value = "") { this.tag = tag; this.attributes = {...values}; this.children = []; this.textContent = value; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  querySelector(selector) {
    assert.match(selector, /^#[a-zA-Z0-9_-]+$/);
    const id = selector.slice(1), visit = element => element.attributes.id === id ? element : element.children.map(visit).find(Boolean);
    const found = visit(this); assert.ok(found, `paint selector ${selector} must exist in the mounted drawing`); return found;
  }
}
const countNodes = node => 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
const checkSvg = node => {
  for (const value of Object.values(node.attributes)) assert.ok(!/NaN|Infinity/.test(String(value)), `invalid SVG attribute ${value}`);
  for (const child of node.children) checkSvg(child);
};
for (const [id, spec] of Object.entries(specs)) for (const zero of [false, true]) {
  const params = {...samples[id], ...(zero && id === "ohms_law" ? {voltage: 0} : {}), ...(zero && id === "joule_heating" ? {current: 0, time: 0} : {}), ...(zero && id === "transformer_ratio" ? {voltage: 0} : {}), ...(zero && id === "rc_time_constant" ? {discharge: true} : {})};
  const before = JSON.stringify(params), readings = new SvgNode("div"), state = {params};
  const ctx = {state, params, models, readings, number: value => String(Number(value.toPrecision(4))), chart: new SvgNode("svg"), svgEl: (tag, values = {}, value) => new SvgNode(tag, values, value), schematic: (label, height) => new SvgNode("svg", {viewBox: `0 0 600 ${height}`, "aria-label": label}), newSvg: label => new SvgNode("svg", {"aria-label": label}), reading: (parent, label, value) => parent.append(new SvgNode("span", {}, `${label}: ${value}`))};
  const drawing = spec.mount(ctx); assert.equal(drawing.tag, "svg"); ctx.stage = drawing;
  const count = countNodes(drawing);
  for (const progress of [0, .125, .5, .875, 1]) {
    spec.paint(ctx, spec.sample(params, progress, models));
    assert.equal(countNodes(drawing), count, `${id} must not rebuild SVG nodes every frame`); checkSvg(drawing);
  }
  assert.equal(JSON.stringify(params), before); assert.deepEqual(Object.keys(state), ["params"]);
}
console.log("Electrical animations: five modules, teaching/physical time separation, DC zero state, RC probe isolation, heat conservation and AC RMS/phase invariants passed.");
