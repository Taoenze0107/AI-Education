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

// Released from maximum extension: x/A = cos(omega t), v/A = -omega sin(omega t).
// At the equilibrium crossings speed is greatest; the turning points have zero speed.
const motionMass = .375, motionStiffness = 18;
const motionPeriod = models.spring(motionMass, motionStiffness).period_s;
const motionOmega = 2 * Math.PI / motionPeriod;
const motionPhases = [
  [0, 1, 0],
  [.25, 0, -motionOmega],
  [.5, -1, 0],
  [.75, 0, motionOmega],
  [1, 1, 0]
];
for (const [fraction, displacement, velocity] of motionPhases) {
  const value = models.springMotion(motionMass, motionStiffness, fraction * motionPeriod);
  near(value.period_s, motionPeriod);
  near(value.displacement_fraction, displacement);
  near(value.velocity_fraction_per_s, velocity);
}

// All phases stay within the chosen amplitude, and the same physical state repeats after a period.
for (const mass of [.05, .375, .5]) for (const stiffness of [10, 18, 50]) {
  const period = models.spring(mass, stiffness).period_s;
  for (let sample = 0; sample <= 128; sample++) {
    const time = period * sample / 64;
    const value = models.springMotion(mass, stiffness, time);
    const repeated = models.springMotion(mass, stiffness, time + period);
    assert.ok(Number.isFinite(value.displacement_fraction));
    assert.ok(Number.isFinite(value.velocity_fraction_per_s));
    assert.ok(Math.abs(value.displacement_fraction) <= 1 + 1e-12);
    assert.ok(Math.abs(value.velocity_fraction_per_s) <= 2 * Math.PI / period + 1e-12);
    near(repeated.displacement_fraction, value.displacement_fraction);
    near(repeated.velocity_fraction_per_s, value.velocity_fraction_per_s);
  }
}

// Heavier masses oscillate more slowly, while a stiffer spring speeds up the same phase.
const motionBase = models.springMotion(.1, 20, 0);
const motionHeavy = models.springMotion(.4, 20, 0);
const motionStiff = models.springMotion(.1, 80, 0);
near(motionHeavy.period_s / motionBase.period_s, 2);
near(motionStiff.period_s / motionBase.period_s, .5);
const quarterBase = models.springMotion(.1, 20, motionBase.period_s / 4);
const quarterHeavy = models.springMotion(.4, 20, motionHeavy.period_s / 4);
const quarterStiff = models.springMotion(.1, 80, motionStiff.period_s / 4);
near(quarterHeavy.displacement_fraction, quarterBase.displacement_fraction);
near(quarterStiff.displacement_fraction, quarterBase.displacement_fraction);
near(quarterHeavy.velocity_fraction_per_s / quarterBase.velocity_fraction_per_s, .5);
near(quarterStiff.velocity_fraction_per_s / quarterBase.velocity_fraction_per_s, 2);
for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
  assert.throws(() => models.springMotion(bad, 20, 0), RangeError);
  assert.throws(() => models.springMotion(.2, bad, 0), RangeError);
}
for (const bad of [-1, NaN, Infinity, -Infinity]) {
  assert.throws(() => models.springMotion(.2, 20, bad), RangeError);
}

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


// Archimedes: cubic centimetres convert to cubic metres, not litres or cubic millimetres.
near(models.buoyancy(1000, 100).buoyancy_N, .981);
near(models.buoyancy(1000, 100).displaced_mass_kg, .1);
near(models.buoyancy(1000, 200).buoyancy_N / models.buoyancy(1000, 100).buoyancy_N, 2);
near(models.buoyancy(1400, 100).buoyancy_N / models.buoyancy(700, 100).buoyancy_N, 2);
near(models.buoyancy(1000, 0).buoyancy_N, 0);

// Resistivity: micro-ohm-metres and millimetre diameter; R scales with inverse d squared.
near(models.resistivity(.5, 1, .5).resistance_ohm, 2.5464790894703255);
near(models.resistivity(.5, 1, .5).area_mm2, Math.PI * .5 ** 2 / 4);
near(models.resistivity(.5, 2, .5).resistance_ohm / models.resistivity(.5, 1, .5).resistance_ohm, 2);
near(models.resistivity(1, 1, .5).resistance_ohm / models.resistivity(.5, 1, .5).resistance_ohm, 2);
near(models.resistivity(.5, 1, 1).resistance_ohm / models.resistivity(.5, 1, .5).resistance_ohm, .25);

