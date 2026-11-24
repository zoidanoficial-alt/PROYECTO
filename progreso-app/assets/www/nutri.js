'use strict';
/* =====================================================================
 *  38.0 · NUTRICIÓN INTELIGENTE · motor
 *  Estrategia → objetivos (kcal y macros) → registro → medición → ajuste propuesto.
 *  - Ecuación: Mifflin-St Jeor (1990) × factor de actividad. Es una ESTIMACIÓN.
 *  - Calibración: con ≥14 días de registros, gasto observado = ingesta media − cambio
 *    de peso (tendencia) × ~7700 kcal/kg (aproximación; Hall 2011 explica sus límites).
 *  - El motor nunca ajusta solo: propone, explica y tú decides.
 *  - Sin cortes de peso, deshidratación, déficits extremos ni sustancias.
 *  Las funciones nCalc*, nTrendOf, nAdviceFrom son puras (probadas en tests/unit).
 * ===================================================================== */

const NUTRI_MODES = {
  volumen: { n: 'Volumen muscular', short: 'Volumen', ico: 'trending-up', d: 'Ganar músculo con un superávit pequeño y medido, sin sumar grasa de más.', ref: 'Inspiración: la paciencia del off-season de Chris Bumstead (práctica de atleta, no evidencia).' },
  definicion: { n: 'Definición', short: 'Definición', ico: 'flame', d: 'Perder grasa a un ritmo que conserva tu músculo y tu rendimiento.', ref: 'Inspiración: la disciplina de campamento de Paddy Pimblett, sin cortes de peso (práctica de atleta, no evidencia).' },
  recomp: { n: 'Recomposición', short: 'Recomposición', ico: 'refresh-cw', d: 'Más músculo y menos grasa a la vez, con calorías cerca del mantenimiento.', ref: '' },
  mantener: { n: 'Mantenimiento', short: 'Mantener', ico: 'shield', d: 'Sostener tu peso, consolidar hábitos y comer con flexibilidad.', ref: '' },
  rend: { n: 'Rendimiento deportivo', short: 'Rendimiento', ico: 'zap', d: 'Energía suficiente y carbohidratos según tu carga de entrenamiento.', ref: '' }
};
/** Factor de actividad (FAO/OMS y práctica clínica con Mifflin-St Jeor). */
const NAF = {
  sed: [1.2, 'Sedentario', 'Trabajo sentado y casi sin ejercicio'],
  lig: [1.375, 'Ligero', 'Ejercicio 1–3 días por semana'],
  mod: [1.55, 'Moderado', 'Ejercicio 3–5 días por semana'],
  alt: [1.725, 'Alto', 'Ejercicio intenso 6–7 días por semana'],
  muy: [1.9, 'Muy alto', 'Doble sesión diaria o trabajo físico pesado']
};
/** Ritmo de cambio de peso por semana (% del peso corporal). */
const N_RATE = {
  volumen: { principiante: 0.4, intermedio: 0.3, avanzado: 0.2, range: [0.25, 0.5] },   // Iraki y col., 2019
  definicion: { def: 0.7, range: [0.5, 1.0] }                                           // Helms y col., 2014; Garthe y col., 2011
};
const KCAL_PER_KG = 7700;

/* ---------- Cálculo puro ---------- */
function nBmr(sex, kg, cm, age) { return 10 * kg + 6.25 * cm - 5 * age + (sex === 'f' ? -161 : 5); }
/** Carbohidratos por carga semanal (g/kg/día) · Thomas, Erdman y Burke, 2016 (ACSM/AND/DC). */
function nCarbBand(minWeek) {
  if (minWeek < 150) return { g: 4, range: [3, 5], txt: 'carga ligera' };
  if (minWeek < 420) return { g: 6, range: [5, 7], txt: '≈1 h al día de entrenamiento moderado' };
  if (minWeek < 900) return { g: 7, range: [6, 10], txt: '1–3 h al día de entrenamiento' };
  return { g: 8, range: [8, 12], txt: 'más de 3 h al día (volumen muy alto)' };
}
/**
 * Objetivos del día a partir de datos de entrada (función pura).
 * inp: { mode, sex, kg, cm, age, af, exp, lbm, minWeek, tdeeObs, adj }
 */
