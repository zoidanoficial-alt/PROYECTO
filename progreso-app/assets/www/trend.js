'use strict';
/* =====================================================================
 *  37.0 · EVOLUCIÓN: tu objetivo en vivo, gráficas de mejora y cómo sostenerla
 *  - Cada disciplina (HYROX, running, triatlón, Spartan, ciclismo, fisicoculturismo,
 *    fuerza) tiene su métrica principal, calculada con TUS datos a cualquier fecha.
 *  - "En vivo": cuando un entreno mueve tu métrica, la app te lo dice con su delta.
 *  - "Cómo sostenerlo": la dosis mínima para no perder lo ganado, con su fuente.
 *  Nada se inventa: sin datos suficientes, la métrica no aparece.
 * ===================================================================== */

const SPORTS = {
  hyrox: { n: 'HYROX', ico: 'timer', d: 'Carrera + 8 estaciones' },
  run: { n: 'Running', ico: 'footprints', d: '5 km a maratón' },
  tri: { n: 'Triatlón', ico: 'activity', d: 'Nadar, rodar y correr' },
  spartan: { n: 'Spartan / OCR', ico: 'mountain', d: 'Carrera con obstáculos' },
  bici: { n: 'Ciclismo', ico: 'bike', d: 'Ruta, montaña o indoor' },
  fisico: { n: 'Fisicoculturismo', ico: 'dumbbell', d: 'Músculo y definición' },
  fuerza: { n: 'Fuerza y físico', ico: 'zap', d: 'Más fuerte y en forma' }
};
const RUN_DIST = { 5: '5 km', 10: '10 km', 21.1: 'Medio maratón', 42.2: 'Maratón' };
function mainSport() {
  const p = DB.profile;
  if (p.sport && SPORTS[p.sport]) return p.sport;
  if (typeof hxOn === 'function' && hxOn()) return 'hyrox';
  if (p.trainMode === 'running') return 'run';
  if (p.phase === 'volumen' || p.phase === 'definicion') return 'fisico';
  return 'fuerza';
}
function runGoalKm() { const s = mainSport(), g = Number(DB.profile.runKm); return g || (s === 'spartan' ? 5 : s === 'tri' ? 10 : 10); }