// Joule heating: grams -> kilograms; water storage is eta times electrical energy.
const joule = models.joule(.5, 40, 60, 25, 1);
near(joule.electrical_energy_J, 600); near(joule.water_heat_J, 600); near(joule.temperature_rise_C, 600 / (.025 * 4180));
near(models.joule(1, 10, 60, 200, .8).temperature_rise_C / models.joule(.5, 10, 60, 200, .8).temperature_rise_C, 4);
near(models.joule(.5, 10, 120, 200, .8).temperature_rise_C / models.joule(.5, 10, 60, 200, .8).temperature_rise_C, 2);
near(models.joule(.5, 10, 60, 200, .4).temperature_rise_C / models.joule(.5, 10, 60, 200, .8).temperature_rise_C, .5);
near(models.joule(0, 20, 180, 200).temperature_rise_C, 0);
near(models.joule(2, 20, 0, 200).temperature_rise_C, 0);
assert.ok(models.joule(2, 20, 180, 200, 1).final_C < 38);
assert.throws(() => models.joule(10, 100, 100, 1, 1), RangeError);

// Ideal transformer uses rms voltage, with integral positive turns.
near(models.transformer(600, 300, 12).secondary_V_rms, 6);
near(models.transformer(100, 600, 12).secondary_V_rms, 72);
near(models.transformer(200, 400, 0).secondary_V_rms, 0);
near(models.transformer(200, 400, 6).turns_ratio, 2);
near(models.transformer(100, 300, 6).secondary_V_rms, models.transformer(200, 600, 6).secondary_V_rms);

// Grating: 200 lines/mm -> d 5000 nm; absent orders return null rather than NaN.
near(models.grating(200, 500, 1).spacing_nm, 5000);
near(models.grating(200, 500, 1).required_sine, .1);
near(models.grating(200, 500, 1).diffraction_deg, 5.739170477266787);
const grazing = models.grating(2000, 500, 1), absent = models.grating(2000, 500, 2);
assert.equal(grazing.exists, true); assert.equal(grazing.diffraction_state, "grazing"); near(grazing.diffraction_deg, 90);
assert.equal(absent.exists, false); assert.equal(absent.diffraction_state, "absent"); assert.equal(absent.diffraction_deg, null);
assert.equal(models.grating(2000, 500, 0).diffraction_deg, 0);
assert.equal(models.grating(2000, 500 + 1e-6, 1).exists, false);
assert.ok(models.grating(2000, 500 - 1e-6, 1).diffraction_deg < 90);
near(models.grating(400, 500, 1).required_sine / models.grating(200, 500, 1).required_sine, 2);

// TIR has three distinct physical states; equality is grazing, not total reflection.
const critical = Math.asin(1 / 1.5) * 180 / Math.PI;
near(models.totalReflection(1.5, 1, 30).refraction_deg, 48.59037789072914);
near(models.totalReflection(1.5, 1, 0).refraction_deg, 0);
const tir = models.totalReflection(1.5, 1, 45), atCritical = models.totalReflection(1.5, 1, critical);
assert.equal(tir.optical_state, "total"); assert.equal(tir.refraction_deg, null); near(tir.reflection_deg, 45);
assert.equal(atCritical.optical_state, "critical"); near(atCritical.refraction_deg, 90); near(atCritical.critical_deg, critical);
assert.equal(models.totalReflection(1.5, 1, critical + 1e-6).optical_state, "total");
assert.equal(models.totalReflection(1.5, 1, critical - 1e-6).optical_state, "refracting");
assert.ok(models.totalReflection(1.8, 1, 0).critical_deg < models.totalReflection(1.3, 1, 0).critical_deg);

// Expansion: alpha 12 means 12e-6 / K; L in cm and extension in mm.
near(models.expansion(12, 60, 50).extension_mm, .36);
near(models.expansion(12, 60, 50).final_cm, 60.036);
near(models.expansion(12, 60, 0).extension_mm, 0);
near(models.expansion(24, 60, 50).extension_mm / models.expansion(12, 60, 50).extension_mm, 2);
near(models.expansion(12, 100, 80).extension_mm / models.expansion(12, 50, 40).extension_mm, 4);