function nCalc(inp) {
  const kg = Math.max(35, Math.min(250, Number(inp.kg) || 70)), cm = Math.max(130, Math.min(220, Number(inp.cm) || 170)), age = Math.max(15, Math.min(90, Number(inp.age) || 30));
  const bmr = nBmr(inp.sex, kg, cm, age), af = (NAF[inp.af] || NAF.mod)[0];
  const tdeeEq = bmr * af;
  let tdee = tdeeEq, calib = null;
  if (inp.tdeeObs && inp.tdeeObs.v > 0 && Math.abs(inp.tdeeObs.v / tdeeEq - 1) < 0.4) { const w = Math.min(0.7, inp.tdeeObs.w || 0.5); tdee = tdeeEq * (1 - w) + inp.tdeeObs.v * w; calib = { obs: Math.round(inp.tdeeObs.v), w }; }
  const notes = [], mode = NUTRI_MODES[inp.mode] ? inp.mode : 'mantener';
  let kcal = tdee, delta = 0, pG, pRange, fatPct = 0.25, carbs = null, rate = null;
  const lbm = inp.lbm && inp.lbm > 25 && inp.lbm < kg ? inp.lbm : null;
  if (mode === 'volumen') {
    rate = N_RATE.volumen[inp.exp] || N_RATE.volumen.intermedio;
    delta = kg * rate / 100 * KCAL_PER_KG / 7;
    delta = Math.max(tdee * 0.05, Math.min(tdee * 0.15, delta));
    pG = 1.8 * kg; pRange = [1.6 * kg, 2.2 * kg];
  } else if (mode === 'definicion') {
    rate = Number(inp.rate) || N_RATE.definicion.def; rate = Math.max(0.5, Math.min(1.0, rate));
    delta = -Math.min(tdee * 0.25, kg * rate / 100 * KCAL_PER_KG / 7);
    if (lbm) { pG = 2.6 * lbm; pRange = [2.3 * lbm, 3.1 * lbm]; } else { pG = 2.2 * kg; pRange = [1.8 * kg, 2.7 * kg]; }
  } else if (mode === 'recomp') {
    delta = inp.highFat ? -tdee * 0.1 : 0;
    pG = 2.2 * kg; pRange = [1.8 * kg, 2.7 * kg];
  } else if (mode === 'rend') {
    pG = 1.8 * kg; pRange = [1.6 * kg, 2.0 * kg];
    const band = nCarbBand(inp.minWeek || 0); carbs = band.g * kg; notes.push(`Carbohidratos de ${band.range[0]}–${band.range[1]} g/kg por ${band.txt}.`);
    fatPct = 0.25;
  } else { pG = 1.6 * kg; pRange = [1.4 * kg, 2.0 * kg]; fatPct = 0.3; }
  kcal = tdee + delta + (Number(inp.adj) || 0);
  if (mode === 'rend') kcal = Math.max(kcal, (pG * 4 + carbs * 4) / (1 - 0.2));   // disponibilidad energética: no recortar el combustible
  // Seguridad: nunca por debajo del metabolismo basal estimado ni de un piso absoluto
  const floor = Math.max(bmr, inp.sex === 'f' ? 1200 : 1500);
  let floored = false; if (kcal < floor) { kcal = floor; floored = true; notes.push('Ajusté al mínimo seguro: nunca por debajo de tu metabolismo basal estimado.'); }
  kcal = Math.round(kcal / 10) * 10;
  const protein = Math.round(pG);
  let fat = Math.max(Math.round(kcal * fatPct / 9), Math.round(0.6 * kg));
  if (carbs == null) carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  else { carbs = Math.round(carbs); fat = Math.max(Math.round(0.6 * kg), Math.round((kcal - protein * 4 - carbs * 4) / 9)); }
  return { mode, bmr: Math.round(bmr), af, tdeeEq: Math.round(tdeeEq), tdee: Math.round(tdee), calib, delta: Math.round(delta), adj: Number(inp.adj) || 0, kcal, protein, carbs, fat, pRange: pRange.map(Math.round), rate, floored, notes, perMeal: Math.round(0.4 * kg) };
}
/** Tendencia de peso por regresión lineal (función pura): pts = [{date, w}] ordenados. */
function nTrendOf(pts) {
  if (!pts || pts.length < 4) return null;
  const t0 = parseDate(pts[0].date).getTime(), xs = pts.map(p => (parseDate(p.date).getTime() - t0) / 864e5), ys = pts.map(p => p.w);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (!sxx) return null;
  const perDay = sxy / sxx, span = xs[n - 1] - xs[0];
  return { perDay, perWeek: perDay * 7, pctWeek: perDay * 7 / my * 100, mean: my, n, span };
}

