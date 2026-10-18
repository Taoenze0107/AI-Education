"use strict";
(() => {
  // These functions describe ideal teaching models. They never modify measured data.
  const finiteResult = result => { if (Object.values(result).some(value => typeof value === "number" && !Number.isFinite(value))) throw new RangeError("参数超出本教学模型的数值范围。"); return result; };
  const models = {
    pendulum(lengthM, gravity = 9.81) {
      if (![lengthM, gravity].every(Number.isFinite) || !(lengthM > 0) || !(gravity > 0)) throw new RangeError("摆长与重力加速度必须为正数。");
      const period = 2 * Math.PI * Math.sqrt(lengthM / gravity);
      return {length_m: lengthM, period_s: period, period_squared_s2: period * period, gravity_m_s2: gravity};
    },
    ohms(resistanceOhm, voltageV) {
      if (![resistanceOhm, voltageV].every(Number.isFinite) || !(resistanceOhm > 0) || !(voltageV >= 0)) throw new RangeError("电阻须为正数，电压不能为负。");
      return {resistance_ohm: resistanceOhm, voltage_V: voltageV, current_mA: voltageV / resistanceOhm * 1000};
    },
    hooke(stiffnessNPerM, forceN) {
      if (![stiffnessNPerM, forceN].every(Number.isFinite) || !(stiffnessNPerM > 0) || !(forceN >= 0)) throw new RangeError("劲度系数须为正数，载荷不能为负。");
      return finiteResult({stiffness_N_m: stiffnessNPerM, force_N: forceN, extension_m: forceN / stiffnessNPerM, extension_cm: forceN / stiffnessNPerM * 100});
    },
    hookeMotion(stiffnessNPerM, externalForceN, elapsedSeconds, massKg = 1, amplitudeM = .02) {
      if (!Number.isFinite(amplitudeM) || amplitudeM < 0) throw new RangeError("微扰振幅须为有限非负数。");
      const equilibrium = models.hooke(stiffnessNPerM, externalForceN);
      const motion = models.springMotion(massKg, stiffnessNPerM, elapsedSeconds);
      const displacement = amplitudeM * motion.displacement_fraction, extension = equilibrium.extension_m + displacement;
      const restoring = -stiffnessNPerM * extension;
      return finiteResult({stiffness_N_m: stiffnessNPerM, external_force_N: externalForceN, equilibrium_extension_m: equilibrium.extension_m, equilibrium_extension_cm: equilibrium.extension_cm, instant_extension_m: extension, instant_extension_cm: extension * 100, displacement_from_equilibrium_m: displacement, velocity_m_s: amplitudeM * motion.velocity_fraction_per_s, restoring_force_N: restoring, net_force_N: externalForceN + restoring, mass_kg: massKg, amplitude_m: amplitudeM, period_s: motion.period_s});
    },
    spring(massKg, stiffnessNPerM) {
      if (![massKg, stiffnessNPerM].every(Number.isFinite) || !(massKg > 0) || !(stiffnessNPerM > 0)) throw new RangeError("质量与劲度系数必须为正数。");
      const period = 2 * Math.PI * Math.sqrt(massKg / stiffnessNPerM);
      return finiteResult({mass_kg: massKg, stiffness_N_m: stiffnessNPerM, period_s: period, period_squared_s2: period * period});
    },
    springMotion(massKg, stiffnessNPerM, elapsedSeconds) {
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError("演示时间须为有限非负数。");
      const {period_s} = models.spring(massKg, stiffnessNPerM);
      if (!(period_s > 0)) throw new RangeError("周期超出数值范围。");
      const phase = (elapsedSeconds % period_s) / period_s * 2 * Math.PI;
      return finiteResult({period_s, displacement_fraction: Math.cos(phase), velocity_fraction_per_s: -2 * Math.PI / period_s * Math.sin(phase)});
    },
    kinematics(initialVelocityMps, accelerationMps2, elapsedSeconds) {
      if (![initialVelocityMps, accelerationMps2, elapsedSeconds].every(Number.isFinite) || initialVelocityMps < 0 || accelerationMps2 < 0 || elapsedSeconds < 0) throw new RangeError("本课仅处理初速度、加速度和时间非负的运动段。");
      return finiteResult({initial_velocity_m_s: initialVelocityMps, acceleration_m_s2: accelerationMps2, time_s: elapsedSeconds, position_m: initialVelocityMps * elapsedSeconds + .5 * accelerationMps2 * elapsedSeconds ** 2, velocity_m_s: initialVelocityMps + accelerationMps2 * elapsedSeconds});
    },
    newtons(massKg, netForceN, elapsedSeconds = 0) {
      if (![massKg, netForceN].every(Number.isFinite) || !(massKg > 0) || netForceN < 0) throw new RangeError("质量须为正数，正向合外力须非负。");
      return finiteResult({...models.kinematics(0, netForceN / massKg, elapsedSeconds), mass_kg: massKg, net_force_N: netForceN});
    },
    freeFall(gravityMps2, elapsedSeconds) {
      if (!Number.isFinite(gravityMps2) || !(gravityMps2 > 0)) throw new RangeError("重力加速度须为有限正数。");
      const motion = models.kinematics(0, gravityMps2, elapsedSeconds);
      return {...motion, gravity_m_s2: gravityMps2, height_m: motion.position_m};
    },
    workEnergy(massKg, netForceN, displacementM, initialVelocity = 0) {
      if (![massKg, netForceN, displacementM, initialVelocity].every(Number.isFinite) || !(massKg > 0 && netForceN >= 0 && displacementM >= 0 && initialVelocity >= 0)) throw new RangeError("质量须为正，正向合力、位移和初速度须为有限非负数。");
      const work = netForceN * displacementM, initialKinetic = .5 * massKg * initialVelocity ** 2, finalKinetic = initialKinetic + work;
      const velocity = Math.sqrt(initialVelocity ** 2 + 2 * work / massKg);
      return finiteResult({mass_kg: massKg, net_force_N: netForceN, position_m: displacementM, initial_velocity_m_s: initialVelocity, work_J: work, kinetic_initial_J: initialKinetic, kinetic_final_J: finalKinetic, velocity_m_s: velocity});
    },
    centripetal(massKg, radiusM, angularSpeedRadS) {
      if (![massKg, radiusM, angularSpeedRadS].every(Number.isFinite) || !(massKg > 0 && radiusM > 0 && angularSpeedRadS > 0)) throw new RangeError("质量、半径和角速度须为有限正数。");
      const speed = angularSpeedRadS * radiusM;
      return finiteResult({mass_kg: massKg, radius_m: radiusM, angular_speed_rad_s: angularSpeedRadS, force_N: massKg * angularSpeedRadS ** 2 * radiusM, speed_m_s: speed, period_s: 2 * Math.PI / angularSpeedRadS});
    },
    slidingFriction(massKg, coefficient, initialVelocityMps, elapsedS, gravity = 9.81) {
      if (![massKg, coefficient, initialVelocityMps, elapsedS, gravity].every(Number.isFinite) || !(massKg > 0 && coefficient > 0 && initialVelocityMps > 0 && elapsedS >= 0 && gravity > 0)) throw new RangeError("质量、动摩擦因数、初速度和重力加速度须为正数，时间不能为负。");
      const deceleration = coefficient * gravity;
      if (!(deceleration > 0 && Number.isFinite(deceleration))) throw new RangeError("减速度超出本教学模型的数值范围。");
      const stopTime = initialVelocityMps / deceleration, stopDistance = .5 * initialVelocityMps * stopTime;
      const time = Math.min(elapsedS, stopTime), velocity = elapsedS >= stopTime ? 0 : Math.max(0, initialVelocityMps - deceleration * time);
      const position = elapsedS >= stopTime ? stopDistance : .5 * (initialVelocityMps + velocity) * time;
      return finiteResult({friction_N: massKg * deceleration, deceleration_m_s2: deceleration, stop_time_s: stopTime, stop_distance_m: stopDistance, time_s: time, position_m: position, velocity_m_s: velocity, kinetic_J: .5 * massKg * velocity ** 2, mass_kg: massKg, coefficient, initial_velocity_m_s: initialVelocityMps});
    },
    dampedMotion(amplitudeMm, betaPerS, periodS, elapsedS) {
      if (![amplitudeMm, betaPerS, periodS, elapsedS].every(Number.isFinite) || !(amplitudeMm > 0 && betaPerS >= 0 && periodS > 0 && elapsedS >= 0)) throw new RangeError("初振幅与阻尼后的周期须为正数，衰减率和时间须为有限非负数。");
      const omega = 2 * Math.PI / periodS;
      if (!Number.isFinite(omega)) throw new RangeError("角频率超出本教学模型的数值范围。");
      const phase = (elapsedS % periodS) / periodS * 2 * Math.PI, envelope = amplitudeMm * Math.exp(-betaPerS * elapsedS);
      const displacement = envelope * Math.cos(phase), velocity = envelope * (-betaPerS * Math.cos(phase) - omega * Math.sin(phase));
      return finiteResult({amplitude_initial_mm: amplitudeMm, beta_per_s: betaPerS, period_s: periodS, time_s: elapsedS, envelope_mm: envelope, displacement_mm: displacement, velocity_mm_s: velocity});
    },
    soundResonance(speedMps, frequencyHz, endCorrectionCm = 0) {
      if (![speedMps, frequencyHz, endCorrectionCm].every(Number.isFinite) || !(speedMps > 0 && frequencyHz > 0 && endCorrectionCm >= 0)) throw new RangeError("声速和频率须为正数，管口修正不能为负。");
      const wavelength = speedMps / frequencyHz, correctionM = endCorrectionCm / 100;
      if (!(wavelength > 0 && Number.isFinite(wavelength) && correctionM < wavelength / 4)) throw new RangeError("管口修正必须小于四分之一波长，并保证第一共振管长为正。");
      return finiteResult({speed_m_s: speedMps, frequency_Hz: frequencyHz, end_correction_cm: endCorrectionCm, wavelength_m: wavelength, first_length_cm: (wavelength / 4 - correctionM) * 100, second_length_cm: (.75 * wavelength - correctionM) * 100, spacing_cm: .5 * wavelength * 100});
    },
    capacitorDischarge(resistanceKohm, capacitanceUf, initialV, timeMs) {
      if (![resistanceKohm, capacitanceUf, initialV, timeMs].every(Number.isFinite) || !(resistanceKohm > 0 && capacitanceUf > 0 && initialV > 0 && timeMs >= 0)) throw new RangeError("电阻、电容和初始电压须为正数，放电时间不能为负。");
      const tau = resistanceKohm * capacitanceUf;
      if (!(tau > 0 && Number.isFinite(tau))) throw new RangeError("时间常数超出本教学模型的数值范围。");
      const fraction = Math.exp(-timeMs / tau), voltage = initialV * fraction;
      return finiteResult({resistance_kohm: resistanceKohm, capacitance_uF: capacitanceUf, initial_V: initialV, time_ms: timeMs, tau_ms: tau, voltage_V: voltage, fraction, energy_uJ: .5 * capacitanceUf * voltage ** 2});
    },
    lens(focalCm, objectCm) {
      if (![focalCm, objectCm].every(Number.isFinite) || !(focalCm > 0) || !(objectCm > focalCm)) throw new RangeError("本实像模型要求正焦距且物距大于焦距。");
      const image = focalCm / (1 - focalCm / objectCm);
      return finiteResult({focal_cm: focalCm, object_cm: objectCm, image_cm: image, magnification: -image / objectCm});
    },
    refraction(index2, incidenceDeg) {
      if (![index2, incidenceDeg].every(Number.isFinite) || !(index2 >= 1) || !(incidenceDeg >= 0 && incidenceDeg < 90)) throw new RangeError("本模型从空气入射，介质折射率至少为 1，入射角须在 0° 至 90° 之间。");
      const sine = Math.sin(incidenceDeg * Math.PI / 180), refracted = Math.asin(sine / index2);
      return finiteResult({index_1: 1, index_2: index2, incidence_deg: incidenceDeg, refraction_deg: refracted * 180 / Math.PI, sine_incidence: sine, sine_refraction: Math.sin(refracted)});
    },
    doubleSlit(wavelengthNm, distanceM, slitSpacingMm) {
      if (![wavelengthNm, distanceM, slitSpacingMm].every(Number.isFinite) || !(wavelengthNm > 0 && distanceM > 0 && slitSpacingMm > 0)) throw new RangeError("波长、屏距和缝距必须为正数。");
      const spacing = wavelengthNm * 1e-6 * distanceM / slitSpacingMm * 1000;
      return finiteResult({wavelength_nm: wavelengthNm, distance_m: distanceM, slit_spacing_mm: slitSpacingMm, fringe_spacing_mm: spacing});
    },
    fringeIntensity(positionMm, fringeSpacingMm) {
      if (![positionMm, fringeSpacingMm].every(Number.isFinite) || !(fringeSpacingMm > 0)) throw new RangeError("屏幕位置须为有限数，条纹间距须为正数。");
      const phase = Math.PI * (positionMm / fringeSpacingMm);
      if (!Number.isFinite(phase)) throw new RangeError("条纹相位超出数值范围。");
      return Math.cos(phase) ** 2;
    },
    calorimetry(metalMassG, waterMassG, waterTempC, metalTempC, metalSpecificJkgK = 900) {
      if (![metalMassG, waterMassG, waterTempC, metalTempC, metalSpecificJkgK].every(Number.isFinite) || !(metalMassG > 0 && waterMassG > 0 && metalSpecificJkgK > 0) || !(waterTempC >= 0 && waterTempC < metalTempC && metalTempC <= 100)) throw new RangeError("质量与比热容须为正数，温度要求 0 ≤ 水初温 < 金属初温 ≤ 100 ℃。");
      const metalCapacity = metalMassG / 1000 * metalSpecificJkgK, waterCapacity = waterMassG / 1000 * 4180;
      const equilibrium = waterTempC + (metalTempC - waterTempC) * metalCapacity / (metalCapacity + waterCapacity);
      const absorbed = waterCapacity * (equilibrium - waterTempC), released = metalCapacity * (metalTempC - equilibrium);
      return finiteResult({metal_mass_g: metalMassG, water_mass_g: waterMassG, water_temp_C: waterTempC, metal_temp_C: metalTempC, metal_specific_J_kg_K: metalSpecificJkgK, equilibrium_C: equilibrium, absorbed_J: absorbed, released_J: released, recovered_specific_J_kg_K: absorbed / (metalMassG / 1000 * (metalTempC - equilibrium))});
    },
    buoyancy(densityKgM3, volumeCm3, gravity = 9.81) {
      if (![densityKgM3, volumeCm3, gravity].every(Number.isFinite) || !(densityKgM3 > 0 && volumeCm3 >= 0 && gravity > 0)) throw new RangeError("液体密度与重力加速度须为正数，排液体积不能为负。");
      return finiteResult({density_kg_m3: densityKgM3, volume_cm3: volumeCm3, displaced_mass_kg: densityKgM3 * volumeCm3 * 1e-6, buoyancy_N: densityKgM3 * gravity * volumeCm3 * 1e-6});
    },
    resistivity(resistivityMicroOhmM, lengthM, diameterMm) {
      if (![resistivityMicroOhmM, lengthM, diameterMm].every(Number.isFinite) || !(resistivityMicroOhmM > 0 && lengthM > 0 && diameterMm > 0)) throw new RangeError("电阻率、导线长度与直径必须为正数。");
      const area = Math.PI * (diameterMm * .001) ** 2 / 4;
      if (!(area > 0)) throw new RangeError("截面积超出数值范围。");
      return finiteResult({resistivity_microohm_m: resistivityMicroOhmM, length_m: lengthM, diameter_mm: diameterMm, area_mm2: area * 1e6, resistance_ohm: resistivityMicroOhmM * 1e-6 * lengthM / area});
    },
    joule(currentA, resistanceOhm, timeS, waterMassG, efficiency = .8, initialC = 20) {
      if (![currentA, resistanceOhm, timeS, waterMassG, efficiency, initialC].every(Number.isFinite) || !(currentA >= 0 && resistanceOhm > 0 && timeS >= 0 && waterMassG > 0 && efficiency > 0 && efficiency <= 1 && initialC >= 0 && initialC < 100)) throw new RangeError("焦耳热参数不合法：质量、电阻、效率须为正，电流和时间非负，效率不超过 1。");
      const energy = currentA ** 2 * resistanceOhm * timeS, absorbed = efficiency * energy, rise = absorbed / (waterMassG / 1000 * 4180), finalC = initialC + rise;
      if (!(finalC < 100)) throw new RangeError("本模型仅研究水未沸腾且无相变的情形。");
      return finiteResult({current_A: currentA, resistance_ohm: resistanceOhm, time_s: timeS, water_mass_g: waterMassG, efficiency, initial_C: initialC, electrical_energy_J: energy, water_heat_J: absorbed, temperature_rise_C: rise, final_C: finalC});
    },
    transformer(primaryTurns, secondaryTurns, primaryVrms) {
      if (![primaryTurns, secondaryTurns, primaryVrms].every(Number.isFinite) || !Number.isInteger(primaryTurns) || !Number.isInteger(secondaryTurns) || !(primaryTurns > 0 && secondaryTurns > 0 && primaryVrms >= 0)) throw new RangeError("线圈匝数须为正整数，交流输入有效值不能为负。");
      const ratio = secondaryTurns / primaryTurns;
      return finiteResult({primary_turns: primaryTurns, secondary_turns: secondaryTurns, primary_V_rms: primaryVrms, secondary_V_rms: primaryVrms * ratio, turns_ratio: ratio});
    },
    grating(linesPerMm, wavelengthNm, order = 1) {
      if (![linesPerMm, wavelengthNm, order].every(Number.isFinite) || !(linesPerMm > 0 && wavelengthNm > 0) || !Number.isInteger(order) || order < 0) throw new RangeError("光栅线密度和波长须为正，级次须为非负整数。");
      const spacingNm = 1e6 / linesPerMm, requiredSine = order * wavelengthNm / spacingNm;
      if (!Number.isFinite(requiredSine)) throw new RangeError("衍射参数超出数值范围。");
      const exists = requiredSine <= 1 + 1e-12, grazing = exists && requiredSine >= 1 - 1e-12;
      return finiteResult({lines_per_mm: linesPerMm, wavelength_nm: wavelengthNm, order, spacing_nm: spacingNm, required_sine: requiredSine, exists, diffraction_deg: exists ? Math.asin(Math.min(1, requiredSine)) * 180 / Math.PI : null, diffraction_state: !exists ? "absent" : grazing ? "grazing" : "propagating"});
    },
    totalReflection(indexHigh, indexLow, incidenceDeg) {
      if (![indexHigh, indexLow, incidenceDeg].every(Number.isFinite) || !(indexHigh > indexLow && indexLow > 0 && incidenceDeg >= 0 && incidenceDeg < 90)) throw new RangeError("全反射模型要求光从高折射率到低折射率，角度在 0° 至 90° 之间。");
      const critical = Math.asin(indexLow / indexHigh) * 180 / Math.PI, requiredSine = indexHigh / indexLow * Math.sin(incidenceDeg * Math.PI / 180);
      if (!Number.isFinite(requiredSine)) throw new RangeError("折射参数超出数值范围。");
      const total = requiredSine > 1 + 1e-12, grazing = !total && requiredSine >= 1 - 1e-12;
      return finiteResult({index_high: indexHigh, index_low: indexLow, incidence_deg: incidenceDeg, critical_deg: critical, required_sine: requiredSine, reflection_deg: incidenceDeg, refraction_deg: total ? null : Math.asin(Math.min(1, requiredSine)) * 180 / Math.PI, optical_state: total ? "total" : grazing ? "critical" : "refracting"});
    },
    expansion(alphaMicroPerK, initialCm, deltaC) {
      if (![alphaMicroPerK, initialCm, deltaC].every(Number.isFinite) || !(alphaMicroPerK > 0 && initialCm > 0 && deltaC >= 0)) throw new RangeError("线膨胀系数与原长须为正数，本课温升不能为负。");
      const extensionMm = initialCm * alphaMicroPerK * deltaC * 1e-5;
      return finiteResult({alpha_micro_K: alphaMicroPerK, initial_cm: initialCm, temperature_rise_C: deltaC, extension_mm: extensionMm, final_cm: initialCm + extensionMm / 10});
    },
    stringWave(lengthM, tensionN, densityGramPerM) {
      if (![lengthM, tensionN, densityGramPerM].every(Number.isFinite) || !(lengthM > 0 && tensionN > 0 && densityGramPerM > 0)) throw new RangeError("弦长、张力与线密度须为正数。");
      const speed = Math.sqrt(tensionN / (densityGramPerM * .001));
      return finiteResult({length_m: lengthM, tension_N: tensionN, linear_density_g_m: densityGramPerM, speed_m_s: speed, fundamental_Hz: speed / (2 * lengthM), wavelength_m: 2 * lengthM});
    },
    malus(angleDeg, inputIntensity = 1, background = 0) {
      if (![angleDeg, inputIntensity, background].every(Number.isFinite) || !(angleDeg >= 0 && angleDeg <= 180 && inputIntensity > 0 && background >= 0)) throw new RangeError("两偏振轴夹角须在 0°–180° 之间，入射光强须为正，背景非负。");
      const fraction = angleDeg === 90 ? 0 : Math.cos(angleDeg * Math.PI / 180) ** 2;
      return finiteResult({angle_deg: angleDeg, input_intensity: inputIntensity, background, transmission_fraction: fraction, signal_intensity: inputIntensity * fraction, measured_intensity: inputIntensity * fraction + background});
    },
    rc(resistanceKohm, capacitanceUf, timeMs, discharge = false, sourceV = 5) {
      if (![resistanceKohm, capacitanceUf, timeMs, sourceV].every(Number.isFinite) || !(resistanceKohm > 0) || !(capacitanceUf > 0) || !(timeMs >= 0) || !(sourceV > 0)) throw new RangeError("RC 参数与电源须为正数，时间不能为负。");
      const tau = resistanceKohm * capacitanceUf;
      const fraction = discharge ? Math.exp(-timeMs / tau) : 1 - Math.exp(-timeMs / tau);
      return {resistance_kohm: resistanceKohm, capacitance_uF: capacitanceUf, time_ms: timeMs, tau_ms: tau, voltage_V: sourceV * fraction, fraction, discharge};
    }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = models;
  if (typeof document === "undefined") return;
  window.LabAcademy = models;

  const supported = {
    simple_pendulum: {title: "单摆：摆长如何改变周期？", subtitle: "先作一个预测，再用摆动和图线检验。", goal: "理解小角度条件下的周期、摆长与重力加速度。", formula: "T = 2π√(L/g)", tex: "T = 2\\pi\\sqrt{\\frac{L}{g}}", condition: "理想单摆；小角度、无阻尼；g = 9.81 m/s²。", initial: {length: 1}, symbols: [["T", "周期 T：完成一次完整往返所需的时间，单位 s。"], ["L", "摆长 L：从悬点到摆球质心的距离，单位 m。"], ["g", "重力加速度 g：本仿真固定为 9.81 m/s²。"]]},
    ohms_law: {title: "伏安法：图线的斜率意味着什么？", subtitle: "改变电阻与电压，观察同一个欧姆元件的读数。", goal: "联系电压、电流、电阻，辨别坐标轴和单位。", formula: "U = IR", tex: "U = IR", condition: "恒温欧姆元件；电表理想化；忽略导线电阻。", initial: {resistance: 250, voltage: 3}, symbols: [["U", "电压 U：电阻两端的电势差，单位 V。"], ["I", "电流 I：公式使用 A；图中使用 mA。1 mA = 0.001 A。"], ["R", "电阻 R：U–I 图纵轴为 U、横轴为 I 时，斜率对应电阻。若横轴用 mA，斜率还要乘 1000 才得到 Ω。"]]},
    hookes_law: {"title":"胡克定律：弹簧怎样往返运动？","subtitle":"保持拉力不变，让弹簧和物块自动往返，再比较平衡伸长。","goal":"区分平衡伸长、瞬时位置与恢复运动。","formula":"F = kx_eq","tex":"F=kx_{\\mathrm{eq}}","condition":"水平无摩擦、理想双向线性弹簧，始终处于弹性限度内。恒拉力F下，平衡伸长x_eq=F/k；固定物块质量1kg、位移振幅2cm，绕加载平衡位置自动振动。瞬时伸长可为负（压缩）。","initial":{"stiffness":50,"force":2,"mass":1},"symbols":[["F","图线中的F是恒外加拉力；仅在加载平衡时有F=kx_eq。振动中水平合力为F−kx(t)。"],["k","劲度系数，单位N/m；越硬则同质量的振动越快。静态F–x_eq图横轴用cm，斜率需乘100才得到N/m。"],["x_eq","加载后的平衡伸长F/k；上方数值和下方静态图线使用这个量，不随振动时刻变化。"],["x(t)","从原长位置量的瞬时伸长；x(t)=x_eq+Acos(2πt/T)，弹簧力为−kx(t)，压缩时为负伸长。"]]},
    spring_oscillation: {title: "弹簧振子：质量怎样改变周期？", subtitle: "保持弹簧不变，比较不同质量的周期平方。", goal: "区分质量与劲度系数对简谐振动周期的影响。", formula: "T = 2π√(m/k)", tex: "T = 2\\pi\\sqrt{\\frac{m}{k}}", condition: "理想轻弹簧和质点；无阻尼；在弹性限度内作简谐振动。", initial: {mass: .2, stiffness: 20}, symbols: [["T", "振动周期 T，单位 s；振幅在理想线性模型中不改变周期。"], ["m", "振子质量 m，单位 kg；本模型忽略弹簧自身质量。"], ["k", "劲度系数 k，单位 N/m；T²–m 图的斜率为 4π²/k。"]]},
    thin_lens: {title: "薄透镜：物体移动，像在哪里？", subtitle: "调整焦距和物距，观察倒立实像及光路。", goal: "理解实像位置、放大率与物距的非线性关系。", formula: "1/f = 1/u + 1/v", tex: "\\frac{1}{f}=\\frac{1}{u}+\\frac{1}{v}", condition: "薄凸透镜；近轴光线；本课只研究 u > f 的实像。光路按几何关系绘制，坐标使用 cm。", initial: {focal: 10, distance: 30}, symbols: [["f", "焦距 f，单位 cm；本模型取正值。"], ["u", "物距 u，单位 cm；滑杆范围保证 u > f，避免在焦点处无有限像距。"], ["v", "像距 v，单位 cm；本课实像位于透镜另一侧，v 为正。"], ["M", "横向放大率 M = −v/u；负号表示实像倒立。"]]},
    snell_refraction: {title: "折射：光线为什么向法线偏折？", subtitle: "改变入射角和介质，比较角度与正弦关系。", goal: "把斯涅尔定律与光路、折射率联系起来。", formula: "n₁ sin θ₁ = n₂ sin θ₂", tex: "n_1\\sin\\theta_1=n_2\\sin\\theta_2", condition: "单色光由空气 n₁ = 1 入射均匀介质 n₂ ≥ 1；角度从法线量起。此方向不会发生全反射。", initial: {index: 1.5, angle: 45}, symbols: [["n₁", "入射介质为空气，折射率 n₁ 固定为 1。"], ["n₂", "下方介质折射率 n₂，无量纲；本课范围 1.1–2.0。"], ["θ₁", "入射角 θ₁：入射光与界面法线的夹角，读数使用 °。"], ["θ₂", "折射角 θ₂：折射光与法线的夹角。sin θ₂–sin θ₁ 图的斜率为 1/n₂。"]]},
    double_slit: {title: "双缝干涉：条纹间距由什么决定？", subtitle: "改变波长、屏距和缝距，比较相邻亮纹的距离。", goal: "理解条纹间距与波长、屏距成正比，与缝距成反比。", formula: "Δx = λD/d", tex: "\\Delta x=\\frac{\\lambda D}{d}", condition: "理想相干、等强双缝；远场小角度近似；忽略单缝衍射包络。亮度示意采用相对强度。", initial: {wavelength: 550, distance: 1, spacing: .5}, symbols: [["λ", "波长 λ，滑杆使用 nm；代入 SI 公式时乘 10⁻⁹ 换算为 m。"], ["D", "双缝到屏幕的距离 D，单位 m；缝距远小于屏距。"], ["d", "双缝间距 d，滑杆使用 mm；SI 公式需换算为 m。"], ["Δx", "相邻亮纹的间距 Δx；图示与读数使用 mm。"]]},
    calorimetry: {title: "量热法：怎样测出金属的比热容？", subtitle: "把热金属放入水中，观察平衡温度与能量交换。", goal: "用水的吸热量回算金属比热容，辨别质量与温差的作用。", formula: "m金c金(T热−T) = m水c水(T−T冷)", tex: "\\begin{aligned}&m_m c_m(T_h-T)\\\\&\\quad=m_w c_w(T-T_c)\\end{aligned}", condition: "热金属与水达到热平衡；水的比热容 c水 = 4180 J/(kg·K)；忽略量热器吸热、散热、蒸发与相变。", initial: {metalMass: 100, waterMass: 150, waterTemp: 20, metalTemp: 80, specific: 900}, symbols: [["m金", "金属质量，读数使用 g，计算热量时换算为 kg。"], ["c金", "金属比热容，单位 J/(kg·K)；本模型可设置，再用水的吸热量回算验证。"], ["m水", "水的质量；水比热容固定为 4180 J/(kg·K)，质量使用 kg 代入。"], ["T", "最终平衡温度应位于水和金属的初温之间。温差 1 ℃ 与 1 K 相等。"], ["Q", "水吸热量等于金属放热量，单位 J；实际实验须考虑量热器与散热修正。"]]},
    rc_time_constant: {title: "RC：为什么是 63.2%？", subtitle: "改变电阻和电容，追踪充电与放电的同一时刻。", goal: "把时间常数与曲线上的电压比例对应起来。", formula: "τ = RC", tex: "\\tau = RC", condition: "理想一阶 RC 电路；电源 5 V；充电从 0 V 开始，放电从 5 V 开始。", initial: {resistance: 10, capacitance: 1, time: 1, discharge: false}, symbols: [["τ", "时间常数 τ = RC：R 用 Ω、C 用 F 时，τ 的单位是 s。此处 R 用 kΩ、C 用 μF，因此读数为 ms。"], ["R", "电阻 R：增大电阻，会按相同比例增大充电与放电的时间常数。"], ["C", "电容 C：增大电容，会按相同比例增大时间常数。"], ["Vc", "电容电压 Vc：充电时为 5(1−e^(−t/τ)) V，放电时为 5e^(−t/τ) V。"]]}
  };
  Object.assign(supported, {
    archimedes: {title: "阿基米德原理：浮力由什么决定？", subtitle: "比较不同排液体积，分清体积和密度的作用。", goal: "用排开液体的重力解释浮力，建立 F浮–V 关系。", formula: "F浮 = ρ液gV排", tex: "F_b=\\rho gV", condition: "静止液体、均匀密度；V 为浸入液体的排液体积；g = 9.81 m/s²；忽略表面张力。", initial: {density: 1000, volume: 100}, symbols: [["ρ", "液体密度 ρ，单位 kg/m³；不是物体密度。"], ["V", "排液体积 V，滑杆用 cm³；1 cm³ = 10⁻⁶ m³。"], ["F浮", "浮力等于排开液体的重力，单位 N；部分浸入时不能使用整个物体体积。"]]},
    resistivity: {title: "电阻率：导线粗细有多大影响？", subtitle: "改变长度、直径和材料，比较电阻。", goal: "理解 R 与长度成正比，与直径平方成反比。", formula: "R = ρL/A，A = πd²/4", tex: "R=\\frac{\\rho L}{A},\\quad A=\\frac{\\pi d^2}{4}", condition: "均匀圆柱导线；温度不变；忽略接触、引线电阻；不考虑自热。", initial: {rho: .49, length: 1, diameter: .5}, symbols: [["ρ", "电阻率滑杆使用 μΩ·m；1 μΩ·m = 10⁻⁶ Ω·m。"], ["L", "有效导线长度 L，单位 m。"], ["d", "直径 d 的单位 mm；求面积时换算为 m，面积与 d² 成正比。"], ["R", "电阻 R，单位 Ω；直径加倍时，截面积变为四倍。"]]},
    joule_heating: {title: "焦耳热：电流加倍，水温怎样变？", subtitle: "比较电能和水吸收的热量，识别 I² 关系。", goal: "把电流、电阻、时间与温升、水储热比例联系起来。", formula: "ΔT = ηI²Rt/(mc)", tex: "\\Delta T=\\frac{\\eta I^2Rt}{mc}", condition: "理想恒流、电阻不变；水 c = 4180 J/(kg·K)，初温 20 ℃；η 是电能最终进入水的比例，简化为常数；把容器吸热与散热等统一简化为固定比例；水不沸腾、无相变。", initial: {current: 1, resistance: 10, time: 120, mass: 200, efficiency: .8}, symbols: [["I", "电流 I，单位 A；固定其他量时，温升与 I² 成正比。"], ["η", "水储热比例 η = 水吸热/输入电能，在 0 至 1 之间；不等于温度比。"], ["m", "水质量滑杆用 g，公式中换算为 kg。"], ["t", "通电时间 t，单位 s。"], ["ΔT", "水温升 ΔT，单位 ℃（与 K 温差数值相同）；最终温度 = 20 ℃ + ΔT。"]]},
    transformer_ratio: {title: "变压器：匝数比怎样决定电压？", subtitle: "调整两个线圈，观察理想空载的交流有效值。", goal: "区分匝数比与电压比，理解升压和降压。", formula: "U₂/U₁ = N₂/N₁", tex: "\\frac{U_2}{U_1}=\\frac{N_2}{N_1}", condition: "理想变压器、交流输入、次级空载；只讨论电压有效值，忽略损耗与漏磁。此为教学仿真，不得接入市电；真实操作仅用实验室安全低压电源。", initial: {primary: 200, secondary: 100, voltage: 6}, symbols: [["U₁", "初级交流电压有效值 U₁，单位 V；不是直流电压。"], ["U₂", "次级交流电压有效值 U₂，单位 V；空载理想模型不能推断负载功率。"], ["N₁", "初级匝数 N₁，无量纲的正整数。"], ["N₂", "次级匝数 N₂；N₂ > N₁ 时理想空载次级电压更高。"]]},
    grating_diffraction: {title: "光栅衍射：每个级次都存在吗？", subtitle: "改变波长与光栅线密度，寻找允许的衍射方向。", goal: "用 |mλ/d| ≤ 1 判断级次，理解线密度的单位。", formula: "d sin θ = mλ", tex: "d\\sin\\theta=m\\lambda", condition: "单色光垂直入射理想光栅；研究一侧正级次；线密度用 线/mm，d = 10⁶/线密度 nm。mλ/d > 1 时该级次不存在，等于 1 时沿光栅面，不能在有限远的垂直屏上形成亮点。", initial: {lines: 600, wavelength: 550, order: 1}, symbols: [["d", "光栅常数 d：相邻缝间距。线密度为 n 线/mm 时，d = 1/n mm。"], ["m", "衍射级次 m，为整数；本课滑杆取正级次 1–3。"], ["λ", "波长 λ，单位 nm；与光栅常数使用同一长度单位后计算。"], ["θ", "衍射角 θ 从光栅法线量起；要求 |sin θ| ≤ 1。"]]},
    total_internal_reflection: {title: "全反射：光线何时不再折射？", subtitle: "从高折射率介质向空气入射，跨越临界角。", goal: "区分普通折射、临界沿面与全反射三个状态。", formula: "sin θc = n低/n高", tex: "\\sin\\theta_c=\\frac{n_l}{n_h}", condition: "单色光从高折射率介质进入空气 n低 = 1；角度从法线量起。θ < θc 时有折射，θ = θc 时折射沿界面，θ > θc 时发生全反射。", initial: {index: 1.5, angle: 50}, symbols: [["n高", "入射介质折射率 n高，大于出射介质折射率；本课出射介质为空气。"], ["θ", "入射角 θ，从法线量起；反射角始终等于入射角。"], ["θc", "临界角 θc = arcsin(n低/n高)；等于临界角属于临界沿面状态。"], ["折射", "斯涅尔定律要求的 sin θ折 > 1 时不存在传播折射光，不能继续计算 arcsin。"]]},
    thermal_expansion: {title: "线膨胀：金属杆伸长了多少？", subtitle: "比较材料、原长与温升，辨别微小长度变化。", goal: "正确换算微量膨胀系数和毫米伸长。", formula: "ΔL = αL₀ΔT", tex: "\\Delta L=\\alpha L_0\\Delta T", condition: "各向同性金属杆、小温升近似；α 在范围内视为常数，温度均匀；忽略测量架膨胀。示意图对伸长作放大显示。", initial: {alpha: 17, length: 50, temperature: 50}, symbols: [["α", "线膨胀系数滑杆以 10⁻⁶/K 为单位，例如 17 表示 17×10⁻⁶/K。"], ["L₀", "原长 L₀，滑杆用 cm；ΔL 读数用 mm。"], ["ΔT", "温升 ΔT，用 ℃；温差的 ℃ 与 K 数值相同。"], ["ΔL", "伸长量 ΔL；最终长度 L = L₀ + ΔL，求和前统一单位。"]]},
    string_waves: {title: "弦驻波：怎样改变基频？", subtitle: "调节弦长、张力与线密度，观察一个波腹的基模。", goal: "理解基频与张力平方根、弦长和线密度的关系。", formula: "f₁ = (1/2L)√(F/μ)", tex: "f_1=\\frac{1}{2L}\\sqrt{\\frac{F}{\\mu}}", condition: "均匀细弦，两端固定；张力恒定，小振幅；只研究基频（一个波腹），λ₁ = 2L；忽略弦的弯曲刚度和阻尼。", initial: {length: 1, tension: 10, density: 1}, symbols: [["L", "两固定端间的有效弦长 L，单位 m。"], ["F", "张力 F，单位 N；不是振动频率。"], ["μ", "线密度 μ = 质量/长度，滑杆用 g/m；计算前乘 0.001 换为 kg/m。"], ["f₁", "基频 f₁，单位 Hz；两端为波节，中间为一个波腹。"]]},
    malus_law: {title: "马吕斯定律：转过 90° 就全黑吗？", subtitle: "转动检偏器，同时比较光信号与背景。", goal: "把 cos² 关系、透振方向和背景修正联系起来。", formula: "I测 = I₀ cos² θ + I背景", tex: "I=I_0\\cos^2\\theta+I_{bg}", condition: "入射光已线偏振；θ 为其偏振方向与检偏器透振轴的夹角；理想检偏器；背景视为与角度无关的常量。所有光强为相对单位。", initial: {angle: 45, intensity: 1, background: .05}, symbols: [["θ", "偏振方向与检偏器透振轴夹角，单位 °；180° 与 0° 透射情况相同。"], ["I₀", "沿检偏器轴方向对齐时的理想信号光强，相对单位。"], ["I背景", "角度无关的背景光或探测器零点；90° 时信号为零，测得值仍可能非零。"], ["cos²", "cos² θ 不是 cos(2θ)；无量纲，取值 0 至 1。"]]}
  });
  // Additional motion lessons share the existing prediction/data/revision flow.
  Object.assign(supported, {"uniform_acceleration":{"title":"匀加速运动：车越来越快了吗？","subtitle":"让小车运动，联系位置、速度与时间。","goal":"区分初速度与加速度，理解速度图的斜率和截距。","formula":"v = v₀ + at","tex":"v=v_0+at","condition":"一维正向匀加速；x₀ = 0；初速度和加速度非负。演示使用真实时间，轨道固定显示 0–8 m，每段 3 s。","initial":{"velocity":0.2,"acceleration":0.5},"symbols":[["v₀","t = 0 时的初速度，单位 m/s；对应速度图截距。"],["a","恒加速度，单位 m/s²；对应 v–t 图斜率。"],["t","从初始状态起计时，单位 s。"],["x","位置 x = v₀t + ½at²，单位 m；位置不与时间等比例增长。"]]},"newtons_second_law":{"title":"牛顿第二定律：推力和质量怎样改变运动？","subtitle":"控制同一系统的质量与合外力，观察小车加速。","goal":"区分合外力与驱动力，比较质量对加速度的影响。","formula":"F合 = ma","tex":"F_{\\mathrm{net}}=ma","condition":"固定质量的质点系统，正向恒合外力；从静止开始，忽略摩擦或已计入合力。轨道固定显示 0–10 m，每段 2 s。","initial":{"mass":0.5,"force":0.6},"symbols":[["F合","全部外力的合力，单位 N；不是未扣摩擦的单独拉力。"],["m","系统总惯性质量，单位 kg；一段演示内保持不变。"],["a","加速度 a = F合/m，单位 m/s²。"],["t","从静止起计时；v = at，x = ½at²。"]]},"free_fall":{"title":"自由落体：相同时间走相同距离吗？","subtitle":"释放小球，观察下落速度与距离。","goal":"联系静止释放、时间平方和重力加速度，核查高度与计时零点。","formula":"h = ½gt²","tex":"h=\\frac{1}{2}gt^2","condition":"只受重力、从静止释放；g 在下落范围恒定，向下为正，忽略空气阻力。小球到达设定高度后停止；空间按当前高度缩放，不模拟碰撞。","initial":{"gravity":9.8,"height":2},"symbols":[["h","从释放点起的下落距离，单位 m；与 t² 成正比。"],["g","重力加速度，单位 m/s²；演示范围 5–15。"],["t","从释放瞬间计时，单位 s；实测 ms 先除以 1000 再平方。"],["v","向下速度 v = gt，单位 m/s；初速度为 0。"]]}});
  // Six additional lessons reuse the private progress and measured-data boundary.
  Object.assign(supported, {"work_energy":{"title":"功与动能：做功去了哪里？","subtitle":"让小车通过一段距离，比较净功与动能增量。","goal":"保留初始动能，区分净功与单个力做功。","formula":"W合 = ΔK = ½m(v²−v₀²)","tex":"W_{\\mathrm{net}}=\\Delta K=\\frac{m}{2}(v^2-v_0^2)","condition":"一维平动、恒正向合外力；质量恒定；忽略转动能。净功包含全部外力的功。固定显示0–4m轨道，达到目标距离后停止。","initial":{"mass":0.5,"force":0.5,"distance":2,"velocity":0.5},"symbols":[["W合","全部外力做功的总和，单位J；恒净力同向时W合=F合x。"],["ΔK","动能增量K末−K初，不能把末动能直接当增量。"],["v₀","初速度，单位m/s；不为零时必须保留½mv₀²。"],["m","平动系统总质量，单位kg；公式暂不包含转动动能。"]]},"centripetal_force":{"title":"向心力：速度方向一直在变","subtitle":"观察圆周运动的切向速度与指向圆心的合力。","goal":"理解径向合力与角速度平方的关系。","formula":"F径 = mrω²","tex":"F_r=mr\\omega^2","condition":"水平匀速圆周运动；r固定为0.10m，与资料页处理相同；质量恒定。图中箭头只表示方向，蓝色为速度，红色为径向合力。","initial":{"mass":0.1,"radius":0.1,"omega":4},"symbols":[["F径","向心力是径向合力的作用，不是已有外力之外额外添加的力。"],["ω","角速度用rad/s，不能把每分钟转数直接代入。"],["r","旋转轴到物体质心距离，本课固定为0.10m。"],["v","速率v=rω保持不变，但速度方向沿切线持续改变。"]]},"kinetic_friction":{"title":"滑动摩擦：撤去拉力后会怎样？","subtitle":"给物块初速度，观察它减速直到停止。","goal":"联系动摩擦、支持力与减速，并返回匀速牵引实测。","formula":"fₖ = μₖN，N = mg","tex":"f_k=\\mu_kN,\\quad N=mg","condition":"水平面、仅重力与支持力作用于竖直方向；先给初速度再撤去拉力，仅滑动摩擦使其减速；μₖ近似恒定，g=9.81m/s²。停止后不继续套滑动模型。","initial":{"mass":0.5,"coefficient":0.2,"velocity":3},"symbols":[["μₖ","动摩擦系数，无量纲；这是滑动阶段的经验近似。"],["N","无其他竖直力时N=mg；斜拉时不能直接照用。"],["fₖ","方向与相对滑动方向相反；停止后本演示置零，不模拟静摩擦。"],["实测","资料页采用匀速水平牵引，此时拉力与摩擦平衡。不要把本演示的减速度当作拉力读数。"]]},"damped_oscillation":{"title":"阻尼振动：振幅怎样慢慢变小？","subtitle":"看弹簧继续往返，同时观察包络收缩。","goal":"区分瞬时位移、包络振幅和阻尼周期。","formula":"A(t) = A₀e^(−βt)","tex":"A(t)=A_0e^{-\\beta t}","condition":"线性欠阻尼模型；x=A₀e^(−βt)cos(2πt/Td)，Td为阻尼周期。相位取0，x(0)=A₀且v(0)=−βA₀，非静止释放。演示10s后停止；图线为正包络，并非瞬时位移。","initial":{"amplitude":25,"beta":0.15,"period":1.2},"symbols":[["A(t)","正包络，单位mm；图线用于比较振幅衰减，不等于每一时刻的位移。"],["β","振幅衰减系数，单位s⁻¹；不要与能量衰减率混用。"],["Td","阻尼后的周期，单位s；不是无阻尼自然周期。"],["x","位移在正负包络之间往返；相位为0时初速度并非零。"]]},"sound_resonance":{"title":"共鸣管：为什么相邻共鸣差半波长？","subtitle":"切换第一次和第二次共鸣，观察空气沿管轴振动。","goal":"区分位移波节、波腹与相邻共鸣长度差。","formula":"c = 2f(L₂−L₁)","tex":"c=2f(L_2-L_1)","condition":"一端封闭一端开放；同一管径、同一频率的相邻共鸣。有效长度L+e，固定端修正e=0.70cm。粒子纵向位移放大；每2s展示一个示意周期，不表示实际频率、不发声。","initial":{"speed":343,"frequency":500,"correction":0.7,"mode":1},"symbols":[["L₁、L₂","物理管长；L₁+e=λ/4，L₂+e=3λ/4。同频相减可抵消共同端修正。"],["f","声源实际频率，单位Hz；粒子示意不按数百Hz闪动。"],["c","声速，单位m/s；同一空气条件下并不随频率任意改变。"],["位移","封闭端是空气位移波节，有效开端是位移波腹；压强的节点关系相反。"]]},"capacitor_discharge":{"title":"电容放电：电压为何越降越慢？","subtitle":"观察剩余电压、储能和指数曲线同步下降。","goal":"理解时间常数、剩余比例与毫秒换算。","formula":"U(t) = U₀e^(−t/RC)","tex":"U(t)=U_0e^{-t/(RC)}","condition":"理想一阶RC，初始电压U₀、终值为0；忽略探头负载。电阻kΩ×电容μF得到τ(ms)。教学进度每1s走过1τ，5τ后停图，电压仍约0.67%初值；非实时放电。","initial":{"resistance":10,"capacitance":1,"voltage":5},"symbols":[["τ","时间常数RC；本课以ms显示，公式使用同一时间单位。"],["U₀","t=0时电容电压；经过1τ剩U₀/e，充电63.2%不能混用。"],["E","电容储能E=½CU²；能量随电压平方下降。"],["对数图","正电压取ln(U/1V)对时间作图，斜率为−1/τ；零点和噪声底需先核查。"]]}});
  window.LabAcademyCourseList = Object.entries(supported).map(([experiment_id, config]) => ({experiment_id, title: config.title, summary: config.goal}));
  window.dispatchEvent(new Event("lab-academy-ready"));
  const get = id => document.getElementById(id);
  const make = (tag, text, cls) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; };
  const button = (text, callback, cls = "academy-button") => { const el = make("button", text, cls); el.type = "button"; el.addEventListener("click", callback); return el; };
  const number = (value, precision = 3) => Number(value.toPrecision(precision)).toLocaleString("zh-CN", {maximumSignificantDigits: precision});
  const supportedPages = new Set(["experiment", "topic", "data", "review", "observations", "checks", "calculation", "diagnosis", "revision"]);
  const records = new Map();
  let activeId = "", activePage = "", root = null, frame = null, generation = 0, observer, focusedLesson = "", lastAnimationTime = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const record = id => { if (!records.has(id)) records.set(id, {params: {...supported[id].initial}, course: null, loading: false, loadedAt: 0, lastLoadAttempt: 0, error: "", explored: false, transferOpen: false, results: {}, answers: {}, selected: null, symbol: 0, pause: false, motion: {phase: 0, time: 0, speed: 1, completed: false, lastReadout: 0}, busy: new Set()}); return records.get(id); };
  function stopAnimation() { if (frame != null) cancelAnimationFrame(frame); frame = null; lastAnimationTime = null; }
  const transitIds = new Set(["uniform_acceleration", "newtons_second_law", "free_fall"]);
  const additionalMotionIds = new Set(["work_energy", "centripetal_force", "kinetic_friction", "damped_oscillation", "sound_resonance", "capacitor_discharge"]);
  const finiteMotionIds = new Set([...transitIds, "work_energy", "kinetic_friction", "damped_oscillation", "capacitor_discharge"]);
  const animatedIds = new Set(["simple_pendulum", "hookes_law", "spring_oscillation", ...transitIds, ...additionalMotionIds]);
  const teachingTimeIds = new Set(["sound_resonance", "capacitor_discharge"]);
  function routeExperiment() { const match = location.pathname.match(/^\/experiments\/([a-z0-9_]+)$/); return match ? match[1] : get("experimentId")?.value; }
  function ask(question, selection) { window.dispatchEvent(new CustomEvent("lab-academy-question", {detail: {question, experiment_id: activeId, selection}})); }
  async function api(path, data) {
    const response = await fetch(`/api/v1/learning/courses/${path}`, {method: data === undefined ? "GET" : "POST", credentials: "same-origin", headers: {Accept: "application/json", ...(data === undefined ? {} : {"Content-Type": "application/json"})}, ...(data === undefined ? {} : {body: JSON.stringify(data)})});
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "课程暂时无法连接，请稍后再试。");
    return body;
  }
  async function loadCourse(id, force = false) {
    const state = record(id); if (!window.tutorReady || state.loading || (state.course && !force)) return;
    state.loading = true; state.error = ""; state.lastLoadAttempt = Date.now(); const token = generation;
    try {
      const course = await api(id);
      if (token !== generation) return;
      state.course = course; state.loadedAt = Date.now();
      for (const item of course.progress || []) if (item.attempt_count > 0) {
        state.results[item.node_id] = {...item, correct: item.last_correct, restored: true};
        if (item.last_choice_id) state.answers[item.node_id] = item.last_choice_id;
        else if (Object.hasOwn(item, "last_choice_id")) delete state.answers[item.node_id];
      }
    } catch (error) { if (token === generation) state.error = error.message; }
    finally { if (token === generation) { state.loading = false; if (activeId === id) { renderContent(); focusLesson(); } } }
  }
  function answeredPrediction(state) { return Object.values(state.results).some(result => result.attempt_count > 0) && !!state.results.prediction; }
  function stageNav(state) {
    const nav = make("ol", null, "academy-stages"); nav.setAttribute("aria-label", "交互课路径");
    [["先预测", !!state.results.prediction?.correct], ["探索模型", state.explored], ["记录实测", false], ["再验证", !!state.results.transfer?.correct]].forEach(([label, done], index) => {
      const li = make("li", null, done ? "complete" : "");
      const current = !state.explored ? 0 : state.transferOpen ? 3 : 1;
      if (index === current) li.setAttribute("aria-current", "step");
      li.append(make("span", done ? "✓" : String(index + 1).padStart(2, "0")), make("b", label)); nav.append(li);
    }); return nav;
  }
  function entry(state) {
    const config = supported[activeId], section = make("section", null, "academy-entry");
    const copy = make("div"); copy.append(make("p", "INTERACTIVE LESSON / 交互课", "eyebrow"), make("h2", config.title), make("p", config.subtitle));
    const action = make("a", "进入交互课 →", "academy-entry-link"); action.href = "/data";
    if (activePage === "topic") action.addEventListener("click", event => { event.preventDefault(); window.startAcademyExperiment?.(activeId); });
    else action.dataset.route = "";
    section.append(copy, action); return section;
  }
  function renderContent() {
    if (!root || !activeId) return;
    stopAnimation(); const state = record(activeId), config = supported[activeId];
    root.replaceChildren();
    if (["experiment", "topic"].includes(activePage)) { root.append(entry(state)); return; }
    const contents = make("div", null, "academy-course-content");
    if (activePage !== "data") {
      const details = make("details", null, "academy-revisit"); details.append(make("summary", "回看交互课：预测、模型与理解检查"), contents); root.append(details);
      details.addEventListener("toggle", () => { if (details.open) beginAnimation(); else stopAnimation(); });
    } else root.append(contents);
    const header = make("header", null, "academy-heading");
    header.append(make("p", "INTERACTIVE LESSON / 交互课", "eyebrow"), make("h2", config.title), make("p", config.goal));
    contents.append(header, stageNav(state));
    const notice = make("p", "教学仿真 · 与下方实测分开。模型参数不会写入你的原始数据。", "academy-disclaimer"); contents.append(notice);
    const questionArea = make("section", null, "academy-prediction"); questionArea.setAttribute("aria-label", "先预测"); questionArea.append(make("p", "01 / 先预测", "academy-kicker"));
    if (state.loading) questionArea.append(make("p", "正在载入本次学习进度…", "academy-muted"));
    else if (state.error) {
      const error = make("p", `${state.error} 仍可探索模型；连接恢复后再记录答题进度。`, "academy-error"); error.setAttribute("role", "status"); questionArea.append(error, button("重新连接课程", () => loadCourse(activeId, true), "academy-text-button"));
    } else if (state.course) {
      const nodes = state.course.nodes.filter(item => item.stage === "prediction"); nodes.forEach(item => questionArea.append(question(item, state)));
    }
    contents.append(questionArea);
    const explore = button(state.explored ? "已开启模型探索" : "开始探索模型 →", () => { state.explored = true; renderContent(); root.querySelector(".academy-exploration h3")?.focus({preventScroll: true}); }, "academy-primary");
    explore.disabled = state.explored || (!answeredPrediction(state) && !state.error);
    contents.append(explore);
    if (!state.explored && !state.error) contents.append(make("p", "先提交你的预测。答错后也可以观察模型，再回来修改。", "academy-muted"));
    if (state.explored) {
      const exploration = make("section", null, "academy-exploration");
      const title = make("h3", "02 / 改变参数，看看会发生什么"); title.tabIndex = -1;
      exploration.append(title, make("p", config.condition, "academy-condition"));
      const layout = make("div", null, "academy-lab-layout"), controls = make("div", null, "academy-controls"), visual = make("div", null, "academy-visual");
      layout.append(controls, visual); exploration.append(layout); contents.append(exploration);
      buildControls(controls, state); buildFormula(controls, state, config); buildVisual(visual, state);
      const continueArea = make("div", null, "academy-continue");
      const note = make("div"); note.append(make("strong", "03 / 回到自己的实验"), make("p", "用真实读数检验模型，记录实际条件与偏差。仿真不能代替测量。"));
      continueArea.append(note, button("去记录实测 ↓", () => {
        const target = document.querySelector('[data-view="data"] > .card');
        if (target) { window.flowReveal?.(target); target.scrollIntoView({behavior: reducedMotion.matches ? "auto" : "smooth", block: "start"}); const first = [...target.querySelectorAll("input,button,select,textarea")].find(el => !el.disabled && el.offsetParent !== null); first?.focus({preventScroll: true}); }
      }, "academy-text-button")); contents.append(continueArea);
      const transfer = make("section", null, "academy-transfer");
      transfer.append(make("h3", "04 / 再验证一次理解"), make("p", "把模型用到一个新情境。可以先完成实测，再回来回答。", "academy-muted"));
      if (state.transferOpen) { (state.course?.nodes || []).filter(item => item.stage === "transfer").forEach(item => transfer.append(question(item, state))); if (!state.course) transfer.append(make("p", "课程连接恢复后即可提交理解检查。")); }
      else transfer.append(button("试一道迁移题 →", () => { state.transferOpen = true; renderContent(); root.querySelector(".academy-transfer")?.scrollIntoView({block: "nearest"}); }, "academy-button"));
      contents.append(transfer); beginAnimation();
    }
  }
  function question(item, state) {
    const id = item.id || item.node_id, wrap = make("div", null, "academy-question"); wrap.dataset.node = id;
    const fieldset = make("fieldset"), legend = make("legend", item.question); fieldset.append(legend);
    const choices = make("div", null, "academy-choices");
    (item.choices || []).forEach(choice => {
      const label = make("label", null, "academy-choice"), input = make("input"); input.type = "radio"; input.name = `academy-${activeId}-${id}`; input.value = choice.id;
      input.checked = state.answers[id] === choice.id; input.disabled = state.busy.has(id);
      input.addEventListener("change", () => { state.answers[id] = choice.id; submit.disabled = false; error.hidden = true; });
      label.append(input, make("span", choice.text)); choices.append(label);
    }); fieldset.append(choices); wrap.append(fieldset);
    const result = state.results[id];
    const submit = button(state.busy.has(id) ? "正在保存…" : result?.correct ? "再答一次" : result?.attempt_count ? "修改后再试" : "提交我的预测", () => submitAnswer(item, state, wrap), "academy-button");
    if (item.stage === "transfer" && !result?.attempt_count) submit.textContent = "提交理解检查";
    const locked = result?.correct && result.can_answer === false;
    submit.disabled = locked || !state.answers[id] || state.busy.has(id);
    if (locked) { submit.textContent = "本次理解检查已完成"; fieldset.disabled = true; }
    wrap.append(submit);
    const error = make("p", "", "academy-error"); error.hidden = true; error.setAttribute("role", "status"); wrap.append(error);
    if (result) {
      const response = make("div", null, `academy-response ${result.correct ? "is-correct" : "try-again"}`); response.setAttribute("role", "status");
      response.append(make("strong", result.status === "review_due" ? "到了独立复习的时间" : result.correct ? result.assisted ? "在提示帮助下完成了这道题" : "本题答对，继续验证" : "再观察一下，再作判断"));
      if (result.restored) response.append(make("p", result.status === "review_due" ? "先独立作答，提交后再根据反馈核对。之前的答案已收起。" : `已恢复学习记录：尝试 ${result.attempt_count} 次${result.assisted ? "，使用过提示" : ""}。${locked ? "本次已完成，可以回看解析；到期后再独立复习。" : "可以重新回答巩固理解。"}`));
      else {
        if (result.feedback) response.append(make("p", result.feedback));
        if (result.hint) response.append(make("p", `提示：${result.hint}`, "academy-answer-hint"));
      }
      if (result.explanation) { const explanation = make("details", null, "academy-explanation"); explanation.open = !result.restored; explanation.append(make("summary", "回看解释"), make("p", result.explanation)); response.append(explanation); }
      wrap.append(response);
      if (result.attempts?.length) {
        const changes = make("details", null, "academy-attempt-history"), history = make("ol");
        changes.append(make("summary", `作答与修改记录（本轮 ${result.total ?? result.cycle_attempt_count ?? result.attempt_count} 次）`));
        for (const attempt of result.attempts) {
          const choice = item.choices.find(option => option.id === attempt.choice_id), entry = make("li");
          entry.append(make("span", choice?.text || attempt.choice_id), make("small", `${attempt.correct ? "本题答对" : "待调整"}${attempt.assisted ? " · 根据提示再答" : ""}${attempt.answered_at ? ` · ${new Date(attempt.answered_at).toLocaleString("zh-CN")}` : ""}`)); history.append(entry);
        }
        changes.append(history); if (result.truncated || result.attempts_truncated) changes.append(make("p", "此处显示最近 8 次记录。", "academy-muted")); wrap.append(changes);
      }
    }
    return wrap;
  }
  async function submitAnswer(item, state, wrap) {
    const id = item.id || item.node_id, eid = activeId, token = generation;
    if (!state.answers[id] || state.busy.has(id)) return;
    state.busy.add(id); wrap.querySelectorAll("input,button").forEach(el => el.disabled = true);
    try {
      const response = await api(`${eid}/answers`, {node_id: id, choice_id: state.answers[id]});
      if (token !== generation) return;
      const attempts = [...(state.results[id]?.attempts || []), {choice_id: state.answers[id], correct: response.correct, assisted: response.assisted, answered_at: new Date().toISOString()}].slice(-8);
      state.results[id] = {...response, attempts, can_answer: response.correct ? false : true}; state.busy.delete(id);
      window.dispatchEvent(new CustomEvent("lab-learning-updated", {detail: {experiment_id: eid, node_id: id, correct: response.correct}}));
      if (activeId === eid) { renderContent(); const status = root.querySelector(`[data-node="${id}"] .academy-response`); if (status) { status.tabIndex = -1; status.focus({preventScroll: true}); } }
    } catch (error) {
      if (token !== generation) return;
      state.busy.delete(id); wrap.querySelectorAll("input,button").forEach(el => el.disabled = false);
      const note = wrap.querySelector(".academy-error"); note.textContent = `${error.message} 你的选项仍然保留，请重试。`; note.hidden = false;
    }
  }
  function range(parent, key, label, min, max, step, value, format, onInput) {
    const holder = make("div", null, "academy-range"), caption = make("div"), control = make("input"), output = make("output");
    control.id = `academy-${activeId}-${key}`; control.type = "range"; control.min = min; control.max = max; control.step = step; control.value = value;
    const l = make("label", label); l.htmlFor = control.id; output.htmlFor = control.id; output.value = format(value); caption.append(l, output);
    control.setAttribute("aria-valuetext", format(value));
    control.addEventListener("input", () => { const n = Number(control.value); output.value = format(n); control.setAttribute("aria-valuetext", format(n)); onInput(n);
      if (transitIds.has(activeId) || additionalMotionIds.has(activeId) || activeId === "hookes_law") { const motion = record(activeId).motion; motion.time = 0; motion.phase = 0; motion.completed = false; }
      updateVisual(); syncMotionControls(); if (frame == null) beginAnimation(); });
    holder.append(caption, control); parent.append(holder);
  }
  function buildControls(parent, state) {
    const p = state.params;
    if (activeId === "simple_pendulum") {
      range(parent, "length", "摆长 L", .25, 1.5, .05, p.length, n => `${number(n)} m`, n => p.length = n);
      parent.append(make("p", "摆角固定为 8°。观察完整往返，区分周期与半周期。", "academy-muted"));
      buildMotionControls(parent, state);
    } else if (activeId === "ohms_law") {
      range(parent, "resistance", "电阻 R", 100, 1000, 50, p.resistance, n => `${number(n)} Ω`, n => p.resistance = n);
      range(parent, "voltage", "电压 U", .5, 5, .1, p.voltage, n => `${number(n)} V`, n => p.voltage = n);
      parent.append(make("p", "保持 R 不变，改变 U；再换一个 R，比较 U–I 图的斜率。", "academy-muted"));
    } else if (activeId === "rc_time_constant") {
      range(parent, "resistance", "电阻 R", 1, 50, 1, p.resistance, n => `${number(n)} kΩ`, n => p.resistance = n);
      range(parent, "capacitance", "电容 C", .5, 10, .5, p.capacitance, n => `${number(n)} μF`, n => p.capacitance = n);
      range(parent, "time", "观察时刻 t", 0, 5, .1, p.time, n => `${number(n)} τ`, n => p.time = n);
      const modes = make("div", null, "academy-modes"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "RC 模式");
      [false, true].forEach(discharge => { const b = button(discharge ? "放电" : "充电", () => { p.discharge = discharge; [...modes.children].forEach(el => el.setAttribute("aria-pressed", String(el === b))); updateVisual(); }, "academy-mode"); b.setAttribute("aria-pressed", String(discharge === p.discharge)); modes.append(b); }); parent.append(modes);
    } else if (activeId === "hookes_law") {
      range(parent, "stiffness", "劲度系数 k", 20, 100, 5, p.stiffness, n => `${number(n)} N/m`, n => p.stiffness = n);
      range(parent, "force", "外加拉力 F", 0, 4, .1, p.force, n => `${number(n)} N`, n => p.force = n);
      parent.append(make("p", "不用拖动滑杆，物块会围绕加载后的平衡位置持续往返，弹簧同步伸缩。F改变平衡位置，k改变平衡位置和振动快慢；修改参数后从新初始状态观察。", "academy-muted"));
      buildMotionControls(parent, state);
    } else if (activeId === "spring_oscillation") {
      range(parent, "mass", "振子质量 m", .05, .5, .025, p.mass, n => `${number(n)} kg`, n => p.mass = n);
      range(parent, "stiffness", "劲度系数 k", 10, 50, 2, p.stiffness, n => `${number(n)} N/m`, n => p.stiffness = n);
      parent.append(make("p", "物块围绕平衡位置往返，弹簧同步伸缩。振幅固定且仅作示意；质量越大越慢，弹簧越硬越快。", "academy-muted"));
      buildMotionControls(parent, state);
    } else if (activeId === "uniform_acceleration") {
      range(parent, "velocity", "初速度 v₀", 0, 1, .1, p.velocity, n => `${number(n)} m/s`, n => p.velocity = n);
      range(parent, "acceleration", "恒加速度 a", .1, 1, .1, p.acceleration, n => `${number(n)} m/s²`, n => p.acceleration = n);
      parent.append(make("p", "每段演示 3 s，修改参数后从起点重播；图线蓝色游标对应当前时刻。", "academy-muted")); buildMotionControls(parent, state);
    } else if (activeId === "newtons_second_law") {
      range(parent, "mass", "系统总质量 m", .2, 1, .1, p.mass, n => `${number(n)} kg`, n => p.mass = n);
      range(parent, "force", "恒合外力 F合", .1, 1, .1, p.force, n => `${number(n)} N`, n => p.force = n);
      parent.append(make("p", "每段演示 2 s，从静止出发；红箭头表示合外力。修改参数后从起点重播。", "academy-muted")); buildMotionControls(parent, state);
    } else if (activeId === "free_fall") {
      range(parent, "gravity", "重力加速度 g", 5, 15, .1, p.gravity, n => `${number(n)} m/s²`, n => p.gravity = n);
      range(parent, "height", "释放高度 H", .5, 5, .5, p.height, n => `${number(n)} m`, n => p.height = n);
      parent.append(make("p", "到达设定高度时停止，可用慢放观察越落越快。修改参数后重新释放。", "academy-muted")); buildMotionControls(parent, state);
    } else if (activeId === "thin_lens") {
      range(parent, "focal", "焦距 f", 5, 20, 1, p.focal, n => `${number(n)} cm`, n => p.focal = n);
      range(parent, "distance", "物距 u", 25, 100, 1, p.distance, n => `${number(n)} cm`, n => p.distance = n);
      parent.append(make("p", "焦距最多 20 cm、物距至少 25 cm，始终保持 u > f。图中物、像和焦点按同一尺度绘制。", "academy-muted"));
    } else if (activeId === "snell_refraction") {
      range(parent, "index", "介质折射率 n₂", 1.1, 2, .05, p.index, n => number(n), n => p.index = n);
      range(parent, "angle", "入射角 θ₁", 0, 75, 1, p.angle, n => `${number(n)}°`, n => p.angle = n);
      parent.append(make("p", "从法线量角；折射率保持不变时，比较正弦图上的不同点。", "academy-muted"));
    } else if (activeId === "double_slit") {
      range(parent, "wavelength", "单色光波长 λ", 400, 700, 10, p.wavelength, n => `${number(n)} nm`, n => p.wavelength = n);
      range(parent, "distance", "双缝到屏幕距离 D", .5, 2, .1, p.distance, n => `${number(n)} m`, n => p.distance = n);
      range(parent, "spacing", "双缝间距 d", .2, 1, .05, p.spacing, n => `${number(n)} mm`, n => p.spacing = n);
      parent.append(make("p", "屏幕示意固定显示中央 ±15 mm。改变 λ、D、d，比较同一尺度上的条纹疏密。", "academy-muted"));
    } else if (activeId === "calorimetry") {
      range(parent, "metalMass", "金属质量 m金", 50, 250, 10, p.metalMass, n => `${number(n)} g`, n => p.metalMass = n);
      range(parent, "waterMass", "水质量 m水", 50, 300, 10, p.waterMass, n => `${number(n)} g`, n => p.waterMass = n);
      range(parent, "waterTemp", "水初温 T冷", 10, 40, 1, p.waterTemp, n => `${number(n)} ℃`, n => p.waterTemp = n);
      range(parent, "metalTemp", "金属初温 T热", 50, 95, 1, p.metalTemp, n => `${number(n)} ℃`, n => p.metalTemp = n);
      range(parent, "specific", "金属比热容 c金", 200, 1000, 50, p.specific, n => `${number(n)} J/(kg·K)`, n => p.specific = n);
      parent.append(make("p", "温度范围始终保持金属比水热。改变质量或比热容，观察平衡温度靠近哪一侧。", "academy-muted"));
    } else if (additionalMotionIds.has(activeId)) buildAdditionalMotionControls(parent, state);
    else buildExtendedControls(parent, state);
  }
  function buildExtendedControls(parent, state) {
    const p = state.params;
    const definitions = {
      archimedes: [["density", "液体密度 ρ", 700, 1400, 50, "kg/m³"], ["volume", "排液体积 V", 0, 200, 5, "cm³"]],
      resistivity: [["rho", "电阻率 ρ", .02, 1.1, .01, "μΩ·m"], ["length", "导线长度 L", .2, 2, .1, "m"], ["diameter", "导线直径 d", .2, 1.2, .05, "mm"]],
      joule_heating: [["current", "电流 I", 0, 2, .1, "A"], ["resistance", "电阻 R", 2, 20, 1, "Ω"], ["time", "通电时间 t", 0, 180, 10, "s"], ["mass", "水质量 m", 200, 500, 25, "g"], ["efficiency", "水储热比例 η", .2, 1, .05, ""]],
      transformer_ratio: [["primary", "初级匝数 N₁", 100, 600, 20, "匝"], ["secondary", "次级匝数 N₂", 100, 600, 20, "匝"], ["voltage", "初级电压有效值 U₁", 1, 12, .5, "V"]],
      grating_diffraction: [["lines", "光栅线密度", 100, 1200, 50, "线/mm"], ["wavelength", "波长 λ", 400, 700, 10, "nm"], ["order", "正衍射级次 m", 1, 3, 1, ""]],
      total_internal_reflection: [["index", "入射介质折射率 n高", 1.3, 1.8, .05, ""], ["angle", "入射角 θ", 0, 80, "any", "°"]],
      thermal_expansion: [["alpha", "线膨胀系数 α / 10⁻⁶ K⁻¹", 2, 30, 1, ""], ["length", "金属杆原长 L₀", 20, 100, 5, "cm"], ["temperature", "温升 ΔT", 0, 80, 5, "℃"]],
      string_waves: [["length", "有效弦长 L", .4, 1.5, .05, "m"], ["tension", "弦张力 F", 1, 20, 1, "N"], ["density", "线密度 μ", .5, 5, .25, "g/m"]],
      malus_law: [["angle", "检偏器夹角 θ", 0, 180, 5, "°"], ["intensity", "入射信号光强 I₀", .2, 1, .05, "相对单位"], ["background", "背景光强", 0, .2, .01, "相对单位"]]
    };
    for (const [key, label, min, max, step, unit] of definitions[activeId] || []) range(parent, key, label, min, max, step, p[key], n => `${number(n)}${unit ? " " + unit : ""}`, n => p[key] = n);
    const notes = {archimedes: "体积为 0 时排开液体的质量和浮力均为 0；图中的排液体积不代表物体总容积。", resistivity: "固定材料和直径，看 R–L 直线；再把直径加倍，检查电阻是否变成四分之一。", joule_heating: "固定电流、电阻、质量与效率，观察温升随时间的关系。滑杆组合最高水温低于 38 ℃，不涉及沸腾。", transformer_ratio: "图线比较固定初级匝数下的次级电压；只模拟交流空载，不将线圈接入市电。", grating_diffraction: "图纵轴是定律要求的 sin θ；超过 1 表示该级次不存在，不会继续画出衍射光线。", total_internal_reflection: "折射要求的 sin θ 达到 1 是临界状态，超过 1 后仅绘制反射光；图中不表示反射光强。", thermal_expansion: "伸长示意放大 80 倍，读数使用真实模型数值；比较时固定材料与原长。", string_waves: "图中展示基模静态轮廓（振幅仅为示意），没有将振幅变化当作频率变化。", malus_law: "先把背景设为 0，再加入背景，比较 90° 的测得值；信号强度需扣除背景。"};
    parent.append(make("p", notes[activeId] || "", "academy-muted"));
    if (activeId === "total_internal_reflection") parent.append(button("将入射角设为临界角", () => { p.angle = models.totalReflection(p.index, 1, 0).critical_deg; renderContent(); }, "academy-text-button"));
  }
  function buildAdditionalMotionControls(parent, state) {
    const p = state.params;
    const definitions = {
      work_energy: [["mass", "系统质量 m", .2, 1, .1, "kg"], ["force", "恒合外力 F合", .2, 1, .1, "N"], ["distance", "目标距离 x", 1, 4, .5, "m"], ["velocity", "初速度 v₀", 0, 1, .1, "m/s"]],
      centripetal_force: [["mass", "旋转质量 m", .05, .25, .025, "kg"], ["omega", "角速度 ω", 1, 8, .5, "rad/s"]],
      kinetic_friction: [["mass", "物块质量 m", .2, 1, .1, "kg"], ["coefficient", "动摩擦系数 μₖ", .1, .5, .05, ""], ["velocity", "初速度 v₀", 1, 4, .25, "m/s"]],
      damped_oscillation: [["amplitude", "包络初值 A₀", 10, 30, 1, "mm"], ["beta", "振幅衰减系数 β", .05, .4, .025, "s⁻¹"], ["period", "阻尼周期 Td", .6, 2, .1, "s"]],
      sound_resonance: [["frequency", "声源频率 f", 300, 800, 25, "Hz"], ["speed", "给定空气条件下的声速 c", 320, 360, 5, "m/s"]],
      capacitor_discharge: [["resistance", "放电电阻 R", 1, 50, 1, "kΩ"], ["capacitance", "电容 C", .5, 10, .5, "μF"], ["voltage", "初始电压 U₀", 1, 6, .5, "V"]]
    };
    for (const [key, label, min, max, step, unit] of definitions[activeId]) range(parent, key, label, min, max, step, p[key], n => `${number(n)}${unit ? " " + unit : ""}`, n => p[key] = n);
    if (activeId === "sound_resonance") {
      const modes = make("div", null, "academy-modes"); modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "共鸣模式");
      for (const mode of [1, 2]) {
        const b = button(mode === 1 ? "第一次共鸣" : "相邻第二次共鸣", () => {
          p.mode = mode; state.motion.time = 0; state.motion.phase = 0; state.motion.completed = false;
          [...modes.children].forEach(el => el.setAttribute("aria-pressed", String(el === b))); updateVisual(); syncMotionControls(); if (frame == null) beginAnimation();
        }, "academy-mode"); b.setAttribute("aria-pressed", String(p.mode === mode)); modes.append(b);
      }
      parent.append(modes);
    }
    const notes = {
      work_energy: "先比较净功与动能增量两条能量条，再把初速度设为非零。到达目标距离后停止，调参从起点重播。",
      centripetal_force: "半径固定0.10m。比较红色径向合力与蓝色切向速度：速率不变，方向持续改变。调参从同一方位重新观察。",
      kinetic_friction: "先看撤去拉力后的减速。本课实测仍采用匀速水平牵引，以拉力读数测摩擦；两种受力情形须分别记录。",
      damped_oscillation: "比较瞬时位移与正包络。10s后只停止演示，振子不因此变为严格静止；调参从同一初始相位重播。",
      sound_resonance: "圆点表示空气沿管轴的纵向位移（已放大）。每2s为一个示意周期，与实际数百Hz不按实时比例播放；模式决定节点分布。",
      capacitor_discharge: "教学进度每1s走过1τ，5s展示到5τ后停图。调节R或C会改变读数中的物理毫秒时间，不改变教学进度总时长。"
    };
    parent.append(make("p", notes[activeId], "academy-muted")); buildMotionControls(parent, state);
  }
  function buildMotionControls(parent, state) {
    const controls = make("div", null, "academy-motion-controls");
    const actions = make("div", null, "academy-motion-actions");
    const play = button("", () => {
      if (state.motion.completed) { state.motion.time = 0; state.motion.phase = 0; state.motion.completed = false; state.pause = false; }
      else state.pause = !state.pause;
      paintMotion(true); syncMotionControls(); if (state.pause) stopAnimation(); else beginAnimation();
    }, "academy-button"); play.id = "academyMotionToggle"; play.setAttribute("aria-controls", "academyMotionDrawing");
    const reset = button("复位到起点", () => { stopAnimation(); state.motion.time = 0; state.motion.phase = 0; state.motion.completed = false; state.pause = true; paintMotion(true); syncMotionControls(); }, "academy-button");
    reset.id = "academyMotionReset"; actions.append(play, reset);
    const speedLabel = make("label", "播放速度"), speed = make("select"); speed.id = "academyMotionSpeed"; speedLabel.htmlFor = speed.id;
    for (const [value, label] of [[1, teachingTimeIds.has(activeId) ? "1× 教学进度" : "1× 实时"], [.5, "0.5× 慢放"], [.25, "0.25× 慢放"]]) { const option = make("option", label); option.value = value; option.selected = state.motion.speed === value; speed.append(option); }
    speed.addEventListener("change", () => { state.motion.speed = Number(speed.value); syncMotionControls(); });
    const status = make("p", "", "academy-motion-status"); status.id = "academyMotionStatus"; status.setAttribute("role", "status");
    controls.append(actions, speedLabel, speed, status, make("small", teachingTimeIds.has(activeId) ? "这是教学进度，非物理实时播放。慢放只延长观察时间；复位会暂停在起点。" : "慢放只改变播放速度，不改变模型周期或计算结果；复位会暂停在起点。", "academy-motion-note")); parent.append(controls); syncMotionControls();
  }
  function syncMotionControls() {
    const toggle = get("academyMotionToggle"), status = get("academyMotionStatus"); if (!toggle || !activeId) return;
    const state = record(activeId), unavailable = reducedMotion.matches;
    toggle.disabled = unavailable;
    toggle.textContent = state.motion.completed ? "重新播放" : state.pause ? "继续动画" : "暂停动画";
    status.textContent = unavailable ? "已按系统的减少动态效果设置停用自动播放，仍可调参和查看图线。" : state.motion.completed ? "本次演示完成，点击重新播放可再观察一次。" : `${state.pause ? "已暂停" : "播放中"} · ${state.motion.speed}× ${teachingTimeIds.has(activeId) ? "教学进度" : "速度"}`;
  }
  function buildFormula(parent, state, config) {
    const panel = make("div", null, "academy-formula"), formula = button("", () => ask(`请解释教学仿真中的公式 ${config.formula}。当前模拟：${pointLabel(activeId, currentPoint(state))}。适用条件：${config.condition}`, {kind: "formula", label: config.formula, values: {...currentPoint(state), condition: config.condition}}), "academy-formula-button");
    if (window.katex) window.katex.render(config.tex, formula, {throwOnError: false, trust: false, displayMode: false}); else formula.textContent = config.formula;
    formula.setAttribute("aria-label", `向助教询问公式 ${config.formula}`); panel.append(make("p", "读懂模型", "academy-kicker"), formula);
    const symbols = make("div", null, "academy-symbols"), explanation = make("p", config.symbols[state.symbol][1], "academy-symbol-explanation"); explanation.setAttribute("aria-live", "polite");
    config.symbols.forEach(([symbol, text], index) => { const b = button(symbol, () => { state.symbol = index; explanation.textContent = text; [...symbols.children].forEach(el => el.setAttribute("aria-pressed", String(el === b))); }, "academy-symbol"); b.setAttribute("aria-pressed", String(index === state.symbol)); symbols.append(b); });
    panel.append(symbols, explanation, make("p", "点击公式可将问题带到助教，确认后再发送。", "academy-muted")); parent.append(panel);
  }
  const ns = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}, text) { const el = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value)); if (text != null) el.textContent = text; return el; }
  function newSvg(label, height = 300) { const svg = svgEl("svg", {viewBox: `0 0 600 ${height}`, role: "img", "aria-label": label, class: "academy-chart"}); svg.append(svgEl("title", {}, label)); return svg; }
  function plot({label, xLabel, yLabel, maxX, maxY, points, line, threshold, selected, onSelect}) {
    const svg = newSvg(label), left = 68, right = 575, top = 25, bottom = 243;
    svg.setAttribute("role", "group");
    const x = n => left + n / maxX * (right - left), y = n => bottom - n / maxY * (bottom - top);
    for (let i = 0; i <= 5; i++) {
      const px = x(maxX * i / 5), py = y(maxY * i / 5);
      svg.append(svgEl("line", {x1: left, x2: right, y1: py, y2: py, class: "academy-grid"}), svgEl("text", {x: left - 10, y: py + 4, "text-anchor": "end", class: "academy-tick"}, number(maxY * i / 5)), svgEl("text", {x: px, y: bottom + 22, "text-anchor": "middle", class: "academy-tick"}, number(maxX * i / 5)));
    }
    svg.append(svgEl("path", {d: `M${left},${top}V${bottom}H${right}`, class: "academy-axis"}), svgEl("text", {x: (left + right) / 2, y: 292, "text-anchor": "middle", class: "academy-axis-label"}, xLabel), svgEl("text", {x: 10, y: 14, class: "academy-axis-label"}, yLabel));
    if (threshold) {
      svg.append(svgEl("path", {d: `M${x(threshold.x)},${bottom}V${y(threshold.y)}H${left}`, class: "academy-threshold"}), svgEl("text", {x: Math.min(x(threshold.x) + 9, right - 125), y: y(threshold.y) - 10, class: "academy-threshold-label"}, threshold.label));
    }
    if (line) svg.append(svgEl("path", {d: line.map((point, index) => `${index ? "L" : "M"}${x(point.x).toFixed(3)},${y(point.y).toFixed(3)}`).join(" "), class: "academy-model-line"}));
    points.forEach((point, index) => {
      const circle = svgEl("circle", {cx: x(point.x), cy: y(point.y), r: selected === index ? 7 : 5, class: `academy-chart-point${selected === index ? " selected" : ""}`, tabindex: 0, role: "button", "aria-label": `${point.label}，选择这个教学模拟点`, "aria-pressed": String(selected === index)});
      const choose = () => onSelect(index); circle.addEventListener("click", choose); circle.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); choose(); } }); svg.append(circle);
    }); return svg;
  }
  function currentPoint(state) {
    const p = state.params;
    if (activeId === "simple_pendulum") return models.pendulum(p.length);
    if (activeId === "ohms_law") return models.ohms(p.resistance, p.voltage);
    if (activeId === "rc_time_constant") return models.rc(p.resistance, p.capacitance, p.time * p.resistance * p.capacitance, p.discharge);
    if (activeId === "hookes_law") return models.hooke(p.stiffness, p.force);
    if (activeId === "spring_oscillation") return models.spring(p.mass, p.stiffness);
    if (activeId === "uniform_acceleration") return models.kinematics(p.velocity, p.acceleration, 3);
    if (activeId === "newtons_second_law") return models.newtons(p.mass, p.force, 2);
    if (activeId === "free_fall") return models.freeFall(p.gravity, Math.sqrt(2 * p.height / p.gravity));
    if (activeId === "thin_lens") return models.lens(p.focal, p.distance);
    if (activeId === "snell_refraction") return models.refraction(p.index, p.angle);
    if (activeId === "double_slit") return models.doubleSlit(p.wavelength, p.distance, p.spacing);
    if (activeId === "calorimetry") return models.calorimetry(p.metalMass, p.waterMass, p.waterTemp, p.metalTemp, p.specific);
    if (activeId === "archimedes") return models.buoyancy(p.density, p.volume);
    if (activeId === "resistivity") return models.resistivity(p.rho, p.length, p.diameter);
    if (activeId === "joule_heating") return models.joule(p.current, p.resistance, p.time, p.mass, p.efficiency);
    if (activeId === "transformer_ratio") return models.transformer(p.primary, p.secondary, p.voltage);
    if (activeId === "grating_diffraction") return models.grating(p.lines, p.wavelength, p.order);
    if (activeId === "total_internal_reflection") return models.totalReflection(p.index, 1, p.angle);
    if (activeId === "thermal_expansion") return models.expansion(p.alpha, p.length, p.temperature);
    if (activeId === "string_waves") return models.stringWave(p.length, p.tension, p.density);
    if (activeId === "malus_law") return models.malus(p.angle, p.intensity, p.background);
    if (activeId === "work_energy") return models.workEnergy(p.mass, p.force, p.distance, p.velocity);
    if (activeId === "centripetal_force") return models.centripetal(p.mass, p.radius, p.omega);
    if (activeId === "kinetic_friction") return models.slidingFriction(p.mass, p.coefficient, p.velocity, 0);
    if (activeId === "damped_oscillation") return models.dampedMotion(p.amplitude, p.beta, p.period, 10);
    if (activeId === "sound_resonance") return models.soundResonance(p.speed, p.frequency, p.correction);
    if (activeId === "capacitor_discharge") return models.capacitorDischarge(p.resistance, p.capacitance, p.voltage, p.resistance * p.capacitance);
    throw new RangeError("未配置的教学模型。");
  }
  function buildVisual(parent, state) {
    parent.id = "academyVisual";
    const readings = make("div", null, "academy-readings"); readings.id = "academyReadings";
    const graphic = make("div", null, "academy-graphic"); graphic.id = "academyGraphic";
    const selected = make("div", null, "academy-selected"); selected.id = "academySelected"; selected.setAttribute("aria-live", "polite");
    parent.append(readings, graphic, selected, make("p", "可点击曲线上的圆点，或用 Tab 键选择，再向助教询问。", "academy-plot-help")); updateVisual();
  }
  function reading(parent, label, value) { const item = make("div"); item.append(make("span", label), make("strong", value)); parent.append(item); }
  function pointLabel(eid, point) {
    if (eid === "simple_pendulum") return `L = ${number(point.length_m)} m，T = ${number(point.period_s)} s，T² = ${number(point.period_squared_s2)} s²`;
    if (eid === "ohms_law") return `I = ${number(point.current_mA)} mA，U = ${number(point.voltage_V)} V，R = ${number(point.resistance_ohm)} Ω`;
    if (eid === "hookes_law") return `F = ${number(point.force_N)} N，平衡伸长 x_eq = ${number(point.extension_cm)} cm，k = ${number(point.stiffness_N_m)} N/m`;
    if (eid === "spring_oscillation") return `m = ${number(point.mass_kg)} kg，k = ${number(point.stiffness_N_m)} N/m，T = ${number(point.period_s)} s，T² = ${number(point.period_squared_s2)} s²`;
    if (eid === "uniform_acceleration") return `v₀ = ${number(point.initial_velocity_m_s)} m/s，a = ${number(point.acceleration_m_s2)} m/s²，t = ${number(point.time_s)} s，x = ${number(point.position_m)} m，v = ${number(point.velocity_m_s)} m/s`;
    if (eid === "newtons_second_law") return `m = ${number(point.mass_kg)} kg，F合 = ${number(point.net_force_N)} N，a = ${number(point.acceleration_m_s2)} m/s²（从静止开始）`;
    if (eid === "free_fall") return `g = ${number(point.gravity_m_s2)} m/s²，t = ${number(point.time_s)} s，h = ${number(point.height_m)} m，v = ${number(point.velocity_m_s)} m/s（静止释放）`;
    if (eid === "thin_lens") return `f = ${number(point.focal_cm)} cm，u = ${number(point.object_cm)} cm，v = ${number(point.image_cm)} cm，M = ${number(point.magnification)}`;
    if (eid === "snell_refraction") return `n₂ = ${number(point.index_2)}，θ₁ = ${number(point.incidence_deg)}°，θ₂ = ${number(point.refraction_deg)}°，sin θ₁ = ${number(point.sine_incidence)}，sin θ₂ = ${number(point.sine_refraction)}`;
    if (eid === "double_slit") return `λ = ${number(point.wavelength_nm)} nm，D = ${number(point.distance_m)} m，d = ${number(point.slit_spacing_mm)} mm，Δx = ${number(point.fringe_spacing_mm)} mm`;
    if (eid === "calorimetry") return `m金 = ${number(point.metal_mass_g)} g，m水 = ${number(point.water_mass_g)} g，T热 = ${number(point.metal_temp_C)} ℃，T冷 = ${number(point.water_temp_C)} ℃，c金 = ${number(point.metal_specific_J_kg_K)} J/(kg·K)，T = ${number(point.equilibrium_C)} ℃，吸热 = 放热 = ${number(point.absorbed_J)} J`;
    if (eid === "archimedes") return `ρ液 = ${number(point.density_kg_m3)} kg/m³，V排 = ${number(point.volume_cm3)} cm³，F浮 = ${number(point.buoyancy_N)} N`;
    if (eid === "resistivity") return `ρ = ${number(point.resistivity_microohm_m)} μΩ·m，L = ${number(point.length_m)} m，d = ${number(point.diameter_mm)} mm，A = ${number(point.area_mm2)} mm²，R = ${number(point.resistance_ohm)} Ω`;
    if (eid === "joule_heating") return `I = ${number(point.current_A)} A，R = ${number(point.resistance_ohm)} Ω，t = ${number(point.time_s)} s，水质量 = ${number(point.water_mass_g)} g，η = ${number(point.efficiency)}，输入电能 = ${number(point.electrical_energy_J)} J，水吸热 = ${number(point.water_heat_J)} J，温升 = ${number(point.temperature_rise_C)} ℃`;
    if (eid === "transformer_ratio") return `N₁ = ${point.primary_turns}，N₂ = ${point.secondary_turns}，U₁有效 = ${number(point.primary_V_rms)} V，U₂有效 = ${number(point.secondary_V_rms)} V，匝数比 = ${number(point.turns_ratio)}`;
    if (eid === "grating_diffraction") return `${number(point.lines_per_mm)} 线/mm，λ = ${number(point.wavelength_nm)} nm，m = ${point.order}，mλ/d = ${number(point.required_sine)}，${point.diffraction_state === "absent" ? "该级次不存在" : point.diffraction_state === "grazing" ? "θ = 90°，沿面方向" : `θ = ${number(point.diffraction_deg)}°`}`;
    if (eid === "total_internal_reflection") return `n高 = ${number(point.index_high)}，n低 = ${number(point.index_low)}，θ = ${number(point.incidence_deg)}°，θc = ${number(point.critical_deg)}°，${point.optical_state === "total" ? "全反射，无传播折射光" : point.optical_state === "critical" ? "临界状态，折射沿界面" : `折射角 = ${number(point.refraction_deg)}°`}`;
    if (eid === "thermal_expansion") return `α = ${number(point.alpha_micro_K)}×10⁻⁶/K，L₀ = ${number(point.initial_cm)} cm，ΔT = ${number(point.temperature_rise_C)} ℃，ΔL = ${number(point.extension_mm)} mm`;
    if (eid === "string_waves") return `L = ${number(point.length_m)} m，F = ${number(point.tension_N)} N，μ = ${number(point.linear_density_g_m)} g/m，v = ${number(point.speed_m_s)} m/s，f₁ = ${number(point.fundamental_Hz)} Hz，λ₁ = ${number(point.wavelength_m)} m`;
    if (eid === "malus_law") return `θ = ${number(point.angle_deg)}°，I₀ = ${number(point.input_intensity)}，背景 = ${number(point.background)}，信号 = ${number(point.signal_intensity)}，测得光强 = ${number(point.measured_intensity)}（相对单位）`;
    if (eid === "work_energy") return `x=${number(point.position_m)}m，v₀=${number(point.initial_velocity_m_s)}m/s，v=${number(point.velocity_m_s)}m/s，W合=${number(point.work_J)}J，ΔK=${number(point.kinetic_final_J - point.kinetic_initial_J)}J`;
    if (eid === "centripetal_force") return `m=${number(point.mass_kg)}kg，r=${number(point.radius_m)}m，ω=${number(point.angular_speed_rad_s)}rad/s，F径=${number(point.force_N)}N，v=${number(point.speed_m_s)}m/s`;
    if (eid === "kinetic_friction") return `m=${number(point.mass_kg)}kg，μₖ=${number(point.coefficient)}，fₖ=${number(point.friction_N)}N，t=${number(point.time_s)}s，v=${number(point.velocity_m_s)}m/s，x=${number(point.position_m)}m`;
    if (eid === "damped_oscillation") return `t=${number(point.time_s)}s，正包络A=${number(point.envelope_mm)}mm，瞬时位移x=${number(point.displacement_mm)}mm，β=${number(point.beta_per_s)}s⁻¹`;
    if (eid === "sound_resonance") return `c=${number(point.speed_m_s)}m/s，f=${number(point.frequency_Hz)}Hz，L₁=${number(point.first_length_cm, 5)}cm，L₂=${number(point.second_length_cm, 5)}cm，ΔL=${number(point.spacing_cm, 5)}cm`;
    if (eid === "capacitor_discharge") return `t=${number(point.time_ms)}ms，U=${number(point.voltage_V)}V，τ=${number(point.tau_ms)}ms，剩余储能=${number(point.energy_uJ)}μJ`;
    return `t = ${number(point.time_ms)} ms，Vc = ${number(point.voltage_V)} V，τ = ${number(point.tau_ms)} ms（${point.discharge ? "放电" : "充电"}）`;
  }
  function updateVisual(preserveSelected = false) {
    const graphic = get("academyGraphic"), readings = get("academyReadings"), holder = get("academySelected");
    if (!graphic || !activeId) return;
    const state = record(activeId), p = state.params, current = currentPoint(state); if (!preserveSelected) state.selected = current;
    readings.replaceChildren(); graphic.replaceChildren();
    const choose = (point, focusChart = false) => { state.selected = point; updateVisual(true); if (focusChart) get("academyGraphic")?.querySelector('.academy-chart[role="group"] .selected')?.focus({preventScroll: true}); };
    let points, curve, chart;
    if (activeId === "simple_pendulum") {
      reading(readings, "单周期 T", `${number(current.period_s)} s`); reading(readings, "周期平方 T²", `${number(current.period_squared_s2)} s²`);
      const drawing = newSvg("小角度单摆示意：摆长从悬点量至摆球质心。", 170); drawing.classList.add("academy-pendulum"); drawing.id = "academyMotionDrawing";
      drawing.append(svgEl("line", {x1: 190, x2: 410, y1: 14, y2: 14, class: "academy-support"}), svgEl("line", {x1: 300, x2: 300, y1: 14, y2: 157, class: "academy-rest-line"}), svgEl("line", {id: "academyPendulumString", x1: 300, y1: 14, x2: 300, y2: 130, class: "academy-string"}), svgEl("circle", {id: "academyPendulumBob", cx: 300, cy: 130, r: 11, class: "academy-bob"}), svgEl("text", {x: 400, y: 88, class: "academy-axis-label"}, `L = ${number(p.length)} m`)); graphic.append(drawing);
      points = [.25, .5, .75, 1, 1.25, 1.5].map(length => models.pendulum(length));
      if (!points.some(point => Math.abs(point.length_m - p.length) < 1e-6)) points.push(current);
      points.sort((a, b) => a.length_m - b.length_m);
      chart = plot({label: "单摆周期平方与摆长的教学模型", xLabel: "摆长 L / m", yLabel: "周期平方 T² / s²", maxX: 1.5, maxY: 7, line: [{x: 0, y: 0}, {x: 1.5, y: models.pendulum(1.5).period_squared_s2}], points: points.map(point => ({x: point.length_m, y: point.period_squared_s2, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.length_m - state.selected.length_m) < 1e-6), onSelect: index => choose(points[index], true)});
      positionPendulum(.139626 * Math.cos(state.motion.phase * 2 * Math.PI), p.length);
    } else if (activeId === "ohms_law") {
      reading(readings, "模拟电流 I", `${number(current.current_mA)} mA`); reading(readings, "U/I（I 换算为 A）", `${number(p.resistance)} Ω`);
      points = [0, 1, 2, 3, 4, 5].map(voltage => models.ohms(p.resistance, voltage)); if (!points.some(point => Math.abs(point.voltage_V - p.voltage) < 1e-6)) points.push(current); points.sort((a, b) => a.voltage_V - b.voltage_V);
      chart = plot({label: "恒温欧姆元件 U–I 教学模型；横轴电流毫安，纵轴电压伏特", xLabel: "电流 I / mA", yLabel: "电压 U / V", maxX: 50, maxY: 5.5, line: points.map(point => ({x: point.current_mA, y: point.voltage_V})), points: points.map(point => ({x: point.current_mA, y: point.voltage_V, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.voltage_V - state.selected.voltage_V) < 1e-6), onSelect: index => choose(points[index], true)});
    } else if (activeId === "rc_time_constant") {
      reading(readings, "时间常数 τ", `${number(current.tau_ms)} ms`); reading(readings, `t = ${number(p.time)} τ 时的 Vc`, `${number(current.voltage_V)} V`);
      const threshold = models.rc(p.resistance, p.capacitance, current.tau_ms, p.discharge);
      curve = Array.from({length: 101}, (_, i) => models.rc(p.resistance, p.capacitance, current.tau_ms * i / 20, p.discharge));
      points = [0, .5, 1, 2, 3, 4, 5].map(time => models.rc(p.resistance, p.capacitance, time * current.tau_ms, p.discharge)); if (!points.some(point => Math.abs(point.time_ms - current.time_ms) < 1e-8)) points.push(current); points.sort((a, b) => a.time_ms - b.time_ms);
      chart = plot({label: `RC ${p.discharge ? "放电" : "充电"}教学曲线，标出一个时间常数的电压比例`, xLabel: "时间 t / ms", yLabel: "电容电压 Vc / V", maxX: 5 * current.tau_ms, maxY: 5.5, threshold: {x: threshold.time_ms, y: threshold.voltage_V, label: `τ · ${p.discharge ? "36.8%" : "63.2%"}`}, line: curve.map(point => ({x: point.time_ms, y: point.voltage_V})), points: points.map(point => ({x: point.time_ms, y: point.voltage_V, label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point.time_ms - state.selected.time_ms) < 1e-8), onSelect: index => choose(points[index], true)});
    }
    if (!chart) ({points, chart} = extendedVisual(state, current, graphic, readings, choose));
    graphic.append(chart); paintMotion(true); holder.replaceChildren();
    const pointChoice = make("select"), pointChoiceLabel = make("label", "选择模拟点"); pointChoice.id = `academy-point-${activeId}`; pointChoiceLabel.htmlFor = pointChoice.id;
    points.forEach((point, index) => { const option = make("option", `${index + 1}. ${pointLabel(activeId, point)}`); option.value = index; option.selected = pointLabel(activeId, point) === pointLabel(activeId, state.selected); pointChoice.append(option); });
    pointChoice.addEventListener("change", () => { const index = Number(pointChoice.value); choose(points[index]); get(`academy-point-${activeId}`)?.focus({preventScroll: true}); });
    holder.append(pointChoiceLabel, pointChoice, make("span", "已选模拟点", "academy-kicker"), make("p", pointLabel(activeId, state.selected)));
    holder.append(button("解释这个点 ↗", () => { const point = {...state.selected}, label = pointLabel(activeId, point); ask(`这是教学仿真的点（不是我的实测数据）：${label}。适用条件：${supported[activeId].condition}。请解释它在图中的含义、单位与模型条件。`, {kind: "simulation_point", label, values: {...point, condition: supported[activeId].condition}}); }, "academy-text-button"));
  }
  // All diagrams use the same SI-derived readings as the plots; no readings are written to the experiment form.
  function schematic(label, height = 205) {
    const drawing = newSvg(label, height); drawing.classList.add("academy-schematic"); return drawing;
  }
  function springPath(endX) {
    const start = 55, tail = endX - 15, steps = 20, d = [`M45,90L${start},90`];
    for (let i = 0; i <= steps; i++) d.push(`L${start + (tail - start) * i / steps},${i === 0 || i === steps ? 90 : i % 2 ? 76 : 104}`);
    d.push(`L${endX},90`); return d.join(" ");
  }
  function springDrawing(drawing, endX, blockWidth = 45, note = "") {
    drawing.append(svgEl("line", {x1: 45, x2: 45, y1: 35, y2: 145, class: "academy-support"}));
    drawing.append(svgEl("path", {d: springPath(endX), class: "academy-model-line"}), svgEl("rect", {x: endX, y: 64, width: blockWidth, height: 52, rx: 3, class: "academy-mass"}), svgEl("line", {x1: endX + blockWidth, x2: endX + blockWidth + 55, y1: 90, y2: 90, class: "academy-ray"}), svgEl("path", {d: `M${endX + blockWidth + 48},84l7,6l-7,6`, class: "academy-ray"}));
    drawing.append(svgEl("text", {x: 55, y: 175, class: "academy-axis-label"}, note));
  }
  function extendedVisual(state, current, graphic, readings, choose) {
    const p = state.params; let points, chart;
    // The currently adjusted value is always a selectable point, even between the fixed reference samples.
    function drawPlot(config, samples, key, curve) {
      points = samples;
      if (!points.some(point => Math.abs(point[key] - current[key]) < 1e-8)) points.push(current);
      points.sort((a, b) => a[key] - b[key]);
      const x = config.x, y = config.y;
      chart = plot({...config, line: (curve || points).map(point => ({x: x(point), y: y(point)})), points: points.map(point => ({x: x(point), y: y(point), label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point[key] - state.selected[key]) < 1e-8), onSelect: index => choose(points[index], true)});
    }
    if (activeId === "hookes_law") {
      reading(readings, "平衡伸长 x_eq（相对原长）", `${number(current.extension_cm)} cm`); reading(readings, "劲度系数 k", `${number(current.stiffness_N_m)} N/m`);
      const equilibriumCenter = 187.5 + current.extension_cm * 12;
      const drawing = schematic("胡克定律弹簧在恒拉力下绕加载平衡位置持续振动；红箭头表示水平合力。", 240); drawing.id = "academyMotionDrawing";
      drawing.append(
        svgEl("line", {x1: 45, x2: 45, y1: 35, y2: 145, class: "academy-support"}),
        svgEl("line", {x1: 187.5, x2: 187.5, y1: 30, y2: 145, class: "academy-rest-line"}),
        svgEl("text", {x: 187.5, y: 23, "text-anchor": "middle", class: "academy-tick"}, "原长位置"),
        svgEl("line", {x1: equilibriumCenter, x2: equilibriumCenter, y1: 35, y2: 145, class: "academy-envelope"}),
        svgEl("text", {x: equilibriumCenter, y: 165, "text-anchor": "middle", class: "academy-tick"}, "加载平衡"),
        svgEl("path", {id: "academyHookeCoil", class: "academy-model-line"}),
        svgEl("rect", {id: "academyMotionBody", x: 165, y: 64, width: 45, height: 52, rx: 3, class: "academy-mass"}),
        svgEl("circle", {id: "academyHookeCenter", cx: 187.5, cy: 90, r: 3, fill: "#9a3444"}),
        svgEl("path", {id: "academyHookeNetForce", class: "academy-ray"}),
        svgEl("text", {x: 350, y: 29, class: "academy-tick"}, "红箭头：水平合力"),
        svgEl("text", {x: 35, y: 197, class: "academy-axis-label"}, `F = ${number(p.force)} N · 平衡伸长 ${number(current.extension_cm)} cm`),
        svgEl("text", {x: 35, y: 227, class: "academy-tick"}, "固定 m = 1 kg、振幅 2 cm · 红点为质心 · 压缩为负")
      ); graphic.append(drawing, motionReadout());
      drawPlot({label: "静态加载平衡时拉力与平衡伸长的关系，不随振动时刻变化", xLabel: "平衡伸长 x_eq / cm", yLabel: "外加拉力 F / N", maxX: 20, maxY: 4.5, x: point => point.extension_cm, y: point => point.force_N}, [0, 1, 2, 3, 4].map(force => models.hooke(p.stiffness, force)), "force_N");
    } else if (activeId === "spring_oscillation") {
      reading(readings, "振动周期 T", `${number(current.period_s)} s`); reading(readings, "周期平方 T²", `${number(current.period_squared_s2)} s²`);
      const drawing = schematic(`弹簧与物块同步往返，质量 ${number(p.mass)} kg，劲度系数 ${number(p.stiffness)} N/m，周期 ${number(current.period_s)} s；振幅仅为示意。`, 225); drawing.id = "academyMotionDrawing";
      const width = 35 + p.mass * 90;
      drawing.append(svgEl("line", {x1: 45, x2: 45, y1: 35, y2: 145, class: "academy-support"}), svgEl("line", {x1: 280 + width / 2, x2: 280 + width / 2, y1: 25, y2: 143, class: "academy-rest-line"}), svgEl("path", {id: "academySpringCoil", d: springPath(316), class: "academy-model-line"}), svgEl("rect", {id: "academySpringMass", x: 316, y: 64, width, height: 52, rx: 3, class: "academy-mass"}), svgEl("path", {id: "academySpringVelocity", class: "academy-ray"}), svgEl("text", {x: 425, y: 36, class: "academy-tick"}, "箭头：运动方向"), svgEl("text", {x: 280 + width / 2, y: 155, "text-anchor": "middle", class: "academy-tick"}, "平衡位置"), svgEl("text", {x: 55, y: 190, class: "academy-axis-label"}, `m = ${number(p.mass)} kg · k = ${number(p.stiffness)} N/m`)); graphic.append(drawing, motionReadout());
      drawPlot({label: "理想弹簧振子的周期平方与质量关系", xLabel: "质量 m / kg", yLabel: "周期平方 T² / s²", maxX: .5, maxY: 2.1, x: point => point.mass_kg, y: point => point.period_squared_s2}, [.05, .1, .2, .3, .4, .5].map(mass => models.spring(mass, p.stiffness)), "mass_kg");
    } else if (transitIds.has(activeId)) {
      const duration = motionDuration(activeId, state);
      if (activeId === "uniform_acceleration") { reading(readings, "恒加速度 a", `${number(p.acceleration)} m/s²`); reading(readings, "3 s 时的速度", `${number(current.velocity_m_s)} m/s`); }
      else if (activeId === "newtons_second_law") { reading(readings, "恒合外力 F合", `${number(p.force)} N`); reading(readings, "加速度 a", `${number(current.acceleration_m_s2)} m/s²`); }
      else { reading(readings, "到达设定高度的时间", `${number(duration)} s`); reading(readings, "到达时的向下速度", `${number(current.velocity_m_s)} m/s`); }
      const drawing = schematic(activeId === "free_fall" ? "静止释放小球，到达设定高度后停止。" : "小车从左向右加速；轨道尺度固定，间距随时间增大。", activeId === "free_fall" ? 280 : 210); drawing.id = "academyMotionDrawing";
      if (activeId === "free_fall") {
        drawing.append(svgEl("line", {x1: 230, x2: 230, y1: 30, y2: 220, class: "academy-rest-line"}), svgEl("line", {x1: 150, x2: 370, y1: 232, y2: 232, class: "academy-support"}), svgEl("circle", {id: "academyMotionBody", cx: 280, cy: 30, r: 10, class: "academy-bob"}), svgEl("text", {x: 310, y: 40, class: "academy-axis-label"}, "静止释放"), svgEl("text", {x: 310, y: 222, class: "academy-axis-label"}, `H = ${number(p.height)} m`), svgEl("text", {x: 80, y: 265, class: "academy-tick"}, "向下为正 · 空间按当前高度缩放 · 不模拟碰撞"));
      } else {
        const max = activeId === "uniform_acceleration" ? 8 : 10;
        drawing.append(svgEl("line", {x1: 60, x2: 550, y1: 120, y2: 120, class: "academy-support"}));
        for (let i = 0; i <= 4; i++) drawing.append(svgEl("line", {x1: 70 + i * 110, x2: 70 + i * 110, y1: 125, y2: 135, class: "academy-axis"}), svgEl("text", {x: 70 + i * 110, y: 158, "text-anchor": "middle", class: "academy-tick"}, `${max * i / 4} m`));
        const body = svgEl("g", {id: "academyMotionBody"}); body.append(svgEl("rect", {x: -20, y: 75, width: 40, height: 30, rx: 3, class: "academy-mass"}), svgEl("circle", {cx: -12, cy: 112, r: 7, class: "academy-bob"}), svgEl("circle", {cx: 12, cy: 112, r: 7, class: "academy-bob"}));
        if (activeId === "newtons_second_law") body.append(svgEl("path", {d: `M0,60h${15 + p.force * 45}m-7,-5l7,5l-7,5`, class: "academy-ray"}));
        drawing.append(body, svgEl("text", {x: 60, y: 193, class: "academy-tick"}, `固定轨道尺度 0–${max} m · 演示 ${duration} s 后停止`));
      }
      graphic.append(drawing, motionReadout());
      if (activeId === "uniform_acceleration") drawPlot({label: "匀加速运动速度与时间；蓝色游标为当前演示时刻", xLabel: "时间 t / s", yLabel: "速度 v / m/s", maxX: 3, maxY: 5, x: point => point.time_s, y: point => point.velocity_m_s}, [0, .5, 1, 1.5, 2, 2.5, 3].map(t => models.kinematics(p.velocity, p.acceleration, t)), "time_s");
      else if (activeId === "newtons_second_law") drawPlot({label: "固定质量系统的恒合外力与加速度关系", xLabel: "加速度 a / m/s²", yLabel: "合外力 F合 / N", maxX: 5, maxY: 1.1, x: point => point.acceleration_m_s2, y: point => point.net_force_N}, [.1, .2, .4, .6, .8, 1].map(force => models.newtons(p.mass, force)), "net_force_N");
      else drawPlot({label: "自由落体下落距离与时间平方；蓝色游标对应当前小球位置", xLabel: "时间平方 t² / s²", yLabel: "下落距离 h / m", maxX: 2, maxY: 6, x: point => point.time_s ** 2, y: point => point.height_m}, [0, .25, .5, .75, 1].map(fraction => models.freeFall(p.gravity, duration * fraction)), "time_s");
      if (activeId !== "newtons_second_law") chart.append(svgEl("circle", {id: "academyMotionCursor", r: 6, class: "academy-motion-cursor", "aria-hidden": "true", "pointer-events": "none"}));
    } else if (activeId === "thin_lens") {
      reading(readings, "实像像距 v", `${number(current.image_cm)} cm`); reading(readings, "放大率 M（负号表示倒立）", number(current.magnification));
      const drawing = schematic(`薄凸透镜近轴实像光路，物距 ${number(p.distance)} cm，像距 ${number(current.image_cm)} cm，焦距 ${number(p.focal)} cm。`, 265);
      const origin = 300, axis = 125, scale = 230 / Math.max(current.object_cm, current.image_cm, 2 * p.focal), objectX = origin - p.distance * scale, imageX = origin + current.image_cm * scale, height = Math.min(32, 55 / Math.abs(current.magnification)), objectY = axis - height, imageY = axis - height * current.magnification;
      drawing.append(svgEl("line", {x1: 25, x2: 575, y1: axis, y2: axis, class: "academy-rest-line"}), svgEl("path", {d: "M300,25Q275,125 300,225Q325,125 300,25", class: "academy-lens"}));
      for (const direction of [-1, 1]) drawing.append(svgEl("circle", {cx: origin + direction * p.focal * scale, cy: axis, r: 3, class: "academy-bob"}), svgEl("text", {x: origin + direction * p.focal * scale, y: axis + 22, "text-anchor": "middle", class: "academy-tick"}, "F"));
      drawing.append(svgEl("path", {d: `M${objectX},${objectY}L${origin},${objectY}L${imageX},${imageY}`, class: "academy-ray"}), svgEl("path", {d: `M${objectX},${objectY}L${imageX},${imageY}`, class: "academy-model-line"}), svgEl("path", {d: `M${objectX},${axis}V${objectY}m-5,7l5,-7l5,7`, class: "academy-object"}), svgEl("path", {d: `M${imageX},${axis}V${imageY}m-5,-7l5,7l5,-7`, class: "academy-image"}), svgEl("text", {x: objectX, y: 235, "text-anchor": "middle", class: "academy-axis-label"}, `物 · ${number(p.distance)} cm`), svgEl("text", {x: imageX, y: 255, "text-anchor": "middle", class: "academy-axis-label"}, `像 · ${number(current.image_cm)} cm`)); graphic.append(drawing);
      const curve = Array.from({length: 76}, (_, i) => models.lens(p.focal, 25 + i));
      drawPlot({label: "固定焦距下实像像距与物距关系", xLabel: "物距 u / cm", yLabel: "像距 v / cm", maxX: 100, maxY: Math.max(20, Math.ceil(models.lens(p.focal, 25).image_cm / 10) * 10), x: point => point.object_cm, y: point => point.image_cm}, [25, 40, 60, 80, 100].map(distance => models.lens(p.focal, distance)), "object_cm", curve);
    } else if (activeId === "snell_refraction") {
      reading(readings, "折射角 θ₂", `${number(current.refraction_deg)}°`); reading(readings, "sin θ₁ / sin θ₂", p.angle === 0 ? "0 / 0 · 未定义" : number(p.index));
      const drawing = schematic(`空气进入折射率为 ${number(p.index)} 的介质，入射角 ${number(p.angle)}°，折射角 ${number(current.refraction_deg)}°。`, 240), boundary = 112, radius = 85, incidence = p.angle * Math.PI / 180, refracted = current.refraction_deg * Math.PI / 180;
      drawing.append(svgEl("rect", {x: 25, y: boundary, width: 550, height: 112, class: "academy-medium"}), svgEl("line", {x1: 25, x2: 575, y1: boundary, y2: boundary, class: "academy-axis"}), svgEl("line", {x1: 300, x2: 300, y1: 15, y2: 222, class: "academy-rest-line"}), svgEl("path", {d: `M${300 - radius * Math.sin(incidence)},${boundary - radius * Math.cos(incidence)}L300,${boundary}L${300 + radius * Math.sin(refracted)},${boundary + radius * Math.cos(refracted)}`, class: "academy-ray"}), svgEl("text", {x: 42, y: 38, class: "academy-axis-label"}, "空气 n₁ = 1"), svgEl("text", {x: 42, y: 205, class: "academy-axis-label"}, `介质 n₂ = ${number(p.index)}`), svgEl("text", {x: 315, y: 25, class: "academy-tick"}, "法线"), svgEl("text", {x: 420, y: 75, class: "academy-axis-label"}, `θ₁ = ${number(p.angle)}°`), svgEl("text", {x: 420, y: 158, class: "academy-axis-label"}, `θ₂ = ${number(current.refraction_deg)}°`)); graphic.append(drawing);
      drawPlot({label: "空气折射至均匀介质的角度正弦关系", xLabel: "sin θ₁（无量纲）", yLabel: "sin θ₂（无量纲）", maxX: 1, maxY: 1, x: point => point.sine_incidence, y: point => point.sine_refraction}, [0, 15, 30, 45, 60, 75].map(angle => models.refraction(p.index, angle)), "incidence_deg");
    } else if (activeId === "double_slit") {
      reading(readings, "相邻亮纹间距 Δx", `${number(current.fringe_spacing_mm)} mm`); reading(readings, "波长 λ", `${number(p.wavelength)} nm`);
      const drawing = schematic(`双缝干涉屏幕中央正负 15 毫米，亮纹间距 ${number(current.fringe_spacing_mm)} 毫米。`, 190);
      drawing.append(svgEl("rect", {x: 40, y: 35, width: 520, height: 90, fill: "#081622"}));
      for (let i = 0; i < 520; i++) {
        const positionMm = (i / 519 - .5) * 30, intensity = models.fringeIntensity(positionMm, current.fringe_spacing_mm);
        drawing.append(svgEl("rect", {x: 40 + i, y: 35, width: 1.1, height: 90, fill: "#f2d298", opacity: intensity}));
      }
      for (const value of [-15, 0, 15]) { const x = 300 + value / 30 * 520; drawing.append(svgEl("text", {x, y: 148, "text-anchor": "middle", class: "academy-tick"}, `${value} mm`)); }
      drawing.append(svgEl("text", {x: 300, y: 179, "text-anchor": "middle", class: "academy-axis-label"}, "屏幕位置（中央亮纹为 0）")); graphic.append(drawing);
      drawPlot({label: "固定波长与缝距，亮纹间距与屏距关系", xLabel: "屏距 D / m", yLabel: "条纹间距 Δx / mm", maxX: 2, maxY: 7.5, x: point => point.distance_m, y: point => point.fringe_spacing_mm}, [.5, .75, 1, 1.25, 1.5, 2].map(distance => models.doubleSlit(p.wavelength, distance, p.spacing)), "distance_m");
    } else if (activeId === "calorimetry") {
      reading(readings, "最终平衡温度 T", `${number(current.equilibrium_C)} ℃`); reading(readings, "回算金属比热容", `${number(current.recovered_specific_J_kg_K)} J/(kg·K)`);
      const drawing = schematic(`理想量热能量平衡，金属放热和水吸热均为 ${number(current.absorbed_J)} J。`, 205), barWidth = current.absorbed_J / 20000 * 370;
      drawing.append(svgEl("text", {x: 30, y: 29, class: "academy-axis-label"}, `金属 ${number(p.metalTemp)} ℃ + 水 ${number(p.waterTemp)} ℃ → ${number(current.equilibrium_C)} ℃`));
      [["金属放热", 63, "academy-heat-release"], ["水吸热", 113, "academy-heat-absorb"]].forEach(([label, y, cls]) => { drawing.append(svgEl("text", {x: 30, y: y + 19, class: "academy-axis-label"}, label), svgEl("rect", {x: 130, y, width: barWidth, height: 26, class: cls}), svgEl("text", {x: 130 + barWidth + 8, y: y + 19, class: "academy-tick"}, `${number(current.absorbed_J)} J`)); });
      drawing.append(svgEl("text", {x: 30, y: 177, class: "academy-tick"}, "能量条共用 0–20,000 J 尺度；理想条件下 Q放 = Q吸。")); graphic.append(drawing);
      const curve = Array.from({length: 41}, (_, i) => models.calorimetry(50 + i * 5, p.waterMass, p.waterTemp, p.metalTemp, p.specific));
      drawPlot({label: "水质量和初温固定时平衡温度与金属质量关系", xLabel: "金属质量 m金 / g", yLabel: "平衡温度 T / ℃", maxX: 250, maxY: 100, x: point => point.metal_mass_g, y: point => point.equilibrium_C}, [50, 100, 150, 200, 250].map(mass => models.calorimetry(mass, p.waterMass, p.waterTemp, p.metalTemp, p.specific)), "metal_mass_g", curve);
    } else return extendedVisualV2(state, current, graphic, readings, choose);
    return {points, chart};
  }
  function extendedVisualV2(state, current, graphic, readings, choose) {
    const p = state.params; let points, chart;
    function drawPlot(config, samples, key, curve) {
      points = samples.slice();
      if (!points.some(point => Math.abs(point[key] - current[key]) < 1e-8)) points.push(current);
      points.sort((a, b) => a[key] - b[key]);
      chart = plot({...config, line: (curve || points).map(point => ({x: config.x(point), y: config.y(point)})), points: points.map(point => ({x: config.x(point), y: config.y(point), label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point[key] - state.selected[key]) < 1e-8), onSelect: index => choose(points[index], true)});
    }
    const caption = (drawing, text, y = 185) => drawing.append(svgEl("text", {x: 30, y, class: "academy-axis-label"}, text));
    const arrow = (drawing, x1, y1, x2, y2, cls = "academy-ray") => {
      drawing.append(svgEl("line", {x1, y1, x2, y2, class: cls}));
      if (Math.hypot(x2 - x1, y2 - y1) < 1e-8) return;
      const a = Math.atan2(y2 - y1, x2 - x1), size = 7;
      drawing.append(svgEl("path", {d: `M${x2 - size * Math.cos(a - .5)},${y2 - size * Math.sin(a - .5)}L${x2},${y2}L${x2 - size * Math.cos(a + .5)},${y2 - size * Math.sin(a + .5)}`, class: cls}));
    };
    if (activeId === "archimedes") {
      reading(readings, "浮力 F浮", `${number(current.buoyancy_N)} N`); reading(readings, "排开液体的质量", `${number(current.displaced_mass_kg)} kg`);
      const drawing = schematic(`排液体积 ${number(p.volume)} cm³，液体密度 ${number(p.density)} kg/m³，浮力 ${number(current.buoyancy_N)} N。`, 235), immersed = p.volume / 200 * 70, blockY = 100 - 70 + immersed;
      drawing.append(svgEl("path", {d: "M65,34V192H345V34", class: "academy-support"}), svgEl("rect", {x: 67, y: 100, width: 276, height: 90, class: "academy-medium"}), svgEl("rect", {x: 155, y: blockY, width: 95, height: 70, class: "academy-mass"}));
      if (immersed > 0) drawing.append(svgEl("rect", {x: 155, y: 100, width: 95, height: immersed, class: "academy-submerged"}));
      drawing.append(svgEl("line", {x1: 67, x2: 343, y1: 100, y2: 100, class: "academy-axis"}));
      arrow(drawing, 410, 174, 410, 174 - immersed * .9);
      drawing.append(svgEl("text", {x: 430, y: 132, class: "academy-axis-label"}, `F浮 ${number(current.buoyancy_N)} N`), svgEl("text", {x: 90, y: 215, class: "academy-axis-label"}, `着色部分：V排 = ${number(p.volume)} cm³`)); graphic.append(drawing);
      drawPlot({label: "固定液体密度时浮力与排液体积关系", xLabel: "排液体积 V / cm³", yLabel: "浮力 F浮 / N", maxX: 200, maxY: 3, x: point => point.volume_cm3, y: point => point.buoyancy_N}, [0, 40, 80, 120, 160, 200].map(volume => models.buoyancy(p.density, volume)), "volume_cm3");
    } else if (activeId === "resistivity") {
      reading(readings, "导线电阻 R", `${number(current.resistance_ohm)} Ω`); reading(readings, "圆形截面积 A", `${number(current.area_mm2)} mm²`);
      const drawing = schematic(`圆柱导线长度 ${number(p.length)} m，直径 ${number(p.diameter)} mm。`, 200), width = 420 * p.length / 2, thickness = 10 + p.diameter * 25;
      drawing.append(svgEl("rect", {x: 65, y: 100 - thickness / 2, width, height: thickness, rx: thickness / 2, class: "academy-wire"}), svgEl("ellipse", {cx: 65 + width, cy: 100, rx: thickness / 4, ry: thickness / 2, class: "academy-wire-end"}), svgEl("line", {x1: 65, x2: 65 + width, y1: 45, y2: 45, class: "academy-axis"}));
      caption(drawing, `L = ${number(p.length)} m · d = ${number(p.diameter)} mm`, 165); graphic.append(drawing);
      drawPlot({label: "固定材料和直径时导线电阻与长度关系", xLabel: "长度 L / m", yLabel: "电阻 R / Ω", maxX: 2, maxY: models.resistivity(p.rho, 2, p.diameter).resistance_ohm * 1.1, x: point => point.length_m, y: point => point.resistance_ohm}, [.2, .5, 1, 1.5, 2].map(length => models.resistivity(p.rho, length, p.diameter)), "length_m");
    } else if (activeId === "joule_heating") {
      reading(readings, "水温升 ΔT", `${number(current.temperature_rise_C)} ℃`); reading(readings, "最终水温", `${number(current.final_C)} ℃`);
      const drawing = schematic(`输入电能 ${number(current.electrical_energy_J)} J，其中 ${number(current.water_heat_J)} J 进入水。`, 215);
      [["输入电能", current.electrical_energy_J, 48, "academy-heat-release"], ["水吸热", current.water_heat_J, 100, "academy-heat-absorb"]].forEach(([name, value, y, cls]) => {
        drawing.append(svgEl("text", {x: 25, y: y + 18, class: "academy-axis-label"}, name), svgEl("rect", {x: 125, y, width: value / 15000 * 340, height: 25, class: cls}), svgEl("text", {x: 132 + value / 15000 * 340, y: y + 18, class: "academy-tick"}, `${number(value)} J`));
      });
      caption(drawing, `水初温 20 ℃ → ${number(current.final_C)} ℃ · η = ${number(p.efficiency)}`, 166);
      caption(drawing, "能量条共用 0–15,000 J 尺度；不含沸腾或相变。", 195); graphic.append(drawing);
      drawPlot({label: "固定电流与热参数时水温升和通电时间的关系", xLabel: "通电时间 t / s", yLabel: "水温升 ΔT / ℃", maxX: 180, maxY: 18, x: point => point.time_s, y: point => point.temperature_rise_C}, [0, 30, 60, 90, 120, 180].map(time => models.joule(p.current, p.resistance, time, p.mass, p.efficiency)), "time_s");
    } else if (activeId === "transformer_ratio") {
      reading(readings, "次级电压有效值 U₂", `${number(current.secondary_V_rms)} V`); reading(readings, "匝数比 N₂/N₁", number(current.turns_ratio));
      const drawing = schematic(`理想变压器空载，初级 ${p.primary} 匝，次级 ${p.secondary} 匝，输入交流有效值 ${number(p.voltage)} V。`, 220);
      drawing.append(svgEl("rect", {x: 190, y: 40, width: 220, height: 115, class: "academy-core"}), svgEl("rect", {x: 220, y: 65, width: 160, height: 65, class: "academy-core-gap"}));
      for (const x of [200, 400]) for (let i = 0; i < 7; i++) drawing.append(svgEl("ellipse", {cx: x, cy: 55 + i * 13, rx: 20, ry: 6, class: "academy-coil"}));
      drawing.append(svgEl("text", {x: 55, y: 85, class: "academy-axis-label"}, `N₁ = ${p.primary}`), svgEl("text", {x: 55, y: 115, class: "academy-axis-label"}, `U₁ ~ ${number(p.voltage)} V`), svgEl("text", {x: 445, y: 85, class: "academy-axis-label"}, `N₂ = ${p.secondary}`), svgEl("text", {x: 445, y: 115, class: "academy-axis-label"}, `U₂ ~ ${number(current.secondary_V_rms)} V`));
      caption(drawing, "交流有效值 · 理想空载 · 线圈绘图圈数为示意", 196); graphic.append(drawing);
      drawPlot({label: "固定初级匝数与输入电压时次级电压随次级匝数的关系", xLabel: "次级匝数 N₂", yLabel: "次级有效电压 U₂ / V", maxX: 600, maxY: Math.max(2, models.transformer(p.primary, 600, p.voltage).secondary_V_rms * 1.1), x: point => point.secondary_turns, y: point => point.secondary_V_rms}, [100, 200, 300, 400, 500, 600].map(turns => models.transformer(p.primary, turns, p.voltage)), "secondary_turns");
    } else if (activeId === "grating_diffraction") {
      reading(readings, "选定正级次的方向", current.diffraction_state === "absent" ? "该级次不存在" : current.diffraction_state === "grazing" ? "90° · 沿面" : `${number(current.diffraction_deg)}°`);
      reading(readings, "光栅常数 d", `${number(current.spacing_nm)} nm`);
      const drawing = schematic(`光栅第 ${p.order} 级，${current.diffraction_state === "absent" ? "不存在传播方向" : current.diffraction_state === "grazing" ? "90 度掠射" : `衍射角 ${number(current.diffraction_deg)} 度`}。`, 230);
      drawing.append(svgEl("line", {x1: 245, x2: 245, y1: 24, y2: 192, class: "academy-support"}), svgEl("line", {x1: 35, x2: 555, y1: 110, y2: 110, class: "academy-rest-line"}));
      arrow(drawing, 55, 110, 245, 110, "academy-model-line");
      if (current.exists) { const a = current.diffraction_deg * Math.PI / 180; arrow(drawing, 245, 110, 245 + 90 * Math.cos(a), 110 - 90 * Math.sin(a)); }
      drawing.append(svgEl("text", {x: 275, y: 165, class: "academy-axis-label"}, current.diffraction_state === "absent" ? "mλ/d > 1：无此级次" : current.diffraction_state === "grazing" ? "沿光栅面：不是有限屏幕亮点" : `m = ${p.order}，θ = ${number(current.diffraction_deg)}°`));
      caption(drawing, "水平虚线为法线；仅画选定正级次，不表示光强。", 215); graphic.append(drawing);
      drawPlot({label: "光栅定律要求的正弦值随波长的关系；超过1则该级不存在", xLabel: "波长 λ / nm", yLabel: "定律要求的 sin θ", maxX: 700, maxY: 2.7, threshold: {x: 700, y: 1, label: "允许上限 1"}, x: point => point.wavelength_nm, y: point => point.required_sine}, [400, 450, 500, 550, 600, 650, 700].map(wavelength => models.grating(p.lines, wavelength, p.order)), "wavelength_nm");
    } else if (activeId === "total_internal_reflection") {
      reading(readings, "当前光路状态", current.optical_state === "total" ? "全反射" : current.optical_state === "critical" ? "临界 · 沿界面" : "有折射光"); reading(readings, "临界角 θc", `${number(current.critical_deg, 5)}°`);
      const drawing = schematic(`从折射率 ${number(p.index)} 的介质进入空气，入射角 ${number(p.angle)} 度，${current.optical_state === "total" ? "全反射，无传播折射光" : current.optical_state === "critical" ? "临界角，折射光沿界面" : `折射角 ${number(current.refraction_deg)} 度`}。`, 260), boundary = 120, a = p.angle * Math.PI / 180, r = 94;
      drawing.append(svgEl("rect", {x: 25, y: boundary, width: 550, height: 112, class: "academy-medium"}), svgEl("line", {x1: 25, x2: 575, y1: boundary, y2: boundary, class: "academy-axis"}), svgEl("line", {x1: 300, x2: 300, y1: 18, y2: 225, class: "academy-rest-line"}));
      arrow(drawing, 300 - r * Math.sin(a), boundary + r * Math.cos(a), 300, boundary, "academy-model-line");
      arrow(drawing, 300, boundary, 300 + r * Math.sin(a), boundary + r * Math.cos(a));
      if (current.refraction_deg !== null) { const b = current.refraction_deg * Math.PI / 180; arrow(drawing, 300, boundary, 300 + r * Math.sin(b), boundary - r * Math.cos(b), "academy-refracted-ray"); }
      drawing.append(svgEl("text", {x: 40, y: 42, class: "academy-axis-label"}, "空气 n低 = 1"), svgEl("text", {x: 40, y: 212, class: "academy-axis-label"}, `介质 n高 = ${number(p.index)}`), svgEl("text", {x: 315, y: 30, class: "academy-tick"}, "法线"));
      caption(drawing, "光线仅表示方向；未用明暗比较反射、透射能量。", 250); graphic.append(drawing);
      const curve = Array.from({length: 81}, (_, angle) => models.totalReflection(p.index, 1, angle));
      drawPlot({label: "折射定律要求的正弦值与入射角；临界值为1", xLabel: "入射角 θ / °", yLabel: "要求的 sin θ折", maxX: 80, maxY: 2, threshold: {x: current.critical_deg, y: 1, label: "临界 · sin θ折 = 1"}, x: point => point.incidence_deg, y: point => point.required_sine}, [0, 20, 40, current.critical_deg, 60, 80].map(angle => models.totalReflection(p.index, 1, angle)), "incidence_deg", curve);
    } else if (activeId === "thermal_expansion") {
      reading(readings, "伸长量 ΔL", `${number(current.extension_mm)} mm`); reading(readings, "最终长度 L", `${number(current.final_cm, 6)} cm`);
      const drawing = schematic(`金属杆原长 ${number(p.length)} cm，温升 ${number(p.temperature)} ℃，伸长 ${number(current.extension_mm)} mm；伸长绘图放大80倍。`, 215), initialWidth = p.length * 3, extraWidth = current.extension_mm * 24;
      drawing.append(svgEl("rect", {x: 65, y: 45, width: initialWidth, height: 25, class: "academy-wire"}), svgEl("rect", {x: 65, y: 107, width: initialWidth, height: 25, class: "academy-wire"}), svgEl("rect", {x: 65 + initialWidth, y: 107, width: extraWidth, height: 25, class: "academy-heat-release"}), svgEl("line", {x1: 65 + initialWidth, x2: 65 + initialWidth, y1: 25, y2: 150, class: "academy-rest-line"}));
      caption(drawing, `上：原长 L₀ = ${number(p.length)} cm`, 92); caption(drawing, `下：伸长 ΔL = ${number(current.extension_mm)} mm（放大 80 倍）`, 178); graphic.append(drawing);
      drawPlot({label: "固定材料和原长时金属杆伸长与温升的关系", xLabel: "温升 ΔT / ℃", yLabel: "伸长 ΔL / mm", maxX: 80, maxY: 2.5, x: point => point.temperature_rise_C, y: point => point.extension_mm}, [0, 20, 40, 60, 80].map(temperature => models.expansion(p.alpha, p.length, temperature)), "temperature_rise_C");
    } else if (activeId === "string_waves") {
      reading(readings, "基频 f₁", `${number(current.fundamental_Hz)} Hz`); reading(readings, "弦波速 v", `${number(current.speed_m_s)} m/s`);
      const drawing = schematic(`两端固定弦的基模：一个波腹，弦长 ${number(p.length)} m，基频 ${number(current.fundamental_Hz)} Hz。`, 210), width = p.length / 1.5 * 450, wave = [];
      for (let i = 0; i <= 80; i++) wave.push(`${i ? "L" : "M"}${65 + width * i / 80},${95 - 42 * Math.sin(Math.PI * i / 80)}`);
      drawing.append(svgEl("line", {x1: 65, x2: 65 + width, y1: 95, y2: 95, class: "academy-rest-line"}), svgEl("path", {d: wave.join(" "), class: "academy-model-line"}));
      for (const x of [65, 65 + width]) drawing.append(svgEl("line", {x1: x, x2: x, y1: 70, y2: 120, class: "academy-support"}), svgEl("circle", {cx: x, cy: 95, r: 4, class: "academy-bob"}));
      caption(drawing, `两端波节 · 一个波腹 · λ₁ = 2L = ${number(current.wavelength_m)} m`, 155); caption(drawing, "静态轮廓，振幅为示意；弦长按同一尺度绘制。", 185); graphic.append(drawing);
      const curve = Array.from({length: 77}, (_, i) => models.stringWave(p.length, 1 + i / 4, p.density));
      drawPlot({label: "固定弦长和线密度时基频与张力关系", xLabel: "张力 F / N", yLabel: "基频 f₁ / Hz", maxX: 20, maxY: models.stringWave(p.length, 20, p.density).fundamental_Hz * 1.1, x: point => point.tension_N, y: point => point.fundamental_Hz}, [1, 4, 8, 12, 16, 20].map(tension => models.stringWave(p.length, tension, p.density)), "tension_N", curve);
    } else if (activeId === "malus_law") {
      reading(readings, "信号光强（已扣背景）", number(current.signal_intensity)); reading(readings, "测得光强（相对单位）", number(current.measured_intensity));
      const drawing = schematic(`线偏振光通过检偏器，夹角 ${number(p.angle)} 度，信号强度 ${number(current.signal_intensity)}，背景 ${number(p.background)}。`, 220), a = p.angle * Math.PI / 180;
      drawing.append(svgEl("circle", {cx: 120, cy: 95, r: 55, class: "academy-lens"}), svgEl("circle", {cx: 285, cy: 95, r: 55, class: "academy-lens"}), svgEl("line", {x1: 120, x2: 120, y1: 45, y2: 145, class: "academy-model-line"}), svgEl("line", {x1: 285 - 50 * Math.sin(a), x2: 285 + 50 * Math.sin(a), y1: 95 - 50 * Math.cos(a), y2: 95 + 50 * Math.cos(a), class: "academy-ray"}));
      drawing.append(svgEl("text", {x: 70, y: 179, class: "academy-axis-label"}, "入射偏振方向"), svgEl("text", {x: 240, y: 179, class: "academy-axis-label"}, `检偏轴 ${number(p.angle)}°`), svgEl("rect", {x: 415, y: 143 - current.signal_intensity * 80, width: 45, height: current.signal_intensity * 80, class: "academy-heat-absorb"}), svgEl("rect", {x: 415, y: 143, width: 45, height: p.background * 80, class: "academy-heat-release"}), svgEl("text", {x: 390, y: 188, class: "academy-tick"}, "蓝：信号 / 红：背景")); graphic.append(drawing);
      const curve = Array.from({length: 91}, (_, i) => models.malus(i * 2, p.intensity, p.background));
      drawPlot({label: "已线偏振入射光的测得强度随检偏器夹角关系；含恒定背景", xLabel: "偏振方向夹角 θ / °", yLabel: "测得光强 / 相对单位", maxX: 180, maxY: 1.3, x: point => point.angle_deg, y: point => point.measured_intensity}, [0, 30, 45, 60, 90, 120, 150, 180].map(angle => models.malus(angle, p.intensity, p.background)), "angle_deg", curve);
    } else return additionalMotionVisual(state, current, graphic, readings, choose);
    return {points, chart};
  }
  function additionalPlotScale(state) {
    const p = state.params;
    if (activeId === "work_energy") return [Math.max(1, 2 * p.force * p.distance / p.mass) * 1.1, Math.max(.5, p.force * p.distance) * 1.1];
    if (activeId === "centripetal_force") return [64, 1.8];
    if (activeId === "kinetic_friction") return [models.slidingFriction(p.mass, p.coefficient, p.velocity, 0).stop_time_s * 1.1, p.velocity * 1.1];
    if (activeId === "damped_oscillation") return [10, 35];
    if (activeId === "sound_resonance") return [3.5, 35];
    return [5 * p.resistance * p.capacitance, 6.5];
  }
  function moveAdditionalCursor(state, x, y) {
    const cursor = get("academyMotionCursor"), [maxX, maxY] = additionalPlotScale(state);
    if (cursor) { cursor.setAttribute("cx", 68 + x / maxX * 507); cursor.setAttribute("cy", 243 - y / maxY * 218); }
  }
  function vectorPath(x, y, dx, dy) {
    const size = Math.hypot(dx, dy); if (size < 1e-8) return "";
    const ux = dx / size, uy = dy / size, ex = x + dx, ey = y + dy;
    return `M${x},${y}L${ex},${ey}M${ex - ux * 7 - uy * 4},${ey - uy * 7 + ux * 4}L${ex},${ey}L${ex - ux * 7 + uy * 4},${ey - uy * 7 - ux * 4}`;
  }
  function additionalMotionVisual(state, current, graphic, readings, choose) {
    const p = state.params, [maxX, maxY] = additionalPlotScale(state); let points, chart;
    function draw(config, samples, key, dense = samples) {
      points = samples.slice(); if (!points.some(point => Math.abs(point[key] - current[key]) < 1e-8)) points.push(current);
      points.sort((a, b) => a[key] - b[key]);
      chart = plot({...config, maxX, maxY, line: dense.map(point => ({x: config.x(point), y: config.y(point)})), points: points.map(point => ({x: config.x(point), y: config.y(point), label: pointLabel(activeId, point)})), selected: points.findIndex(point => Math.abs(point[key] - state.selected[key]) < 1e-8), onSelect: i => choose(points[i], true)});
    }
    const drawing = schematic(supported[activeId].title + "；" + supported[activeId].condition, activeId === "centripetal_force" ? 300 : activeId === "work_energy" ? 285 : 230); drawing.id = "academyMotionDrawing";
    if (activeId === "work_energy" || activeId === "kinetic_friction") {
      const friction = activeId === "kinetic_friction", trackMax = friction ? 9 : 4;
      if (friction) { reading(readings, "滑动阶段摩擦力 fₖ", `${number(current.friction_N)} N`); reading(readings, "停止距离", `${number(current.stop_distance_m)} m`); }
      else { reading(readings, "目标位置的净功", `${number(current.work_J)} J`); reading(readings, "目标位置的末速度", `${number(current.velocity_m_s)} m/s`); }
      drawing.append(svgEl("line", {x1: 50, x2: 550, y1: 110, y2: 110, class: "academy-support"}));
      for (let i = 0; i <= 3; i++) drawing.append(svgEl("text", {x: 70 + i * 440 / 3, y: 138, "text-anchor": "middle", class: "academy-tick"}, `${number(trackMax * i / 3)} m`));
      const body = svgEl("g", {id: "academyMotionBody"});
      body.append(svgEl("rect", {x: -22, y: 70, width: 44, height: 38, rx: 3, class: "academy-mass"}), svgEl("path", {id: "academyAdditionalForce", class: "academy-ray"})); drawing.append(body);
      if (friction) drawing.append(svgEl("text", {x: 35, y: 178, class: "academy-axis-label"}, "撤去拉力 · 红箭头为滑动摩擦"), svgEl("text", {x: 35, y: 208, class: "academy-tick"}, "停止后不再使用滑动模型，不继续倒滑"));
      else {
        drawing.append(svgEl("line", {x1: 70 + p.distance / 4 * 440, x2: 70 + p.distance / 4 * 440, y1: 30, y2: 110, class: "academy-rest-line"}), svgEl("text", {x: 35, y: 174, class: "academy-axis-label"}, "到达观察位置时停图；末速度并非零"));
        for (const [label, y, id, cls] of [["净功 W合", 200, "academyWorkBar", "academy-heat-release"], ["动能增量 ΔK", 240, "academyKineticBar", "academy-heat-absorb"]]) drawing.append(svgEl("text", {x: 30, y: y + 17, class: "academy-tick"}, label), svgEl("rect", {id, x: 155, y, width: 0, height: 22, class: cls}));
      }
      if (friction) {
        const total = current.stop_time_s;
        draw({label: "撤去拉力后速度随时间下降，到停止时刻截止", xLabel: "滑动时间 t / s", yLabel: "速度 v / m/s", x: a => a.time_s, y: a => a.velocity_m_s}, [0, .25, .5, .75, 1].map(q => models.slidingFriction(p.mass, p.coefficient, p.velocity, total * q)), "time_s");
      } else {
        draw({label: "净功与速度平方增量关系；蓝游标对应当前运动状态", xLabel: "速度平方增量 v²−v₀² / m²s⁻²", yLabel: "净功 W合 / J", x: a => 2 * a.work_J / p.mass, y: a => a.work_J}, [0, .25, .5, .75, 1].map(q => models.workEnergy(p.mass, p.force, p.distance * q, p.velocity)), "position_m");
      }
    } else if (activeId === "centripetal_force") {
      reading(readings, "径向合力 F径", `${number(current.force_N)} N`); reading(readings, "速率 v = rω", `${number(current.speed_m_s)} m/s`);
      drawing.append(svgEl("circle", {cx: 300, cy: 132, r: 86, class: "academy-orbit"}), svgEl("circle", {cx: 300, cy: 132, r: 3, class: "academy-bob"}), svgEl("line", {id: "academyRadius", x1: 300, y1: 132, x2: 386, y2: 132, class: "academy-rest-line"}), svgEl("circle", {id: "academyMotionBody", cx: 386, cy: 132, r: 10, class: "academy-bob"}), svgEl("path", {id: "academyRadialForce", class: "academy-ray"}), svgEl("path", {id: "academyTangentVelocity", class: "academy-velocity-vector"}), svgEl("text", {x: 30, y: 258, class: "academy-axis-label"}, "蓝：切向速度　红：径向合力"), svgEl("text", {x: 30, y: 286, class: "academy-tick"}, "r = 0.10 m · 箭头只表示方向，长度不作量值比较"));
      draw({label: "固定半径和质量时，径向合力与角速度平方成正比", xLabel: "角速度平方 ω² / rad²s⁻²", yLabel: "径向合力 F径 / N", x: a => a.angular_speed_rad_s ** 2, y: a => a.force_N}, [1, 2, 3, 4, 6, 8].map(w => models.centripetal(p.mass, p.radius, w)), "angular_speed_rad_s");
    } else if (activeId === "damped_oscillation") {
      reading(readings, "振幅衰减系数 β", `${number(p.beta)} s⁻¹`); reading(readings, "10 s 的正包络", `${number(current.envelope_mm)} mm`);
      drawing.append(svgEl("line", {x1: 45, x2: 45, y1: 30, y2: 145, class: "academy-support"}), svgEl("line", {x1: 280, x2: 280, y1: 25, y2: 145, class: "academy-rest-line"}), svgEl("line", {id: "academyEnvelopeLeft", y1: 25, y2: 145, class: "academy-envelope"}), svgEl("line", {id: "academyEnvelopeRight", y1: 25, y2: 145, class: "academy-envelope"}), svgEl("path", {id: "academyDampedCoil", class: "academy-model-line"}), svgEl("rect", {id: "academyMotionBody", x: 255, y: 64, width: 50, height: 52, rx: 3, class: "academy-mass"}), svgEl("circle", {id: "academyDampedCenter", cx: 280, cy: 90, r: 3, fill: "#9a3444"}), svgEl("text", {x: 35, y: 180, class: "academy-axis-label"}, "红点为质心 · 虚线夹出质心位移 ±A(t)"), svgEl("text", {x: 35, y: 211, class: "academy-tick"}, "图线为包络，不把瞬时位移当作振幅"));
      draw({label: "阻尼振动正包络的指数衰减，蓝色游标为当前包络而非位移", xLabel: "时间 t / s", yLabel: "正包络 A(t) / mm", x: a => a.time_s, y: a => a.envelope_mm}, [0, 2, 4, 6, 8, 10].map(t => models.dampedMotion(p.amplitude, p.beta, p.period, t)), "time_s", Array.from({length: 101}, (_, i) => models.dampedMotion(p.amplitude, p.beta, p.period, i / 10)));
    } else if (activeId === "sound_resonance") {
      reading(readings, "第一次共鸣 L₁", `${number(current.first_length_cm, 5)} cm`); reading(readings, "相邻第二次共鸣 L₂", `${number(current.second_length_cm, 5)} cm`);
      const lengthCm = p.mode === 1 ? current.first_length_cm : current.second_length_cm, width = lengthCm * 5, effective = width + p.correction * 5;
      drawing.append(svgEl("path", {d: `M${60 + width},65H60V125H${60 + width}`, class: "academy-model-line"}), svgEl("line", {x1: 60 + effective, x2: 60 + effective, y1: 50, y2: 140, class: "academy-envelope"}));
      const particles = svgEl("g", {id: "academyMotionBody"});
      for (let i = 0; i <= 12; i++) particles.append(svgEl("circle", {cx: 60 + width * i / 12, cy: 95, r: 3.2, class: "academy-air-particle", "data-fraction": i / 12}));
      drawing.append(particles, svgEl("text", {x: 30, y: 30, class: "academy-tick"}, `${p.mode === 1 ? "第一次" : "相邻第二次"}共鸣 · 物理管长 ${number(lengthCm, 5)} cm`), svgEl("text", {x: 30, y: 163, class: "academy-axis-label"}, "空气沿管轴左右振动（位移放大）"), svgEl("text", {x: 30, y: 193, class: "academy-tick"}, "闭端：位移波节 · 有效开端：位移波腹"), svgEl("text", {x: 30, y: 220, class: "academy-tick"}, "e = 0.70 cm · 虚线为有效开端 L+e · 非实时动画"));
      draw({label: "固定声速，第一次共鸣物理长度随频率倒数的关系，含端修正", xLabel: "频率倒数 1/f / ms", yLabel: "第一次共鸣管长 L₁ / cm", x: a => 1000 / a.frequency_Hz, y: a => a.first_length_cm}, [800, 700, 600, 500, 400, 300].map(f => models.soundResonance(p.speed, f, p.correction)), "frequency_Hz");
    } else if (activeId === "capacitor_discharge") {
      reading(readings, "时间常数 τ = RC", `${number(current.tau_ms)} ms`); reading(readings, "1τ 时的剩余电压", `${number(current.voltage_V)} V`);
      drawing.append(svgEl("path", {d: "M170,70V40H350V60M170,90V130H350V100", class: "academy-model-line"}), svgEl("line", {x1: 145, x2: 195, y1: 70, y2: 70, class: "academy-support"}), svgEl("line", {x1: 145, x2: 195, y1: 90, y2: 90, class: "academy-support"}), svgEl("rect", {x: 340, y: 60, width: 20, height: 40, class: "academy-wire"}), svgEl("text", {x: 115, y: 113, class: "academy-tick"}, "C"), svgEl("text", {x: 375, y: 88, class: "academy-tick"}, "R"), svgEl("rect", {x: 470, y: 30, width: 35, height: 115, class: "academy-voltage-empty"}), svgEl("rect", {id: "academyMotionBody", x: 470, y: 30, width: 35, height: 115, class: "academy-heat-absorb"}), svgEl("text", {x: 450, y: 168, class: "academy-tick"}, "U/U₀"), svgEl("text", {x: 30, y: 195, class: "academy-axis-label"}, "教学进度 1 s 对应 1τ · 不按实际毫秒播放"), svgEl("text", {x: 30, y: 223, class: "academy-tick"}, "5τ 时仅停止画面，电压仍非严格为零"));
      const tau = current.tau_ms;
      draw({label: "电容放电电压指数下降，蓝色游标对应读数中的物理毫秒时间", xLabel: "物理放电时间 t / ms", yLabel: "电容电压 U / V", threshold: {x: tau, y: p.voltage / Math.E, label: "1τ · 剩36.8%"}, x: a => a.time_ms, y: a => a.voltage_V}, [0, .5, 1, 2, 3, 4, 5].map(q => models.capacitorDischarge(p.resistance, p.capacitance, p.voltage, tau * q)), "time_ms", Array.from({length: 101}, (_, i) => models.capacitorDischarge(p.resistance, p.capacitance, p.voltage, tau * i / 20)));
    } else throw new RangeError("未配置的动态模型视图。");
    graphic.append(drawing, motionReadout());
    if (!["centripetal_force", "sound_resonance"].includes(activeId)) chart.append(svgEl("circle", {id: "academyMotionCursor", r: 6, class: "academy-motion-cursor", "aria-hidden": "true", "pointer-events": "none"}));
    return {points, chart};
  }
  function paintAdditionalMotion(state) {
    const p = state.params, body = get("academyMotionBody"), t = state.motion.time; if (!body) return "";
    if (activeId === "work_energy") {
      const motion = models.kinematics(p.velocity, p.force / p.mass, Math.min(t, motionDuration(activeId, state))), position = Math.min(p.distance, motion.position_m), value = models.workEnergy(p.mass, p.force, position, p.velocity);
      body.setAttribute("transform", `translate(${70 + position / 4 * 440},0)`); get("academyAdditionalForce")?.setAttribute("d", vectorPath(0, 52, 40, 0));
      for (const id of ["academyWorkBar", "academyKineticBar"]) get(id)?.setAttribute("width", value.work_J / 4 * 350);
      moveAdditionalCursor(state, 2 * value.work_J / p.mass, value.work_J);
      return `t=${t.toFixed(2)} s · x=${position.toFixed(2)} m · v=${value.velocity_m_s.toFixed(2)} m/s · W合=ΔK=${value.work_J.toFixed(2)} J（初动能${value.kinetic_initial_J.toFixed(2)} J）`;
    }
    if (activeId === "kinetic_friction") {
      const v = models.slidingFriction(p.mass, p.coefficient, p.velocity, t);
      body.setAttribute("transform", `translate(${70 + v.position_m / 9 * 440},0)`); get("academyAdditionalForce")?.setAttribute("d", v.velocity_m_s > 0 ? vectorPath(0, 52, -40, 0) : "");
      moveAdditionalCursor(state, v.time_s, v.velocity_m_s);
      return `t=${v.time_s.toFixed(2)} s · x=${v.position_m.toFixed(2)} m · v=${v.velocity_m_s.toFixed(2)} m/s${v.velocity_m_s === 0 ? " · 滑动结束" : " · 摩擦方向向左"}`;
    }
    if (activeId === "centripetal_force") {
      const phase = state.motion.phase * 2 * Math.PI, c = Math.cos(phase), z = Math.sin(phase), x = 300 + 86 * c, y = 132 - 86 * z;
      body.setAttribute("cx", x); body.setAttribute("cy", y); get("academyRadius")?.setAttribute("x2", x); get("academyRadius")?.setAttribute("y2", y);
      get("academyRadialForce")?.setAttribute("d", vectorPath(x, y, -40 * c, 40 * z)); get("academyTangentVelocity")?.setAttribute("d", vectorPath(x, y, -40 * z, -40 * c));
      return `模型时间 t=${t.toFixed(2)} s · 周期T=${models.centripetal(p.mass, p.radius, p.omega).period_s.toFixed(2)} s · 速率不变，速度方向改变`;
    }
    if (activeId === "damped_oscillation") {
      const v = models.dampedMotion(p.amplitude, p.beta, p.period, Math.min(t, 10)), left = 255 + v.displacement_mm * 2;
      body.setAttribute("x", left); get("academyDampedCoil")?.setAttribute("d", springPath(left)); get("academyDampedCenter")?.setAttribute("cx", left + 25);
      for (const [id, direction] of [["academyEnvelopeLeft", -1], ["academyEnvelopeRight", 1]]) { const line = get(id), x = 280 + direction * v.envelope_mm * 2; line?.setAttribute("x1", x); line?.setAttribute("x2", x); }
      moveAdditionalCursor(state, v.time_s, v.envelope_mm);
      return `t=${v.time_s.toFixed(2)} s · 正包络A=${v.envelope_mm.toFixed(2)} mm · 位移x=${v.displacement_mm.toFixed(2)} mm`;
    }
    if (activeId === "sound_resonance") {
      const v = models.soundResonance(p.speed, p.frequency, p.correction), length = p.mode === 1 ? v.first_length_cm : v.second_length_cm, waveNumber = 2 * Math.PI / (v.wavelength_m * 100), oscillation = Math.cos(state.motion.phase * 2 * Math.PI);
      body.querySelectorAll("circle").forEach(particle => { const distance = length * Number(particle.dataset.fraction); particle.setAttribute("cx", 60 + distance * 5 + 11 * Math.sin(waveNumber * distance) * oscillation); });
      return `相邻长度差ΔL=${v.spacing_cm.toFixed(2)} cm · 2fΔL=${v.speed_m_s.toFixed(1)} m/s · 粒子为纵向慢放示意，非实际频率`;
    }
    const tau = p.resistance * p.capacitance, value = models.capacitorDischarge(p.resistance, p.capacitance, p.voltage, Math.min(t, 5) * tau);
    body.setAttribute("y", 145 - value.fraction * 115); body.setAttribute("height", value.fraction * 115); moveAdditionalCursor(state, value.time_ms, value.voltage_V);
    return `物理时间t=${value.time_ms.toFixed(2)} ms（${Math.min(t, 5).toFixed(2)}τ）· U=${value.voltage_V.toFixed(3)} V · 剩余储能=${value.energy_uJ.toFixed(3)} μJ`;
  }
  function positionPendulum(theta, length) { const line = get("academyPendulumString"), bob = get("academyPendulumBob"); if (!line || !bob) return; const pixels = 55 + length / 1.5 * 80, x = 300 + pixels * Math.sin(theta), y = 14 + pixels * Math.cos(theta); line.setAttribute("x2", x); line.setAttribute("y2", y); bob.setAttribute("cx", x); bob.setAttribute("cy", y); }
  function motionReadout() { const el = make("p", "", "academy-motion-readout"); el.id = "academyMotionReadout"; el.setAttribute("aria-live", "off"); return el; }
  function motionDuration(id, state) {
    const p = state.params;
    if (id === "free_fall") return Math.sqrt(2 * p.height / p.gravity);
    if (id === "uniform_acceleration") return 3;
    if (id === "work_energy") return 2 * p.distance / (models.workEnergy(p.mass, p.force, p.distance, p.velocity).velocity_m_s + p.velocity);
    if (id === "kinetic_friction") return models.slidingFriction(p.mass, p.coefficient, p.velocity, 0).stop_time_s;
    if (id === "damped_oscillation") return 10;
    if (id === "capacitor_discharge") return 5;
    return 2;
  }
  function paintMotion(forceReadout = false, timestamp = performance.now()) {
    if (!animatedIds.has(activeId)) return;
    const state = record(activeId), p = state.params, motion = state.motion;
    let caption = "";
    if (activeId === "simple_pendulum") positionPendulum(.139626 * Math.cos(motion.phase * 2 * Math.PI), p.length);
    else if (activeId === "hookes_law") {
      const body = get("academyMotionBody"), coil = get("academyHookeCoil"); if (!body || !coil) return;
      const period = models.spring(p.mass, p.stiffness).period_s;
      const point = models.hookeMotion(p.stiffness, p.force, motion.phase * period, p.mass, .02), left = 165 + point.instant_extension_cm * 12, center = left + 22.5;
      body.setAttribute("x", left); coil.setAttribute("d", springPath(left)); get("academyHookeCenter")?.setAttribute("cx", center);
      const force = get("academyHookeNetForce"); if (force) force.setAttribute("d", Math.abs(point.net_force_N) < 1e-7 ? "" : vectorPath(center, 48, Math.sign(point.net_force_N) * 42, 0));
      caption = `模型时间 t=${motion.time.toFixed(2)} s · 瞬时伸长 x(t)=${point.instant_extension_cm.toFixed(2)} cm · T=${period.toFixed(3)} s · 平衡值 x_eq=${point.equilibrium_extension_cm.toFixed(2)} cm`;
    }
    else if (activeId === "spring_oscillation") {
      const mass = get("academySpringMass"), coil = get("academySpringCoil"), arrow = get("academySpringVelocity"); if (!mass || !coil) return;
      const period = models.spring(p.mass, p.stiffness).period_s, point = models.springMotion(p.mass, p.stiffness, motion.phase * period), x = 280 + 36 * point.displacement_fraction;
      mass.setAttribute("x", x); coil.setAttribute("d", springPath(x));
      if (arrow) { const center = x + (35 + p.mass * 90) / 2, direction = Math.sign(point.velocity_fraction_per_s); arrow.setAttribute("d", `M${center},48h${direction * 42}m${-direction * 7},-5l${direction * 7},5l${-direction * 7},5`); arrow.setAttribute("visibility", Math.abs(point.velocity_fraction_per_s) < 1e-6 ? "hidden" : "visible"); }
      caption = `已演示 ${motion.time.toFixed(2)} s · 示意位移 x/A = ${point.displacement_fraction.toFixed(2)}（A 为固定示意振幅）`;
    } else if (additionalMotionIds.has(activeId)) caption = paintAdditionalMotion(state);
    else if (transitIds.has(activeId)) {
      const body = get("academyMotionBody"), time = Math.min(motion.time, motionDuration(activeId, state)); if (!body) return;
      const point = activeId === "uniform_acceleration" ? models.kinematics(p.velocity, p.acceleration, time) : activeId === "newtons_second_law" ? models.newtons(p.mass, p.force, time) : models.freeFall(p.gravity, time);
      if (activeId === "free_fall") body.setAttribute("cy", 30 + point.height_m / p.height * 190);
      else body.setAttribute("transform", `translate(${70 + point.position_m / (activeId === "uniform_acceleration" ? 8 : 10) * 440},0)`);
      const cursor = get("academyMotionCursor");
      if (cursor) { cursor.setAttribute("cx", 68 + (activeId === "free_fall" ? time ** 2 / 2 : time / 3) * 507); cursor.setAttribute("cy", 243 - (activeId === "free_fall" ? point.height_m / 6 : point.velocity_m_s / 5) * 218); }
      caption = `当前动画：t = ${time.toFixed(2)} s · ${activeId === "free_fall" ? "h" : "x"} = ${point.position_m.toFixed(2)} m · v = ${point.velocity_m_s.toFixed(2)} m/s`;
    }
    const output = get("academyMotionReadout");
    if (output && (forceReadout || timestamp - motion.lastReadout >= 100)) { output.textContent = caption; motion.lastReadout = timestamp; }
  }
  function animationAllowed(id, state) {
    return activeId === id && records.get(id) === state && root?.isConnected && !root.hidden && !document.hidden && !reducedMotion.matches && state.explored && !state.pause && !state.motion.completed && (activePage === "data" || !!root.querySelector("details.academy-revisit")?.open) && !!get(id === "simple_pendulum" ? "academyPendulumBob" : id === "spring_oscillation" ? "academySpringMass" : "academyMotionBody");
  }
  function beginAnimation() {
    stopAnimation(); if (!animatedIds.has(activeId)) return;
    const id = activeId, state = record(id); if (!animationAllowed(id, state)) return;
    const animate = time => {
      frame = null; if (!animationAllowed(id, state)) { lastAnimationTime = null; return; }
      const dt = lastAnimationTime == null ? 0 : Math.max(0, (time - lastAnimationTime) / 1000) * state.motion.speed; lastAnimationTime = time;
      state.motion.time += dt;
      if (finiteMotionIds.has(id)) {
        const duration = motionDuration(id, state);
        if (state.motion.time >= duration) { state.motion.time = duration; state.motion.completed = true; paintMotion(true, time); syncMotionControls(); lastAnimationTime = null; return; }
      } else {
        const period = id === "simple_pendulum" ? models.pendulum(state.params.length).period_s : id === "centripetal_force" ? models.centripetal(state.params.mass, state.params.radius, state.params.omega).period_s : id === "sound_resonance" ? 2 : models.spring(state.params.mass, state.params.stiffness).period_s;
        state.motion.phase = (state.motion.phase + dt / period) % 1;
      }
      paintMotion(false, time); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  }
  window.refreshAcademy = function () {
    const page = document.body.dataset.page || "home", id = routeExperiment();
    const oldGuide = get("learningGuide-data"), guideWrapper = get("academyMeasurementGuide");
    if (guideWrapper && (page !== "data" || !supported[id])) { guideWrapper.before(oldGuide); guideWrapper.remove(); }
    if (!supportedPages.has(page) || !supported[id]) { stopAnimation(); if (root) root.hidden = true; activePage = page; activeId = ""; return; }
    const changed = activeId !== id || activePage !== page;
    activeId = id; activePage = page;
    if (!root) {
      root = make("section", null, "lab-academy"); root.id = "academyRoot"; root.setAttribute("aria-label", "实验交互课");
      // Lesson controls have their own persistence; keep them out of measured-data listeners.
      root.addEventListener("input", event => event.stopPropagation());
      root.addEventListener("change", event => event.stopPropagation());
    }
    root.hidden = false;
    const view = document.querySelector(`[data-view="${page}"]`); if (!view) return;
    const before = page === "data" ? view.querySelector(":scope > .card") : page === "topic" ? get("topicContent") : page === "experiment" ? view.querySelector(":scope > .card") : view.querySelector(":scope > .card, :scope > .page-actions");
    if (page === "data") {
      view.querySelector(".page-heading").after(root);
      let guide = get("academyMeasurementGuide");
      if (!guide && oldGuide) {
        guide = make("details", null, "academy-measurement-guide"); guide.id = "academyMeasurementGuide";
        guide.append(make("summary", "测量前的操作提示"), oldGuide);
      }
      if (guide) root.after(guide);
    } else if (root.parentElement !== view || (before && root.nextElementSibling !== before)) view.insertBefore(root, before);
    if (changed || !root.children.length) renderContent();
    const data = record(id), stale = Date.now() - data.lastLoadAttempt > 30000;
    const due = Object.values(data.results).some(item => item.can_answer === false && item.due_at && Date.parse(item.due_at) <= Date.now());
    loadCourse(id, !!data.course && stale && (changed || due));
    focusLesson();
  };
  function focusLesson() {
    const lesson = new URLSearchParams(location.search).get("lesson");
    if (activePage !== "data" || !["prediction", "transfer"].includes(lesson) || !record(activeId).course) return;
    const key = `${generation}:${activeId}:${location.pathname + location.search}`; if (focusedLesson === key) return;
    const state = record(activeId);
    if (lesson === "transfer" && !state.transferOpen) { state.explored = true; state.transferOpen = true; renderContent(); }
    const question = root.querySelector(`[data-node="${lesson}"] legend`);
    if (question) {
      focusedLesson = key;
      requestAnimationFrame(() => {
        if (activePage !== "data" || key !== `${generation}:${activeId}:${location.pathname + location.search}` || !question.isConnected) return;
        const explanation = root.querySelector(`[data-node="${lesson}"] .academy-explanation`);
        if (explanation && state.results[lesson]?.correct) explanation.open = true;
        question.tabIndex = -1; question.focus({preventScroll: true}); question.scrollIntoView({block: "center", behavior: reducedMotion.matches ? "auto" : "smooth"});
      });
    }
  }
  window.addEventListener("lab-account-changed", () => { generation++; records.clear(); if (activeId) { renderContent(); loadCourse(activeId); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAnimation(); else beginAnimation(); });
  window.addEventListener("pagehide", stopAnimation);
  window.addEventListener("tutor-ready", () => window.refreshAcademy());
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) { stopAnimation(); if (animatedIds.has(activeId) && record(activeId).explored) paintMotion(true); } else beginAnimation(); syncMotionControls(); });
  // Flow navigation is normally wired by refreshAcademy; this also handles direct loads.
  observer = new MutationObserver(() => { if (document.body.dataset.page !== activePage) window.refreshAcademy(); });
  observer.observe(document.body, {attributes: true, attributeFilter: ["data-page"]});
  window.refreshAcademy();
})();