// Fixed-ended string: mu g/m converts to kg/m, lambda_1=2L and f_1=v/(2L).
near(models.stringWave(.6, 1.8, 2).speed_m_s, 30);
near(models.stringWave(.6, 1.8, 2).fundamental_Hz, 25);
near(models.stringWave(.6, 1.8, 2).wavelength_m, 1.2);
near(models.stringWave(1, 16, 1).fundamental_Hz / models.stringWave(1, 4, 1).fundamental_Hz, 2);
near(models.stringWave(1, 4, 4).fundamental_Hz / models.stringWave(1, 4, 1).fundamental_Hz, .5);
near(models.stringWave(1, 4, 1).fundamental_Hz / models.stringWave(.5, 4, 1).fundamental_Hz, .5);

// Malus: linearly polarized signal plus angle-independent background.
near(models.malus(0, 100, 10).measured_intensity, 110);
near(models.malus(60, 100, 10).measured_intensity, 35);
near(models.malus(90, 100, 10).measured_intensity, 10);
assert.equal(models.malus(90).signal_intensity, 0);
near(models.malus(180, 100, 10).measured_intensity, 110);
near(models.malus(30, 100, 10).measured_intensity, models.malus(150, 100, 10).measured_intensity);
near(models.malus(45, 2, .1).signal_intensity, 2 * models.malus(45, 1, .1).signal_intensity);

const allFiniteOrState = value => {
  for (const item of Object.values(value)) assert.ok(item === null || typeof item === "string" || typeof item === "boolean" || Number.isFinite(item));
};
for (const density of [700, 1400]) for (const volume of [0, 200]) allFiniteOrState(models.buoyancy(density, volume));
for (const rho of [.02, 1.1]) for (const length of [.2, 2]) for (const diameter of [.2, 1.2]) allFiniteOrState(models.resistivity(rho, length, diameter));
for (const i of [0, 2]) for (const r of [2, 20]) for (const t of [0, 180]) for (const mass of [200, 500]) for (const eta of [.2, 1]) allFiniteOrState(models.joule(i, r, t, mass, eta));
for (const n1 of [100, 600]) for (const n2 of [100, 600]) for (const v of [1, 12]) allFiniteOrState(models.transformer(n1, n2, v));
for (const lines of [100, 1200]) for (const wavelength of [400, 700]) for (const order of [1, 3]) { const value = models.grating(lines, wavelength, order); allFiniteOrState(value); assert.equal(value.exists, value.required_sine <= 1); }
for (const n of [1.3, 1.8]) for (const angle of [0, 80]) { const value = models.totalReflection(n, 1, angle); allFiniteOrState(value); assert.equal(value.refraction_deg === null, value.optical_state === "total"); }
for (const alpha of [2, 30]) for (const length of [20, 100]) for (const t of [0, 80]) allFiniteOrState(models.expansion(alpha, length, t));
for (const length of [.4, 1.5]) for (const tension of [1, 20]) for (const density of [.5, 5]) allFiniteOrState(models.stringWave(length, tension, density));
for (const angle of [0, 90, 180]) for (const intensity of [.2, 1]) for (const background of [0, .2]) allFiniteOrState(models.malus(angle, intensity, background));

