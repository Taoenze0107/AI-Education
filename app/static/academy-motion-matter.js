/* Five classroom animations. Pure samples are also exported for numerical tests. */
(() => {
  "use strict";
  const clamp = value => {
    if (!Number.isFinite(value)) throw new RangeError("教学进度须为有限数。");
    return Math.max(0, Math.min(1, value));
  };
  const part = (stage, name) => stage?.querySelector(`[data-motion="${name}"]`);
  const attrs = (stage, name, values) => { const node = part(stage, name); if (node) for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value)); };
  const text = (stage, name, value) => { const node = part(stage, name); if (node) node.textContent = value; };
  const element = (ctx, tag, name, properties = {}, label) => ctx.svgEl(tag, {"data-motion": name, ...properties}, label);
  const stageFor = (ctx, label, height) => { const stage = ctx.schematic(label, height); stage.setAttribute("id", "academyMotionDrawing"); return stage; };
  const arrowPath = (x1, y1, x2, y2) => {
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return "";
    const direction = Math.atan2(y2 - y1, x2 - x1), wing = 7;
    return `M${x1},${y1}L${x2},${y2}M${x2 - wing * Math.cos(direction - .55)},${y2 - wing * Math.sin(direction - .55)}L${x2},${y2}L${x2 - wing * Math.cos(direction + .55)},${y2 - wing * Math.sin(direction + .55)}`;
  };
  const heatColor = temp => { const amount = Math.max(0, Math.min(1, temp / 100)); return `rgb(${Math.round(55 + 160 * amount)},${Math.round(133 - 65 * amount)},${Math.round(165 - 100 * amount)})`; };
  const clearReadings = ctx => ctx.readings?.replaceChildren();
  const addReading = (ctx, label, value) => { if (ctx.readings) ctx.reading(ctx.readings, label, value); };

  const specs = {
    calorimetry: {
      duration: 6, loop: false, timeMode: "teaching",
      note: "6 秒教学进度展示 0–5τ 的换热；不表示真实实验只需 6 秒。结束时温差仍有初值的 e⁻⁵，并未瞬间完全相等。",
      conditionNote: "动态补充假设：金属与水各自温度均匀，有效热导 G = 2 W/K 恒定，外界绝热；τ = C金C水/[G(C金+C水)]。色彩只辅助示意温度，读数与能量守恒按模型计算。",
      sample(p, progress, models) {
        const q = clamp(progress), target = models.calorimetry(p.metalMass, p.waterMass, p.waterTemp, p.metalTemp, p.specific);
        const metalCapacity = p.metalMass / 1000 * p.specific, waterCapacity = p.waterMass / 1000 * 4180;
        const conductance = 2, tau = metalCapacity * waterCapacity / (conductance * (metalCapacity + waterCapacity));
        const fraction = -Math.expm1(-5 * q), metalTemp = p.metalTemp - (p.metalTemp - target.equilibrium_C) * fraction;
        const waterTemp = p.waterTemp + (target.equilibrium_C - p.waterTemp) * fraction;
        return {progress: q, model_time_s: 5 * tau * q, tau_s: tau, conductance_W_K: conductance,
          metal_capacity_J_K: metalCapacity, water_capacity_J_K: waterCapacity,
          metal_temp_C: metalTemp, water_temp_C: waterTemp, equilibrium_C: target.equilibrium_C,
          released_J: metalCapacity * (p.metalTemp - metalTemp), absorbed_J: waterCapacity * (waterTemp - p.waterTemp),
          limiting_heat_J: target.absorbed_J, temperature_difference_C: metalTemp - waterTemp,
          heat_flow_W: conductance * (metalTemp - waterTemp)};
      },
      readout(s, p, number) {
        return `假设模型 t = ${number(s.model_time_s)} s · 金属 ${number(s.metal_temp_C)} ℃，水 ${number(s.water_temp_C)} ℃ · 金属放热 ${number(s.released_J)} J = 水吸热 ${number(s.absorbed_J)} J · 余温差 ${number(s.temperature_difference_C)} ℃`;
      },
      mount(ctx) {
        const {params: p, models, number, svgEl} = ctx, target = models.calorimetry(p.metalMass, p.waterMass, p.waterTemp, p.metalTemp, p.specific);
        clearReadings(ctx); addReading(ctx, "理论平衡温度（极限）", `${number(target.equilibrium_C)} ℃`); addReading(ctx, "理论交换热量（极限）", `${number(target.absorbed_J)} J`);
        const stage = stageFor(ctx, "热金属浸在水中，温度逐渐靠近，金属放热始终等于水吸热。", 285);
        stage.append(svgEl("path", {d: "M65,48V225H315V48", class: "academy-support", fill: "none"}),
          element(ctx, "rect", "heat-water", {x: 67, y: 88, width: 246, height: 135, "fill-opacity": .4}),
          svgEl("line", {x1: 67, x2: 313, y1: 88, y2: 88, class: "academy-axis"}),
          element(ctx, "rect", "heat-metal", {x: 153, y: 124, width: 75, height: 75, rx: 4, stroke: "#173e5d", "stroke-width": 2}),
          element(ctx, "path", "heat-left-arrow", {class: "academy-ray", fill: "none"}), element(ctx, "path", "heat-right-arrow", {class: "academy-ray", fill: "none"}),
          svgEl("text", {x: 171, y: 166, class: "academy-tick", style: "fill: #fff"}, "金属"),
          svgEl("text", {x: 75, y: 70, class: "academy-axis-label"}, "水与金属接触换热"),
          svgEl("text", {x: 68, y: 252, class: "academy-tick"}, "箭头：金属向水放热；外界绝热"));
        for (const [name, x, label, fill] of [["metal", 385, "金属", "#9a3444"], ["water", 485, "水", "#426c85"]]) {
          stage.append(svgEl("rect", {x, y: 65, width: 26, height: 130, fill: "#e3e4df", stroke: "#a2ada8"}),
            element(ctx, "rect", `heat-${name}-bar`, {x, y: 195, width: 26, height: 0, fill}),
            svgEl("line", {x1: x - 7, x2: x + 34, y1: 195 - target.equilibrium_C / 100 * 130, y2: 195 - target.equilibrium_C / 100 * 130, class: "academy-rest-line"}),
            svgEl("text", {x: x - 3, y: 45, class: "academy-axis-label"}, label),
            element(ctx, "text", `heat-${name}-label`, {x: x - 16, y: 225, class: "academy-tick"}, ""));
        }
        stage.append(svgEl("text", {x: 366, y: 267, class: "academy-tick"}, "虚线：极限平衡温度"));
        return stage;
      },
      paint(ctx, s) {
        const stage = ctx.stage, number = ctx.number;
        attrs(stage, "heat-water", {fill: heatColor(s.water_temp_C)}); attrs(stage, "heat-metal", {fill: heatColor(s.metal_temp_C)});
        attrs(stage, "heat-left-arrow", {d: arrowPath(149, 160, 105, 160), opacity: Math.max(.08, s.temperature_difference_C / (ctx.params.metalTemp - ctx.params.waterTemp))});
        attrs(stage, "heat-right-arrow", {d: arrowPath(232, 160, 277, 160), opacity: Math.max(.08, s.temperature_difference_C / (ctx.params.metalTemp - ctx.params.waterTemp))});
        for (const [name, temp] of [["metal", s.metal_temp_C], ["water", s.water_temp_C]]) {
          attrs(stage, `heat-${name}-bar`, {y: 195 - temp / 100 * 130, height: temp / 100 * 130});
          text(stage, `heat-${name}-label`, `${number(temp)} ℃`);
        }
      }
    },
    archimedes: {
      duration: 6, loop: false, timeMode: "teaching",
      note: "外部装置缓慢下放，排液体积从 0 增至滑杆目标；到目标后停止。不是根据未知物体质量模拟自由沉浮。",
      conditionNote: "动态示意采用溢流杯维持水面，固定物体可排液体积为 200 cm³；外部装置准静态控制浸入深度，接收杯累计液体体积等于排液体积。忽略流动阻力和表面张力。",
      sample(p, progress, models) {
        const q = clamp(progress);
        if (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 200) throw new RangeError("排液目标须在 0–200 cm³。 ");
        const value = models.buoyancy(p.density, p.volume * q);
        return {...value, progress: q, target_volume_cm3: p.volume, immersed_fraction: value.volume_cm3 / 200,
          overflow_volume_cm3: value.volume_cm3, lowering: q > 0 && q < 1 && p.volume > 0,
          cursor: {x: value.volume_cm3, y: value.buoyancy_N, maxX: 200, maxY: 3}};
      },
      readout(s, p, number) { return `准静态下放 · 当前 V排 = ${number(s.volume_cm3)} / 目标 ${number(p.volume)} cm³ · F浮 = ${number(s.buoyancy_N)} N · 已排液 ${number(s.overflow_volume_cm3)} cm³`; },
      mount(ctx) {
        const {params: p, models, number, svgEl} = ctx, target = models.buoyancy(p.density, p.volume);
        clearReadings(ctx); addReading(ctx, "目标排液量对应的浮力", `${number(target.buoyancy_N)} N`); addReading(ctx, "目标排开液体质量", `${number(target.displaced_mass_kg)} kg`);
        const stage = stageFor(ctx, "外部装置在溢流杯中缓慢下放物体，浮力随排液体积增加。", 290);
        stage.append(svgEl("path", {d: "M65,45V235H310V45", class: "academy-support", fill: "none"}),
          svgEl("rect", {x: 67, y: 110, width: 241, height: 123, class: "academy-medium"}),
          svgEl("line", {x1: 67, x2: 310, y1: 110, y2: 110, class: "academy-axis"}),
          svgEl("path", {d: "M310,110H425V160H450", fill: "none", stroke: "#426c85", "stroke-width": 4}),
          svgEl("path", {d: "M440,148V235H550V148", class: "academy-support", fill: "none"}),
          element(ctx, "rect", "buoyancy-overflow-water", {x: 442, y: 233, width: 106, height: 0, class: "academy-submerged"}),
          element(ctx, "rect", "buoyancy-body", {x: 145, y: 30, width: 80, height: 80, class: "academy-mass"}),
          element(ctx, "rect", "buoyancy-wetted-body", {x: 145, y: 110, width: 80, height: 0, class: "academy-submerged"}),
          element(ctx, "line", "buoyancy-cable", {x1: 185, x2: 185, y1: 7, y2: 30, class: "academy-support"}),
          element(ctx, "path", "buoyancy-force", {class: "academy-ray", fill: "none"}),
          element(ctx, "text", "buoyancy-force-label", {x: 330, y: 260, class: "academy-tick"}, ""),
          element(ctx, "text", "buoyancy-volume-label", {x: 442, y: 260, class: "academy-tick"}, ""),
          svgEl("text", {x: 68, y: 277, class: "academy-tick"}, "外部装置控制深度；水面由溢流维持"));
        return stage;
      },
      paint(ctx, s) {
        const stage = ctx.stage, immersed = s.immersed_fraction * 80, top = 30 + immersed, forceLength = s.buoyancy_N / 3 * 95;
        attrs(stage, "buoyancy-body", {y: top}); attrs(stage, "buoyancy-cable", {y2: top});
        attrs(stage, "buoyancy-wetted-body", {y: 110, height: immersed});
        attrs(stage, "buoyancy-overflow-water", {y: 233 - s.immersed_fraction * 60, height: s.immersed_fraction * 60});
        attrs(stage, "buoyancy-force", {d: arrowPath(360, 222, 360, 222 - forceLength), visibility: forceLength > 0 ? "visible" : "hidden"});
        text(stage, "buoyancy-force-label", `F浮 ${ctx.number(s.buoyancy_N)} N`); text(stage, "buoyancy-volume-label", `${ctx.number(s.volume_cm3)} cm³`);
      }
    },
    thermal_expansion: {
      duration: 6, loop: false, timeMode: "teaching",
      note: "外部加热程序把均匀温升从 0 缓慢设定到滑杆目标，6 秒是教学进度，不预测真实加热耗时。伸长示意沿用放大 80 倍。",
      conditionNote: "动态中温升按教学进度匀速增加；仍使用 ΔL = αL₀ΔT，不另行假设热容量或真实加热功率。杆温度均匀，左端固定、右端可自由伸长。",
      sample(p, progress, models) {
        const q = clamp(progress), value = models.expansion(p.alpha, p.length, p.temperature * q);
        return {...value, progress: q, target_rise_C: p.temperature,
          cursor: {x: value.temperature_rise_C, y: value.extension_mm, maxX: 80, maxY: 2.5}};
      },
      readout(s, p, number) { return `当前均匀温升 ΔT = ${number(s.temperature_rise_C)} / 目标 ${number(p.temperature)} ℃ · 真实模型伸长 ΔL = ${number(s.extension_mm)} mm · 当前长度 ${number(s.final_cm, 6)} cm（绘图伸长放大 80 倍）`; },
      mount(ctx) {
        const {params: p, models, number, svgEl} = ctx, target = models.expansion(p.alpha, p.length, p.temperature), width = p.length * 3;
        clearReadings(ctx); addReading(ctx, "目标温升对应的伸长", `${number(target.extension_mm)} mm`); addReading(ctx, "目标温升后的长度", `${number(target.final_cm, 6)} cm`);
        const stage = stageFor(ctx, "均匀加热使金属杆向右伸长，左端固定；伸长绘图放大八十倍。", 285);
        stage.append(svgEl("line", {x1: 60, x2: 60, y1: 45, y2: 163, class: "academy-support"}),
          svgEl("rect", {x: 60, y: 62, width, height: 25, class: "academy-wire"}),
          svgEl("rect", {x: 60, y: 132, width, height: 25, class: "academy-wire"}),
          element(ctx, "rect", "expansion-extra", {x: 60 + width, y: 132, width: 0, height: 25, class: "academy-heat-release"}),
          element(ctx, "line", "expansion-current-end", {x1: 60 + width, x2: 60 + width, y1: 122, y2: 168, class: "academy-ray"}),
          svgEl("line", {x1: 60 + width, x2: 60 + width, y1: 45, y2: 177, class: "academy-rest-line"}),
          svgEl("text", {x: 70, y: 38, class: "academy-axis-label"}, `原长 L₀ = ${number(p.length)} cm`),
          element(ctx, "text", "expansion-length-label", {x: 70, y: 195, class: "academy-axis-label"}, ""),
          element(ctx, "rect", "expansion-heater", {x: 80, y: 214, width: 300, height: 18, fill: "#9a3444", opacity: .15}),
          svgEl("text", {x: 95, y: 261, class: "academy-tick"}, "均匀升温示意；伸长放大 80 倍"),
          svgEl("rect", {x: 510, y: 65, width: 25, height: 130, fill: "#e3e4df", stroke: "#a2ada8"}),
          element(ctx, "rect", "expansion-thermometer", {x: 510, y: 195, width: 25, height: 0, class: "academy-heat-release"}),
          svgEl("text", {x: 486, y: 40, class: "academy-axis-label"}, "温升 ΔT"),
          element(ctx, "text", "expansion-temp-label", {x: 486, y: 227, class: "academy-tick"}, ""));
        return stage;
      },
      paint(ctx, s) {
        const stage = ctx.stage, end = 60 + ctx.params.length * 3, extra = s.extension_mm * 24, bar = s.temperature_rise_C / 80 * 130;
        attrs(stage, "expansion-extra", {width: extra}); attrs(stage, "expansion-current-end", {x1: end + extra, x2: end + extra});
        attrs(stage, "expansion-thermometer", {y: 195 - bar, height: bar}); attrs(stage, "expansion-heater", {opacity: .15 + .75 * s.temperature_rise_C / 80});
        text(stage, "expansion-length-label", `当前伸长 ΔL = ${ctx.number(s.extension_mm)} mm`); text(stage, "expansion-temp-label", `${ctx.number(s.temperature_rise_C)} ℃`);
      }
    },
    string_waves: {
      duration: 2, loop: true, timeMode: "teaching",
      note: "基模轮廓以固定 2 秒观感周期往返，便于看清两端波节和一个波腹；不按真实数十或数百 Hz 快速闪动。真实基频读数由弦参数计算。",
      conditionNote: "动态形状 y/A = sin(πx/L)cosφ，点表示弦上的固定材料位置，只作横向位移，不沿弦输运。振幅为示意；播放相位周期固定，不能从画面节奏读取实际频率。",
      sample(p, progress, models) {
        const q = clamp(progress), value = models.stringWave(p.length, p.tension, p.density), phase = 2 * Math.PI * q, cosine = Math.cos(phase);
        const profile = Array.from({length: 81}, (_, index) => ({fraction: index / 80, displacement_fraction: index === 0 || index === 80 ? 0 : Math.sin(Math.PI * index / 80) * cosine}));
        return {...value, progress: q, phase_rad: phase, center_displacement_fraction: cosine, profile};
      },
      readout(s, p, number) { return `固定 2 s 示意相位 · 中点 y/A = ${number(s.center_displacement_fraction)} · 模型基频 f₁ = ${number(s.fundamental_Hz)} Hz，波速 ${number(s.speed_m_s)} m/s · 两端始终为波节`; },
      mount(ctx) {
        const {params: p, models, number, svgEl} = ctx, value = models.stringWave(p.length, p.tension, p.density), width = p.length / 1.5 * 450;
        const stage = stageFor(ctx, "两端固定弦的基模横向往返，两端不动，中间一个波腹。", 250);
        const envelope = sign => Array.from({length: 81}, (_, i) => `${i ? "L" : "M"}${65 + width * i / 80},${110 - sign * 40 * Math.sin(Math.PI * i / 80)}`).join(" ");
        stage.append(svgEl("line", {x1: 65, x2: 65 + width, y1: 110, y2: 110, class: "academy-rest-line"}),
          svgEl("path", {d: envelope(1), class: "academy-rest-line", fill: "none"}), svgEl("path", {d: envelope(-1), class: "academy-rest-line", fill: "none"}),
          element(ctx, "path", "string-profile", {class: "academy-model-line", fill: "none"}));
        for (const x of [65, 65 + width]) stage.append(svgEl("line", {x1: x, x2: x, y1: 72, y2: 148, class: "academy-support"}), svgEl("circle", {cx: x, cy: 110, r: 4, class: "academy-bob"}));
        for (const [index, fraction] of [[0, .25], [1, .5], [2, .75]]) stage.append(element(ctx, "circle", `string-material-${index}`, {cx: 65 + width * fraction, cy: 110, r: 5, fill: "#9a3444"}));
        stage.append(svgEl("text", {x: 65, y: 32, class: "academy-axis-label"}, "两端波节 · 基模一个波腹"),
          svgEl("text", {x: 65, y: 191, class: "academy-tick"}, `L = ${number(p.length)} m · λ₁ = ${number(value.wavelength_m)} m`),
          svgEl("text", {x: 65, y: 224, class: "academy-tick"}, "固定材料点只上下运动；画面为慢放相位示意"));
        return stage;
      },
      paint(ctx, s) {
        const stage = ctx.stage, width = ctx.params.length / 1.5 * 450;
        attrs(stage, "string-profile", {d: s.profile.map((point, i) => `${i ? "L" : "M"}${65 + width * point.fraction},${110 - 40 * point.displacement_fraction}`).join(" ")});
        for (const [index, at] of [[0, 20], [1, 40], [2, 60]]) attrs(stage, `string-material-${index}`, {cy: 110 - 40 * s.profile[at].displacement_fraction});
      }
    },
    malus_law: {
      duration: 6, loop: true, timeMode: "teaching",
      note: "检偏器从滑杆设定的起始角 θ₀ 连续转动，每 6 秒教学进度转 180°；轴方向每 180° 等价。蓝条为信号，红条为角度无关的背景。",
      conditionNote: "滑杆 θ₀ 是每次演示的起始角；动画当前角 θ 单独显示并沿 I–θ 图移动。转动由外部控制，不模拟机械驱动力；相对光强遵循 cos²θ，90° 时信号为零但背景仍可存在。",
      sample(p, progress, models) {
        const q = clamp(progress);
        models.malus(p.angle, p.intensity, p.background);
        const angle = (p.angle + 180 * q) % 180, value = models.malus(angle, p.intensity, p.background);
        return {...value, progress: q, starting_angle_deg: p.angle,
          cursor: {x: angle, y: value.measured_intensity, maxX: 180, maxY: 1.3}};
      },
      readout(s, p, number) { return `起始角 θ₀ = ${number(p.angle)}° · 当前 θ = ${number(s.angle_deg)}° · 信号 ${number(s.signal_intensity)} + 背景 ${number(s.background)} = 测得光强 ${number(s.measured_intensity)}（相对单位）`; },
      mount(ctx) {
        const {params: p, models, number, svgEl} = ctx, value = models.malus(p.angle, p.intensity, p.background);
        clearReadings(ctx); addReading(ctx, `起始角 ${number(p.angle)}° · 信号光强`, number(value.signal_intensity)); addReading(ctx, `起始角 ${number(p.angle)}° · 测得光强`, number(value.measured_intensity));
        const stage = stageFor(ctx, "连续转动检偏轴，透射信号遵循夹角余弦平方，恒定背景另行保留。", 265);
        stage.append(svgEl("circle", {cx: 105, cy: 105, r: 55, class: "academy-lens"}), svgEl("circle", {cx: 280, cy: 105, r: 55, class: "academy-lens"}),
          svgEl("line", {x1: 105, x2: 105, y1: 55, y2: 155, class: "academy-model-line"}),
          svgEl("path", {d: "M165,105H215", class: "academy-model-line", fill: "none"}),
          element(ctx, "line", "malus-axis", {x1: 280, x2: 280, y1: 55, y2: 155, class: "academy-ray"}),
          element(ctx, "rect", "malus-transmission", {x: 340, y: 85, width: 55, height: 40, fill: "#d6ae67", opacity: 0}),
          svgEl("line", {x1: 414, x2: 500, y1: 185, y2: 185, class: "academy-axis"}),
          element(ctx, "rect", "malus-signal", {x: 435, y: 185, width: 42, height: 0, class: "academy-heat-absorb"}),
          element(ctx, "rect", "malus-background", {x: 435, y: 185, width: 42, height: 0, class: "academy-heat-release"}),
          svgEl("text", {x: 56, y: 196, class: "academy-tick"}, "入射偏振方向"),
          element(ctx, "text", "malus-angle-label", {x: 232, y: 196, class: "academy-tick"}, ""),
          svgEl("text", {x: 391, y: 224, class: "academy-tick"}, "蓝：信号 / 红：背景"),
          svgEl("text", {x: 62, y: 245, class: "academy-tick"}, "转动为教学进度，光束明暗与 cos²θ 相符"));
        return stage;
      },
      paint(ctx, s) {
        const stage = ctx.stage, angle = s.angle_deg * Math.PI / 180, scale = 105;
        attrs(stage, "malus-axis", {x1: 280 - 50 * Math.sin(angle), x2: 280 + 50 * Math.sin(angle), y1: 105 - 50 * Math.cos(angle), y2: 105 + 50 * Math.cos(angle)});
        attrs(stage, "malus-transmission", {opacity: s.transmission_fraction});
        attrs(stage, "malus-background", {y: 185 - s.background * scale, height: s.background * scale});
        attrs(stage, "malus-signal", {y: 185 - s.measured_intensity * scale, height: s.signal_intensity * scale});
        text(stage, "malus-angle-label", `当前检偏轴 ${ctx.number(s.angle_deg)}°`);
      }
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = specs;
  if (typeof window !== "undefined") Object.assign(window.LabAcademyAnimationModules ||= {}, specs);
})();