/* ---------- Estado y datos del usuario ---------- */
function nState() {
  if (!DB.nutri) DB.nutri = { mode: null, af: null, exp: null, rate: null, adj: 0, phases: [], log: [], favs: [], recents: [], saved: [], plan: { meals: 4, prefs: [], budget: 'normal' }, planOv: {}, decided: {} };
  const s = DB.nutri; ['phases', 'log', 'favs', 'recents', 'saved'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; }); s.plan = s.plan || { meals: 4, prefs: [], budget: 'normal' }; s.planOv = s.planOv || {}; s.decided = s.decided || {};
  return s;
}
const nOn = () => !!(DB.nutri && DB.nutri.mode);
function nExp() { const s = nState(); return s.exp || (userLevel() === 'avanzado' ? 'intermedio' : 'principiante'); }
/** Minutos de entrenamiento por semana (media de 4 semanas) desde los registros reales. */
function nMinWeek() {
  const t = todayStr(); let min = 0;
  DB.sessions.forEach(s => { if (s.end && s.start && s.date > addDays(t, -28)) min += Math.min(180, (s.end - s.start) / 60000); });
  (DB.runs || []).forEach(r => { if (r.date > addDays(t, -28)) min += (r.dur || 0) / 60; });
  (DB.activities || []).forEach(a => { if (a.date > addDays(t, -28)) min += a.min || 0; });
  if (DB.hyrox) (DB.hyrox.sessions || []).forEach(s => { if (s.date > addDays(t, -28)) min += (s.dur || 0) / 60; });
  return Math.round(min / 4);
}
/** Actividad sugerida a partir de tus entrenos reales (puedes cambiarla). */
function nSuggestAf() { const m = nMinWeek(); return m < 60 ? 'sed' : m < 180 ? 'lig' : m < 360 ? 'mod' : m < 600 ? 'alt' : 'muy'; }
function nLbm() {
  const kg = currentWeight(); if (!kg || typeof rfm !== 'function') return null;
  const m = (DB.measures || []).filter(x => x.waist).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  if (!m || daysBetween(m.date, todayStr()) > 60) return null;
  const bf = rfm(Number(DB.profile.height), m.waist, fem()); return bf > 3 && bf < 60 ? { lbm: kg * (1 - bf / 100), bf } : null;
}
/** Ingesta registrada por día (solo días con comidas). */
function nIntake(d) { const e = DB.days[d]; if (!e || !((e.meals && e.meals.length) || e.kcal)) return null; return dayTotals(d); }
function nWeights(days) { const t = todayStr(), from = addDays(t, -days); return weightEntries().filter(e => e.date > from && e.date <= t); }
/** Gasto observado con tus registros (calibración). */
function nObserved() {
  const t = todayStr(), W = nWeights(21), tr = nTrendOf(W);
  const days = []; for (let i = 1; i <= 21; i++) { const x = nIntake(addDays(t, -i)); if (x && x.kcal >= 800) days.push(x.kcal); }
  if (!tr || tr.span < 13 || W.length < 6 || days.length < 10) return { ok: false, logged: days.length, weighs: W.length };
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  return { ok: true, v: avg - tr.perDay * KCAL_PER_KG, w: Math.min(0.7, days.length / 30), avgIntake: Math.round(avg), logged: days.length, weighs: W.length, trend: tr };
}
function nInputs() {
  const s = nState(), p = DB.profile, obs = nObserved(), lb = nLbm();
  return { mode: s.mode || 'mantener', sex: fem() ? 'f' : 'm', kg: currentWeight(), cm: Number(p.height), age: Number(p.age), af: s.af || nSuggestAf(), exp: nExp(), rate: s.rate, lbm: lb ? lb.lbm : null, highFat: lb ? lb.bf > (fem() ? 32 : 22) : false, minWeek: nMinWeek(), tdeeObs: obs.ok ? obs : null, adj: s.adj || 0 };
}
function nTargets() { return nCalc(nInputs()); }

/* ---------- Adherencia, cintura, fuerza ---------- */
function nAdherence(days) {
  const t = todayStr(), tg = targets(); let logged = 0, onK = 0, onP = 0, sk = 0, sp = 0;
  for (let i = 1; i <= days; i++) { const x = nIntake(addDays(t, -i)); if (!x) continue; logged++; sk += x.kcal; sp += x.p; if (Math.abs(x.kcal / tg.kcal - 1) <= 0.1) onK++; if (x.p >= tg.protein * 0.9) onP++; }
  return { days, logged, pct: Math.round(logged / days * 100), onKcal: logged ? Math.round(onK / logged * 100) : 0, onProt: logged ? Math.round(onP / logged * 100) : 0, avgKcal: logged ? Math.round(sk / logged) : null, avgP: logged ? Math.round(sp / logged) : null };
}
function nWaist(fromDate) {
  const w = (DB.measures || []).filter(x => x.waist).sort((a, b) => a.date < b.date ? -1 : 1); if (!w.length) return null;
  const last = w[w.length - 1], base = w.filter(x => x.date <= (fromDate || addDays(todayStr(), -28))).pop() || w[0];
  return { now: last.waist, base: base.waist, delta: Math.round((last.waist - base.waist) * 10) / 10, date: last.date, baseDate: base.date, n: w.length };
}
function nStrength() { if (typeof strengthScores !== 'function') return null; const a = strengthScores(todayStr()).overall, b = strengthScores(addDays(todayStr(), -28)).overall; return a != null && b != null ? { now: a, d: Math.round(a - b) } : null; }