// Reject non-finite/negative domains before they reach readings or SVG coordinates.
for (const bad of [0, -1, NaN, Infinity]) {
  assert.throws(() => models.buoyancy(bad, 100), RangeError);
  assert.throws(() => models.resistivity(bad, 1, .5), RangeError);
  assert.throws(() => models.resistivity(.5, bad, .5), RangeError);
  assert.throws(() => models.resistivity(.5, 1, bad), RangeError);
  assert.throws(() => models.joule(1, bad, 60, 200), RangeError);
  assert.throws(() => models.joule(1, 10, 60, bad), RangeError);
  assert.throws(() => models.joule(1, 10, 60, 200, bad), RangeError);
  assert.throws(() => models.transformer(bad, 100, 6), RangeError);
  assert.throws(() => models.transformer(100, bad, 6), RangeError);
  assert.throws(() => models.grating(bad, 500), RangeError);
  assert.throws(() => models.grating(200, bad), RangeError);
  assert.throws(() => models.expansion(bad, 50, 20), RangeError);
  assert.throws(() => models.expansion(12, bad, 20), RangeError);
  assert.throws(() => models.stringWave(bad, 10, 1), RangeError);
  assert.throws(() => models.stringWave(1, bad, 1), RangeError);
  assert.throws(() => models.stringWave(1, 10, bad), RangeError);
  assert.throws(() => models.malus(45, bad), RangeError);
}
for (const bad of [-1, NaN, Infinity]) {
  assert.throws(() => models.buoyancy(1000, bad), RangeError);
  assert.throws(() => models.joule(bad, 10, 60, 200), RangeError);
  assert.throws(() => models.joule(1, 10, bad, 200), RangeError);
  assert.throws(() => models.transformer(100, 200, bad), RangeError);
  assert.throws(() => models.expansion(12, 50, bad), RangeError);
  assert.throws(() => models.malus(45, 1, bad), RangeError);
}
assert.throws(() => models.transformer(100.5, 200, 6), RangeError);
assert.throws(() => models.grating(200, 500, 1.5), RangeError);
assert.throws(() => models.grating(200, 500, -1), RangeError);
assert.throws(() => models.totalReflection(1, 1.5, 45), RangeError);
assert.throws(() => models.totalReflection(1.5, 1.5, 45), RangeError);
for (const angle of [-1, 90, NaN, Infinity]) assert.throws(() => models.totalReflection(1.5, 1, angle), RangeError);
for (const angle of [-1, 181, NaN, Infinity]) assert.throws(() => models.malus(angle), RangeError);
assert.throws(() => models.joule(1, 10, 60, 200, 1.1), RangeError);
assert.throws(() => models.resistivity(.5, 1, Number.MIN_VALUE), RangeError);
assert.throws(() => models.stringWave(1, Number.MAX_VALUE, Number.MIN_VALUE), RangeError);
assert.throws(() => models.grating(Number.MAX_VALUE, Number.MAX_VALUE), RangeError);
assert.throws(() => models.expansion(Number.MAX_VALUE, Number.MAX_VALUE, 80), RangeError);
// Additional one-dimensional motion lessons: fixed reference frame, net force and static release.
const uniform = models.kinematics(.2, .5, 2);
near(uniform.position_m, 1.4); near(uniform.velocity_m_s, 1.2);
near(models.kinematics(.7, .5, 2).velocity_m_s - uniform.velocity_m_s, .5);
near(models.kinematics(0, .5, 2).position_m / models.kinematics(0, .5, 1).position_m, 4);
const driven = models.newtons(.5, .6, 2);
near(driven.acceleration_m_s2, 1.2); near(driven.velocity_m_s, 2.4); near(driven.position_m, 2.4);
near(models.newtons(1, .6, 2).acceleration_m_s2 / driven.acceleration_m_s2, .5);
near(models.freeFall(9.8, .5).height_m, 1.225); near(models.freeFall(9.8, .5).velocity_m_s, 4.9);
near(models.freeFall(9.8, 1).height_m / models.freeFall(9.8, .5).height_m, 4);
for (const v0 of [0, 1]) for (const a of [.1, 1]) for (const t of [0, 3]) { const p = models.kinematics(v0, a, t); allFiniteOrState(p); assert.ok(p.position_m <= 8); }
for (const m of [.2, 1]) for (const f of [.1, 1]) { const p = models.newtons(m, f, 2); allFiniteOrState(p); assert.ok(p.position_m <= 10); }
for (const g of [5, 15]) for (const h of [.5, 5]) near(models.freeFall(g, Math.sqrt(2 * h / g)).height_m, h);
for (const bad of [-1, NaN, Infinity]) { assert.throws(() => models.kinematics(.2, .5, bad), RangeError); assert.throws(() => models.freeFall(9.8, bad), RangeError); }
for (const bad of [0, -1, NaN, Infinity]) { assert.throws(() => models.newtons(bad, .6, 1), RangeError); assert.throws(() => models.freeFall(bad, .5), RangeError); }
// Work-energy theorem: the work of the net force changes kinetic energy, not speed linearly.
const energyRun = models.workEnergy(.5, 2, 3, 1);
near(energyRun.work_J, 6); near(energyRun.kinetic_initial_J, .25); near(energyRun.kinetic_final_J, 6.25); near(energyRun.velocity_m_s, 5);
near(energyRun.kinetic_final_J - energyRun.kinetic_initial_J, energyRun.net_force_N * energyRun.position_m);
near(.5 * energyRun.mass_kg * energyRun.velocity_m_s ** 2, energyRun.kinetic_final_J);
near(models.workEnergy(.5, 0, 5, 2).velocity_m_s, 2);
near(models.workEnergy(.5, 3, 0, 2).kinetic_final_J, 1);
near(models.workEnergy(.5, 2, 0).velocity_m_s, 0);
near(models.workEnergy(.5, 2, 4).velocity_m_s / models.workEnergy(.5, 2, 1).velocity_m_s, 2);
near(models.workEnergy(2, 2, 1).velocity_m_s / models.workEnergy(.5, 2, 1).velocity_m_s, .5);

