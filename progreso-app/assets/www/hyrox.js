/* =====================================================================
 *  25.0 · Laboratorio HYROX dentro de Mi Progreso
 *  Evaluación por partes, 8 estaciones, running fresco y bajo fatiga (RDI),
 *  índice interno (HPI) con calidad de datos, cuello de botella, predictor
 *  con rango y "¿Y si…?", estrategia de carrera y la misión de hoy.
 *  Todo es local (DB.hyrox). Nada se inventa: sin datos, la app lo dice.
 *  HYROX es una marca de terceros; este módulo no está afiliado a ella.
 * ===================================================================== */

const HX_STATIONS = [
  { k: 'ski', n: 'SkiErg', d: '1,000 m', load: false, tip: 'Brazos casi extendidos, la fuerza sale de la cadera y el abdomen. Ritmo constante: el que arranca a tope lo paga en el primer km siguiente.', err: ['Jalar solo con brazos', 'Salir demasiado rápido'] },
  { k: 'push', n: 'Sled push', d: '50 m', load: true, tip: 'Brazos firmes, cuerpo a 45°, pasos cortos y continuos. Parar y volver a arrancar cuesta más que ir lento.', err: ['Brazos doblados que se cansan', 'Paradas largas'] },
  { k: 'pull', n: 'Sled pull', d: '50 m', load: true, tip: 'Mano sobre mano, cadera baja y caminando hacia atrás dentro de la caja. Usa piernas y espalda, no solo bíceps.', err: ['Jalar de pie con brazos', 'Cuerda enredada'] },
  { k: 'bbj', n: 'Burpee broad jumps', d: '80 m', load: false, tip: 'Un ritmo que puedas sostener sin parar. Saltos medianos y constantes rinden más que saltos largos con pausas.', err: ['Saltos máximos al inicio', 'Pausas de pie'] },
  { k: 'row', n: 'Row', d: '1,000 m', load: false, tip: 'Piernas, luego cadera, luego brazos. 24–30 paladas por minuto; respiración controlada antes del sled.', err: ['Remar con brazos', 'Ritmo de paladas muy alto'] },
  { k: 'farm', n: 'Farmers carry', d: '200 m', load: true, tip: 'Hombros atrás, pasos rápidos y cortos. Si sueltas, descansa poco y vuelve; el agarre se recupera rápido.', err: ['Pasos largos lentos', 'Descansos largos'] },
  { k: 'lunge', n: 'Sandbag lunges', d: '100 m', load: true, tip: 'Rodilla toca el piso, torso alto, bolsa estable. Ritmo constante: estas son las que más castigan el último km.', err: ['Paso muy largo', 'Pausas cada pocos metros'] },
  { k: 'wb', n: 'Wall balls', d: '100 reps', load: true, tip: 'Sets planeados con descansos cortos (5–10 s). La sentadilla completa y el balón al blanco: los no-rep cuestan más.', err: ['Ir al fallo en el primer set', 'No-reps por profundidad'] }
];
const HX_ST = Object.fromEntries(HX_STATIONS.map(s => [s.k, s]));
// Cargas de referencia (temporada 2024/25). Cambian: confírmalas en el reglamento vigente.
const HX_LOADS = {
  open: { m: { push: '152 kg (con trineo)', pull: '103 kg (con trineo)', farm: '2 × 24 kg', lunge: '20 kg', wb: '6 kg a 3 m' }, f: { push: '102 kg (con trineo)', pull: '78 kg (con trineo)', farm: '2 × 16 kg', lunge: '10 kg', wb: '4 kg a 2.7 m' } },
  pro: { m: { push: '202 kg (con trineo)', pull: '153 kg (con trineo)', farm: '2 × 32 kg', lunge: '30 kg', wb: '9 kg a 3 m' }, f: { push: '152 kg (con trineo)', pull: '103 kg (con trineo)', farm: '2 × 24 kg', lunge: '20 kg', wb: '6 kg a 2.7 m' } }
};
const HX_CATS = { open: 'Open', pro: 'Pro', doubles: 'Doubles', relay: 'Relay' };
const HX_EQUIP = { full: 'Gimnasio con equipo HYROX', gym: 'Gimnasio convencional', home: 'Home gym', run: 'Solo running', lim: 'Equipo limitado' };
/*
 * Anclas del modelo interno, en segundos (hombres Open). Puntaje 0 = principiante,
 * 100 = élite. Son aproximaciones de resultados públicos, no estándares oficiales.
 * Mujeres ×1.12; Pro ×1.10 en estaciones con carga (la carga es mayor).
 */
const HX_ANCHOR = { run1k: [390, 180], ski: [360, 210], push: [420, 150], pull: [480, 210], bbj: [480, 165], row: [360, 215], farm: [180, 80], lunge: [480, 210], wb: [540, 210] };

function hx() {
  if (!DB.hyrox) DB.hyrox = { profile: null, results: [], sessions: [], active: null, roxzone: null };
  return DB.hyrox;
}
function hxOn() { return !!(DB.hyrox && DB.hyrox.profile); }

