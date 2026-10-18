"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const models = require("../app/static/academy.js");
const specs = require("../app/static/academy-motion-matter.js");
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const finite = value => {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === "object") Object.values(value).forEach(finite);
};
const params = {
  calorimetry: Object.freeze({metalMass: 100, waterMass: 150, waterTemp: 20, metalTemp: 80, specific: 900}),
  archimedes: Object.freeze({density: 1000, volume: 100}),
  thermal_expansion: Object.freeze({alpha: 17, length: 50, temperature: 50}),
  string_waves: Object.freeze({length: 1, tension: 10, density: 1}),
  malus_law: Object.freeze({angle: 45, intensity: 1, background: .05})
};
assert.deepEqual(Object.keys(specs).sort(), Object.keys(params).sort());
for (const [id, spec] of Object.entries(specs)) {
  assert.ok(spec.duration > 0 && Number.isFinite(spec.duration));
  assert.equal(spec.timeMode, "teaching");
  assert.equal(typeof spec.loop, "boolean");
  assert.ok(spec.note && spec.conditionNote);
  for (const method of ["sample", "readout", "mount", "paint"]) assert.equal(typeof spec[method], "function");
  const unchanged = JSON.stringify(params[id]);
  for (const q of [0, .125, .25, .5, .75, 1]) {
    const value = spec.sample(params[id], q, models); finite(value);
    assert.ok(spec.readout(value, params[id], value => String(value)).length > 20);
  }
  assert.equal(JSON.stringify(params[id]), unchanged);
  for (const bad of [NaN, Infinity, -Infinity]) assert.throws(() => spec.sample(params[id], bad, models), RangeError);
  assert.deepEqual(spec.sample(params[id], -1, models), spec.sample(params[id], 0, models));
  assert.deepEqual(spec.sample(params[id], 2, models), spec.sample(params[id], 1, models));
}

// Two finite heat capacities exchange exactly the same energy. A finite 5-tau
// endpoint still has a positive temperature difference, unlike a forced snap to equilibrium.
const heat = specs.calorimetry;
for (const metalMass of [50, 250]) for (const waterMass of [50, 300])
for (const waterTemp of [10, 40]) for (const metalTemp of [50, 95]) for (const specific of [200, 1000]) {
  const p = Object.freeze({metalMass, waterMass, waterTemp, metalTemp, specific});
  const cm = metalMass / 1000 * specific, cw = waterMass / 1000 * 4180;
  let lastHeat = -1, lastDifference = Infinity;
  for (const q of [0, .02, .2, .4, .8, 1]) {
    const s = heat.sample(p, q, models); finite(s);
    near(cm * s.metal_temp_C + cw * s.water_temp_C, cm * metalTemp + cw * waterTemp, 1e-7);
    near(s.released_J, s.absorbed_J, 1e-8);
    assert.ok(s.metal_temp_C >= s.equilibrium_C && s.water_temp_C <= s.equilibrium_C);
    assert.ok(s.metal_temp_C <= metalTemp && s.water_temp_C >= waterTemp);
    assert.ok(s.released_J >= lastHeat && s.temperature_difference_C <= lastDifference);
    assert.ok(s.released_J <= s.limiting_heat_J + 1e-8);
    lastHeat = s.released_J; lastDifference = s.temperature_difference_C;
  }
  const end = heat.sample(p, 1, models);
  near(end.temperature_difference_C / (metalTemp - waterTemp), Math.exp(-5), 1e-12);
  near(end.model_time_s / end.tau_s, 5);
  assert.ok(end.temperature_difference_C > 0 && end.released_J < end.limiting_heat_J);
}
const heat0 = heat.sample(params.calorimetry, 0, models);
near(heat0.metal_temp_C, 80); near(heat0.water_temp_C, 20); near(heat0.absorbed_J, 0); near(heat0.heat_flow_W, 120);
// The initial energy rate must equal G times the temperature gap, in W = J/s.
const tinyHeat = heat.sample(params.calorimetry, 1e-7, models);
near(tinyHeat.absorbed_J / tinyHeat.model_time_s, 120, .001);
const doubledHeat = heat.sample({...params.calorimetry, metalMass: 200, waterMass: 300}, .4, models);
const ordinaryHeat = heat.sample(params.calorimetry, .4, models);
near(doubledHeat.tau_s, ordinaryHeat.tau_s * 2);
near(doubledHeat.equilibrium_C, ordinaryHeat.equilibrium_C);
near(doubledHeat.absorbed_J, ordinaryHeat.absorbed_J * 2, 1e-8);
assert.equal(ordinaryHeat.cursor, undefined, "A metal-mass/equilibrium plot must not carry a fake time cursor.");
assert.throws(() => heat.sample({...params.calorimetry, waterTemp: 90}, .5, models), RangeError);