// Uniform circular motion: at fixed angular speed F is proportional to r and omega squared.
const circular = models.centripetal(.2, .5, 4);
near(circular.force_N, 1.6); near(circular.speed_m_s, 2); near(circular.period_s, Math.PI / 2);
near(circular.force_N, circular.mass_kg * circular.speed_m_s ** 2 / circular.radius_m);
near(circular.speed_m_s * circular.period_s, 2 * Math.PI * circular.radius_m);
near(models.centripetal(.4, .5, 4).force_N / circular.force_N, 2);
near(models.centripetal(.2, 1, 4).force_N / circular.force_N, 2);
near(models.centripetal(.2, .5, 8).force_N / circular.force_N, 4);
near(models.centripetal(.2, .5, 8).period_s / circular.period_s, .5);

// Coulomb sliding friction on a level track: stop once, with no artificial backwards motion.
const sliding = models.slidingFriction(2, .2, 4, 1, 10);
near(sliding.friction_N, 4); near(sliding.deceleration_m_s2, 2); near(sliding.stop_time_s, 2); near(sliding.stop_distance_m, 4);
near(sliding.velocity_m_s, 2); near(sliding.position_m, 3); near(sliding.kinetic_J, 4);
near(.5 * sliding.mass_kg * sliding.initial_velocity_m_s ** 2 - sliding.kinetic_J, sliding.friction_N * sliding.position_m);
const slidingStart = models.slidingFriction(2, .2, 4, 0, 10);
near(slidingStart.time_s, 0); near(slidingStart.position_m, 0); near(slidingStart.velocity_m_s, 4);
for (const t of [2, 3, 1e6]) {
  const stopped = models.slidingFriction(2, .2, 4, t, 10);
  near(stopped.time_s, 2); near(stopped.position_m, 4); near(stopped.velocity_m_s, 0); near(stopped.kinetic_J, 0);
}
near(models.slidingFriction(4, .2, 4, 1, 10).velocity_m_s, sliding.velocity_m_s);
near(models.slidingFriction(4, .2, 4, 1, 10).friction_N / sliding.friction_N, 2);
near(models.slidingFriction(2, .4, 4, 0, 10).stop_distance_m / sliding.stop_distance_m, .5);
near(models.slidingFriction(2, .2, 8, 0, 10).stop_distance_m / sliding.stop_distance_m, 4);

// The supplied period is the damped period. Velocity includes the exponential-envelope derivative.
const damped = models.dampedMotion(10, .5, 2, 0);
near(damped.envelope_mm, 10); near(damped.displacement_mm, 10); near(damped.velocity_mm_s, -5);
const dampedQuarter = models.dampedMotion(10, .5, 2, .5);
near(dampedQuarter.displacement_mm, 0); near(dampedQuarter.velocity_mm_s, -Math.PI * 10 * Math.exp(-.25));
const dampedHalf = models.dampedMotion(10, .5, 2, 1);
near(dampedHalf.displacement_mm, -10 * Math.exp(-.5)); near(dampedHalf.velocity_mm_s, 5 * Math.exp(-.5));
near(models.dampedMotion(10, .5, 2, 2).displacement_mm / damped.displacement_mm, Math.exp(-1));
near(models.dampedMotion(10, 0, 2, 0).velocity_mm_s, 0);
near(models.dampedMotion(10, 0, 2, .5).velocity_mm_s, -10 * Math.PI);
near(models.dampedMotion(10, 0, 2, 2).displacement_mm, 10);
const derivativeStep = 1e-5, derivativeTime = .37;
const derivative = (models.dampedMotion(12, .3, 1.7, derivativeTime + derivativeStep).displacement_mm - models.dampedMotion(12, .3, 1.7, derivativeTime - derivativeStep).displacement_mm) / (2 * derivativeStep);
near(models.dampedMotion(12, .3, 1.7, derivativeTime).velocity_mm_s, derivative, 1e-7);
near(models.dampedMotion(10, 1, 2, 1e6).envelope_mm, 0);
near(models.dampedMotion(10, 1, 2, 1e6).velocity_mm_s, 0);

