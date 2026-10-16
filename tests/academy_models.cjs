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
console.log("Academy physical models: all invariants passed.");