/* ---------- Tiempo ---------- */
function hxParse(v) {   // "4:10", "1:02:30" o segundos
  const s = String(v || '').trim().replace(',', '.');
  if (!s) return null;
  const p = s.split(':').map(Number);
  if (p.some(x => !isFinite(x) || x < 0)) return null;
  const t = p.reduce((a, x) => a * 60 + x, 0);
  return t > 0 ? t : null;
}
function hxT(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

/* ---------- Datos ---------- */
function hxResults(kind, st) { return hx().results.filter(r => r.kind === kind && (!st || r.st === st)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.t - b.t); }
function hxLatest(kind, st) { const r = hxResults(kind, st); return r.length ? r[r.length - 1] : null; }
function hxBest(kind, st) { return hxResults(kind, st).reduce((a, r) => !a || r.sec < a.sec ? r : a, null); }
/** Mejor de las últimas 3 pruebas: el estado actual sin castigar un mal día aislado. */
function hxCurrent(kind, st) { const r = hxResults(kind, st).slice(-3); return r.length ? r.reduce((a, x) => x.sec < a.sec ? x : a) : null; }

function hxFactor(st) {
  const p = hx().profile || {};
  let f = p.sex === 'f' ? 1.12 : 1;
  if (p.cat === 'pro' && HX_ST[st] && HX_ST[st].load) f *= 1.10;
  return f;
}
function hxScore(st, sec) {
  if (sec == null) return null;
  const [nov, eli] = HX_ANCHOR[st], f = hxFactor(st);
  return Math.max(0, Math.min(100, Math.round(100 * (nov * f - sec) / (nov * f - eli * f))));
}
/** Tiempo que correspondería a un puntaje dado (para comparar contra tu propio nivel). */
function hxTimeAt(st, score) { const [nov, eli] = HX_ANCHOR[st], f = hxFactor(st); return (nov - (nov - eli) * score / 100) * f; }

/* ---------- Running bajo fatiga: RDI ---------- */
/** RDI = ((ritmo fatigado − ritmo fresco) / ritmo fresco) × 100, en s/km. */
function hxRDI(freshPace, fatPace) { return freshPace && fatPace ? (fatPace - freshPace) / freshPace * 100 : null; }
function hxFatigue() {
  const fresh = hxCurrent('run1k'), comp = hxResults('comp').slice(-3);
  if (!fresh || !comp.length) return null;
  const rows = comp.map(c => ({ ...c, rdi: hxRDI(fresh.sec, c.sec) }));
  const avg = rows.reduce((a, r) => a + r.rdi, 0) / rows.length;
  return { fresh, rows, rdi: avg, n: rows.length };
}

/* ---------- HPI: índice interno 0–100 ---------- */
const HX_WEIGHTS = { run: 25, st: 25, str: 15, fat: 15, race: 10, rec: 10 };
const HX_PILLAR = { run: 'Motor de running', st: 'Estaciones', str: 'Fuerza', fat: 'Resistencia a la fatiga', race: 'Ejecución de carrera', rec: 'Recuperación y constancia' };
function hxStrength() {
  // Fuerza relativa con lo que ya registras en Mi Progreso (sentadilla y peso muerto, e1RM / peso).
  const bw = currentWeight();
  if (!bw) return null;
  const best = re => DB.lifts.filter(l => re.test(l.ex) && l.r && l.r <= 12 && l.date >= addDays(todayStr(), -90)).reduce((a, l) => Math.max(a, l.w * (1 + l.r / 30)), 0);
  const sq = best(/sentadilla|squat|prensa/i), dl = best(/peso muerto|deadlift/i);
  if (!sq && !dl) return null;
  const parts = [];
  if (sq) parts.push({ n: 'Sentadilla', rel: sq / bw, s: Math.max(0, Math.min(100, Math.round((sq / bw - 0.75) / (1.75 - 0.75) * 100))) });
  if (dl) parts.push({ n: 'Peso muerto', rel: dl / bw, s: Math.max(0, Math.min(100, Math.round((dl / bw - 1) / (2.25 - 1) * 100))) });
  return { s: Math.round(parts.reduce((a, p) => a + p.s, 0) / parts.length), parts };
}
function hxRecoveryPillar() {
  const t = todayStr(), recs = [];
  for (let i = 0; i < 14; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r) recs.push(r); }
  const done = DB.sessions.filter(s => s.end && s.date >= addDays(t, -28)).length + hx().sessions.filter(s => s.date >= addDays(t, -28)).length;
  if (recs.length < 4 && done < 4) return null;
  const sl = recs.filter(r => r.sleepH != null), slS = sl.length ? Math.max(0, Math.min(100, (sl.reduce((a, r) => a + r.sleepH, 0) / sl.length - 5) / 3 * 100)) : null;
  const avail = (hx().profile && hx().profile.days) || 4, conS = Math.min(100, done / (avail * 4) * 100);
  const parts = [slS, conS].filter(x => x != null);
  return { s: Math.round(parts.reduce((a, b) => a + b, 0) / parts.length), sleep: slS, cons: conS, sessions: done };
}
function hxPerformance() {
  const st = {};
  HX_STATIONS.forEach(s => { const c = hxCurrent('st', s.k); st[s.k] = c ? { sec: c.sec, s: hxScore(s.k, c.sec), r: c } : null; });
  const tested = HX_STATIONS.filter(s => st[s.k]);
  const run = hxCurrent('run1k'), fat = hxFatigue(), str = hxStrength(), rec = hxRecoveryPillar(), sim = hxLatest('sim');
  const P = {
    run: run ? { s: hxScore('run1k', run.sec), src: `1 km fresco: ${hxT(run.sec)}` } : null,
    st: tested.length >= 4 ? { s: Math.round(tested.reduce((a, s) => a + st[s.k].s, 0) / tested.length), src: `${tested.length} de 8 estaciones medidas` } : null,
    str: str ? { s: str.s, src: str.parts.map(p => `${p.n} ${fmt(p.rel, 2)}× tu peso`).join(' · ') } : null,
    fat: fat ? { s: Math.max(0, Math.min(100, Math.round(100 - fat.rdi * 5))), src: `RDI ${fmt(fat.rdi, 1)} % en ${fat.n} prueba${fat.n > 1 ? 's' : ''}` } : null,
    race: sim && sim.pred ? { s: Math.max(0, Math.min(100, Math.round(100 - Math.max(0, (sim.sec / sim.pred - 1) * 100) * 8))), src: `Simulación ${hxT(sim.sec)} vs ${hxT(sim.pred)} esperado` } : null,
    rec: rec ? { s: rec.s, src: `${rec.sessions} sesiones en 4 semanas${rec.sleep != null ? ' · sueño' : ''}` } : null
  };
  const w = Object.assign({}, HX_WEIGHTS, (hx().profile && hx().profile.weights) || {});
  const keys = Object.keys(HX_WEIGHTS), have = keys.filter(k => P[k]);
  const cover = have.reduce((a, k) => a + w[k], 0) / keys.reduce((a, k) => a + w[k], 0);
  const hpi = cover >= 0.6 && P.run && P.st ? Math.round(have.reduce((a, k) => a + P[k].s * w[k], 0) / have.reduce((a, k) => a + w[k], 0)) : null;
  const conf = cover >= 0.9 ? 'alta' : cover >= 0.75 ? 'media' : 'baja';
  return { st, tested, run, fat, str, rec, sim, P, w, cover, hpi, conf, missing: keys.filter(k => !P[k]) };
}

/* ---------- Cuello de botella ---------- */
/**
 * Compara cada parte contra TU propio nivel (la mediana de tus puntajes): la parte que más
 * segundos te cuesta por encima de lo que tu nivel predice es el cuello de botella.
 */
function hxBottleneck(perf) {
  perf = perf || hxPerformance();
  const scores = perf.tested.map(s => perf.st[s.k].s).concat(perf.run ? [perf.P.run.s] : []).sort((a, b) => a - b);
  if (scores.length < 4) return null;
  const med = scores[Math.floor(scores.length / 2)], items = [];
  perf.tested.forEach(s => { const x = perf.st[s.k]; items.push({ k: s.k, n: s.n, lost: x.sec - hxTimeAt(s.k, med), s: x.s, why: `${hxT(x.sec)} medido; a tu nivel general esperaríamos ${hxT(hxTimeAt(s.k, med))}.` }); });
  if (perf.run) items.push({ k: 'run', n: 'Running fresco', lost: (perf.run.sec - hxTimeAt('run1k', med)) * 8, s: perf.P.run.s, why: `1 km en ${hxT(perf.run.sec)} se repite 8 veces en la carrera.` });
  if (perf.fat) {
    const excess = Math.max(0, perf.fat.rdi - 6) / 100 * perf.fat.fresh.sec * 8;   // hasta ~6 % de caída es normal
    items.push({ k: 'comp', n: 'Running bajo fatiga', lost: excess, s: perf.P.fat.s, why: `Tu ritmo cae ${fmt(perf.fat.rdi, 1)} % después de estaciones (referencia del modelo: hasta 6 %).` });
  }
  items.sort((a, b) => b.lost - a.lost);
  const main = items[0] && items[0].lost > 10 ? items[0] : null;
  const second = items[1] && items[1].lost > 10 ? items[1] : null;
  const maint = items.filter(i => i.lost <= 0).map(i => i.n);
  return { med, items, main, second, maint };
}

/* ---------- Predictor ---------- */
/**
 * Tiempo = 8 km (ritmo fresco × (1 + RDI)) + estaciones (medidas aisladas × 1.08 por fatiga de carrera)
 * + Roxzone. Sin 1 km o con menos de 6 estaciones no hay predicción.
 */
function hxPredict(mod) {
  mod = mod || {};
  const perf = hxPerformance();
  if (!perf.run || perf.tested.length < 6) return { ok: false, perf };
  const flags = [];
  let fresh = perf.run.sec - (mod.run || 0);
  let rdi = perf.fat ? perf.fat.rdi : null;
  if (rdi == null) { rdi = 12; flags.push('Caída de ritmo bajo fatiga estimada en 12 % (aún no la mides)'); }
  if (mod.rdi != null) rdi = Math.max(0, rdi - mod.rdi);
  const runT = fresh * (1 + rdi / 100) * 8;
  const med = hxBottleneck(perf) ? hxBottleneck(perf).med : 50;
  let stT = 0, est = 0;
  const parts = HX_STATIONS.map(s => {
    let t, how = 'medido';
    if (perf.st[s.k]) t = perf.st[s.k].sec * 1.08;
    else { t = hxTimeAt(s.k, med) * 1.08; how = 'estimado'; est++; }
    if (mod.st && mod.st[s.k]) { t *= 1 - mod.st[s.k] / 100; how = 'simulado'; }
    stT += t; return { k: s.k, n: s.n, t, how };
  });
  const rox = (hx().roxzone || 7.5 * 60) - (mod.rox || 0);
  if (!hx().roxzone) flags.push('Roxzone (transiciones) estimada en 7:30 en total');
  if (est) flags.push(`${est} estación${est > 1 ? 'es' : ''} estimada${est > 1 ? 's' : ''} con tu nivel general`);
  const total = runT + stT + rox;
  const spread = 0.03 + est * 0.015 + (perf.fat ? 0 : 0.02) + (hx().roxzone ? 0 : 0.01);
  return { ok: true, total, lo: total * (1 - spread), hi: total * (1 + spread), runT, stT, rox, parts, rdi, fresh, flags, spread, perf };
}

