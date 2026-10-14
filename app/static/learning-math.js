"use strict";
// Numeric helpers are shared by the learning views and their edge-case tests.
const LabLearning = {
  numberList(text) {
    const tokens = String(text).trim().split(/[,，\s]+/).filter(Boolean);
    const values = tokens.map(Number);
    if (!tokens.length || values.some(v => !Number.isFinite(v))) throw new Error("请填写有限数值，用逗号分隔。");
    return values;
  },
  mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; },
  rc({ times, voltage, resistance, capacitance, finalVoltage }) {
    if (times.length < 3 || times.length !== voltage.length) throw new Error("至少填写 3 对时间、电压读数，两个列表的数量必须一致。");
    if (![...times, ...voltage, resistance, capacitance, finalVoltage].every(Number.isFinite)) throw new Error("读数必须为有限数值。");
    if (resistance <= 0 || capacitance <= 0 || finalVoltage <= voltage[0]) throw new Error("R、C 应大于 0，充电终值应高于初始电压。");
    if (times[0] !== 0 || times.some((t, i) => t < 0 || (i > 0 && t <= times[i - 1]))) throw new Error("请以充电开始为 0 ms，时间读数按严格递增顺序填写。");
    const tau = resistance * capacitance;
    if (!Number.isFinite(tau) || tau <= 0) throw new Error("R、C 的乘积超出可计算范围，请核对数量级。");
    const threshold = voltage[0] + (1 - Math.exp(-1)) * (finalVoltage - voltage[0]);
    let measuredTau = null;
    for (let i = 1; i < voltage.length; i++) {
      if (voltage[i - 1] <= threshold && voltage[i] >= threshold && voltage[i] > voltage[i - 1]) {
        measuredTau = (times[i - 1] + (threshold - voltage[i - 1]) / (voltage[i] - voltage[i - 1]) * (times[i] - times[i - 1])) / 1000;
        break;
      }
    }
    const maxTime = Math.max(times.at(-1), tau * 3000);
    const model = Array.from({ length: 81 }, (_, i) => {
      const t = maxTime * i / 80;
      return { x: t, y: finalVoltage + (voltage[0] - finalVoltage) * Math.exp(-t / (1000 * tau)) };
    });
    return { tau, threshold, measuredTau, model, points: times.map((x, i) => ({ x, y: voltage[i] })) };
  },
  pendulum({ length, count, times }) {
    if (!Number.isFinite(length) || length <= 0 || !Number.isInteger(count) || count < 1 || times.length < 2 || times.some(t => !Number.isFinite(t) || t <= 0)) throw new Error("摆长应大于 0，周期数应为正整数，至少填写 2 次有效计时。");
    const periods = times.map(t => t / count);
    const meanPeriod = this.mean(periods);
    const sd = Math.sqrt(periods.reduce((a, v) => a + (v - meanPeriod) ** 2, 0) / (periods.length - 1));
    const g = 4 * Math.PI ** 2 * length / meanPeriod ** 2;
    if (![g, meanPeriod, sd].every(Number.isFinite) || g <= 0) throw new Error("计算超出有效范围，请核对单位与计时。");
    return { periods, meanPeriod, sd, g, points: periods.map((y, i) => ({ x: i + 1, y })) };
  },
  convert(value, unit) {
    const units = { mA: [0.001, "A"], kΩ: [1000, "Ω"], μF: [0.000001, "F"], nF: [0.000000001, "F"], ms: [0.001, "s"], cm: [0.01, "m"] };
    if (!Number.isFinite(value) || !units[unit]) return null;
    const result = value * units[unit][0];
    return Number.isFinite(result) ? { value: result, unit: units[unit][1] } : null;
  },
};
if (typeof module !== "undefined") module.exports = LabLearning;