/* ---------- Datos a una fecha ---------- */
function trBestEffort(d, win) {
  let best = null;
  (DB.runs || []).filter(r => r.best && r.date <= d && r.date > addDays(d, -(win || 120))).forEach(r => Object.keys(r.best).forEach(k => {
    const m = Number(k) * 1000, s = r.best[k]; if (!(m >= 1000) || !(s > 0)) return;
    const v = vdot(m, s); if (!best || v > best.v) best = { v, m, s, date: r.date };
  }));
  return best;
}
function trAvgRec(d, k) {
  const v = []; for (let i = 0; i < 7; i++) { const r = DB.days[addDays(d, -i)] && DB.days[addDays(d, -i)].rec; if (r && r[k] != null) v.push(r[k]); }
  return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function trHyroxAt(d) {
  if (typeof hxOn !== 'function' || !hxOn()) return null;
  const H = hx(), all = H.results;
  if (!all.some(r => r.date <= d)) return null;
  H.results = all.filter(r => r.date <= d);
  try { const pr = hxPredict(); return pr.ok ? pr.total : null; } finally { H.results = all; }
}
const CARDIO = new Set(['correr', 'caminar', 'bici', 'nadar', 'eliptica', 'escalera', 'remo', 'circuito', 'deporte']);

/* ---------- Carga de entrenamiento (sRPE: minutos × esfuerzo, Foster 2001) ---------- */
let TR_LOAD = null;
function trLoads() {
  if (TR_LOAD && TR_LOAD.at === saveStamp()) return TR_LOAD;
  const m = {};
  const add = (d, min, rpe, est, aer) => { if (!d || !(min > 0)) return; const x = m[d] || (m[d] = { l: 0, est: 0, aer: 0, n: 0 }); x.l += Math.min(240, min) * rpe; x.n++; if (est) x.est++; if (aer) x.aer += min; };
  DB.sessions.filter(s => s.end && s.start).forEach(s => {
    const ls = DB.lifts.filter(l => l.sid === s.id && l.rir != null);
    const rpe = ls.length ? Math.max(4, Math.min(10, 10 - ls.reduce((a, l) => a + l.rir, 0) / ls.length)) : 6;
    add(s.date, (s.end - s.start) / 60000, rpe, !ls.length, false);
  });
  (DB.runs || []).forEach(r => add(r.date, (r.dur || 0) / 60, r.rpe || 6, !r.rpe, true));
  (DB.activities || []).forEach(a => add(a.date, a.min, a.rpe || 5, !a.rpe, CARDIO.has(a.type)));
  if (DB.hyrox) {
    (DB.hyrox.sessions || []).forEach(s => add(s.date, (s.dur || 0) / 60, s.rpe || 7, !s.rpe, true));
    (DB.hyrox.runs || []).forEach(r => { const res = (DB.hyrox.results || []).find(x => x.timerId === r.id && x.rpe); add(r.date, r.total / 60 + 15, res ? res.rpe : 8, !res, true); });
  }
  TR_LOAD = { at: saveStamp(), m };
  return TR_LOAD;
}
function saveStamp() { return (DB.sessions.length + ':' + (DB.runs || []).length + ':' + (DB.activities || []).length + ':' + (DB.hyrox ? DB.hyrox.sessions.length + ':' + (DB.hyrox.runs || []).length + ':' + DB.hyrox.results.length : '') + ':' + DB.lifts.length); }
/** Forma (CTL 42 d), fatiga (ATL 7 d) y frescura (TSB) día a día: modelo de Banister. */
function trForm(days) {
  const m = trLoads().m, keys = Object.keys(m).sort(); if (!keys.length) return [];
  const t = todayStr(), from = keys[0] < addDays(t, -400) ? addDays(t, -400) : keys[0];
  const out = []; let ctl = 0, atl = 0;
  for (let d = from; d <= t; d = addDays(d, 1)) {
    const l = m[d] ? m[d].l : 0;
    ctl += (l - ctl) / 42; atl += (l - atl) / 7;
    out.push({ date: d, l, ctl, atl, tsb: ctl - atl });
  }
  return days ? out.slice(-days) : out;
}
function trSum(d, n, k) { const m = trLoads().m; let s = 0; for (let i = 0; i < n; i++) { const x = m[addDays(d, -i)]; if (x) s += x[k || 'l']; } return s; }
function trAcwr(d) { const ch = trSum(d, 28) / 4; return ch > 0 ? trSum(d, 7) / ch : null; }
function trCtlAt(d) { const f = trForm(); const x = f.find(p => p.date === d); return f.length >= 21 && x ? x.ctl : null; }   // carga diaria media (minutos × esfuerzo)

/* ---------- Métricas ---------- */
const fmtTime = v => hxT(Math.round(v));
const METRICS = {
  hyrox: { n: 'Tiempo HYROX previsto', short: 'Predicción', better: 'down', fmt: fmtTime, delta: v => hxT(Math.abs(Math.round(v))), unit: '', at: trHyroxAt, est: true, how: 'Mide tu 1 km fresco y al menos 6 estaciones con el temporizador.' },
  runT: { n: () => `${RUN_DIST[runGoalKm()] || runGoalKm() + ' km'} previsto`, short: () => RUN_DIST[runGoalKm()] || runGoalKm() + ' km', better: 'down', fmt: fmtTime, delta: v => hxT(Math.abs(Math.round(v))), at: d => { const b = trBestEffort(d); return b ? b.s * Math.pow(runGoalKm() * 1000 / b.m, 1.06) : null; }, est: true, how: 'Corre con GPS al menos 1 km a buen ritmo: la app usa tu mejor esfuerzo de 4 meses (fórmula de Riegel).' },
  vo2: { n: 'VO₂máx estimado (VDOT)', short: 'VO₂máx', better: 'up', fmt: v => fmt(v, 1), delta: v => fmt(Math.abs(v), 1), at: d => { const b = trBestEffort(d); return b ? b.v : null; }, est: true, how: 'Sale de tu mejor esfuerzo de carrera (tablas de Jack Daniels).' },
  str: { n: 'Fuerza general', short: 'Fuerza', better: 'up', fmt: v => String(Math.round(v)), delta: v => String(Math.abs(Math.round(v))), at: d => { const s = strengthScores(d); return s.overall != null ? s.overall : null; }, how: 'Registra series con peso en sentadilla, peso muerto, press o dominadas.' },
  w: { n: 'Peso (media 7 días)', short: 'Peso', better: () => DB.profile.phase === 'volumen' ? 'up' : DB.profile.phase === 'definicion' ? 'down' : 'none', fmt: v => fmt(v) + ' kg', delta: v => fmt(Math.abs(v)) + ' kg', at: d => { const a = weekAvg(d); return a ? a.avg : null; }, how: 'Pésate 3–4 mañanas por semana.' },
  fat: { n: 'Grasa corporal estimada (RFM)', short: '% grasa', better: 'down', fmt: v => fmt(v, 1) + ' %', delta: v => fmt(Math.abs(v), 1) + ' pts', at: d => { const m = (DB.measures || []).filter(x => x.waist && x.date <= d).sort((a, b) => a.date < b.date ? 1 : -1)[0]; const h = Number(DB.profile.height); return m && h && typeof rfm === 'function' ? rfm(h, m.waist, fem()) : null; }, est: true, how: 'Mide tu cintura (a la altura del ombligo) cada 2 semanas.' },
  ctl: { n: 'Forma física (carga crónica)', short: 'Forma', better: 'up', fmt: v => String(Math.round(v)), delta: v => String(Math.abs(Math.round(v))), at: trCtlAt, est: true, how: 'Se construye sola con 3 semanas de entrenos registrados (minutos × esfuerzo).' },
  aer: { n: 'Minutos de cardio por semana', short: 'Cardio', better: 'up', fmt: v => Math.round(v) + ' min', delta: v => Math.round(Math.abs(v)) + ' min', at: d => { const s = trSum(d, 7, 'aer'); const any = Object.keys(trLoads().m).some(k => k <= d); return any ? s : null; }, how: 'Registra carreras, bici, natación o sesiones HYROX.' },
  rhr: { n: 'Pulso en reposo (media 7 d)', short: 'Pulso reposo', better: 'down', fmt: v => Math.round(v) + ' lpm', delta: v => Math.round(Math.abs(v)) + ' lpm', at: d => trAvgRec(d, 'rhr'), how: 'Llega solo desde Mi Fitness (Health Connect) o con tu chequeo diario.' },
  hrv: { n: 'HRV (media 7 d)', short: 'HRV', better: 'up', fmt: v => Math.round(v) + ' ms', delta: v => Math.round(Math.abs(v)) + ' ms', at: d => trAvgRec(d, 'hrv'), how: 'Llega desde tu reloj si Mi Fitness la comparte, o escríbela en el chequeo.' }
};
const SPORT_METRICS = {
  hyrox: ['hyrox', 'runT', 'ctl', 'str', 'rhr'],
  run: ['runT', 'vo2', 'ctl', 'aer', 'rhr'],
  tri: ['ctl', 'aer', 'runT', 'vo2', 'rhr', 'hrv'],
  spartan: ['runT', 'str', 'ctl', 'aer', 'rhr'],
  bici: ['ctl', 'aer', 'rhr', 'hrv', 'str'],
  fisico: ['fat', 'w', 'str', 'ctl'],
  fuerza: ['str', 'w', 'fat', 'ctl', 'rhr']
};
const mName = (k, f) => { const v = METRICS[k][f || 'n']; return typeof v === 'function' ? v() : v; };
const mBetter = k => { const b = METRICS[k].better; return typeof b === 'function' ? b() : b; };
function metricAt(k, d) { try { const v = METRICS[k].at(d); return v == null || !isFinite(v) ? null : v; } catch (e) { return null; } }
/** Serie semanal (último día de cada semana) para graficar. */
function metricSeries(k, weeks) {
  const t = todayStr(), out = [];
  for (let i = (weeks || 16) - 1; i >= 0; i--) { const d = addDays(t, -7 * i), v = metricAt(k, d); if (v != null) out.push({ date: d, y: v }); }
  return out;
}
/** ¿Mejoró? +1 mejor, −1 peor, 0 igual (con margen para no celebrar ruido). */
function metricDir(k, a, b) {
  const bt = mBetter(k), eps = Math.max(Math.abs(a) * 0.003, k === 'str' || k === 'ctl' ? 0.5 : 0.05);
  if (Math.abs(b - a) < eps || bt === 'none') return 0;
  return (bt === 'down' ? b < a : b > a) ? 1 : -1;
}
function sportMetrics(withData) {
  const ks = SPORT_METRICS[mainSport()].slice();
  if (mainSport() === 'fisico' && metricAt('fat', todayStr()) == null) { ks.splice(ks.indexOf('fat'), 1); ks.push('fat'); }
  return withData ? ks.filter(k => metricAt(k, todayStr()) != null) : ks;
}
function mainMetric() { return sportMetrics(true)[0] || null; }

/* ---------- En vivo: lo que movió tu último entreno ---------- */
function liveCheck() {
  const k = mainMetric(); if (!k) return null;
  const v = metricAt(k, todayStr()); if (v == null) return null;
  DB.live = DB.live || {};
  const prev = DB.live[k];
  let ev = null;
  if (prev && prev.v != null && metricDir(k, prev.v, v) === 1) {
    ev = { k, from: prev.v, to: v, date: todayStr() };
    DB.live.log = (DB.live.log || []).concat(ev).slice(-40);
  }
  if (!prev || prev.v !== v) { DB.live[k] = { v, date: todayStr() }; saveData(); }
  return ev;
}
function liveToast(ev) {
  if (!ev) return;
  const m = METRICS[ev.k];
  snack(`🔥 ${mName(ev.k, 'short')}: ${m.fmt(ev.from)} → ${m.fmt(ev.to)} (${mBetter(ev.k) === 'down' ? '−' : '+'}${m.delta(ev.to - ev.from)})`, 'Ver', () => { progMode = 'evol'; progMetric = ev.k; showTab('progress'); }, 6000);
}
/** Resumen para Hoy: valor actual y cambio en 7 días. */
function goalLive() {
  const k = mainMetric(); if (!k) return null;
  const t = todayStr(), v = metricAt(k, t), w = metricAt(k, addDays(t, -7)), m = METRICS[k];
  const dir = w != null ? metricDir(k, w, v) : 0;
  return { k, label: k === 'runT' ? 'Tiempo previsto' : mName(k, 'short'), val: m.fmt(v), est: m.est, chg: w != null && dir !== 0 ? `${(mBetter(k) === 'down') === (v < w) ? (mBetter(k) === 'down' ? '−' : '+') : (mBetter(k) === 'down' ? '+' : '−')}${m.delta(v - w)} en 7 días` : w != null ? 'estable esta semana' : 'primer dato', dir };
}

/* ---------- Cómo sostenerlo ---------- */
function daysSince(pred) {
  const t = todayStr(); let best = null;
  const see = d => { if (d && d <= t && (!best || d > best)) best = d; };
  pred(see); return best ? daysBetween(best, t) : null;
}
const hardAerobic = see => {
  (DB.runs || []).forEach(r => { if ((r.rpe || 0) >= 7 || (r.dur || 0) >= 1800) see(r.date); });
  if (DB.hyrox) { DB.hyrox.sessions.forEach(s => { if ((s.rpe || 0) >= 7) see(s.date); }); (DB.hyrox.runs || []).forEach(r => see(r.date)); }
  (DB.activities || []).forEach(a => { if (CARDIO.has(a.type) && (a.rpe || 0) >= 7) see(a.date); });
};
const SUSTAIN = {
  str: { rule: 'La fuerza se sostiene con 1 sesión pesada por semana: un tercio del volumen, pero la misma intensidad (series a 1–2 reps del fallo).', src: 'Bickel y col., 2011 · Med Sci Sports Exerc', stim: 'última serie pesada (RIR ≤ 2)', ok: 10, warn: 21, last: () => daysSince(see => DB.lifts.forEach(l => { if (l.rir != null && l.rir <= 2) see(l.date); })) },
  runT: { rule: 'Tu nivel aeróbico se sostiene aunque bajes frecuencia y volumen hasta en dos tercios, si mantienes la intensidad: 1 sesión de calidad por semana.', src: 'Hickson y col., 1985 · Mujika y Padilla, 2000', stim: 'última sesión aeróbica de calidad', ok: 7, warn: 14, last: () => daysSince(hardAerobic) },
  hyrox: { rule: 'Una sesión específica por semana (estaciones + correr) y una prueba cronometrada cada 3–4 semanas mantienen tu predicción real.', src: 'Criterio de la app con la metodología de HYROX Lab', stim: 'última sesión o prueba HYROX', ok: 10, warn: 21, last: () => daysSince(see => { if (DB.hyrox) { DB.hyrox.sessions.forEach(s => see(s.date)); DB.hyrox.results.forEach(r => see(r.date)); } }) },
  w: { rule: 'Para sostener tu peso: variaciones de ±1 % por semana son normales. Proteína ~1.6 g/kg al día y fuerza 2 veces por semana protegen tu músculo.', src: 'Morton y col., 2018 · Br J Sports Med', stim: 'último pesaje', ok: 4, warn: 10, last: () => daysSince(see => Object.keys(DB.days).forEach(d => { if (DB.days[d].weight != null) see(d); })) },
  fat: { rule: 'La composición se sostiene con proteína alta, fuerza 2×/semana y un déficit pequeño o nulo. Mide tu cintura cada 2 semanas para verlo.', src: 'Morton y col., 2018 · Woolcott y Bergman, 2018 (RFM)', stim: 'última medida de cintura', ok: 15, warn: 30, last: () => daysSince(see => (DB.measures || []).forEach(m => { if (m.waist) see(m.date); })) },
  ctl: { rule: 'Sube tu carga semanal poco a poco. La relación carga aguda/crónica entre 0.8 y 1.3 es la zona donde más se progresa con menos lesiones; arriba de 1.5 el riesgo sube.', src: 'Gabbett, 2016 · Br J Sports Med (guía, no ley)', acwr: true },
  aer: { rule: 'Unos 80 % de tus minutos de cardio deben ser suaves (puedes hablar) y 20 % intensos. Así se sostiene el volumen sin quemarte.', src: 'Seiler, 2010 · Int J Sports Physiol Perform', stim: 'última sesión de cardio', ok: 4, warn: 10, last: () => daysSince(see => { const m = trLoads().m; Object.keys(m).forEach(d => { if (m[d].aer > 0) see(d); }); }) },
  rhr: { rule: 'Si tu pulso en reposo sube 5+ lpm sobre tu media varios días, prioriza sueño (7–9 h) y una semana más ligera.', src: 'Bellenger y col., 2016 · Sports Med', base: 'rhr' },
  hrv: { rule: 'Una HRV más baja que tu media varios días seguidos indica fatiga acumulada: baja la intensidad hasta que vuelva.', src: 'Plews y col., 2013 · Sports Med', base: 'hrv' }
};
SUSTAIN.vo2 = SUSTAIN.runT;
function sustainState(k) {
  const s = SUSTAIN[k]; if (!s) return null;
  if (s.acwr) {
    const r = trAcwr(todayStr()); if (r == null) return { s, st: 'none', txt: 'Necesito 4 semanas de entrenos para calcular tu relación de carga.' };
    return { s, st: r > 1.5 ? 'bad' : r > 1.3 || r < 0.8 ? 'warn' : 'ok', txt: `Relación de carga: ${fmt(r, 2)} · ${r > 1.5 ? 'subiste demasiado rápido esta semana' : r > 1.3 ? 'en el límite: no subas más esta semana' : r < 0.8 ? 'semana ligera: bien si es descarga; si no, vas perdiendo forma' : 'en la zona óptima'}` };
  }
  if (s.base) {
    const t = todayStr(), now = trAvgRec(t, s.base), b = trAvgRec(addDays(t, -21), s.base);
    if (now == null || b == null) return { s, st: 'none', txt: 'Necesito 3 semanas de datos del reloj para compararte contigo.' };
    const diff = now - b, bad = s.base === 'rhr' ? diff >= 5 : diff <= -b * 0.1;
    return { s, st: bad ? 'warn' : 'ok', txt: `${s.base === 'rhr' ? 'Pulso' : 'HRV'} ${Math.round(now)} vs ${Math.round(b)} hace 3 semanas · ${bad ? 'señal de fatiga' : 'dentro de tu normal'}` };
  }
  const d = s.last();
  if (d == null) return { s, st: 'none', txt: `Aún no hay ${s.stim}.` };
  return { s, st: d <= s.ok ? 'ok' : d <= s.warn ? 'warn' : 'bad', txt: `${s.stim[0].toUpperCase() + s.stim.slice(1)}: ${d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días'}${d > s.warn ? ' · empiezas a perder lo ganado' : d > s.ok ? ' · toca un estímulo pronto' : ' · lo estás sosteniendo'}` };
}

/* ---------- Gráfica de tendencia ---------- */
function drawTrend(canvas, pts, k, opts) {
  if (!canvas) return; opts = opts || {};
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
  const acc = getVar('--accent'), mut = getVar('--muted'), line = getVar('--line'), txt3 = getVar('--text-3');
  if (pts.length < 2) { c.fillStyle = mut; c.font = '13px system-ui'; c.textAlign = 'center'; c.fillText(pts.length ? 'Un solo dato: vuelve en una semana' : 'Sin datos todavía', W / 2, H / 2); return; }
  const m = METRICS[k], ys = pts.map(p => p.y).concat(opts.extra || []);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = Math.max((y1 - y0) * 0.18, Math.abs(y1) * 0.01, 0.5); y0 -= pad; y1 += pad;
  const L = 8, R = 8, T = 16, B = 22, n = pts.length;
  const x0 = parseDate(pts[0].date).getTime(), x1 = parseDate(pts[n - 1].date).getTime();
  const px = d => L + (parseDate(d).getTime() - x0) / Math.max(1, x1 - x0) * (W - L - R), py = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  // "Mejor" hacia arriba: si menos es mejor, el eje se invierte para que mejorar siempre suba
  const inv = mBetter(k) === 'down', Y = v => inv ? H - B - (py(v) - T) : py(v);
  c.strokeStyle = line; c.lineWidth = 1; [0.25, 0.5, 0.75].forEach(f => { const y = T + f * (H - T - B); c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); });
  if (opts.goal != null) { const y = Y(opts.goal); c.save(); c.setLineDash([5, 4]); c.strokeStyle = mut; c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); c.restore(); c.fillStyle = mut; c.font = '11px system-ui'; c.textAlign = 'right'; c.fillText('Meta ' + m.fmt(opts.goal), W - R, y - 5); }
  const P = pts.map(p => [px(p.date), Y(p.y)]);
  const g = c.createLinearGradient(0, T, 0, H - B); const al = a => /^#[0-9a-f]{6}$/i.test(acc) ? acc + a : 'rgba(198,244,50,0)'; try { g.addColorStop(0, al('55')); g.addColorStop(1, al('00')); } catch (e) {}
  c.beginPath(); P.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineTo(P[n - 1][0], H - B); c.lineTo(P[0][0], H - B); c.closePath(); c.fillStyle = g; c.fill();
  c.beginPath(); P.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = acc; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke();
  const bi = pts.reduce((b, p, i) => (inv ? p.y < pts[b].y : p.y > pts[b].y) ? i : b, 0);
  c.fillStyle = acc; c.beginPath(); c.arc(P[n - 1][0], P[n - 1][1], 5, 0, 7); c.fill();
  c.strokeStyle = getVar('--bg'); c.lineWidth = 2; c.stroke();
  if (bi !== n - 1) { c.fillStyle = getVar('--text'); c.beginPath(); c.arc(P[bi][0], P[bi][1], 3.5, 0, 7); c.fill(); }
  c.font = '11px system-ui'; c.fillStyle = txt3; c.textAlign = 'left'; c.fillText(shortDate(pts[0].date), L, H - 5); c.textAlign = 'right'; c.fillText('hoy', W - R, H - 5);
  c.fillStyle = mut; c.textAlign = P[bi][0] > W / 2 ? 'right' : 'left'; c.fillText('mejor ' + m.fmt(pts[bi].y), P[bi][0] + (P[bi][0] > W / 2 ? -8 : 8), Math.max(12, P[bi][1] - 8));
}
/** Forma (CTL) y fatiga (ATL) de los últimos 12 semanas. */
function drawForm(canvas) {
  if (!canvas) return;
  const f = trForm(84); const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr; const c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
  if (f.length < 14) { c.fillStyle = getVar('--muted'); c.font = '13px system-ui'; c.textAlign = 'center'; c.fillText('Se construye con 2–3 semanas de entrenos', W / 2, H / 2); return; }
  const L = 8, R = 8, T = 10, B = 22, n = f.length, max = Math.max(...f.map(p => Math.max(p.ctl, p.atl, p.l * 0.5))) * 1.1 || 1;
  const px = i => L + i / (n - 1) * (W - L - R), py = v => T + (1 - v / max) * (H - T - B);
  c.fillStyle = getVar('--surface-3'); f.forEach((p, i) => { if (p.l) { const h = (H - T - B) * Math.min(1, p.l * 0.5 / max); c.fillRect(px(i) - 1.5, H - B - h, 3, h); } });
  const ln = (k, col, w, dash) => { c.save(); if (dash) c.setLineDash([4, 4]); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); f.forEach((p, i) => i ? c.lineTo(px(i), py(p[k])) : c.moveTo(px(i), py(p[k]))); c.stroke(); c.restore(); };
  ln('atl', getVar('--muted'), 1.5, true); ln('ctl', getVar('--accent'), 2.5);
  c.font = '11px system-ui'; c.fillStyle = getVar('--text-3'); c.textAlign = 'left'; c.fillText(shortDate(f[0].date), L, H - 5); c.textAlign = 'right'; c.fillText('hoy', W - R, H - 5);
}

