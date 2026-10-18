"use strict";
(() => {
  const progressValue = progress => {
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError("教学进度须为 0 至 1 之间的有限数。");
    return progress;
  };
  const text = (ctx, parent, x, y, label, attrs = {}) => parent.append(ctx.svgEl("text", {x, y, class: "academy-axis-label", ...attrs}, label));
  const node = (ctx, id) => ctx.stage?.querySelector(`#${id}`);
  const attrs = (ctx, id, values) => { const el = node(ctx, id); if (el) for (const [key, value] of Object.entries(values)) el.setAttribute(key, String(value)); };
  const caption = (ctx, id, value) => { const el = node(ctx, id); if (el) el.textContent = value; };
  const circuitPoint = fraction => {
    const width = 430, height = 130, distance = ((fraction % 1) + 1) % 1 * 2 * (width + height);
    if (distance <= width) return {x: 85 + distance, y: 55};
    if (distance <= width + height) return {x: 515, y: 55 + distance - width};
    if (distance <= width * 2 + height) return {x: 515 - (distance - width - height), y: 185};
    return {x: 85, y: 185 - (distance - width * 2 - height)};
  };
  const specs = {
    ohms_law: {
      duration: 6, loop: true, timeMode: "teaching",
      note: "正电荷标记沿常规电流方向移动；参数固定时电流恒定。将电压设为 0，标记就停止。",
      conditionNote: "电荷标记仅示常规电流方向；其数量、间距和播放速度不标定实际电荷漂移速度或电流大小。电子漂移方向与常规电流相反。",
      sample(p, progress, models) {
        const phase = progressValue(progress), result = models.ohms(p.resistance, p.voltage);
        return {...result, active: result.current_mA > 0, flow_fraction: result.current_mA > 0 ? phase : 0};
      },
      readout(s, p, number) { return `恒定直流：U = ${number(s.voltage_V)} V，I = ${number(s.current_mA)} mA，R = ${number(s.resistance_ohm)} Ω。${s.active ? "标记仅示常规电流方向。" : "电流为 0，电荷标记停止。"}`; },
      mount(ctx) {
        const p = ctx.params, drawing = ctx.schematic("恒定直流回路；正电荷标记示意常规电流方向，不表示实际漂移速度。", 250);
        drawing.append(ctx.svgEl("path", {d: "M85,105V55H515V185H85V135", class: "academy-model-line"}), ctx.svgEl("line", {x1: 64, x2: 106, y1: 110, y2: 110, class: "academy-support"}), ctx.svgEl("line", {x1: 74, x2: 96, y1: 130, y2: 130, class: "academy-support"}), ctx.svgEl("rect", {x: 245, y: 42, width: 110, height: 26, class: "academy-mass"}));
        text(ctx, drawing, 300, 28, `R = ${ctx.number(p.resistance)} Ω`, {"text-anchor": "middle"});
        text(ctx, drawing, 112, 113, "+"); text(ctx, drawing, 112, 137, "−");
        text(ctx, drawing, 300, 225, `U = ${ctx.number(p.voltage)} V · 正电荷标记 → 常规电流`, {"text-anchor": "middle"});
        for (let i = 0; i < 8; i++) drawing.append(ctx.svgEl("circle", {id: `electricOhmsCharge${i}`, cx: 85, cy: 55, r: 6, fill: "#a72b44", stroke: "#fff", "stroke-width": 1.5}));
        return drawing;
      },
      paint(ctx, s) {
        for (let i = 0; i < 8; i++) { const p = circuitPoint(s.flow_fraction + i / 8); attrs(ctx, `electricOhmsCharge${i}`, {cx: p.x, cy: p.y, opacity: s.active ? 1 : .25}); }
      }
    },
    rc_time_constant: {
      duration: 6, loop: false, timeMode: "teaching",
      note: "自动游标从 0 播放到 5τ；观察时刻滑杆仍是独立的探针，调节它不会把自动游标当作实测数据。",
      conditionNote: "6 个教学秒展示 0–5τ 的真实模型过程，播放速度与物理毫秒分开；电压条以 5 V 为满量程。",
      sample(p, progress, models) {
        const phase = progressValue(progress), tau = p.resistance * p.capacitance;
        const result = models.rc(p.resistance, p.capacitance, phase * 5 * tau, p.discharge);
        const probe = models.rc(p.resistance, p.capacitance, p.time * tau, p.discharge);
        return {...result, time_in_tau: phase * 5, charged_fraction: result.voltage_V / 5, current_fraction: Math.exp(-phase * 5), probe_time_ms: probe.time_ms, probe_voltage_V: probe.voltage_V, cursor: {x: result.time_ms, y: result.voltage_V, maxX: 5 * tau, maxY: 5.5}};
      },
      readout(s, p, number) { return `自动${p.discharge ? "放电" : "充电"}：t = ${number(s.time_ms)} ms（${number(s.time_in_tau)}τ），Vc = ${number(s.voltage_V)} V；选定观察点仍为 ${number(p.time)}τ，电压 ${number(s.probe_voltage_V)} V。`; },
      mount(ctx) {
        const p = ctx.params, probe = ctx.models.rc(p.resistance, p.capacitance, p.time * p.resistance * p.capacitance, p.discharge);
        ctx.readings.replaceChildren(); ctx.reading(ctx.readings, "时间常数 τ", `${ctx.number(probe.tau_ms)} ms`); ctx.reading(ctx.readings, `选定观察时刻 ${ctx.number(p.time)}τ`, `${ctx.number(probe.voltage_V)} V`);
        const drawing = ctx.schematic(`RC ${p.discharge ? "放电，电源已断开" : "充电，接入5伏电源"}，电压条随自动游标更新。`, 265);
        drawing.append(ctx.svgEl("path", {d: "M100,85V55H450V108M450,135V190H100V145", class: "academy-model-line"}), ctx.svgEl("rect", {x: 235, y: 42, width: 90, height: 26, class: "academy-mass"}), ctx.svgEl("line", {x1: 420, x2: 480, y1: 110, y2: 110, class: "academy-support"}), ctx.svgEl("line", {x1: 420, x2: 480, y1: 133, y2: 133, class: "academy-support"}));
        if (p.discharge) {
          drawing.append(ctx.svgEl("line", {x1: 100, x2: 100, y1: 85, y2: 145, class: "academy-model-line"}));
          text(ctx, drawing, 125, 125, "电源断开");
        } else {
          drawing.append(ctx.svgEl("line", {x1: 78, x2: 122, y1: 100, y2: 100, class: "academy-support"}), ctx.svgEl("line", {x1: 88, x2: 112, y1: 130, y2: 130, class: "academy-support"}), ctx.svgEl("line", {x1: 100, x2: 100, y1: 85, y2: 100, class: "academy-model-line"}), ctx.svgEl("line", {x1: 100, x2: 100, y1: 130, y2: 145, class: "academy-model-line"}));
          text(ctx, drawing, 130, 121, "5 V");
        }
        text(ctx, drawing, 280, 28, `R = ${ctx.number(p.resistance)} kΩ`, {"text-anchor": "middle"});
        text(ctx, drawing, 315, 158, `C = ${ctx.number(p.capacitance)} μF`);
        drawing.append(ctx.svgEl("rect", {x: 525, y: 55, width: 25, height: 135, fill: "#fff", stroke: "#89988d"}), ctx.svgEl("rect", {id: "electricRcVoltage", x: 526, y: 189, width: 23, height: 0, fill: "#1d5b72"}));
        text(ctx, drawing, 537, 42, "5 V", {"text-anchor": "middle"}); text(ctx, drawing, 537, 214, "0", {"text-anchor": "middle"});
        text(ctx, drawing, 300, 247, "自动游标：t = 0 ms，Vc = 0 V", {id: "electricRcCaption", "text-anchor": "middle"});
        return drawing;
      },
      paint(ctx, s) {
        const height = 133 * s.charged_fraction;
        attrs(ctx, "electricRcVoltage", {height, y: 189 - height});
        caption(ctx, "electricRcCaption", `自动游标：${ctx.number(s.time_in_tau)}τ · Vc = ${ctx.number(s.voltage_V)} V`);
      }
    },
    resistivity: {
      duration: 6, loop: true, timeMode: "teaching",
      note: "导线中移动的是常规电流方向标记。为比较同一电压下的导电情况，本示意额外假设两端保持 1 V。",
      conditionNote: "R 仍由 ρL/A 计算。动画仅示常规电流方向；固定示意电压 U=1 V 时 I=1/R。标记速度不代表实际漂移速度或电流数值，不模拟导线发热。",
      sample(p, progress, models) {
        const phase = progressValue(progress), result = models.resistivity(p.rho, p.length, p.diameter);
        return {...result, assumed_voltage_V: 1, assumed_current_A: 1 / result.resistance_ohm, flow_fraction: phase};
      },
      readout(s, p, number) { return `R = ${number(s.resistance_ohm)} Ω，A = ${number(s.area_mm2)} mm²；仅在示意假设 U = 1 V 下，I = ${number(s.assumed_current_A)} A。标记只示从高电势端到低电势端的常规电流方向。`; },
      mount(ctx) {
        const p = ctx.params, drawing = ctx.schematic("均匀导线中的常规电流方向标记；假设两端恒为1伏，不按标记速度推断电流。", 255), width = 420 * p.length / 2, thickness = 10 + p.diameter * 25;
        drawing.append(ctx.svgEl("rect", {x: 75, y: 108 - thickness / 2, width, height: thickness, rx: thickness / 2, class: "academy-wire"}), ctx.svgEl("ellipse", {cx: 75 + width, cy: 108, rx: thickness / 4, ry: thickness / 2, class: "academy-wire-end"}));
        drawing.append(ctx.svgEl("path", {d: `M75,58H${75 + width}m-9,-5l9,5l-9,5`, class: "academy-ray"}));
        text(ctx, drawing, 75, 35, "高电势 +"); text(ctx, drawing, 75 + width, 150, "− 低电势", {"text-anchor": "end"});
        text(ctx, drawing, 300, 190, `假设 U = 1 V · L = ${ctx.number(p.length)} m · d = ${ctx.number(p.diameter)} mm`, {"text-anchor": "middle"});
        text(ctx, drawing, 300, 227, "标记只示电流方向；不表示真实漂移速度", {"text-anchor": "middle"});
        for (let i = 0; i < 5; i++) drawing.append(ctx.svgEl("circle", {id: `electricWireCharge${i}`, cx: 75, cy: 108, r: 4.5, fill: "#a72b44", stroke: "#fff", "stroke-width": 1}));
        return drawing;
      },
      paint(ctx, s) {
        const width = 420 * s.length_m / 2;
        for (let i = 0; i < 5; i++) attrs(ctx, `electricWireCharge${i}`, {cx: 75 + ((s.flow_fraction + i / 5) % 1) * width});
      }
    },
    joule_heating: {
      duration: 6, loop: false, timeMode: "teaching",
      note: "6 个教学秒展示从接通电流到选定通电终点的过程；输入电能、水吸热和温度计同时增长。电流或通电时间为 0 时不会升温。",
      conditionNote: "动画时间压缩至6个教学秒，物理时间仍按通电时间读数。能量条共用 0–15,000 J 尺度，温度计显示相对20 ℃的0–18 ℃温升；不模拟沸腾或相变。",
      sample(p, progress, models) {
        const phase = progressValue(progress), result = models.joule(p.current, p.resistance, phase * p.time, p.mass, p.efficiency);
        return {...result, selected_final_time_s: p.time, progress_fraction: phase, cursor: {x: result.time_s, y: result.temperature_rise_C, maxX: 180, maxY: 18}};
      },
      readout(s, p, number) { return `过程 t = ${number(s.time_s)} / ${number(s.selected_final_time_s)} s：输入 ${number(s.electrical_energy_J)} J，水吸热 ${number(s.water_heat_J)} J，水温 ${number(s.final_C)} ℃。${s.current_A === 0 || s.selected_final_time_s === 0 ? "本次没有焦耳热积累。" : "能量条与温升由同一模型计算。"}`; },
      mount(ctx) {
        const p = ctx.params, end = ctx.models.joule(p.current, p.resistance, p.time, p.mass, p.efficiency);
        ctx.readings.replaceChildren(); ctx.reading(ctx.readings, "选定通电终点", `${ctx.number(p.time)} s`); ctx.reading(ctx.readings, "终点温升 ΔT", `${ctx.number(end.temperature_rise_C)} ℃`);
        const drawing = ctx.schematic("焦耳热随实际通电时间积累；输入电能与水吸热同尺度，温度计显示相对20摄氏度的温升。", 280);
        for (const [label, id, y, cls] of [["输入电能", "electricJouleInput", 55, "academy-heat-release"], ["水吸热", "electricJouleWater", 115, "academy-heat-absorb"]]) {
          text(ctx, drawing, 25, y + 20, label); drawing.append(ctx.svgEl("rect", {x: 130, y, width: 280, height: 28, fill: "#e1e4de"}), ctx.svgEl("rect", {id, x: 130, y, width: 0, height: 28, class: cls}));
        }
        text(ctx, drawing, 130, 175, "0–15,000 J · 两条共用尺度");
        drawing.append(ctx.svgEl("rect", {x: 495, y: 53, width: 20, height: 130, rx: 8, fill: "#fff", stroke: "#89988d"}), ctx.svgEl("rect", {id: "electricJouleThermometer", x: 500, y: 180, width: 10, height: 0, fill: "#a72b44"}), ctx.svgEl("circle", {cx: 505, cy: 189, r: 15, fill: "#a72b44"}));
        text(ctx, drawing, 505, 36, "+18 ℃", {"text-anchor": "middle"}); text(ctx, drawing, 505, 230, "20 ℃起", {"text-anchor": "middle"});
        text(ctx, drawing, 300, 260, "t = 0 s · 水温 20 ℃", {id: "electricJouleCaption", "text-anchor": "middle"});
        return drawing;
      },
      paint(ctx, s) {
        attrs(ctx, "electricJouleInput", {width: s.electrical_energy_J / 15000 * 280}); attrs(ctx, "electricJouleWater", {width: s.water_heat_J / 15000 * 280});
        const height = s.temperature_rise_C / 18 * 124; attrs(ctx, "electricJouleThermometer", {height, y: 180 - height});
        caption(ctx, "electricJouleCaption", `t = ${ctx.number(s.time_s)} s · 水温 ${ctx.number(s.final_C)} ℃ · η = ${ctx.number(s.efficiency)}`);
      }
    },
    transformer_ratio: {
      duration: 6, loop: true, timeMode: "teaching",
      note: "交流输入按 50 Hz 建模，每个 20 ms 的物理周期放大为 2 个教学秒。观察两侧瞬时电压如何一起换向，滑杆与原图仍使用有效值。",
      conditionNote: "假设50 Hz正弦交流，按同名端约定两侧电压同相；一个物理周期20 ms放大至2教学秒。波形共用同一电压纵轴；理想空载只演示电压，不表示负载功率或能量传输。",
      sample(p, progress, models) {
        const phase = progressValue(progress), result = models.transformer(p.primary, p.secondary, p.voltage), angle = phase * 6 * Math.PI;
        return {...result, frequency_Hz: 50, physical_time_ms: phase * 60, teaching_time_s: phase * 6, phase_rad: angle, cycle_fraction: (phase * 3) % 1, primary_peak_V: Math.SQRT2 * result.primary_V_rms, secondary_peak_V: Math.SQRT2 * result.secondary_V_rms, primary_instant_V: Math.SQRT2 * result.primary_V_rms * Math.sin(angle), secondary_instant_V: Math.SQRT2 * result.secondary_V_rms * Math.sin(angle)};
      },
      readout(s, p, number) {
        const u1 = Math.abs(s.primary_instant_V) < 1e-10 ? 0 : s.primary_instant_V, u2 = Math.abs(s.secondary_instant_V) < 1e-10 ? 0 : s.secondary_instant_V;
        return `物理时间 ${number(s.physical_time_ms)} ms（50 Hz，已慢放）：u₁瞬时 = ${number(u1)} V，u₂瞬时 = ${number(u2)} V；U₁有效 = ${number(s.primary_V_rms)} V，U₂有效 = ${number(s.secondary_V_rms)} V。理想空载。`;
      },
      mount(ctx) {
        const p = ctx.params, result = ctx.models.transformer(p.primary, p.secondary, p.voltage), maxPeak = Math.SQRT2 * Math.max(result.primary_V_rms, result.secondary_V_rms) || 1, drawing = ctx.schematic("理想空载变压器的同相瞬时电压；相同电压尺度，50赫兹按每周期2教学秒慢放。", 370);
        drawing.append(ctx.svgEl("rect", {x: 220, y: 27, width: 160, height: 115, class: "academy-core"}), ctx.svgEl("rect", {x: 245, y: 50, width: 110, height: 65, class: "academy-core-gap"}));
        for (const x of [230, 370]) for (let i = 0; i < 7; i++) drawing.append(ctx.svgEl("ellipse", {cx: x, cy: 42 + i * 14, rx: 17, ry: 6, class: "academy-coil"}));
        drawing.append(ctx.svgEl("circle", {cx: 205, cy: 34, r: 4, fill: "#19354f"}), ctx.svgEl("circle", {cx: 395, cy: 34, r: 4, fill: "#19354f"}));
        text(ctx, drawing, 25, 43, `N₁ = ${p.primary}`); text(ctx, drawing, 425, 43, `N₂ = ${p.secondary}`);
        text(ctx, drawing, 25, 78, `有效 ${ctx.number(result.primary_V_rms)} V`); text(ctx, drawing, 425, 78, `有效 ${ctx.number(result.secondary_V_rms)} V`);
        text(ctx, drawing, 25, 114, "u₁ = 0 V", {id: "electricTransformerPrimary"}); text(ctx, drawing, 425, 114, "u₂ = 0 V", {id: "electricTransformerSecondary"});
        text(ctx, drawing, 300, 168, "• 同名端约定 · 极性随瞬时电压换向", {"text-anchor": "middle"});
        drawing.append(ctx.svgEl("line", {x1: 50, x2: 550, y1: 260, y2: 260, class: "academy-rest-line"}));
        for (const [peak, color] of [[Math.SQRT2 * result.primary_V_rms, "#19354f"], [Math.SQRT2 * result.secondary_V_rms, "#a72b44"]]) {
          const d = Array.from({length: 121}, (_, i) => `${i ? "L" : "M"}${50 + 500 * i / 120},${260 - peak / maxPeak * 57 * Math.sin(2 * Math.PI * i / 120)}`).join(" ");
          drawing.append(ctx.svgEl("path", {d, fill: "none", stroke: color, "stroke-width": 2.5}));
        }
        drawing.append(ctx.svgEl("line", {id: "electricTransformerCursor", x1: 50, x2: 50, y1: 195, y2: 325, stroke: "#89988d", "stroke-dasharray": "4 4"}), ctx.svgEl("circle", {id: "electricTransformerPoint1", cx: 50, cy: 260, r: 5, fill: "#19354f"}), ctx.svgEl("circle", {id: "electricTransformerPoint2", cx: 50, cy: 260, r: 5, fill: "#a72b44"}));
        text(ctx, drawing, 50, 192, `共同电压尺度：±${ctx.number(maxPeak)} V`); text(ctx, drawing, 300, 353, "蓝：u₁ · 红：u₂ · 横向为一个20 ms物理周期", {"text-anchor": "middle"});
        return drawing;
      },
      paint(ctx, s) {
        const x = 50 + 500 * s.cycle_fraction, maxPeak = Math.max(s.primary_peak_V, s.secondary_peak_V) || 1, sign = value => Math.abs(value) < 1e-10 ? "0" : value > 0 ? "+" : "−";
        attrs(ctx, "electricTransformerCursor", {x1: x, x2: x}); attrs(ctx, "electricTransformerPoint1", {cx: x, cy: 260 - s.primary_instant_V / maxPeak * 57}); attrs(ctx, "electricTransformerPoint2", {cx: x, cy: 260 - s.secondary_instant_V / maxPeak * 57});
        caption(ctx, "electricTransformerPrimary", `u₁ = ${sign(s.primary_instant_V)}${Math.abs(s.primary_instant_V) < 1e-10 ? "" : ctx.number(Math.abs(s.primary_instant_V))} V`);
        caption(ctx, "electricTransformerSecondary", `u₂ = ${sign(s.secondary_instant_V)}${Math.abs(s.secondary_instant_V) < 1e-10 ? "" : ctx.number(Math.abs(s.secondary_instant_V))} V`);
      }
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = specs;
  if (typeof window !== "undefined") Object.assign(window.LabAcademyAnimationModules ||= {}, specs);
})();