/* ---------- Motor de adaptación ---------- */
/**
 * Decide con datos de ≥ 14 días (función pura). Nunca por un solo día.
 * x: { mode, trend, targetRate, adh, waist, str, sleepLow, rhrUp, daysInPhase, daysSinceAdj, kg }
 * → { st: 'ok'|'adjust'|'check'|'wait', title, text, delta, why[] }
 */
function nAdviceFrom(x) {
  const why = [];
  if (x.daysInPhase < 14) return { st: 'wait', title: 'Reuniendo datos', text: `Llevas ${x.daysInPhase} días en esta fase. Necesito al menos 14 días de peso y registros para evaluar sin dejarme engañar por el agua.`, delta: 0, why };
  if (!x.trend || x.trend.n < 6) return { st: 'wait', title: 'Faltan pesajes', text: 'Pésate al menos 3 mañanas por semana (en ayunas, después del baño). Con un solo día no se decide nada.', delta: 0, why };
  const r = x.trend.pctWeek, adhOk = x.adh.pct >= 70 && x.adh.onKcal >= 60;
  why.push(`Tendencia: ${r >= 0 ? '+' : ''}${r.toFixed(2)} % de tu peso por semana (${x.trend.n} pesajes).`);
  why.push(`Registro: ${x.adh.pct} % de los días; en objetivo de calorías ${x.adh.onKcal} % de esos días.`);
  if (x.waist) why.push(`Cintura: ${x.waist.delta >= 0 ? '+' : ''}${x.waist.delta} cm desde ${shortDate(x.waist.baseDate)}.`);
  if (x.str) why.push(`Fuerza: ${x.str.d >= 0 ? '+' : ''}${x.str.d} puntos en 4 semanas.`);
  const recent = x.daysSinceAdj != null && x.daysSinceAdj < 14;
  const needAdh = () => ({ st: 'check', title: 'Primero, la adherencia', text: x.adh.pct < 70 ? 'Registraste menos del 70 % de los días. Antes de mover calorías necesito ver qué comes de verdad: registra 2 semanas completas.' : 'Tus días se alejan más de 10 % de tu objetivo. Acércate al objetivo 2 semanas y luego evaluamos.', delta: 0, why });
  if (x.mode === 'volumen') {
    const [lo, hi] = [x.targetRate * 0.5, x.targetRate * 1.6];
    if (r > hi) return { st: 'adjust', title: 'Subes de peso demasiado rápido', text: `El objetivo es ≈ ${x.targetRate} % por semana. A este ritmo una parte creciente será grasa. Propongo bajar el superávit un poco.`, delta: recent ? 0 : -150, why };
    if (r < lo) { if (!adhOk) return needAdh(); return { st: 'adjust', title: 'El peso no sube', text: 'Cumples tu plan pero el peso promedio no se mueve: tu gasto real es mayor de lo estimado. Propongo un aumento pequeño.', delta: recent ? 0 : 125, why }; }
    if (x.str && x.str.d <= 0 && r > 0) return { st: 'check', title: 'Subes de peso, pero no de fuerza', text: 'Antes de comer más, revisa el entrenamiento (progresión, series cerca del fallo), el sueño y la proteína. Comer más no compensa un estímulo insuficiente.', delta: 0, why };
    if (x.waist && x.waist.delta > 2.5) return { st: 'check', title: 'La cintura sube rápido', text: 'Más de 2.5 cm en 4 semanas suele indicar ganancia de grasa. Considera mantener el peso estable 2–4 semanas.', delta: recent ? 0 : -100, why };
    return { st: 'ok', title: 'Vas en el ritmo correcto', text: 'Peso subiendo despacio y fuerza acompañando: sigue igual.', delta: 0, why };
  }
  if (x.mode === 'definicion') {
    if (r < -1.2) return { st: 'adjust', title: 'Bajas demasiado rápido', text: 'Más de 1 % por semana aumenta el riesgo de perder músculo, rendimiento y energía. Propongo subir calorías; el déficit no debe ser un castigo.', delta: recent ? 0 : 150, why };
    if ((x.sleepLow || x.rhrUp) && r < -0.8) return { st: 'check', title: 'Tu recuperación lo resiente', text: 'Duermes poco o tu pulso en reposo subió mientras bajas rápido. Prioriza sueño y considera un déficit menor.', delta: recent ? 0 : 100, why };
    if (r > -0.25) { if (!adhOk) return needAdh(); if (x.daysInPhase < 21) return { st: 'wait', title: 'Posible estancamiento', text: 'Dos semanas sin bajar pueden ser agua (sal, estrés, ciclo menstrual). Esperamos una semana más antes de cambiar.', delta: 0, why }; return { st: 'adjust', title: 'Estancamiento real', text: 'Tres semanas cumpliendo sin bajar. Opciones: −100 a −150 kcal o +2,000 pasos diarios. No aumento el déficit sin que lo aceptes.', delta: recent ? 0 : -125, why }; }
    if (x.str && x.str.d < -3) return { st: 'check', title: 'Bajas de peso y de fuerza', text: 'Mantén la intensidad de tus series pesadas y revisa la proteína. Si sigue, un déficit menor protege tu músculo.', delta: 0, why };
    return { st: 'ok', title: 'Pérdida a buen ritmo', text: 'Bajas entre 0.25 y 1 % por semana conservando tu fuerza: no cambies nada.', delta: 0, why };
  }
  if (x.mode === 'recomp') {
    if (x.waist && x.waist.delta <= -0.5 && Math.abs(r) < 0.3) return { st: 'ok', title: 'Recomposición funcionando', text: 'La cintura baja con el peso estable: estás cambiando grasa por músculo. Un peso estable aquí es éxito, no fracaso.', delta: 0, why };
    if (x.waist && x.waist.delta >= 1 && r > 0.2) return { st: 'adjust', title: 'Cintura y peso suben', text: 'Ganas algo de grasa. Propongo bajar un poco las calorías.', delta: recent ? 0 : -100, why };
    if (!x.waist) return { st: 'check', title: 'Mide tu cintura', text: 'En recomposición el peso casi no cambia: la cintura y la fuerza son la prueba. Mide cada 2 semanas.', delta: 0, why };
    return { st: 'ok', title: 'Sigue midiendo', text: x.str && x.str.d > 0 ? 'Tu fuerza sube: buena señal. Mantén proteína alta y calorías cerca del mantenimiento.' : 'Mantén proteína alta, entrena con progresión y evaluamos con la siguiente medida de cintura.', delta: 0, why };
  }
  if (x.mode === 'mantener') {
    if (Math.abs(r) > 0.35) { if (!adhOk) return needAdh(); return { st: 'adjust', title: r > 0 ? 'El peso sube' : 'El peso baja', text: 'Tu peso promedio se mueve más de lo normal para mantenimiento. Propongo un ajuste pequeño.', delta: recent ? 0 : r > 0 ? -100 : 100, why }; }
    return { st: 'ok', title: 'Peso estable', text: 'Tu mantenimiento está bien calibrado.', delta: 0, why };
  }
  // rendimiento
  if (r < -0.5) return { st: 'adjust', title: 'Pierdes peso sin buscarlo', text: 'En rendimiento eso suele ser energía insuficiente: afecta recuperación, hormonas y desempeño (RED-S). Propongo más carbohidratos.', delta: recent ? 0 : 200, why };
  if (x.sleepLow || x.rhrUp) return { st: 'check', title: 'Recuperación baja', text: 'Revisa carbohidratos alrededor del entrenamiento, proteína y sueño antes de añadir carga.', delta: 0, why };
  return { st: 'ok', title: 'Energía suficiente', text: 'Peso estable y recuperación normal: el combustible acompaña tu carga.', delta: 0, why };
}
function nAdvice() {
  const s = nState(), ph = nPhase(), t = todayStr(); if (!s.mode) return null;
  const last = s.log.filter(l => l.applied).slice(-1)[0];
  const rhr = typeof trAvgRec === 'function' ? [trAvgRec(t, 'rhr'), trAvgRec(addDays(t, -21), 'rhr')] : [null, null];
  const sl = []; for (let i = 0; i < 7; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r && r.sleepH != null) sl.push(r.sleepH); }
  const a = nAdviceFrom({ mode: s.mode, trend: nTrendOf(nWeights(21)), targetRate: s.mode === 'volumen' ? (N_RATE.volumen[nExp()] || 0.3) : -(s.rate || 0.7), adh: nAdherence(14), waist: nWaist(ph ? ph.start : null), str: nStrength(), sleepLow: sl.length >= 4 && sl.reduce((a, b) => a + b, 0) / sl.length < 6.5, rhrUp: rhr[0] && rhr[1] ? rhr[0] - rhr[1] >= 5 : false, daysInPhase: ph ? daysBetween(ph.start, t) : 0, daysSinceAdj: last ? daysBetween(last.date, t) : null, kg: currentWeight() });
  // Seguridad: si ya estás en el mínimo, no se propone comer menos
  if (a.delta < 0 && nTargets().floored) { a.delta = 0; a.st = 'check'; a.text += ' Ya estás en el mínimo seguro de calorías: en lugar de comer menos, suma actividad diaria (pasos) o revisa que tus registros estén completos.'; }
  return a;
}
function nApply(delta, why) {
  const s = nState(), before = targets().kcal;
  s.adj = (s.adj || 0) + delta; s.log.push({ date: todayStr(), delta, why, applied: true, from: before });
  saveData(); return targets().kcal;
}