// A tube closed at one end resonates at effective lengths lambda/4 and 3lambda/4.
// The same open-end correction shifts both lengths but cancels from their separation.
const resonance = models.soundResonance(340, 500, 1);
near(resonance.wavelength_m, .68); near(resonance.first_length_cm, 16); near(resonance.second_length_cm, 50); near(resonance.spacing_cm, 34);
near((resonance.first_length_cm + resonance.end_correction_cm) / 100, resonance.wavelength_m / 4);
near((resonance.second_length_cm + resonance.end_correction_cm) / 100, 3 * resonance.wavelength_m / 4);
near(resonance.second_length_cm - resonance.first_length_cm, resonance.spacing_cm);
near(2 * resonance.frequency_Hz * resonance.spacing_cm / 100, resonance.speed_m_s);
near(models.soundResonance(340, 500, 2).first_length_cm, resonance.first_length_cm - 1);
near(models.soundResonance(340, 500, 2).second_length_cm, resonance.second_length_cm - 1);
near(models.soundResonance(340, 500, 2).spacing_cm, resonance.spacing_cm);
near(models.soundResonance(340, 1000).spacing_cm / models.soundResonance(340, 500).spacing_cm, .5);
near(models.soundResonance(680, 500).spacing_cm / models.soundResonance(340, 500).spacing_cm, 2);
assert.ok(models.soundResonance(340, 500, 16.999).first_length_cm > 0);
assert.throws(() => models.soundResonance(340, 500, 17), RangeError);
assert.throws(() => models.soundResonance(340, 500, 18), RangeError);

// kOhm * microfarad is milliseconds; stored energy in microjoules falls as the square of voltage.
const capacitorInitial = models.capacitorDischarge(10, 2, 6, 0);
near(capacitorInitial.tau_ms, 20); near(capacitorInitial.voltage_V, 6); near(capacitorInitial.fraction, 1); near(capacitorInitial.energy_uJ, 36);
const capacitorTau = models.capacitorDischarge(10, 2, 6, 20);
near(capacitorTau.fraction, Math.exp(-1)); near(capacitorTau.voltage_V, 6 / Math.E);
near(capacitorTau.energy_uJ / capacitorInitial.energy_uJ, Math.exp(-2));
near(models.capacitorDischarge(20, 2, 6, 40).fraction, capacitorTau.fraction);
near(models.capacitorDischarge(10, 4, 6, 40).fraction, capacitorTau.fraction);
near(models.capacitorDischarge(10, 2, 12, 20).energy_uJ / capacitorTau.energy_uJ, 4);
near(models.capacitorDischarge(10, 2, 6, 1e6).voltage_V, 0);
near(models.capacitorDischarge(10, 2, 6, 1e6).energy_uJ, 0);

