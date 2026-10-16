"use strict";
const assert = require("node:assert/strict");
const models = require("../app/static/academy.js");
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

// A one metre small-angle pendulum has a period close to two seconds.
near(models.pendulum(1).period_s, 2.0060666807106475);
near(models.pendulum(1).period_s / models.pendulum(.25).period_s, 2);
near(models.pendulum(1.5).period_squared_s2 / models.pendulum(.5).period_squared_s2, 3);

// Milliamps in the chart must still reproduce 250 ohms with SI units.
near(models.ohms(250, 5).current_mA, 20);
near(models.ohms(500, 5).current_mA, 10);
near(models.ohms(250, 0).current_mA, 0);

// kOhm multiplied by microfarads yields milliseconds, not seconds.
const charge = models.rc(10, 1, 10), discharge = models.rc(10, 1, 10, true);
near(charge.tau_ms, 10);
near(charge.voltage_V, 3.1606027941427883);
near(discharge.voltage_V, 1.8393972058572117);
near(charge.fraction + discharge.fraction, 1);
near(models.rc(10, 1, 0).voltage_V, 0);
near(models.rc(10, 1, 0, true).voltage_V, 5);
near(models.rc(20, 1, 20).fraction, charge.fraction);
assert.ok(models.rc(10, 1, 50).voltage_V > 4.96);
for (const bad of [0, -1, NaN, Infinity]) {
  assert.throws(() => models.pendulum(bad), RangeError);
  assert.throws(() => models.ohms(bad, 5), RangeError);
  assert.throws(() => models.rc(10, bad, 10), RangeError);
}
assert.throws(() => models.rc(10, 1, -1), RangeError);
// Hooke: centimetre readings convert to metre lengths before dividing force by extension.
near(models.hooke(50, 2).extension_cm, 4);
near(models.hooke(50, 4).extension_m / models.hooke(50, 2).extension_m, 2);
near(models.hooke(100, 2).extension_m / models.hooke(50, 2).extension_m, .5);
near(models.hooke(50, 0).extension_cm, 0);
near(models.hooke(50, 2).force_N / models.hooke(50, 2).extension_m, 50);

// T² is proportional to m/k; changing m fourfold changes T twofold.
near(models.spring(.2, 20).period_s, 2 * Math.PI * Math.sqrt(.01));
near(models.spring(.4, 20).period_s / models.spring(.1, 20).period_s, 2);
near(models.spring(.2, 40).period_squared_s2 / models.spring(.2, 20).period_squared_s2, .5);

// Thin lens: real image branch only; equal object/image distances at twice focal length.
near(models.lens(10, 20).image_cm, 20);
near(models.lens(10, 20).magnification, -1);
near(models.lens(10, 30).image_cm, 15);
near(1 / models.lens(20, 25).focal_cm, 1 / 25 + 1 / models.lens(20, 25).image_cm);
assert.ok(models.lens(10, 11).image_cm > models.lens(10, 30).image_cm);

// Snell's law uses angles from the normal, converts degrees internally and handles normal incidence.
near(models.refraction(1.5, 0).refraction_deg, 0);
near(models.refraction(1, 45).refraction_deg, 45);
near(models.refraction(1.5, 30).sine_incidence, 1.5 * models.refraction(1.5, 30).sine_refraction);
assert.ok(models.refraction(1.5, 75).refraction_deg < 75);
assert.ok(models.refraction(2, 45).refraction_deg < models.refraction(1.5, 45).refraction_deg);

// λ in nm, d in mm and D in m produce a fringe spacing in mm.
near(models.doubleSlit(550, 1, .5).fringe_spacing_mm, 1.1);
near(models.doubleSlit(550, 2, .5).fringe_spacing_mm, 2.2);
near(models.doubleSlit(550, 1, 1).fringe_spacing_mm, .55);
near(models.doubleSlit(1100, 1, .5).fringe_spacing_mm, 2.2);
near(models.fringeIntensity(0, 1.1), 1);
near(models.fringeIntensity(1.1, 1.1), 1);
near(models.fringeIntensity(.55, 1.1), 0);
near(models.fringeIntensity(-.55, 1.1), models.fringeIntensity(.55, 1.1));