/* ---------- Fases (periodización) ---------- */
const N_PHASE = {
  volumen: { weeks: [12, 24], goal: 'Construir músculo con un superávit pequeño.', ind: 'Peso +0.25–0.5 %/sem (menos si eres avanzado) · fuerza subiendo · cintura estable o +1–2 cm.', adv: 'Pasa a mantenimiento si cumpliste las semanas, si la cintura subió más de 4 cm o si quieres definir.', stop: 'Detente o ajusta si el peso sube más del doble del objetivo 3 semanas o si la fuerza no acompaña.' },
  mantener: { weeks: [4, 8], goal: 'Estabilizar el peso y evaluar resultados.', ind: 'Peso promedio dentro de ±1 % · rendimiento estable.', adv: 'Avanza cuando tu peso lleve 3–4 semanas estable.', stop: 'Ajusta ±100 kcal si el peso se desvía más de 1 %.' },
  definicion: { weeks: [8, 16], goal: 'Reducir grasa preservando músculo y rendimiento.', ind: 'Peso −0.5–1 %/sem · cintura bajando · fuerza estable.', adv: 'Pasa a mantenimiento al llegar a tu meta, al cumplir 16 semanas o si la fuerza o el sueño caen de forma sostenida.', stop: 'Detente si bajas >1 %/sem varias semanas, si hay mareos, pérdida del periodo, lesiones o ánimo muy bajo: busca un profesional.' },
  recomp: { weeks: [8, 16], goal: 'Cambiar grasa por músculo con calorías cerca del mantenimiento.', ind: 'Cintura bajando · fuerza subiendo · peso ±0.3 %/sem.', adv: 'Evalúa cada 4 semanas con cintura y fuerza.', stop: 'Si la cintura sube 2 medidas seguidas, baja un poco las calorías.' },
  rend: { weeks: [4, 20], goal: 'Alimentar el entrenamiento y la competencia.', ind: 'Peso estable · recuperación normal · rendimiento subiendo.', adv: 'Termina al pasar tu competencia: 1–2 semanas de mantenimiento.', stop: 'Si pierdes peso sin buscarlo o te recuperas mal, sube carbohidratos.' }
};
function nPhase() { const s = nState(); return s.phases.filter(p => !p.end).slice(-1)[0] || null; }
function nStartPhase(mode, why) {
  const s = nState(), t = todayStr();
  s.phases.forEach(p => { if (!p.end) p.end = t; });
  s.phases.push({ id: 'ph' + Date.now(), mode, start: t, weeks: N_PHASE[mode].weeks, why: why || '', kgStart: currentWeight(), waistStart: (nWaist() || {}).now || null });
  s.mode = mode; s.adj = 0;
  DB.profile.phase = mode === 'volumen' ? 'volumen' : mode === 'definicion' ? 'definicion' : 'mantener';   // los demás módulos leen la fase
  DB.profile.autoMacros = true;
  saveData();
}
/** ¿Toca revisar la fase? Nunca cambia sola: solo avisa con datos. */
function nPhaseReview() {
  const ph = nPhase(); if (!ph) return null;
  const wk = Math.floor(daysBetween(ph.start, todayStr()) / 7), [mn, mx] = ph.weeks, w = nWaist(ph.start), kg = currentWeight();
  const sig = [];
  if (wk >= mx) sig.push(`Cumpliste ${wk} semanas (máximo sugerido: ${mx}).`);
  if (ph.mode === 'volumen' && w && w.delta > 4) sig.push(`Tu cintura subió ${w.delta} cm en esta fase.`);
  if (ph.mode === 'definicion' && DB.profile.goalWeight && kg && kg <= DB.profile.goalWeight + 0.3) sig.push('Llegaste a tu peso meta.');
  const st = nStrength(); if (ph.mode === 'definicion' && st && st.d < -5) sig.push('Tu fuerza cae de forma sostenida.');
  return { wk, min: mn, max: mx, due: sig.length > 0 && wk >= Math.min(mn, 4), sig, next: { volumen: 'mantener', definicion: 'mantener', mantener: null, recomp: 'mantener', rend: 'mantener' }[ph.mode] };
}

