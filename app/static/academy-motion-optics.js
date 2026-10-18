"use strict";
(() => {
  // Moving markers illustrate ray or wavefront propagation, never light speed,
  // optical frequency, photon counting, or reflected/transmitted power ratios.
  const wrap = value => {
    if (!Number.isFinite(value)) throw new RangeError("传播演示进度须为有限数。");
    return ((value % 1) + 1) % 1;
  };
  const point = (x, y) => ({x, y});
  const path = vertices => vertices.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  function along(vertices, progress, indices = []) {
    const lengths = vertices.slice(1).map((p, i) => Math.hypot(p.x - vertices[i].x, p.y - vertices[i].y) * (indices[i] || 1));
    let remaining = Math.max(0, Math.min(1, progress)) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length - 1) {
        const ratio = lengths[i] ? Math.max(0, Math.min(1, remaining / lengths[i])) : 0;
        return point(vertices[i].x + (vertices[i + 1].x - vertices[i].x) * ratio, vertices[i].y + (vertices[i + 1].y - vertices[i].y) * ratio);
      }
      remaining -= lengths[i];
    }
    return {...vertices[0]};
  }
  const append = (ctx, parent, tag, role, attrs = {}, text) => {
    const el = ctx.svgEl(tag, {...attrs, ...(role ? {"data-role": role} : {})}, text); parent.append(el); return el;
  };
  const text = (ctx, parent, value, x, y, cls = "academy-tick") => append(ctx, parent, "text", null, {x, y, class: cls}, value);
  const ray = (ctx, parent, role, vertices, cls = "academy-ray") => append(ctx, parent, "path", role, {d: path(vertices), class: cls});
  const packet = (ctx, parent, role) => append(ctx, parent, "circle", role, {cx: 0, cy: 0, r: 5, fill: "#dca449", stroke: "#fff", "stroke-width": 1.5, visibility: "hidden", "aria-hidden": "true"});
  const find = (ctx, role) => ctx.stage.querySelector(`[data-role="${role}"]`);
  function put(ctx, role, p) {
    const el = find(ctx, role); if (!el) return;
    el.setAttribute("visibility", p ? "visible" : "hidden");
    if (p) { el.setAttribute("cx", p.x); el.setAttribute("cy", p.y); }
  }
  const setPath = (ctx, role, vertices) => { const el = find(ctx, role); if (el) el.setAttribute("d", path(vertices)); };
  const propagationNote = "光点与前沿是传播慢放示意，非真实光速或光频；标记大小、亮度和数量不表示能量。";

  function lensSample(p, progress, models) {
    const value = models.lens(p.focal, p.distance), origin = 300, axis = 125;
    const scale = 230 / Math.max(value.object_cm, value.image_cm, 2 * p.focal);
    const height = Math.min(32, 55 / Math.abs(value.magnification));
    const object = point(origin - p.distance * scale, axis - height), image = point(origin + value.image_cm * scale, axis - height * value.magnification);
    const rays = [[object, point(origin, object.y), image], [object, point(origin, axis), image]];
    const phase = wrap(progress);
    return {image_cm: value.image_cm, magnification: value.magnification, origin, axis, scale, object, image, rays,
      packets: rays.flatMap(vertices => [0, .5].map(offset => along(vertices, wrap(phase + offset))))};
  }
  function refractionSample(p, progress, models) {
    const value = models.refraction(p.index, p.angle), center = point(290, 120), a = p.angle * Math.PI / 180, b = value.refraction_deg * Math.PI / 180;
    const incident = point(center.x - 88 * Math.sin(a), center.y - 88 * Math.cos(a));
    const transmitted = point(center.x + 105 * Math.sin(b), center.y + 105 * Math.cos(b));
    const vertices = [incident, center, transmitted], phase = wrap(progress);
    return {incidence_deg: p.angle, refraction_deg: value.refraction_deg, center, incident, transmitted, vertices,
      packets: [0, 1 / 3, 2 / 3].map(offset => along(vertices, wrap(phase + offset), [1, p.index]))};
  }
  function reflectionSample(p, progress, models) {
    const value = models.totalReflection(p.index, 1, p.angle), center = point(290, 125), a = p.angle * Math.PI / 180;
    const incident = point(center.x - 100 * Math.sin(a), center.y + 100 * Math.cos(a));
    const reflected = point(center.x + 100 * Math.sin(a), center.y + 100 * Math.cos(a));
    const b = value.refraction_deg == null ? null : value.refraction_deg * Math.PI / 180;
    const transmitted = b == null ? null : point(center.x + 110 * Math.sin(b), center.y - 110 * Math.cos(b));
    const phase = wrap(progress), incoming = phase < .45;
    return {state: value.optical_state, critical_deg: value.critical_deg, refraction_deg: value.refraction_deg, incidence_deg: p.angle, center, incident, reflected, transmitted,
      incidentPacket: incoming ? along([incident, center], phase / .45) : null,
      reflectedPacket: incoming ? null : along([center, reflected], (phase - .45) / .55),
      transmittedPacket: incoming || !transmitted ? null : along([center, transmitted], (phase - .45) / .55)};
  }
  function gratingSample(p, progress, models) {
    const value = models.grating(p.lines, p.wavelength, p.order), center = point(270, 165), incident = point(65, 165);
    const angle = value.diffraction_deg == null ? null : value.diffraction_deg * Math.PI / 180;
    const outgoing = angle == null ? null : point(center.x + 135 * Math.cos(angle), center.y - 135 * Math.sin(angle));
    const phase = wrap(progress), incoming = phase < .45;
    return {state: value.diffraction_state, diffraction_deg: value.diffraction_deg, required_sine: value.required_sine, center, incident, outgoing,
      incidentPacket: !outgoing ? along([incident, center], phase) : incoming ? along([incident, center], phase / .45) : null,
      outgoingPacket: outgoing && !incoming ? along([center, outgoing], (phase - .45) / .55) : null};
  }
  function arc(center, radius) {
    const vertices = [];
    for (let i = 0; i <= 40; i++) {
      const theta = -Math.PI / 2 + Math.PI * i / 40, x = center.x + radius * Math.cos(theta), y = center.y + radius * Math.sin(theta);
      if (x <= 500 && y >= 25 && y <= 180) vertices.push(point(x, y));
    }
    return vertices;
  }
  function slitSample(p, progress, models) {
    const value = models.doubleSlit(p.wavelength, p.distance, p.spacing), phase = wrap(progress);
    const gap = 20 + 30 * (p.spacing - .2) / .8, slits = [point(170, 105 - gap / 2), point(170, 105 + gap / 2)], target = point(520, 105);
    return {fringe_spacing_mm: value.fringe_spacing_mm, slits, target, front_x: 40 + phase * 125,
      packets: slits.map(s => along([s, target], phase)),
      wavefronts: slits.flatMap(s => [0, .5].map(offset => arc(s, 15 + wrap(phase + offset) * 120))),
      center_intensity: models.fringeIntensity(0, value.fringe_spacing_mm),
      half_spacing_intensity: models.fringeIntensity(value.fringe_spacing_mm / 2, value.fringe_spacing_mm)};
  }
  const specs = {
    thin_lens: {
      duration: 6, loop: true, timeMode: "teaching", note: propagationNote,
      conditionNote: "移动光点只追踪两条近轴光路；物体、像点及模型参数固定。传播示意非真实光速。",
      sample: lensSample,
      readout: (s, p, n) => `传播慢放 · u=${n(p.distance)} cm · v=${n(s.image_cm)} cm · 两条光路汇于同一倒立实像点（非真实光速）`,
      mount(ctx) {
        const s = lensSample(ctx.params, 0, ctx.models), drawing = ctx.schematic("薄凸透镜：光点沿平行光线及光心光线传播，汇于同一实像点。传播慢放，非真实光速。", 295);
        append(ctx, drawing, "line", "lens-axis", {x1: 25, x2: 575, y1: s.axis, y2: s.axis, class: "academy-rest-line"});
        append(ctx, drawing, "path", "lens-shape", {d: "M300,25Q275,125 300,225Q325,125 300,25", class: "academy-lens"});
        for (const sign of [-1, 1]) {
          append(ctx, drawing, "circle", null, {cx: 300 + sign * ctx.params.focal * s.scale, cy: s.axis, r: 3, class: "academy-bob"});
          text(ctx, drawing, "F", 300 + sign * ctx.params.focal * s.scale, s.axis + 22);
        }
        s.rays.forEach((vertices, i) => ray(ctx, drawing, `lens-ray-${i}`, vertices, i ? "academy-model-line" : "academy-ray"));
        ray(ctx, drawing, "lens-object", [point(s.object.x, s.axis), s.object], "academy-object");
        ray(ctx, drawing, "lens-image", [point(s.image.x, s.axis), s.image], "academy-image");
        append(ctx, drawing, "circle", "lens-image-point", {cx: s.image.x, cy: s.image.y, r: 3, fill: "#9a3444"});
        for (let i = 0; i < 4; i++) packet(ctx, drawing, `lens-packet-${i}`);
        text(ctx, drawing, `物距 ${ctx.number(ctx.params.distance)} cm`, 35, 250);
        text(ctx, drawing, `像距 ${ctx.number(s.image_cm)} cm · 倒立实像`, 320, 250);
        text(ctx, drawing, "光点仅示传播路径；物像不随播放移动", 35, 280);
        return drawing;
      },
      paint(ctx, s) { s.packets.forEach((p, i) => put(ctx, `lens-packet-${i}`, p)); }
    },
    snell_refraction: {
      duration: 6, loop: true, timeMode: "teaching", note: propagationNote,
      conditionNote: "传播标记沿固定入射、折射光路移动；光点不代表能量、实际光速或光频。",
      sample: refractionSample,
      readout: (s, p, n) => `传播慢放 · θ₁=${n(s.incidence_deg)}° · θ₂=${n(s.refraction_deg)}° · 角度从法线量起，介质与角度保持固定`,
      mount(ctx) {
        const s = refractionSample(ctx.params, 0, ctx.models), drawing = ctx.schematic("空气入射介质，光点沿满足斯涅尔定律的光路传播；角度从法线量起。", 300);
        append(ctx, drawing, "rect", null, {x: 25, y: 120, width: 550, height: 128, class: "academy-medium"});
        append(ctx, drawing, "line", null, {x1: 25, x2: 575, y1: 120, y2: 120, class: "academy-axis"});
        append(ctx, drawing, "line", "snell-normal", {x1: 290, x2: 290, y1: 18, y2: 247, class: "academy-rest-line"});
        ray(ctx, drawing, "snell-ray", s.vertices);
        for (let i = 0; i < 3; i++) packet(ctx, drawing, `snell-packet-${i}`);
        text(ctx, drawing, "空气 n₁=1", 35, 32); text(ctx, drawing, `介质 n₂=${ctx.number(ctx.params.index)}`, 35, 231);
        text(ctx, drawing, "法线", 300, 24); text(ctx, drawing, `θ₁=${ctx.number(ctx.params.angle)}°`, 415, 80);
        text(ctx, drawing, `θ₂=${ctx.number(s.refraction_deg)}°`, 415, 190);
        text(ctx, drawing, "移动光点为传播慢放，非真实光速或光频", 35, 280);
        return drawing;
      },
      paint(ctx, s) { s.packets.forEach((p, i) => put(ctx, `snell-packet-${i}`, p)); }
    },
    double_slit: {
      duration: 6, loop: true, timeMode: "teaching", note: propagationNote + "固定光源下屏幕的时间平均条纹保持稳定。",
      conditionNote: "前沿与光点只示传播，光路尺寸不按比例；屏幕仍显示固定 ±15 mm 的时间平均强度，条纹不随播放移动。",
      sample: slitSample,
      readout: (s, p, n) => `传播慢放 · 条纹间距 Δx=${n(s.fringe_spacing_mm)} mm · 屏幕时间平均强度固定（非真实光速或光频）`,
      mount(ctx) {
        const s = slitSample(ctx.params, 0, ctx.models), drawing = ctx.schematic("双缝波前向屏幕传播；下方是保持稳定的时间平均干涉条纹，传播演示不按真实光速。", 350);
        append(ctx, drawing, "path", null, {d: `M170,25V${s.slits[0].y - 6}M170,${s.slits[0].y + 6}V${s.slits[1].y - 6}M170,${s.slits[1].y + 6}V180`, class: "academy-support"});
        append(ctx, drawing, "line", null, {x1: 520, x2: 520, y1: 25, y2: 180, class: "academy-support"});
        append(ctx, drawing, "line", "slit-front", {x1: 40, x2: 40, y1: 35, y2: 175, stroke: "#426c85", "stroke-width": 2});
        for (let i = 0; i < 4; i++) append(ctx, drawing, "path", `slit-wave-${i}`, {d: "", fill: "none", stroke: "#426c85", "stroke-width": 1.5, opacity: .55});
        s.slits.forEach((p, i) => { ray(ctx, drawing, `slit-ray-${i}`, [p, s.target], "academy-rest-line"); packet(ctx, drawing, `slit-packet-${i}`); });
        text(ctx, drawing, "相干双缝", 125, 210); text(ctx, drawing, "屏幕", 495, 210);
        text(ctx, drawing, "传播示意不按尺寸比例；下方条纹不随时间摆动", 30, 235);
        append(ctx, drawing, "rect", null, {x: 40, y: 250, width: 520, height: 48, fill: "#081622"});
        for (let i = 0; i < 520; i++) {
          const positionMm = (i / 519 - .5) * 30;
          append(ctx, drawing, "rect", `slit-intensity-${i}`, {x: 40 + i, y: 250, width: 1.1, height: 48, fill: "#f2d298", opacity: ctx.models.fringeIntensity(positionMm, s.fringe_spacing_mm)});
        }
        for (const value of [-15, 0, 15]) text(ctx, drawing, `${value} mm`, 300 + value / 30 * 520 - 16, 324);
        return drawing;
      },
      paint(ctx, s) {
        const front = find(ctx, "slit-front"); if (front) { front.setAttribute("x1", s.front_x); front.setAttribute("x2", s.front_x); }
        s.wavefronts.forEach((vertices, i) => setPath(ctx, `slit-wave-${i}`, vertices));
        s.packets.forEach((p, i) => put(ctx, `slit-packet-${i}`, p));
      }
    },
    grating_diffraction: {
      duration: 6, loop: true, timeMode: "teaching", note: propagationNote,
      conditionNote: "仅演示所选正级次的传播方向；无解不画出射标记，临界级次沿光栅面传播；不模拟能量分配。",
      sample: gratingSample,
      readout: (s, p, n) => s.state === "absent" ? `传播慢放 · mλ/d=${n(s.required_sine)}>1，此选定级次不存在；其他级次未画出` : s.state === "grazing" ? "传播慢放 · 该级次沿光栅面（90°），不对应有限屏幕上的亮点" : `传播慢放 · 第${p.order}级 θ=${n(s.diffraction_deg)}° · 标记只示方向，不表示能量`,
      mount(ctx) {
        const s = gratingSample(ctx.params, 0, ctx.models), drawing = ctx.schematic("光点正入射光栅，选定正级次按光栅定律传播；无解时无该级次出射光点。", 325);
        append(ctx, drawing, "line", "grating-plane", {x1: 270, x2: 270, y1: 20, y2: 270, class: "academy-support"});
        append(ctx, drawing, "line", "grating-normal", {x1: 35, x2: 555, y1: 165, y2: 165, class: "academy-rest-line"});
        ray(ctx, drawing, "grating-incident", [s.incident, s.center], "academy-model-line");
        append(ctx, drawing, "path", "grating-outgoing", {d: s.outgoing ? path([s.center, s.outgoing]) : "", class: "academy-ray", visibility: s.outgoing ? "visible" : "hidden"});
        packet(ctx, drawing, "grating-incoming-packet"); packet(ctx, drawing, "grating-outgoing-packet");
        text(ctx, drawing, "正入射", 45, 145); text(ctx, drawing, "光栅面", 280, 35);
        text(ctx, drawing, s.state === "absent" ? "所选级次无传播方向" : s.state === "grazing" ? "沿面掠射，不是有限屏幕亮点" : `第${ctx.params.order}级 · θ=${ctx.number(s.diffraction_deg)}°`, 300, 255);
        text(ctx, drawing, "慢放仅示所选级次方向；非真实光速或光频", 30, 310);
        return drawing;
      },
      paint(ctx, s) { put(ctx, "grating-incoming-packet", s.incidentPacket); put(ctx, "grating-outgoing-packet", s.outgoingPacket); }
    },
    total_internal_reflection: {
      duration: 6, loop: true, timeMode: "teaching", note: propagationNote + "两分支同样亮不代表反射率与透射率相等。",
      conditionNote: "入射、反射与允许的折射光点示传播方向；全反射不画透射光点，临界时沿界面；亮度不比较能量。",
      sample: reflectionSample,
      readout: (s, p, n) => `传播慢放 · θc=${n(s.critical_deg)}° · ${s.state === "total" ? "全反射：无传播折射光点" : s.state === "critical" ? "临界：折射光沿界面" : `折射角${n(s.refraction_deg)}°，另有反射分支`} · 标记亮度不代表能量比例`,
      mount(ctx) {
        const s = reflectionSample(ctx.params, 0, ctx.models), drawing = ctx.schematic("高折射率介质入射空气，按临界角区分折射、临界沿面与全反射；光点只示传播方向。", 310);
        append(ctx, drawing, "rect", null, {x: 25, y: 125, width: 550, height: 125, class: "academy-medium"});
        append(ctx, drawing, "line", "tir-boundary", {x1: 25, x2: 575, y1: 125, y2: 125, class: "academy-axis"});
        append(ctx, drawing, "line", "tir-normal", {x1: 290, x2: 290, y1: 18, y2: 248, class: "academy-rest-line"});
        ray(ctx, drawing, "tir-incident", [s.incident, s.center], "academy-model-line"); ray(ctx, drawing, "tir-reflected", [s.center, s.reflected]);
        append(ctx, drawing, "path", "tir-transmitted", {d: s.transmitted ? path([s.center, s.transmitted]) : "", class: "academy-refracted-ray", visibility: s.transmitted ? "visible" : "hidden"});
        packet(ctx, drawing, "tir-incoming-packet"); packet(ctx, drawing, "tir-reflected-packet"); packet(ctx, drawing, "tir-transmitted-packet");
        text(ctx, drawing, "空气 n低=1", 35, 32); text(ctx, drawing, `介质 n高=${ctx.number(ctx.params.index)}`, 35, 236);
        text(ctx, drawing, "法线", 300, 25); text(ctx, drawing, s.state === "total" ? "全反射" : s.state === "critical" ? "临界沿面" : "反射 + 折射", 435, 90);
        text(ctx, drawing, "传播慢放；各标记等亮不代表能量比例", 35, 280);
        return drawing;
      },
      paint(ctx, s) { put(ctx, "tir-incoming-packet", s.incidentPacket); put(ctx, "tir-reflected-packet", s.reflectedPacket); put(ctx, "tir-transmitted-packet", s.transmittedPacket); }
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = specs;
  if (typeof window !== "undefined") Object.assign(window.LabAcademyAnimationModules ||= {}, specs);
})();