/* ---------- Pantalla Evolución (Progreso) ---------- */
let progMetric = null;
function renderEvolution(el) {
  const ks = sportMetrics(false), have = ks.filter(k => metricAt(k, todayStr()) != null);
  const sp = SPORTS[mainSport()];
  if (!progMetric || !have.includes(progMetric)) progMetric = have[0] || null;
  const head = `<button class="evo-sport" id="evo-sport">${ico(sp.ico, 18)}<span>Tu disciplina: <b>${esc(sp.n)}</b></span>${ico('chevron-right', 14)}</button>`;
  if (!progMetric) {
    el.innerHTML = head + `<div class="cp-diag empty"><b>Tus gráficas aparecen con tus primeros datos</b><p>Para ${esc(sp.n.toLowerCase())} la app sigue: ${ks.map(k => esc(mName(k, 'short'))).join(', ')}.</p>
      <dl>${ks.slice(0, 3).map(k => `<dt>${esc(mName(k, 'short'))}</dt><dd>${esc(METRICS[k].how)}</dd>`).join('')}</dl></div>`;
    bindEvolution(el); return;
  }
  const k = progMetric, m = METRICS[k], pts = metricSeries(k, 16), cur = pts.length ? pts[pts.length - 1].y : metricAt(k, todayStr());
  const first = pts[0], d4 = pts.length > 4 ? pts[pts.length - 5] : first;
  const dirAll = first && pts.length > 1 ? metricDir(k, first.y, cur) : 0, dir4 = d4 && pts.length > 1 ? metricDir(k, d4.y, cur) : 0;
  const sign = (a, b) => (mBetter(k) === 'down' ? b < a : b > a) ? (mBetter(k) === 'down' ? '−' : '+') : (mBetter(k) === 'down' ? '+' : '−');
  const ss = sustainState(k);
  const goal = k === 'w' && DB.profile.goalWeight ? DB.profile.goalWeight : null;
  el.innerHTML = head + `
    <div class="seg wrap scroll evo-chips">${have.map(x => `<button data-metric="${x}" class="${x === k ? 'on' : ''}">${esc(mName(x, 'short'))}</button>`).join('')}</div>
    <div class="evo-card">
      <div class="evo-top"><small>${esc(mName(k))}${m.est ? ' <em class="ds-est">estimado</em>' : ''}</small><b>${m.fmt(cur)}</b>
        ${pts.length > 1 ? `<span class="evo-chg ${dirAll > 0 ? 'up' : dirAll < 0 ? 'down' : ''}">${dirAll === 0 ? 'Estable' : sign(first.y, cur) + m.delta(cur - first.y)} desde ${shortDate(first.date)}</span>` : '<span class="evo-chg">Primer dato: vuelve en una semana</span>'}</div>
      <canvas class="evo-canvas" id="evo-canvas"></canvas>
      <div class="evo-legend"><span><i class="a"></i>Semana a semana</span><span><i class="b"></i>Tu mejor marca</span>${mBetter(k) === 'down' ? '<span class="muted">Más arriba = mejor</span>' : ''}</div>
      ${pts.length > 4 ? `<p class="evo-read">${dir4 > 0 ? `Últimas 4 semanas: <b>mejorando</b> (${sign(d4.y, cur)}${m.delta(cur - d4.y)}).` : dir4 < 0 ? `Últimas 4 semanas: <b>bajando</b> (${sign(d4.y, cur)}${m.delta(cur - d4.y)}). Revisa recuperación y constancia.` : 'Últimas 4 semanas: <b>estable</b>. Para volver a subir, cambia el estímulo.'}</p>` : ''}
    </div>
    ${ss ? `<div class="evo-keep ${ss.st}"><div class="hx-eyebrow">CÓMO SOSTENERLO</div><b>${esc(ss.txt)}</b><p>${esc(ss.s.rule)}</p><small>${esc(ss.s.src)}</small></div>` : ''}
    <div class="evo-card"><div class="evo-top"><small>Forma y fatiga · 12 semanas</small><b class="evo-sm">${(() => { const f = trForm(1)[0]; return f ? `Forma ${Math.round(f.ctl)} · Frescura ${f.tsb >= 0 ? '+' : ''}${Math.round(f.tsb)}` : '—'; })()}</b></div>
      <canvas class="evo-canvas sm" id="evo-form"></canvas>
      <div class="evo-legend"><span><i class="a"></i>Forma (42 días)</span><span><i class="c"></i>Fatiga (7 días)</span><span><i class="d"></i>Carga diaria</span></div>
      <p class="evo-read">${(() => { const f = trForm(1)[0]; if (!f) return 'Registra entrenos y aquí verás cómo se acumula tu forma.'; return f.tsb < -20 ? 'Mucha fatiga acumulada: 2–3 días suaves y vuelves más fuerte.' : f.tsb > 10 ? 'Estás fresco: buen momento para una prueba o una sesión clave.' : 'Equilibrio entre entrenar y recuperar.'; })()} <span class="muted">Carga = minutos × esfuerzo (Foster, 2001); modelo de forma de Banister.${(() => { const e = Object.values(trLoads().m).reduce((a, x) => a + x.est, 0); return e ? ` ${e} sesión${e > 1 ? 'es' : ''} con esfuerzo supuesto.` : ''; })()}</span></p>
    </div>
    ${(SUSTAIN.ctl && sustainState('ctl').st !== 'none') ? `<div class="evo-keep ${sustainState('ctl').st}"><div class="hx-eyebrow">CARGA SEGURA</div><b>${esc(sustainState('ctl').txt)}</b><p>${esc(SUSTAIN.ctl.rule)}</p><small>${esc(SUSTAIN.ctl.src)}</small></div>` : ''}`;
  bindEvolution(el);
  showChart(() => { drawTrend($('#evo-canvas'), pts, k, { goal, extra: goal ? [goal] : [] }); drawForm($('#evo-form')); });
}
function bindEvolution(el) {
  $$('[data-metric]', el).forEach(b => b.onclick = () => { progMetric = b.dataset.metric; renderEvolution(el); });
  const s = $('#evo-sport', el); if (s) s.onclick = () => openSportPicker(() => renderProgress());
}