/* ---------- Integración con el entrenamiento de hoy ---------- */
function nTodayFocus() {
  const t = todayStr(), tg = targets();
  const gym = DB.sessions.some(s => s.date === t) || (typeof nextDay === 'function' && (() => { const nd = nextDay(DB.profile.routine); return nd && !nd.rest && nd.ex && nd.ex.length; })());
  const hyrox = (typeof hxOn === 'function' && hxOn() && typeof hxMission === 'function' && (() => { try { const m = hxMission(); return m && (m.ses || m.assess); } catch (e) { return false; } })()) || (DB.hyrox && DB.hyrox.sessions.some(s => s.date === t));
  const run = (typeof nextRunSession === 'function' && (() => { const r = nextRunSession(); return r && r.date === t; })()) || (DB.runs || []).some(r => r.date === t);
  const kg = currentWeight() || 70, pm = Math.round(0.4 * kg);
  if (hyrox || run) return { k: 'end', t: 'Día de resistencia', txt: `Llega con carbohidratos: una comida con arroz, tortilla, avena o fruta 2–4 h antes. Después, ${pm} g de proteína con carbohidratos para recuperar. Hidrátate: bebe para no perder más de 2 % de tu peso al sudar.`, src: 'Thomas y col., 2016 · Sawka y col., 2007' };
  if (gym) return { k: 'str', t: 'Día de fuerza', txt: `Reparte tus ${tg.protein} g de proteína en 3–4 comidas de ≈ ${pm} g; una de ellas antes o después de entrenar. No necesitas una "ventana" de 30 minutos: cuenta el total del día.`, src: 'Schoenfeld y Aragon, 2018 · Schoenfeld y col., 2013' };
  return { k: 'rest', t: 'Día de descanso', txt: 'Hoy también se construye músculo: mantén tu proteína y tus calorías. No compenses el descanso comiendo menos.', src: 'Morton y col., 2018' };
}