// A slowly lowered object displaces exactly the liquid collected from a
// constant-level overflow vessel. No object mass or spontaneous floating is invented.
for (const density of [700, 1000, 1400]) for (const volume of [0, 5, 100, 200]) {
  let previousForce = -1;
  for (const q of [0, .1, .5, 1]) {
    const s = specs.archimedes.sample({density, volume}, q, models);
    near(s.volume_cm3, volume * q); near(s.overflow_volume_cm3, s.volume_cm3);
    near(s.buoyancy_N, s.displaced_mass_kg * 9.81);
    near(s.displaced_mass_kg, density * s.volume_cm3 * 1e-6);
    near(s.immersed_fraction, s.volume_cm3 / 200);
    assert.ok(s.immersed_fraction >= 0 && s.immersed_fraction <= 1);
    assert.ok(s.buoyancy_N >= previousForce && s.buoyancy_N <= s.cursor.maxY);
    near(s.cursor.x, s.volume_cm3); near(s.cursor.y, s.buoyancy_N);
    previousForce = s.buoyancy_N;
  }
  assert.equal(specs.archimedes.sample({density, volume}, 1, models).lowering, false);
}
near(specs.archimedes.sample({density: 1000, volume: 200}, 1, models).buoyancy_N, 1.962);
for (const bad of [-1, 201, NaN]) assert.throws(() => specs.archimedes.sample({density: 1000, volume: bad}, .5, models), RangeError);

// Uniform externally prescribed heating uses the actual expansion in mm; the
// eightyfold rendering is never applied to the numerical measurement or graph.
for (const alpha of [2, 17, 30]) for (const length of [20, 50, 100]) for (const temperature of [0, 50, 80]) {
  const p = {alpha, length, temperature};
  const end = specs.thermal_expansion.sample(p, 1, models);
  const half = specs.thermal_expansion.sample(p, .5, models);
  const expectedMm = alpha * 1e-6 * (length / 100) * temperature * 1000;
  near(end.extension_mm, expectedMm); near(half.extension_mm, end.extension_mm / 2);
  near(end.final_cm, length + expectedMm / 10);
  near(end.cursor.x, temperature); near(end.cursor.y, expectedMm);
  assert.ok(end.extension_mm <= end.cursor.maxY);
}
near(specs.thermal_expansion.sample(params.thermal_expansion, 1, models).extension_mm, .425);
near(specs.thermal_expansion.sample({...params.thermal_expansion, temperature: 0}, .75, models).extension_mm, 0);

// A transverse standing fundamental has fixed end nodes, one symmetric belly,
// and fixed material coordinates. The chosen slow phase is not a physical-Hz clock.
const string = specs.string_waves;
assert.equal(string.duration, 2); assert.equal(string.loop, true);
for (const q of Array.from({length: 65}, (_, i) => i / 64)) {
  const s = string.sample(params.string_waves, q, models);
  assert.equal(s.profile[0].displacement_fraction, 0); assert.equal(s.profile[80].displacement_fraction, 0);
  near(s.profile[40].displacement_fraction, Math.cos(2 * Math.PI * q));
  for (let i = 0; i <= 80; i++) {
    near(s.profile[i].fraction, i / 80);
    near(s.profile[i].displacement_fraction, s.profile[80 - i].displacement_fraction);
    assert.ok(Math.abs(s.profile[i].displacement_fraction) <= 1);
  }
  assert.equal(s.cursor, undefined, "The f-versus-tension chart is not a phase/time chart.");
}
near(string.sample(params.string_waves, .25, models).center_displacement_fraction, 0);
near(string.sample(params.string_waves, .5, models).center_displacement_fraction, -1);
const stringOriginal = string.sample(params.string_waves, .125, models);
const stringTighter = string.sample({...params.string_waves, tension: 20}, .125, models);
near(stringTighter.fundamental_Hz / stringOriginal.fundamental_Hz, Math.sqrt(2));
assert.deepEqual(stringTighter.profile, stringOriginal.profile);
near(stringOriginal.wavelength_m, 2 * params.string_waves.length);

// A rotating analyser has a 180-degree optical period. The detector keeps its
// angle-independent background at extinction; the signal and total are distinct.
for (const angle of [0, 45, 90, 180]) for (const intensity of [.2, 1]) for (const background of [0, .2]) {
  const p = {angle, intensity, background};
  for (const q of [0, .125, .25, .5, .75, 1]) {
    const s = specs.malus_law.sample(p, q, models), expected = models.malus((angle + 180 * q) % 180, intensity, background);
    near(s.signal_intensity, expected.signal_intensity);
    near(s.measured_intensity - s.signal_intensity, background);
    near(s.cursor.x, s.angle_deg); near(s.cursor.y, s.measured_intensity);
    assert.ok(s.measured_intensity >= background && s.measured_intensity <= intensity + background + 1e-12);
    assert.ok(s.cursor.x >= 0 && s.cursor.x < 180 && s.cursor.y <= s.cursor.maxY);
  }
  near(specs.malus_law.sample(p, 0, models).measured_intensity, specs.malus_law.sample(p, 1, models).measured_intensity);
}
const extinct = specs.malus_law.sample({angle: 0, intensity: 1, background: .2}, .5, models);
near(extinct.angle_deg, 90); near(extinct.signal_intensity, 0); near(extinct.measured_intensity, .2);
assert.throws(() => specs.malus_law.sample({angle: 181, intensity: 1, background: 0}, 0, models), RangeError);

// Browser registration preserves other independently loaded animation modules;
// importing this module alone never needs a DOM, a timer or the learning app.
const browser = {LabAcademyAnimationModules: {existing: {sentinel: true}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app/static/academy-motion-matter.js"), "utf8"), {window: browser});
assert.equal(browser.LabAcademyAnimationModules.existing.sentinel, true);
for (const id of Object.keys(params)) assert.equal(typeof browser.LabAcademyAnimationModules[id].sample, "function");
console.log("Five matter/wave animation modules: numerical limits, conservation, units, optical/extinction and standing-wave nodes passed.");