/* ---------- Elegir disciplina ---------- */
function openSportPicker(after) {
  const cur = mainSport();
  openModal(`<h3>¿Para qué te preparas?</h3><p class="small muted" style="margin-top:0">Tu disciplina decide qué mide la app primero, tus gráficas y lo que te dice Hoy. Puedes cambiarla cuando quieras.</p>
    <div class="sp-grid">${Object.keys(SPORTS).map(k => `<button class="sp-item ${k === cur ? 'on' : ''}" data-sport="${k}">${ico(SPORTS[k].ico, 22)}<b>${SPORTS[k].n}</b><small>${SPORTS[k].d}</small></button>`).join('')}</div>
    <div id="sp-run" ${['run', 'tri', 'spartan'].includes(cur) ? '' : 'hidden'}><div class="rir-label"><span>Distancia objetivo de carrera</span></div>
    <div class="seg">${Object.keys(RUN_DIST).map(km => `<button data-km="${km}" class="${runGoalKm() === Number(km) ? 'on' : ''}">${RUN_DIST[km].replace('Medio maratón', '21 km').replace('Maratón', '42 km')}</button>`).join('')}</div></div>
    <button class="block" id="sp-ok">Listo</button>`, m => {
    $$('[data-sport]', m).forEach(b => b.onclick = () => { DB.profile.sport = b.dataset.sport; saveData(); $$('[data-sport]', m).forEach(x => x.classList.toggle('on', x === b)); $('#sp-run', m).hidden = !['run', 'tri', 'spartan'].includes(b.dataset.sport); });
    $$('[data-km]', m).forEach(b => b.onclick = () => { DB.profile.runKm = Number(b.dataset.km); saveData(); $$('[data-km]', m).forEach(x => x.classList.toggle('on', x === b)); });
    $('#sp-ok', m).onclick = () => { closeModal(); if (DB.profile.sport === 'hyrox' && typeof hxOn === 'function' && !hxOn()) { openHxSetup(() => { closeModal(); showTab('hyrox'); }); return; } if (after) after(); else render(currentTab); };
  });
}