/* ---------- Datos para Campamento / misiones (una sola fuente) ---------- */
function nutriSnapshot(d) {
  d = d || todayStr();
  const s = nState(), tg = targets(), tot = dayTotals(d), adh = nAdherence(14), tr = nTrendOf(nWeights(21)), w = nWaist(), ph = nPhase(), wa = weekAvg(d);
  return { date: d, mode: s.mode, modeName: s.mode ? NUTRI_MODES[s.mode].n : null, phase: ph ? { mode: ph.mode, start: ph.start, week: Math.floor(daysBetween(ph.start, d) / 7) + 1 } : null,
    target: { kcal: tg.kcal, p: tg.protein, c: tg.carbs, f: tg.fat }, intake: { kcal: tot.kcal, p: Math.round(tot.p), c: Math.round(tot.c), f: Math.round(tot.f), meals: tot.meals },
    adherence: adh, weightAvg7: wa ? Math.round(wa.avg * 10) / 10 : null, weightTrendPctWeek: tr ? Math.round(tr.pctWeek * 100) / 100 : null, waist: w };
}
window.NutriAPI = { snapshot: nutriSnapshot, targets: () => targets(), advice: () => nAdvice() };

/* Misión diaria de nutrición dentro de "Misiones de hoy" (mismo dato, sin duplicar registros) */
window.addEventListener('load', () => {
  if (typeof todayMissions !== 'function') return;
  const base = todayMissions;
  todayMissions = function () {
    const out = base(); if (!nOn() || isSimple()) return out;
    const sn = nutriSnapshot(), left = sn.target.p - sn.intake.p;
    out.push({ ico: '🍽️', kind: 'nut', title: 'Nutrición · ' + NUTRI_MODES[sn.mode].short, goal: left > 0 ? `Llega a ${sn.target.p} g de proteína (te faltan ${left} g)` : `Proteína cumplida (${sn.intake.p} g)`, success: `Proteína ≥ ${sn.target.p} g y calorías cerca de ${sn.target.kcal.toLocaleString('es-MX')}.`, why: 'La proteína diaria total es el factor nutricional con más evidencia para ganar o conservar músculo (Morton y col., 2018).', done: left <= 0 });
    return out;
  };
});

/* ---------- Biblioteca de conocimiento ----------
 * tipo: 'ciencia' (revisada por pares) · 'practica' (lo que reportan atletas; no prueba eficacia)
 *       'estimacion' (cálculo de la app) · 'opinion'. Para actualizar: editar esta lista y su fuente. */