// Calorimetry: hot metal and water have different heat capacities; g -> kg is required for Q in joules.
const heat = models.calorimetry(100, 150, 20, 80, 900);
near(heat.equilibrium_C, (100 * 900 * 80 + 150 * 4180 * 20) / (100 * 900 + 150 * 4180));
near(heat.absorbed_J, heat.released_J);
near(heat.recovered_specific_J_kg_K, 900);
near(heat.absorbed_J, .15 * 4180 * (heat.equilibrium_C - 20));
near(models.calorimetry(200, 300, 20, 80, 900).equilibrium_C, heat.equilibrium_C);
near(models.calorimetry(200, 300, 20, 80, 900).absorbed_J, heat.absorbed_J * 2);
near(models.calorimetry(100, 100, 20, 80, 4180).equilibrium_C, 50);
assert.ok(heat.equilibrium_C > 20 && heat.equilibrium_C < 80);
assert.ok(models.calorimetry(200, 150, 20, 80, 900).equilibrium_C > heat.equilibrium_C);
assert.ok(models.calorimetry(100, 250, 20, 80, 900).equilibrium_C < heat.equilibrium_C);

// All bounded slider combinations must produce finite, physically valid readings.
for (const stiffness of [20, 100]) for (const force of [0, 4]) assert.ok(Object.values(models.hooke(stiffness, force)).every(Number.isFinite));
for (const mass of [.05, .5]) for (const stiffness of [10, 50]) assert.ok(Object.values(models.spring(mass, stiffness)).every(Number.isFinite));
for (const focal of [5, 20]) for (const object of [25, 100]) assert.ok(Object.values(models.lens(focal, object)).every(Number.isFinite));
for (const index of [1.1, 2]) for (const angle of [0, 75]) assert.ok(Object.values(models.refraction(index, angle)).every(Number.isFinite));
for (const wavelength of [400, 700]) for (const distance of [.5, 2]) for (const slit of [.2, 1]) assert.ok(Object.values(models.doubleSlit(wavelength, distance, slit)).every(Number.isFinite));
for (const metal of [50, 250]) for (const water of [50, 300]) for (const cold of [10, 40]) for (const hot of [50, 95]) for (const specific of [200, 1000]) {
  const value = models.calorimetry(metal, water, cold, hot, specific);
  assert.ok(Object.values(value).every(Number.isFinite)); assert.ok(value.equilibrium_C > cold && value.equilibrium_C < hot);
  near(value.absorbed_J, value.released_J, 1e-8); near(value.recovered_specific_J_kg_K, specific, 1e-8);
}
for (const bad of [0, -1, NaN, Infinity]) {
  assert.throws(() => models.hooke(bad, 2), RangeError);
  assert.throws(() => models.spring(bad, 20), RangeError);
  assert.throws(() => models.spring(.2, bad), RangeError);
  assert.throws(() => models.lens(bad, 25), RangeError);
  assert.throws(() => models.doubleSlit(bad, 1, .5), RangeError);
  assert.throws(() => models.doubleSlit(550, bad, .5), RangeError);
  assert.throws(() => models.doubleSlit(550, 1, bad), RangeError);
  assert.throws(() => models.calorimetry(bad, 150, 20, 80), RangeError);
  assert.throws(() => models.calorimetry(100, bad, 20, 80), RangeError);
  assert.throws(() => models.calorimetry(100, 150, 20, 80, bad), RangeError);
}
for (const bad of [-1, NaN, Infinity]) assert.throws(() => models.hooke(50, bad), RangeError);
for (const bad of [0, .99, NaN, Infinity]) assert.throws(() => models.refraction(bad, 45), RangeError);
for (const bad of [-1, 90, NaN, Infinity]) assert.throws(() => models.refraction(1.5, bad), RangeError);
for (const distance of [0, 5, 10, NaN, Infinity]) assert.throws(() => models.lens(10, distance), RangeError);
for (const temperatures of [[80, 20], [20, 20], [-1, 80], [20, 101], [NaN, 80]]) assert.throws(() => models.calorimetry(100, 150, ...temperatures), RangeError);
assert.throws(() => models.hooke(Number.MIN_VALUE, Number.MAX_VALUE), RangeError);
assert.throws(() => models.spring(Number.MAX_VALUE, Number.MIN_VALUE), RangeError);
assert.throws(() => models.doubleSlit(700, Number.MAX_VALUE, Number.MIN_VALUE), RangeError);
assert.throws(() => models.fringeIntensity(Infinity, 1), RangeError);
assert.throws(() => models.fringeIntensity(1, 0), RangeError);
console.log("Academy physical models: nine lessons, units, proportions and boundary invariants passed.");