// Bounded teaching parameters give finite values, obey energy balance, and never leave physical limits.
for (const mass of [.2, 1]) for (const force of [0, 2]) for (const x of [0, 4]) for (const v0 of [0, 2]) {
  const p = models.workEnergy(mass, force, x, v0); allFiniteOrState(p);
  near(p.kinetic_final_J - p.kinetic_initial_J, p.work_J); assert.ok(p.velocity_m_s >= v0);
}
for (const mass of [.1, .5]) for (const radius of [.1, 1]) for (const omega of [1, 8]) allFiniteOrState(models.centripetal(mass, radius, omega));
for (const mass of [.2, 2]) for (const mu of [.1, .5]) for (const v0 of [1, 4]) for (const t of [0, .5, 10]) {
  const p = models.slidingFriction(mass, mu, v0, t); allFiniteOrState(p);
  assert.ok(p.time_s <= p.stop_time_s && p.position_m >= 0 && p.position_m <= p.stop_distance_m && p.velocity_m_s >= 0 && p.velocity_m_s <= v0);
  near(.5 * mass * v0 ** 2, p.kinetic_J + p.friction_N * p.position_m, 1e-8);
}
for (const amplitude of [5, 20]) for (const beta of [0, .5]) for (const period of [.5, 3]) for (const t of [0, .3, 1, 8]) {
  const p = models.dampedMotion(amplitude, beta, period, t); allFiniteOrState(p);
  assert.ok(p.envelope_mm >= 0 && p.envelope_mm <= amplitude); assert.ok(Math.abs(p.displacement_mm) <= p.envelope_mm + 1e-12);
}
for (const speed of [320, 360]) for (const frequency of [400, 1000]) for (const correction of [0, 2]) {
  const p = models.soundResonance(speed, frequency, correction); allFiniteOrState(p);
  assert.ok(p.first_length_cm > 0 && p.second_length_cm > p.first_length_cm); near(p.second_length_cm - p.first_length_cm, p.spacing_cm);
}
for (const resistance of [1, 100]) for (const capacitance of [.1, 10]) for (const voltage of [1, 10]) for (const t of [0, 1, 1000]) {
  const p = models.capacitorDischarge(resistance, capacitance, voltage, t); allFiniteOrState(p);
  assert.ok(p.fraction >= 0 && p.fraction <= 1 && p.voltage_V >= 0 && p.voltage_V <= voltage);
  near(p.energy_uJ, .5 * capacitance * p.voltage_V ** 2);
}
for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
  assert.throws(() => models.workEnergy(bad, 1, 1), RangeError);
  assert.throws(() => models.centripetal(bad, .5, 4), RangeError); assert.throws(() => models.centripetal(.2, bad, 4), RangeError); assert.throws(() => models.centripetal(.2, .5, bad), RangeError);
  assert.throws(() => models.slidingFriction(bad, .2, 2, 1), RangeError); assert.throws(() => models.slidingFriction(1, bad, 2, 1), RangeError); assert.throws(() => models.slidingFriction(1, .2, bad, 1), RangeError); assert.throws(() => models.slidingFriction(1, .2, 2, 1, bad), RangeError);
  assert.throws(() => models.dampedMotion(bad, .2, 1, 0), RangeError); assert.throws(() => models.dampedMotion(10, .2, bad, 0), RangeError);
  assert.throws(() => models.soundResonance(bad, 500), RangeError); assert.throws(() => models.soundResonance(340, bad), RangeError);
  assert.throws(() => models.capacitorDischarge(bad, 1, 5, 0), RangeError); assert.throws(() => models.capacitorDischarge(10, bad, 5, 0), RangeError); assert.throws(() => models.capacitorDischarge(10, 1, bad, 0), RangeError);
}
for (const bad of [-1, NaN, Infinity, -Infinity]) {
  assert.throws(() => models.workEnergy(1, bad, 1), RangeError); assert.throws(() => models.workEnergy(1, 1, bad), RangeError); assert.throws(() => models.workEnergy(1, 1, 1, bad), RangeError);
  assert.throws(() => models.slidingFriction(1, .2, 2, bad), RangeError);
  assert.throws(() => models.dampedMotion(10, bad, 1, 0), RangeError); assert.throws(() => models.dampedMotion(10, .2, 1, bad), RangeError);
  assert.throws(() => models.soundResonance(340, 500, bad), RangeError);
  assert.throws(() => models.capacitorDischarge(10, 1, 5, bad), RangeError);
}
assert.throws(() => models.workEnergy(1, Number.MAX_VALUE, 2), RangeError);
assert.throws(() => models.centripetal(1, 1, Number.MAX_VALUE), RangeError);
assert.throws(() => models.slidingFriction(1, Number.MIN_VALUE, 2, 1, Number.MIN_VALUE), RangeError);
assert.throws(() => models.dampedMotion(10, .2, Number.MIN_VALUE, 1), RangeError);
assert.throws(() => models.soundResonance(Number.MAX_VALUE, Number.MIN_VALUE), RangeError);
assert.throws(() => models.capacitorDischarge(Number.MIN_VALUE, Number.MIN_VALUE, 5, 0), RangeError);
assert.throws(() => models.capacitorDischarge(Number.MAX_VALUE, 2, 5, 0), RangeError);
// A constant applied force shifts the Hooke equilibrium; the oscillation is a perturbation about F/k.
const hookeMotionPeriod = models.spring(1, 50).period_s, hookeMotionOmega = 2 * Math.PI / hookeMotionPeriod;
const hookeMotionPhases = [
  [0, .06, 0, -3, -1],
  [.25, .04, -.02 * hookeMotionOmega, -2, 0],
  [.5, .02, 0, -1, 1],
  [.75, .04, .02 * hookeMotionOmega, -2, 0],
  [1, .06, 0, -3, -1]
];
for (const [phase, extension, velocity, restoring, net] of hookeMotionPhases) {
  const p = models.hookeMotion(50, 2, phase * hookeMotionPeriod);
  near(p.period_s, hookeMotionPeriod); near(p.mass_kg, 1); near(p.amplitude_m, .02);
  near(p.equilibrium_extension_m, .04); near(p.equilibrium_extension_cm, 4);
  near(p.instant_extension_m, extension); near(p.instant_extension_cm, extension * 100);
  near(p.velocity_m_s, velocity); near(p.restoring_force_N, restoring); near(p.net_force_N, net);
  near(p.net_force_N, p.external_force_N + p.restoring_force_N);
  near(p.net_force_N, -p.stiffness_N_m * p.displacement_from_equilibrium_m);
}
const compressedSpring = models.hookeMotion(50, 0, hookeMotionPeriod / 2);
near(compressedSpring.equilibrium_extension_m, 0); near(compressedSpring.instant_extension_m, -.02);
near(compressedSpring.restoring_force_N, 1); near(compressedSpring.net_force_N, 1);
for (const time of [0, .1, .5, 1, 10]) {
  const staticSpring = models.hookeMotion(50, 2, time, 1, 0);
  near(staticSpring.instant_extension_m, .04); near(staticSpring.displacement_from_equilibrium_m, 0);
  near(staticSpring.velocity_m_s, 0); near(staticSpring.net_force_N, 0);
}
const hookeMotionStiffPeriod = models.hookeMotion(200, 2, 0).period_s;
const hookeMotionHeavyPeriod = models.hookeMotion(50, 2, 0, 4).period_s;
near(hookeMotionStiffPeriod / hookeMotionPeriod, .5); near(hookeMotionHeavyPeriod / hookeMotionPeriod, 2);
const hookeSpeedBase = models.hookeMotion(50, 2, hookeMotionPeriod / 4).velocity_m_s;
near(models.hookeMotion(200, 2, hookeMotionStiffPeriod / 4).velocity_m_s / hookeSpeedBase, 2);
near(models.hookeMotion(50, 2, hookeMotionHeavyPeriod / 4, 4).velocity_m_s / hookeSpeedBase, .5);
near(models.hookeMotion(50, 0, 0).period_s, models.hookeMotion(50, 4, 0).period_s);
// The sum of perturbation kinetic energy and effective spring energy stays fixed.
for (const stiffness of [20, 100]) for (const force of [0, 4]) for (const mass of [.5, 2]) for (const amplitude of [0, .02]) {
  const period = models.spring(mass, stiffness).period_s;
  for (let sample = 0; sample <= 32; sample++) {
    const p = models.hookeMotion(stiffness, force, period * sample / 16, mass, amplitude); allFiniteOrState(p);
    near(p.net_force_N, p.external_force_N + p.restoring_force_N);
    near(p.net_force_N, -stiffness * p.displacement_from_equilibrium_m);
    near(p.instant_extension_m - p.equilibrium_extension_m, p.displacement_from_equilibrium_m);
    near(.5 * mass * p.velocity_m_s ** 2 + .5 * stiffness * p.displacement_from_equilibrium_m ** 2, .5 * stiffness * amplitude ** 2);
  }
}
for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
  assert.throws(() => models.hookeMotion(bad, 2, 0), RangeError);
  assert.throws(() => models.hookeMotion(50, 2, 0, bad), RangeError);
}
for (const bad of [-1, NaN, Infinity, -Infinity]) {
  assert.throws(() => models.hookeMotion(50, bad, 0), RangeError);
  assert.throws(() => models.hookeMotion(50, 2, bad), RangeError);
  assert.throws(() => models.hookeMotion(50, 2, 0, 1, bad), RangeError);
}
assert.throws(() => models.hookeMotion(50, 2, 0, 1, Number.MAX_VALUE), RangeError);
console.log("Academy physical models: twenty-seven lessons, Hooke equilibrium perturbations, motion and energy invariants, damping derivatives, resonance correction, discharge units and invalid domains passed.");