const NUTRI_KB = [
  { t: 'prot', ty: 'ciencia', h: 'Proteína para ganar músculo', x: 'Con entrenamiento de fuerza, el beneficio de la proteína se estabiliza alrededor de 1.6 g/kg/día; hasta 2.2 g/kg cubre a casi todos.', s: 'Morton y col., 2018 · Br J Sports Med 52:376' },
  { t: 'prot', ty: 'ciencia', h: 'Reparto en el día', x: '≈0.4 g/kg por comida en al menos 4 comidas maximiza la síntesis muscular; el momento exacto importa poco frente al total diario.', s: 'Schoenfeld y Aragon, 2018 · JISSN 15:10 · Schoenfeld y col., 2013 · JISSN 10:53' },
  { t: 'prot', ty: 'ciencia', h: 'Proteína en definición', x: 'En déficit, atletas delgados conservan mejor el músculo con 2.3–3.1 g/kg de masa magra.', s: 'Helms, Aragon y Fitschen, 2014 · JISSN 11:20 · Helms y col., 2014 · IJSNEM 24:127' },
  { t: 'vol', ty: 'ciencia', h: 'Superávit en volumen', x: 'Superávit de ≈10–20 % sobre mantenimiento y ganancia de ≈0.25–0.5 % del peso por semana; los avanzados, más lento. Más rápido suma sobre todo grasa.', s: 'Iraki, Fitschen, Espinar y Helms, 2019 · Sports 7:154' },
  { t: 'vol', ty: 'practica', h: 'Off-season paciente (Chris Bumstead)', x: 'Lo que el atleta ha contado públicamente: temporadas largas de crecimiento, comidas estructuradas y seguimiento constante. Sus cantidades y suplementos no aplican a todos.', s: 'Entrevistas públicas del atleta · no es evidencia científica' },
  { t: 'def', ty: 'ciencia', h: 'Ritmo de pérdida', x: 'Perder 0.5–1 % del peso por semana conserva mejor la masa magra; atletas que bajaron 0.7 %/sem mantuvieron más músculo y fuerza que con 1.4 %/sem.', s: 'Helms y col., 2014 · Garthe y col., 2011 · IJSNEM 21:97' },
  { t: 'def', ty: 'ciencia', h: 'Adaptación metabólica', x: 'Al bajar de peso el gasto cae más de lo que predice la pérdida de masa. Por eso el motor recalibra con tus datos en lugar de recortar sin fin.', s: 'Trexler, Smith-Ryan y Norton, 2014 · JISSN 11:7' },
  { t: 'def', ty: 'practica', h: 'Disciplina de campamento (Paddy Pimblett)', x: 'Lo que reporta públicamente: un equipo de nutrición y seguimiento estricto durante el campamento. Excluimos por completo sus cortes de peso y la manipulación de agua.', s: 'Entrevistas públicas del atleta · no es evidencia científica' },
  { t: 'def', ty: 'ciencia', h: 'Los cortes de peso son peligrosos', x: 'Deshidratación, sauna y restricción de agua dañan rendimiento y salud; no son pérdida de grasa. La app no los implementa.', s: 'Reale, Slater y Burke, 2017 · IJSPP 12:142' },
  { t: 'recomp', ty: 'ciencia', h: 'Recomposición', x: 'Es posible ganar músculo y perder grasa a la vez, sobre todo en principiantes, quienes regresan o con más grasa, con fuerza progresiva y proteína alta.', s: 'Barakat y col., 2020 · Strength Cond J 42:7' },
  { t: 'rend', ty: 'ciencia', h: 'Carbohidratos según la carga', x: 'Ligera 3–5 g/kg · ≈1 h/día 5–7 · 1–3 h/día 6–10 · >4 h/día 8–12. Proteína 1.2–2.0 g/kg; grasa 20–35 %.', s: 'Thomas, Erdman y Burke, 2016 · Med Sci Sports Exerc 48:543' },
  { t: 'rend', ty: 'ciencia', h: 'Disponibilidad energética', x: 'Comer muy por debajo del gasto (<30 kcal/kg de masa magra) altera hormonas, huesos y rendimiento (RED-S).', s: 'Loucks, Kiens y Wright, 2011 · Mountjoy y col., 2018 · Br J Sports Med 52:687' },
  { t: 'grasa', ty: 'ciencia', h: 'Grasas', x: 'No bajes de ≈20 % de tus calorías en grasa: las necesitas para hormonas y vitaminas liposolubles.', s: 'Thomas y col., 2016 · Helms y col., 2014' },
  { t: 'hid', ty: 'ciencia', h: 'Hidratación', x: 'Evita perder más de 2 % de tu peso en sudor durante el ejercicio; pésate antes y después para conocer tu tasa.', s: 'Sawka y col., 2007 · ACSM, Med Sci Sports Exerc 39:377' },
  { t: 'rec', ty: 'ciencia', h: 'Sueño y composición', x: 'Dormir poco durante un déficit aumenta la pérdida de masa magra frente a dormir lo suficiente.', s: 'Nedeltcheva y col., 2010 · Ann Intern Med 153:435' },
  { t: 'calc', ty: 'estimacion', h: 'Cómo calcula la app', x: 'Metabolismo basal con Mifflin-St Jeor × factor de actividad. Con 2–3 semanas de registros se recalibra: gasto real ≈ ingesta media − cambio de peso × 7700 kcal/kg. Todo es estimado.', s: 'Mifflin y col., 1990 · Frankenfield y col., 2005 · Hall y col., 2011' },
  { t: 'calc', ty: 'estimacion', h: 'Alimentos', x: 'Valores por 100 g de USDA FoodData Central (SR Legacy) y SMAE. Las marcas varían: la etiqueta manda.', s: 'USDA FoodData Central · Sistema Mexicano de Alimentos Equivalentes' }
];
const NKB_TOPIC = { prot: 'Proteína', vol: 'Volumen e hipertrofia', def: 'Definición y pérdida de grasa', recomp: 'Recomposición', rend: 'Nutrición deportiva', grasa: 'Grasas', hid: 'Hidratación', rec: 'Recuperación', calc: 'Estimaciones del sistema' };
const NKB_TYPE = { ciencia: 'Evidencia científica', practica: 'Práctica de atletas', estimacion: 'Estimación del sistema', opinion: 'Opinión' };