/* ---------- Fases y misión de hoy ---------- */
function hxWeeks() { const p = hx().profile; return p && p.date ? Math.ceil(daysBetween(todayStr(), p.date) / 7) : null; }
function hxPhase() {
  const w = hxWeeks();
  if (w == null) return { k: 'found', n: 'Base', why: 'Sin fecha de carrera: construimos base aeróbica y técnica.' };
  if (w < 0) return { k: 'rec', n: 'Recuperación', why: 'Ya pasó tu carrera: 1–2 semanas suaves antes del siguiente bloque.' };
  if (w <= 1) return { k: 'taper', n: 'Taper', why: 'Semana de carrera: menos volumen, algo de intensidad para llegar fresco.' };
  if (w <= 3) return { k: 'perf', n: 'Rendimiento', why: 'Lo más específico: ritmo de carrera y simulaciones parciales.' };
  if (w <= 8) return { k: 'spec', n: 'Preparación específica', why: 'Running bajo fatiga y estaciones al peso de competencia.' };
  if (w <= 14) return { k: 'dev', n: 'Desarrollo', why: 'Umbral, fuerza y estaciones por separado.' };
  return { k: 'found', n: 'Base', why: 'Faltan muchas semanas: base aeróbica, fuerza y técnica.' };
}
/** Sesiones de la metodología. pace(x) devuelve el ritmo por km a partir de tu 1 km fresco. */
function hxSessionLib(pace) {
  const p = f => pace ? hxT(pace * f) + '/km' : (f < 1.15 ? 'ritmo fuerte pero sostenible' : 'ritmo conversacional');
  return {
    comp: { n: 'Running bajo fatiga', goal: 'Mantener el ritmo después de estaciones de piernas.', min: '45–55', blocks: [
      ['Calentamiento', '10 min trote suave + 3 aceleraciones de 20 s'],
      ['Bloque principal ×4', `1 km a ${p(1.12)} → 20 lunges caminando o 15 wall balls → 400 m a ${p(1.12)} · 90 s de descanso`],
      ['Enfriamiento', '8 min trote muy suave'] ], measure: 'Anota el tiempo del último 400 m: es tu ritmo bajo fatiga.' },
    run: { n: 'Umbral', goal: 'Subir el ritmo que puedes sostener sin hundirte.', min: '40–50', blocks: [
      ['Calentamiento', '12 min suave + 4 aceleraciones'],
      ['Bloque principal', `5 × 1 km a ${p(1.08)} · 90 s trotando`],
      ['Enfriamiento', '8 min suave'] ], measure: 'El 5.º km no debe ser más de 5 s más lento que el 1.º.' },
    z2: { n: 'Base aeróbica (zona 2)', goal: 'Construir el motor que sostiene toda la carrera.', min: '40–60', blocks: [
      ['Carrera continua', `40–60 min a ${p(1.35)} (puedes hablar en frases completas)`],
      ['Técnica', '4 × 20 s de cadencia rápida al final'] ], measure: 'Mismo ritmo con menos esfuerzo semana a semana.' },
    station: k => ({ n: 'Dominio de ' + HX_ST[k].n, goal: `Bajar tu tiempo en ${HX_ST[k].n} sin perder técnica.`, min: '40–50', st: k, blocks: [
      ['Calentamiento', '8 min de remo o trote + movilidad de cadera y hombro'],
      ['Técnica', HX_ST[k].tip],
      ['Bloque principal', ({ ski: '5 × 250 m al ritmo objetivo · 60 s', push: '6 × 12.5 m al peso de carrera · 75 s', pull: '6 × 12.5 m al peso de carrera · 75 s', bbj: '4 × 20 m continuos · 60 s', row: '5 × 250 m a ritmo objetivo · 60 s', farm: '4 × 50 m sin soltar · 60 s', lunge: '4 × 25 m continuos · 75 s', wb: '5 × 20 reps · 45 s' })[k]],
      ['Enfriamiento', '5 min suave'] ], measure: `Repite la prueba de ${HX_ST[k].n} cada 3–4 semanas, no antes.` }),
    sim: { n: 'Simulación parcial', goal: 'Ensayar ritmo, transiciones y estrategia.', min: '50–70', blocks: [
      ['Calentamiento', '12 min suave + aceleraciones'],
      ['Simulación', `4 × (1 km a ${p(1.10)} + estación al peso de carrera): SkiErg, Sled push, Row, Wall balls`],
      ['Enfriamiento', '10 min suave'] ], measure: 'Registra el tiempo total y cada km para ver tu caída real.' },
    taper: { n: 'Activación pre-carrera', goal: 'Llegar fresco y con el ritmo en la cabeza.', min: '25–30', blocks: [
      ['Trote', '15 min suave'], ['Ritmo', `3 × 400 m a ${p(1.05)} · 2 min`], ['Estaciones', '5 wall balls + 10 m de sled ligero'] ], measure: 'Debes terminar con ganas de más.' },
    recov: { n: 'Recuperación activa', goal: 'Moverte sin sumar fatiga.', min: '20–30', blocks: [
      ['Movimiento suave', '20–30 min caminando, bici o remo muy suave'], ['Movilidad', 'Cadera, tobillo y columna torácica 10 min'] ], measure: 'Sin cansancio al terminar.' }
  };
}
function hxMission() {
  const perf = hxPerformance(), bn = hxBottleneck(perf), ph = hxPhase(), lib = hxSessionLib(perf.run && perf.run.sec);
  const rd = typeof readiness === 'function' ? readiness() : null, changes = [];
  const missing = HX_STATIONS.filter(s => !perf.st[s.k]);
  let ses, why, type;
  if (rd && rd.score < 55) { ses = lib.recov; type = 'recov'; why = 'Tu chequeo de hoy muestra poca recuperación; no tiene sentido sumar fatiga.'; changes.push('Cambiada a recuperación por tu chequeo de hoy'); }
  else if (ph.k === 'taper') { ses = lib.taper; type = 'taper'; why = ph.why; }
  else if (!perf.run) return { assess: 'run1k', ph, why: 'Antes de planear necesito tu ritmo fresco: un 1 km a tope, bien calentado.' };
  else if (missing.length >= 3) return { assess: missing[0].k, ph, why: `Te faltan ${missing.length} estaciones por medir. Una por sesión es suficiente; hoy toca ${missing[0].n}.` };
  else if (!perf.fat) return { assess: 'comp', ph, why: 'Falta medir cuánto cae tu ritmo después de una estación: es la diferencia entre entrenar en el gym y correr una carrera.' };
  else if (bn && bn.main) {
    type = bn.main.k === 'comp' ? 'comp' : bn.main.k === 'run' ? (ph.k === 'found' ? 'z2' : 'run') : 'station';
    ses = type === 'station' ? lib.station(bn.main.k) : lib[type];
    if (ph.k === 'perf' && type !== 'station') { ses = lib.sim; type = 'sim'; }
    why = `${bn.main.n} es tu cuello de botella: te cuesta unos ${hxT(bn.main.lost)} por encima de lo que tu nivel general predice. ${bn.main.why}`;
  } else { ses = ph.k === 'found' ? lib.z2 : lib.run; type = ph.k === 'found' ? 'z2' : 'run'; why = 'Sin un punto débil claro: toca subir el motor general.'; }
  // Adaptación: mira la última sesión del mismo tipo.
  const last = hx().sessions.filter(s => s.type === type).slice(-1)[0];
  let adj = 'mantener';
  if (last && type !== 'recov') {
    if (!last.done || last.rpe >= 9) { adj = 'bajar'; changes.push(`La última vez ${!last.done ? 'no completaste la sesión' : 'la sentiste al límite (RPE ' + last.rpe + ')'}: hoy un bloque menos o 3–5 s/km más lento.`); }
    else if (last.rpe <= 6 && (!rd || rd.score >= 70)) { adj = 'subir'; changes.push(`La última vez la completaste con RPE ${last.rpe}${rd ? ' y tu chequeo de hoy sale bien' : ' (sin chequeo de hoy: si te sientes cansado, no subas)'}: suma un bloque o baja 2–3 s/km. Solo una de las dos.`); }
    else changes.push('Misma carga que la última vez: consolidar antes de subir.');
  }
  return { ses, type, why, ph, adj, changes, st: ses && ses.st };
}

/* ---------- Tarjeta en Plan ---------- */
/** Fila de telemetría: solo muestra números que existen; si falta el dato, un guion. */
function hxTelemetry(days) {
  const perf = hxPerformance(), pr = hxPredict();
  return `<div class="hx-tele"><div><b>${perf.hpi != null ? perf.hpi : '—'}</b><small>HPI</small></div><div><b>${pr.ok ? hxT(pr.total) : '—'}</b><small>Predicción</small></div><div><b>${days != null && days >= 0 ? days : '—'}</b><small>Días</small></div></div>`;
}
function hyroxCard() {
  if (!hxOn()) return '';
  const p = hx().profile, w = hxWeeks(), m = hxMission(), act = hx().active;
  const days = p.date ? daysBetween(todayStr(), p.date) : null;
  return `<div class="card keep hx-card"><div class="hx-eyebrow">HYROX LAB · ${esc(m.ph.n.toUpperCase())}${w != null && w >= 0 ? ' · FALTAN ' + w + ' SEM' : ''}</div>
    ${typeof hxt === 'function' && hxt() ? `<h2 style="margin:4px 0">Temporizador en curso</h2><p class="small muted">${esc(HXT_TITLE[hxt().mode])} · ${esc(hxt().segs[hxt().i].n)}</p><button class="block" id="hx-tmr">Volver al temporizador</button>`
    : act ? `<h2 style="margin:4px 0">Sesión en curso</h2><p class="small muted">${esc(act.n)} · empezaste a las ${new Date(act.start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p><button class="block" id="hx-resume">Continuar sesión</button>`
    : m.assess ? `<h2 style="margin:4px 0">Prueba de hoy: ${esc(m.assess === 'run1k' ? '1 km fresco' : m.assess === 'comp' ? 'running bajo fatiga' : HX_ST[m.assess].n)}</h2><p class="small">${esc(m.why)}</p><button class="block" id="hx-test" data-st="${m.assess}">${ico('timer', 18, 'lead')}Cronometrar la prueba</button>`
    : `<h2 style="margin:4px 0">${esc(m.ses.n)}</h2><p class="small muted" style="margin:0 0 6px">${m.ses.min} min · ${esc(m.ses.goal)}</p><p class="small"><b>Por qué hoy:</b> ${esc(m.why)}</p>${m.changes.length ? `<div class="adapt-note">${ico('refresh-cw', 16, 'lead')}${esc(m.changes[0])}</div>` : ''}<button class="block" id="hx-start">Empezar sesión</button>`}
    ${hxTelemetry(days)}
    <div class="row" style="margin-top:4px"><span class="grow"></span><button class="ghost" id="hx-open">Abrir laboratorio →</button></div></div>`;
}
function bindHyrox(root, rerender) {
  const on = (id, f) => { const b = $('#' + id, root); if (b) b.onclick = f; };
  on('hx-open', () => openHyrox());
  on('hx-test', e => hxtForAssess(e.currentTarget.dataset.st));
  on('hx-tmr', () => openHxTimer());
  on('hx-start', () => hxStartSession());
  on('hx-resume', () => openHxSession());
}

/* ---------- Hub ---------- */
function openHyrox() {
  if (!hxOn()) return openHxSetup(openHyrox);
  const perf = hxPerformance(), bn = hxBottleneck(perf), pr = hxPredict(), p = hx().profile, ph = hxPhase();
  const days = p.date ? daysBetween(todayStr(), p.date) : null;
  const doneN = perf.tested.length + (perf.run ? 1 : 0) + (perf.fat ? 1 : 0);
  const items = [
    ['timer', 'timer', 'Temporizador', 'Simulación, estación o 1 km · se guarda solo · contrólalo desde tu reloj'],
    ['watch', 'heart-pulse', 'Mi reloj', DB.watch && DB.watch.hcOn ? 'Mi Fitness conectado' + (DB.watch.hrDev ? ' · pulso en vivo' : '') : 'Mi Fitness, pulso en vivo y control remoto'],
    ['test', 'clipboard-list', 'Escribir un resultado', 'Si ya lo cronometraste en otro lado'],
    ['st', 'layers', 'Las 8 estaciones', `${perf.tested.length} de 8 medidas · técnica, récords y progreso`],
    ['perf', 'trending-up', 'Rendimiento (HPI)', perf.hpi != null ? `${perf.hpi}/100 · confianza ${perf.conf}` : 'Evaluación incompleta'],
    ['race', 'target', 'Predictor y "¿Y si…?"', pr.ok ? `${hxT(pr.lo)} – ${hxT(pr.hi)}` : 'Necesita 1 km y 6 estaciones'],
    ['strat', 'route', 'Estrategia de carrera', 'Ritmos, sets y transiciones con tus datos'],
    ['events', 'calendar', 'Competiciones', 'Encuentra tu carrera y hazla tu objetivo'],
    ['ranks', 'trophy', 'Resultados y rankings', 'Tus carreras y los mejores de México y el mundo'],
    ['method', 'book-open', 'Metodología', 'Fases y sesiones: por qué entrenas lo que entrenas'],
    ['setup', 'sliders-horizontal', 'Mi carrera y perfil', `${HX_CATS[p.cat]} · ${p.sex === 'f' ? 'Mujeres' : 'Hombres'}${p.date ? ' · ' + shortDate(p.date) : ''}`]
  ];
  openModal(`<div class="hx-eyebrow">HYROX LAB · THE SCIENCE OF YOUR NEXT PR</div>
    ${days != null && days >= 0 ? `<div class="hx-count"><b class="t-display-l">${days}</b><span>días para<br>tu carrera</span></div>` : '<h3 style="margin-top:4px">Tu laboratorio</h3>'}
    <div class="hx-kpis"><div><b>${perf.hpi != null ? perf.hpi : '—'}</b><small>HPI</small></div><div><b>${pr.ok ? hxT(pr.total) : '—'}</b><small>Predicción</small></div><div><b>${doneN}/10</b><small>Evaluación</small></div></div>
    ${perf.hpi == null ? `<div class="status info"><b>Evaluación incompleta</b>Falta: ${[!perf.run && '1 km fresco', perf.tested.length < 6 && `${6 - perf.tested.length} estación(es) más`, !perf.fat && 'running bajo fatiga'].filter(Boolean).join(', ') || perf.missing.map(k => HX_PILLAR[k]).join(', ')}. Hazlas en días distintos; no hace falta todo junto.</div>` : ''}
    ${bn && bn.main ? `<div class="hx-bn"><small>CUELLO DE BOTELLA PRINCIPAL</small><b>${esc(bn.main.n)}</b><p class="small">${esc(bn.main.why)}</p>${bn.second ? `<small>SECUNDARIO</small><b class="hx-b2">${esc(bn.second.n)}</b>` : ''}${bn.maint.length ? `<p class="small muted">Mantener: ${esc(bn.maint.join(', '))}</p>` : ''}</div>` : ''}
    <p class="small muted">Fase: <b>${esc(ph.n)}</b>. ${esc(ph.why)}</p>
    <div class="kit-list">${items.map(([k, i, t, s]) => `<button class="kit-item" data-hx="${k}">${ico(i, 22)}<span class="grow"><b>${t}</b><small>${esc(s)}</small></span>${ico('chevron-right', 16)}</button>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">El HPI y las predicciones son modelos internos de la app, no métricas oficiales de HYROX. Sin afiliación con HYROX.</p>
    <button class="ghost block" id="hx-x">Cerrar</button>`, m => {
    const back = openHyrox;
    $$('[data-hx]', m).forEach(b => b.onclick = () => ({ timer: () => openHxTimerPicker(back), watch: () => openWatch(), test: () => openHxTestPicker(back), st: () => openHxStations(back), perf: () => openHxPerf(back), race: () => openHxPredict(back), strat: () => openHxStrategy(back), method: () => openHxMethod(back), events: () => openEvents(), ranks: () => openHxRanks(back), setup: () => openHxSetup(back) })[b.dataset.hx]());
    $('#hx-x', m).onclick = () => { closeModal(); rerenderHx(); };
  });
}
function rerenderHx() { if (typeof render === 'function' && typeof currentTab !== 'undefined') render(currentTab); }

/* ---------- Perfil del atleta ---------- */
function openHxSetup(after) {
  const p = Object.assign({ cat: 'open', sex: 'm', date: '', goal: '', equip: 'gym', days: 4, exp: 'nuevo', inj: '' }, hx().profile || {});
  const opt = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${n}</option>`).join('');
  openModal(`<h3>Mi carrera HYROX</h3><p class="small muted" style="margin-top:0">Con esto la app planea tus semanas y ajusta las cargas de referencia.</p>
    <label>Categoría<select id="hs-cat">${opt(HX_CATS, p.cat)}</select></label>
    <label>División<select id="hs-sex">${opt({ m: 'Hombres', f: 'Mujeres' }, p.sex)}</select></label>
    <label>Fecha de la carrera (opcional)<input id="hs-date" type="date" value="${esc(p.date)}"></label>
    <label>Tiempo objetivo (h:mm:ss, opcional)<input id="hs-goal" inputmode="numeric" placeholder="1:15:00" value="${p.goal ? hxT(p.goal) : ''}"></label>
    <label>Experiencia en HYROX<select id="hs-exp">${opt({ nuevo: 'Nunca he competido', una: '1–2 carreras', varias: '3 o más' }, p.exp)}</select></label>
    <label>Dónde entrenas<select id="hs-eq">${opt(HX_EQUIP, p.equip)}</select></label>
    <label>Días por semana para HYROX<select id="hs-days">${[2, 3, 4, 5, 6].map(d => `<option${d === p.days ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
    <label>Lesiones o restricciones (opcional)<input id="hs-inj" value="${esc(p.inj)}" placeholder="Ej. rodilla derecha"></label>
    <p class="small muted">Las categorías por edad y las cargas cambian por temporada: confírmalas en el reglamento vigente.</p>
    <div class="row"><button class="secondary" id="hs-c" style="flex:1">Cancelar</button><button id="hs-s" style="flex:1">Guardar</button></div>`, m => {
    $('#hs-c', m).onclick = () => hxOn() ? after() : closeModal();
    $('#hs-s', m).onclick = () => {
      hx().profile = Object.assign(hx().profile || {}, { cat: $('#hs-cat', m).value, sex: $('#hs-sex', m).value, date: $('#hs-date', m).value || '', goal: hxParse($('#hs-goal', m).value), exp: $('#hs-exp', m).value, equip: $('#hs-eq', m).value, days: Number($('#hs-days', m).value), inj: $('#hs-inj', m).value.trim() });
      saveData(); rerenderHx(); after();
    };
  });
}

/* ---------- Registro de pruebas ---------- */
function openHxTestPicker(back) {
  const opts = [['run1k', '1 km fresco', 'Bien calentado, a tope'], ['comp', 'Running bajo fatiga', '1 km justo después de una estación'], ...HX_STATIONS.map(s => [s.k, s.n, s.d]), ['sim', 'Simulación', 'Parcial o completa, tiempo total']];
  openModal(`<h3>Registrar una prueba</h3><div class="kit-list">${opts.map(([k, n, d]) => `<button class="kit-item" data-t="${k}"><span class="grow"><b>${n}</b><small>${d}</small></span>${ico('chevron-right', 16)}</button>`).join('')}</div>
    <button class="ghost block" id="tp-x">← Volver</button>`, m => {
    $$('[data-t]', m).forEach(b => b.onclick = () => openHxTest(b.dataset.t, null, () => openHxTestPicker(back)));
    $('#tp-x', m).onclick = back;
  });
}
function openHxTest(kind, rerender, back) {
  const isSt = !!HX_ST[kind], st = isSt ? HX_ST[kind] : null, p = hx().profile || {};
  const title = isSt ? st.n + ' · ' + st.d : { run1k: '1 km fresco', comp: 'Running bajo fatiga', sim: 'Simulación' }[kind];
  const ref = isSt && st.load && HX_LOADS[p.cat === 'pro' ? 'pro' : 'open'][p.sex === 'f' ? 'f' : 'm'][kind];
  const pred = kind === 'sim' ? hxPredict() : null;
  const help = { run1k: 'Calienta 10–15 min con 3 aceleraciones. Luego 1 km lo más rápido que puedas sostener. Pista, calle plana o caminadora al 1 %.',
    comp: 'Haz una estación (o un bloque de piernas) y corre 1 km de inmediato al máximo sostenible. Compara condiciones parecidas a tu 1 km fresco.',
    sim: pred && pred.ok ? `Si haces la carrera completa, tu predicción actual es ${hxT(pred.total)}. Para una parcial, anota tu tiempo y lo que hiciste.` : 'Anota el tiempo total y qué incluiste.' }[kind] || st.tip;
  openModal(`<h3>${esc(title)}</h3><p class="small muted" style="margin-top:0">${esc(help)}</p>
    ${ref ? `<p class="small">Carga de referencia (${HX_CATS[p.cat] || 'Open'}): <b>${ref}</b>. Si usas otra, anótala: el récord se marcará como no comparable.</p>` : ''}
    ${kind !== 'sim' ? `<button class="block" id="ht-timer">${ico('timer', 18, 'lead')}Cronometrar ahora</button><p class="small muted" style="text-align:center;margin:8px 0">o escribe el tiempo si ya lo hiciste</p>` : ''}
    <label>Tiempo (m:ss)<input id="ht-t" inputmode="numeric" placeholder="4:10"></label>
    ${isSt && st.load ? `<label>Carga usada (opcional)<input id="ht-l" placeholder="${ref ? esc(ref) : ''}"></label>` : ''}
    ${kind === 'comp' ? `<label>Después de qué estación<select id="ht-after">${HX_STATIONS.map(s => `<option value="${s.k}">${s.n}</option>`).join('')}<option value="otro">Otro bloque de piernas</option></select></label>` : ''}
    ${isSt ? `<label class="chk"><input type="checkbox" id="ht-std" checked> Distancia y carga de competencia</label>` : ''}
    <label>Esfuerzo (RPE 1–10)<input id="ht-rpe" type="range" min="1" max="10" value="9"><small class="muted" id="ht-rv">9</small></label>
    <label>Notas (opcional)<input id="ht-n" placeholder="Pausas, sensaciones, técnica"></label>
    <div class="row"><button class="secondary" id="ht-c" style="flex:1">${back ? '← Volver' : 'Cancelar'}</button><button id="ht-s" style="flex:1">Guardar</button></div>`, m => {
    $('#ht-rpe', m).oninput = e => { $('#ht-rv', m).textContent = e.target.value; };
    const tb = $('#ht-timer', m); if (tb) tb.onclick = () => hxtForAssess(kind);
    $('#ht-c', m).onclick = () => back ? back() : closeModal();
    $('#ht-s', m).onclick = () => {
      const sec = hxParse($('#ht-t', m).value);
      if (!sec) { toast('Escribe el tiempo, por ejemplo 4:10'); return; }
      const prevBest = hxBest(isSt ? 'st' : kind, isSt ? kind : undefined);
      const r = { id: 'hx' + Date.now(), kind: isSt ? 'st' : kind, st: isSt ? kind : undefined, sec, date: todayStr(), t: Date.now(), rpe: Number($('#ht-rpe', m).value), note: $('#ht-n', m).value.trim() };
      if ($('#ht-l', m) && $('#ht-l', m).value.trim()) r.load = $('#ht-l', m).value.trim();
      if (isSt) r.std = $('#ht-std', m).checked;
      if (kind === 'comp') r.after = $('#ht-after', m).value;
      if (kind === 'sim' && pred && pred.ok) r.pred = Math.round(pred.total);
      hx().results.push(r); saveData();
      const pr = prevBest && sec < prevBest.sec && (!isSt || (r.std && prevBest.std !== false));
      hxResultSheet(r, prevBest, pr, rerender);
    };
  });
}
function hxResultSheet(r, prev, pr, rerender) {
  const isSt = r.kind === 'st', name = isSt ? HX_ST[r.st].n : { run1k: '1 km fresco', comp: 'Running bajo fatiga', sim: 'Simulación' }[r.kind];
  const lines = [];
  if (r.kind === 'comp') {
    const fr = hxCurrent('run1k');
    if (fr) { const rdi = hxRDI(fr.sec, r.sec); lines.push(['Qué aprendimos', `Tu ritmo cayó ${fmt(rdi, 1)} % contra tu 1 km fresco (${hxT(fr.sec)}). ${rdi <= 6 ? 'Está dentro de lo que el modelo considera bueno.' : rdi <= 12 ? 'Hay margen: el running bajo fatiga vale la pena entrenarlo.' : 'Es una caída grande: probablemente sea tu mayor oportunidad.'} El índice compara condiciones parecidas; el clima, la superficie y el cansancio previo lo afectan.`]); }
    else lines.push(['Qué falta', 'Registra un 1 km fresco para calcular cuánto cae tu ritmo (RDI).']);
  }
  lines.unshift(['Qué hiciste', `${name} en ${hxT(r.sec)}${r.load ? ' con ' + r.load : ''} · RPE ${r.rpe}${isSt && !r.std ? ' · condiciones distintas a competencia' : ''}.`]);
  if (prev) lines.push(['Qué mejoraste', r.sec < prev.sec ? `${hxT(prev.sec - r.sec)} más rápido que tu mejor marca (${hxT(prev.sec)}).` : `Tu mejor marca sigue siendo ${hxT(prev.sec)} (${hxT(r.sec - prev.sec)} de diferencia). Un día no define tu nivel: cuenta el mejor de tus últimas 3 pruebas.`]);
  if (isSt) {
    const target = Math.round(Math.min(r.sec, prev ? prev.sec : r.sec) * 0.97);
    lines.push(['Siguiente objetivo', `${hxT(target)} (−3 %). Vuelve a probar en 3–4 semanas; entre pruebas, entrena la estación sin ir al máximo.`]);
  }
  openModal(`<h3>${pr ? 'Nuevo récord personal' : 'Prueba guardada'}</h3>
    ${lines.map(([t, x]) => `<div class="pg-rec"><b>${t}</b><small>${esc(x)}</small></div>`).join('')}
    <button class="block" id="hr-ok">Listo</button>`, m => { $('#hr-ok', m).onclick = () => { closeModal(); rerenderHx(); if (rerender) rerender(); }; });
}

/* ---------- Estaciones ---------- */
function openHxStations(back) {
  const perf = hxPerformance();
  openModal(`<h3>Las 8 estaciones</h3><p class="small muted" style="margin-top:0">Puntaje del modelo interno: 0 principiante · 100 élite. Usa el mejor de tus últimas 3 pruebas.</p>
    <div class="kit-list">${HX_STATIONS.map((s, i) => { const x = perf.st[s.k]; return `<button class="kit-item" data-s="${s.k}"><span class="hx-n">${String(i + 1).padStart(2, '0')}</span><span class="grow"><b>${s.n} · ${s.d}</b><small>${x ? hxT(x.sec) + ' · puntaje ' + x.s : 'Sin medir'}</small></span>${x ? `<span class="hx-bar"><i style="width:${x.s}%"></i></span>` : ''}${ico('chevron-right', 16)}</button>`; }).join('')}</div>
    <button class="ghost block" id="hst-x">← Volver</button>`, m => {
    $$('[data-s]', m).forEach(b => b.onclick = () => openHxStation(b.dataset.s, () => openHxStations(back)));
    $('#hst-x', m).onclick = back;
  });
}
function openHxStation(k, back) {
  const s = HX_ST[k], rs = hxResults('st', k).slice().reverse(), best = hxBest('st', k), p = hx().profile || {};
  const ref = s.load && HX_LOADS[p.cat === 'pro' ? 'pro' : 'open'][p.sex === 'f' ? 'f' : 'm'][k];
  openModal(`<h3>${s.n} · ${s.d}</h3>
    ${best ? `<div class="hx-kpis"><div><b>${hxT(best.sec)}</b><small>Récord</small></div><div><b>${hxScore(k, hxCurrent('st', k).sec)}</b><small>Puntaje</small></div><div><b>${rs.length}</b><small>Pruebas</small></div></div>` : '<div class="status info"><b>Sin medir</b>Registra una prueba para ver tu nivel y tu objetivo.</div>'}
    ${ref ? `<p class="small">Carga de competencia: <b>${ref}</b></p>` : ''}
    <div class="pg-rec"><b>Técnica</b><small>${esc(s.tip)}</small></div>
    <div class="pg-rec"><b>Errores frecuentes</b><small>${esc(s.err.join(' · '))}</small></div>
    ${rs.length ? `<div class="rir-label"><span>Historial</span></div><table class="small"><tbody>${rs.slice(0, 8).map(r => `<tr><td>${shortDate(r.date)}</td><td><b>${hxT(r.sec)}</b></td><td>RPE ${r.rpe}</td><td>${r.std === false ? 'no comparable' : r.load ? esc(r.load) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <button class="block" id="hs1-t">Registrar prueba</button><button class="ghost block" id="hs1-x">← Volver</button>`, m => {
    $('#hs1-t', m).onclick = () => openHxTest(k, null, () => openHxStation(k, back));
    $('#hs1-x', m).onclick = back;
  });
}

/* ---------- Rendimiento ---------- */
function openHxPerf(back) {
  const perf = hxPerformance(), bn = hxBottleneck(perf);
  openModal(`<h3>Rendimiento</h3>
    <div class="hx-kpis"><div><b>${perf.hpi != null ? perf.hpi : '—'}</b><small>HPI</small></div><div><b>${Math.round(perf.cover * 100)} %</b><small>Datos</small></div><div><b>${perf.hpi != null ? perf.conf : '—'}</b><small>Confianza</small></div></div>
    ${perf.hpi == null ? '<div class="status info"><b>Evaluación incompleta</b>No calculo un índice con menos del 60 % de los datos, ni sin tu 1 km y 4 estaciones. Un número inventado te haría entrenar lo que no es.</div>' : ''}
    ${Object.keys(HX_WEIGHTS).map(k => { const x = perf.P[k]; return `<div class="pg-rec"><div class="row spread"><b>${HX_PILLAR[k]}</b><span class="small muted">${perf.w[k]} %</span></div>${x ? `<span class="hx-bar wide"><i style="width:${x.s}%"></i></span><small>${x.s}/100 · ${esc(x.src)}</small>` : `<small>Sin datos · ${esc({ run: 'registra un 1 km fresco', st: 'mide al menos 4 estaciones', str: 'registra sentadilla o peso muerto en tus entrenos', fat: 'registra un running bajo fatiga', race: 'registra una simulación', rec: 'llena el chequeo diario o entrena 4 veces' }[k])}</small>`}</div>`; }).join('')}
    ${bn ? `<div class="rir-label"><span>Dónde se va tu tiempo</span></div><table class="small"><tbody>${bn.items.map(i => `<tr><td>${esc(i.n)}</td><td>${i.lost > 0 ? '+' + hxT(i.lost) : 'a tu nivel'}</td></tr>`).join('')}</tbody></table><p class="small muted">Cada parte comparada contra tu propio nivel general (mediana de tus puntajes: ${bn.med}). Así no persigues un número arbitrario: atacas lo que más tiempo te cuesta a ti.</p>` : ''}
    <p class="small muted">Fórmula: promedio ponderado de los pilares con datos. Las anclas de cada puntaje son aproximaciones de resultados públicos; es un modelo interno, no una métrica oficial.</p>
    <button class="ghost block" id="hp-x">← Volver</button>`, m => { $('#hp-x', m).onclick = back; });
}

/* ---------- Predictor y ¿Y si…? ---------- */
function openHxPredict(back) {
  const base = hxPredict(), p = hx().profile || {};
  if (!base.ok) {
    openModal(`<h3>Predictor</h3><div class="status info"><b>Aún no hay predicción</b>Necesito tu 1 km fresco y al menos 6 de las 8 estaciones. Ahora tienes ${base.perf.run ? '1 km ✓' : 'sin 1 km'} y ${base.perf.tested.length} estaciones. Prefiero no darte un número falso.</div><button class="ghost block" id="pp-x">← Volver</button>`, m => { $('#pp-x', m).onclick = back; });
    return;
  }
  const row = (k, n, max, unit) => `<label>${n}<input type="range" data-w="${k}" min="0" max="${max}" value="0"><small class="muted" data-wv="${k}">0 ${unit}</small></label>`;
  openModal(`<h3>Predictor</h3>
    <div class="hx-kpis"><div><b>${hxT(base.total)}</b><small>Estimado</small></div><div><b class="sm">${hxT(base.lo)} – ${hxT(base.hi)}</b><small>Rango</small></div></div>
    ${p.goal ? `<p class="small">Tu objetivo: <b>${hxT(p.goal)}</b> · ${base.total <= p.goal ? 'dentro de tu predicción actual.' : 'te faltan ' + hxT(base.total - p.goal) + '.'}</p>` : ''}
    <table class="small hx-tbl"><tbody><tr><td>Running (8 km, ritmo fresco ${hxT(base.fresh)}/km + ${fmt(base.rdi, 1)} % de caída)</td><td><b>${hxT(base.runT)}</b></td></tr>
      ${base.parts.map(x => `<tr><td>${x.n} <span class="hx-tag ${x.how}">${x.how}</span></td><td>${hxT(x.t)}</td></tr>`).join('')}
      <tr><td>Roxzone</td><td>${hxT(base.rox)}</td></tr></tbody></table>
    ${base.flags.length ? `<p class="small muted">${esc(base.flags.join(' · '))}. Las estaciones medidas por separado se multiplican ×1.08 por la fatiga de carrera.</p>` : '<p class="small muted">Las estaciones medidas por separado se multiplican ×1.08 por la fatiga de carrera.</p>'}
    <div class="rir-label"><span>¿Y si…? (simulado)</span></div>
    ${row('run', 'Mejoro mi 1 km', 30, 's')}${row('rdi', 'Reduzco la caída bajo fatiga', 10, 'pts %')}${row('wb', 'Mejoro Wall balls', 20, '%')}${row('push', 'Mejoro Sled push', 20, '%')}${row('ski', 'Mejoro SkiErg', 15, '%')}${row('rox', 'Transiciones más rápidas', 120, 's')}
    <div class="hx-sim"><small>SIMULADO</small><b id="pp-sim">${hxT(base.total)}</b><span id="pp-gain" class="small muted"></span></div>
    <label>Mi Roxzone total real (m:ss, opcional)<input id="pp-rox" value="${hx().roxzone ? hxT(hx().roxzone) : ''}" placeholder="7:30"></label>
    <div class="row"><button class="secondary" id="pp-x" style="flex:1">← Volver</button><button id="pp-s" style="flex:1">Guardar Roxzone</button></div>`, m => {
    const upd = () => {
      const v = k => Number($(`[data-w=${k}]`, m).value);
      $$('[data-wv]', m).forEach(e => { const k = e.dataset.wv; e.textContent = v(k) + ' ' + ({ run: 's', rdi: 'pts %', rox: 's' }[k] || '%'); });
      const sim = hxPredict({ run: v('run'), rdi: v('rdi') || null, rox: v('rox'), st: { wb: v('wb'), push: v('push'), ski: v('ski') } });
      $('#pp-sim', m).textContent = hxT(sim.total);
      $('#pp-gain', m).textContent = base.total - sim.total > 1 ? '−' + hxT(base.total - sim.total) : '';
    };
    $$('[data-w]', m).forEach(i => i.oninput = upd);
    $('#pp-x', m).onclick = back;
    $('#pp-s', m).onclick = () => { const r = hxParse($('#pp-rox', m).value); hx().roxzone = r; saveData(); openHxPredict(back); };
  });
}

/* ---------- Estrategia ---------- */
function openHxStrategy(back) {
  const pr = hxPredict(), perf = pr.perf || hxPerformance(), p = hx().profile || {};
  if (!perf.run) { openModal(`<h3>Estrategia</h3><div class="status info"><b>Sin datos suficientes</b>La estrategia sale de tus ritmos y estaciones. Empieza por un 1 km fresco.</div><button class="ghost block" id="sg-x">← Volver</button>`, m => { $('#sg-x', m).onclick = back; }); return; }
  const racePace = pr.ok ? pr.runT / 8 : perf.run.sec * 1.18;
  const tips = [];
  tips.push(['Ritmo de running', `Objetivo ${hxT(racePace)}/km. Km 1 no más rápido que ${hxT(racePace * 0.98)}: la adrenalina de la salida es la trampa más común.`]);
  if (perf.fat && perf.fat.rdi > 10) tips.push(['Después de lunges y sled', `Tu ritmo cae ${fmt(perf.fat.rdi, 0)} % bajo fatiga: los primeros 200 m después de cada estación, trota suave para recuperar, luego sube.`]);
  const wb = perf.st.wb;
  tips.push(['Wall balls', wb ? (wb.s < 50 ? 'Sets de 10 con 5–8 s de descanso desde el inicio. No vayas al fallo: un set roto te cuesta más que las pausas planeadas.' : 'Sets de 20–25 con descansos de 5 s; reduce a 15 si el ritmo se rompe.') : 'Mídelas antes de decidir sets; por defecto, sets de 15 con descansos cortos.']);
  const push = perf.st.push, pull = perf.st.pull;
  tips.push(['Sled', (push && push.s < 45) || (pull && pull.s < 45) ? 'Es tu zona de riesgo: pasos cortos sin parar, aunque sea lento. Planea 2 micro-pausas como máximo.' : 'Sin pausas: ritmo constante de principio a fin.']);
  const farm = perf.st.farm;
  tips.push(['Farmers carry', farm && farm.s < 50 ? 'Suelta antes de que se abra la mano (a los 100 m) y recupera 5 s: fallar el agarre cuesta más.' : 'Sin soltar si tu agarre lo permite.']);
  tips.push(['Transiciones', 'Entra a la Roxzone trotando, no caminando. Ya sabes qué estación sigue: no la busques al llegar.']);
  if (p.exp === 'nuevo') tips.push(['Tu primera carrera', 'El objetivo es ejecutar el plan, no el tiempo. Sal 5 s/km más lento de lo que crees.']);
  openModal(`<h3>Estrategia de carrera</h3><p class="small muted" style="margin-top:0">Hecha con tus datos${pr.ok ? '' : ' (sin predicción completa todavía)'}; se actualiza con cada prueba.</p>
    ${tips.map(([t, x]) => `<div class="pg-rec"><b>${t}</b><small>${esc(x)}</small></div>`).join('')}
    <div class="pg-rec"><b>Combustible</b><small>Desayuno con carbohidratos 2–3 h antes, que ya hayas probado. Agua con electrolitos los días previos. Para carreras de más de 75 min, un gel o bebida con carbohidratos a la mitad si ya lo ensayaste.</small></div>
    <button class="ghost block" id="sg-x">← Volver</button>`, m => { $('#sg-x', m).onclick = back; });
}

/* ---------- Metodología ---------- */
function openHxMethod(back) {
  const ph = hxPhase(), lib = hxSessionLib(hxCurrent('run1k') && hxCurrent('run1k').sec);
  const phases = [['found', 'Base', 'Motor aeróbico, fuerza y técnica de estaciones.'], ['dev', 'Desarrollo', 'Umbral y estaciones por separado.'], ['spec', 'Preparación específica', 'Running bajo fatiga y cargas de competencia.'], ['perf', 'Rendimiento', 'Simulaciones y ritmo de carrera.'], ['taper', 'Taper', 'Menos volumen, misma intensidad.'], ['rec', 'Recuperación', 'Suave después de competir.']];
  const ses = [lib.z2, lib.run, lib.comp, lib.sim, lib.taper, lib.recov];
  openModal(`<h3>Metodología</h3><p class="small muted" style="margin-top:0">Ninguna sesión es aleatoria: cada una tiene un objetivo, una forma de medirla y una regla para progresar o retroceder. La duración de cada fase depende de tu fecha, no de un plan fijo de 16 semanas.</p>
    ${phases.map(([k, n, d]) => `<div class="pg-rec${k === ph.k ? ' hx-now' : ''}"><b>${n}${k === ph.k ? ' · ahora' : ''}</b><small>${d}</small></div>`).join('')}
    <div class="rir-label"><span>Sesiones</span></div>
    ${ses.map(s => `<div class="pg-rec"><b>${s.n} · ${s.min} min</b><small>${esc(s.goal)} ${esc(s.measure)}</small></div>`).join('')}
    <div class="pg-rec"><b>Reglas de progresión</b><small>Sube una sola variable cuando completas la sesión con RPE ≤ 6 y te recuperaste bien. Mantén si fue RPE 7–8. Baja un bloque si no la completaste o fue RPE 9–10. Recuperación activa si tu chequeo del día sale bajo.</small></div>
    <button class="ghost block" id="hm-x">← Volver</button>`, m => { $('#hm-x', m).onclick = back; });
}

/* ---------- Ejecución de la sesión (persistente) ---------- */
function hxStartSession() {
  const m = hxMission();
  if (!m.ses) return;
  hx().active = { id: 'hs' + Date.now(), type: m.type, n: m.ses.n, st: m.st || null, blocks: m.ses.blocks.map(b => ({ t: b[0], d: b[1], done: false, skip: false })), measure: m.ses.measure, start: Date.now(), paused: null, pausedMs: 0, adj: m.adj, why: m.why, changes: m.changes };
  saveData(); openHxSession();
}
function hxElapsed(a) { return Math.max(0, ((a.paused || Date.now()) - a.start - a.pausedMs) / 1000); }
let hxTick = null;
function openHxSession() {
  const a = hx().active;
  if (!a) return;
  openModal(`<div class="hx-eyebrow">SESIÓN EN CURSO</div><h3 style="margin-top:4px">${esc(a.n)}</h3>
    <div class="hx-clock" id="hx-clk">${hxT(hxElapsed(a))}</div>
    <div class="row" style="justify-content:center;gap:8px;margin-bottom:10px"><button class="secondary" id="hx-pause">${a.paused ? 'Reanudar' : 'Pausar'}</button></div>
    ${a.changes && a.changes.length ? `<div class="adapt-note">${ico('refresh-cw', 16, 'lead')}<span><b>Por qué cambió:</b> ${esc(a.changes.join(' '))}</span></div>` : ''}
    ${a.blocks.map((b, i) => `<div class="hx-block${b.done ? ' done' : ''}${b.skip ? ' skip' : ''}"><div class="grow"><b>${esc(b.t)}</b><small>${esc(b.d)}</small></div><button class="ghost" data-skip="${i}">${b.skip ? 'Retomar' : 'Omitir'}</button><button class="${b.done ? '' : 'secondary'}" data-done="${i}">${b.done ? '✓' : 'Hecho'}</button></div>`).join('')}
    <p class="small muted">${esc(a.measure)}</p>
    <button class="block" id="hx-end">Terminar sesión</button><button class="ghost block" id="hx-min">Minimizar</button>
    <button class="ghost block" id="hx-del" style="color:var(--bad)">Descartar sesión</button>`, m => {
    clearInterval(hxTick);
    hxTick = setInterval(() => { const c = document.getElementById('hx-clk'); if (!c || !hx().active) return clearInterval(hxTick); c.textContent = hxT(hxElapsed(hx().active)); }, 1000);
    $$('[data-done]', m).forEach(b => b.onclick = () => { const x = a.blocks[b.dataset.done]; x.done = !x.done; if (x.done) x.skip = false; saveData(); openHxSession(); });
    $$('[data-skip]', m).forEach(b => b.onclick = () => { const x = a.blocks[b.dataset.skip]; x.skip = !x.skip; if (x.skip) x.done = false; saveData(); openHxSession(); });
    $('#hx-pause', m).onclick = () => { if (a.paused) { a.pausedMs += Date.now() - a.paused; a.paused = null; } else a.paused = Date.now(); saveData(); openHxSession(); };
    $('#hx-min', m).onclick = () => { clearInterval(hxTick); closeModal(); rerenderHx(); };
    $('#hx-del', m).onclick = () => { if (!confirm('¿Descartar esta sesión? No se guardará.')) return; clearInterval(hxTick); hx().active = null; saveData(); closeModal(); rerenderHx(); };
    $('#hx-end', m).onclick = () => hxFinish();
  });
}
function hxFinish() {
  const a = hx().active;
  openModal(`<h3>Terminar sesión</h3>
    <label>Esfuerzo de la sesión (RPE 1–10)<input id="hf-rpe" type="range" min="1" max="10" value="7"><small class="muted" id="hf-rv">7</small></label>
    <label>Resultado medible (opcional, m:ss)<input id="hf-res" inputmode="numeric" placeholder="Ej. último 400 m o tiempo total"></label>
    <label>Notas<input id="hf-n" placeholder="Cómo te sentiste"></label>
    <div class="row"><button class="secondary" id="hf-c" style="flex:1">Volver</button><button id="hf-s" style="flex:1">Guardar</button></div>`, m => {
    $('#hf-rpe', m).oninput = e => { $('#hf-rv', m).textContent = e.target.value; };
    $('#hf-c', m).onclick = openHxSession;
    $('#hf-s', m).onclick = () => {
      clearInterval(hxTick);
      const main = a.blocks.filter(b => !/calentamiento|enfriamiento/i.test(b.t)), done = main.every(b => b.done);
      const s = { id: a.id, type: a.type, n: a.n, st: a.st, date: todayStr(), start: a.start, dur: Math.round(hxElapsed(a)), rpe: Number($('#hf-rpe', m).value), done, completed: a.blocks.filter(b => b.done).length, total: a.blocks.length, res: hxParse($('#hf-res', m).value), note: $('#hf-n', m).value.trim(), adj: a.adj };
      const prev = hx().sessions.filter(x => x.type === s.type).slice(-1)[0];
      hx().sessions.push(s); hx().active = null;
      if (typeof track === 'function') track('hyrox_session');
      saveData(); hxSummary(s, prev);
    };
  });
}
function hxSummary(s, prev) {
  const next = hxMission();
  const L = [['Qué hiciste', `${s.n}: ${s.completed} de ${s.total} bloques en ${hxT(s.dur)} · RPE ${s.rpe}.`]];
  if (prev) L.push(['Qué mejoraste', prev.res && s.res ? (s.res < prev.res ? `Tu resultado medible bajó de ${hxT(prev.res)} a ${hxT(s.res)}.` : `Resultado ${hxT(s.res)} vs ${hxT(prev.res)} la vez anterior: se mantiene; normal entre pruebas.`) : `La vez anterior: RPE ${prev.rpe}${prev.done ? '' : ', incompleta'}. Hoy: RPE ${s.rpe}${s.done ? '' : ', incompleta'}.`]);
  L.push(['Qué aprendimos', !s.done ? 'No completaste el bloque principal: la próxima vez de este tipo baja un bloque. No es retroceder, es ajustar la carga a tu estado.' : s.rpe <= 6 ? 'Te sobró margen: la próxima vez de este tipo sube una variable (un bloque o 2–3 s/km).' : s.rpe >= 9 ? 'Fue al límite: la próxima vez repetimos la carga en lugar de subirla.' : 'Carga adecuada: consolidar una vez más antes de subir.']);
  L.push(['Siguiente objetivo', next.assess ? `Próxima prueba: ${next.assess === 'run1k' ? '1 km fresco' : next.assess === 'comp' ? 'running bajo fatiga' : HX_ST[next.assess].n}.` : `Próxima sesión: ${next.ses.n}. ${next.why}`]);
  openModal(`<div class="hx-eyebrow">SESIÓN COMPLETA</div><h3 style="margin-top:4px">${esc(s.n)}</h3>${L.map(([t, x]) => `<div class="pg-rec"><b>${t}</b><small>${esc(x)}</small></div>`).join('')}<button class="block" id="hsum-ok">Listo</button>`, m => { $('#hsum-ok', m).onclick = () => { closeModal(); rerenderHx(); }; });
}

/* ---------- 27.0 · HYROX Lab como día de tu rutina ---------- */
/** Pone en ese día de la semana la sesión que decide el laboratorio (un solo entreno reutilizable). */
function assignHyroxDay(k) {
  let w = DB.workouts.find(x => x.hyrox);
  if (!w) { w = { id: uid(), name: 'HYROX Lab', ex: [], hyrox: true, fam: '__hyrox' }; DB.workouts.push(w); }
  DB.plan[k] = w.id;
  DB.profile.trainDays = DB.plan.map((x, j) => x ? j : null).filter(x => x != null); DB.profile.weeklyTarget = Math.max(1, DB.profile.trainDays.length);
  saveData();
}
/** Misión de Hoy en un día HYROX: la sesión (o prueba) que decide el laboratorio. */
function hyroxHero() {
  if (!hxOn()) return `<div class="hero"><div class="eyebrow">HYROX Lab · hoy</div><h3>Configura tu carrera</h3><p>Hoy toca HYROX. Dime tu categoría y fecha para decidir la sesión correcta.</p><button id="hx-open">Configurar HYROX Lab</button></div>`;
  const m = hxMission(), a = hx().active;
  if (a) return `<div class="hero"><div class="eyebrow">HYROX Lab · sesión en curso</div><h3>${esc(a.n)}</h3><p>${hxT(hxElapsed(a))} transcurridos</p><button id="hx-resume">Continuar sesión</button></div>`;
  if (typeof hxt === 'function' && hxt()) return `<div class="hero"><div class="eyebrow">HYROX Lab · temporizador en curso</div><h3>${esc(hxt().segs[hxt().i].n)}</h3><p>${esc(HXT_TITLE[hxt().mode])}</p><button id="hx-tmr">Volver al temporizador</button></div>`;
  if (m.assess) return `<div class="hero"><div class="eyebrow">HYROX Lab · prueba de hoy</div><h3>${esc(m.assess === 'run1k' ? '1 km fresco' : m.assess === 'comp' ? 'Running bajo fatiga' : HX_ST[m.assess].n)}</h3><p>${esc(m.why)}</p><button id="hx-test" data-st="${m.assess}">${ico('timer', 18)} Cronometrar la prueba</button></div>`;
  return `<div class="hero"><div class="eyebrow">HYROX Lab · ${esc(m.ph.n)}</div><h3>${esc(m.ses.n)}</h3><p>${m.ses.min} min · ${esc(m.why)}</p><button id="hx-start">${ico('play', 18)} Empezar sesión</button></div>`;
}

/** Abre el temporizador listo para la prueba que toca (sin escribir tiempos). */
function hxtForAssess(k) {
  if (typeof hxt === 'function' && hxt()) return openHxTimer();
  if (k === 'run1k') hxtCreate('run1k');
  else if (k === 'comp') hxtPickStation('comp', () => closeModal());
  else if (HX_ST[k]) hxtCreate('station', k);
}
