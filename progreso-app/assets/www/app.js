'use strict';
/* Mi Progreso 2.0 — lógica de la app. Contenido en data.js, estilos en styles.css. */

/* ------------------------------------------------------------------ *
 *  Utilidades
 * ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const fmt = (n, d = 1) => n == null || !isFinite(n) ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n, d = 1) => n == null ? '—' : (n > 0 ? '+' : '') + fmt(n, d);
const round10 = n => Math.round(n / 10) * 10;
const kgFmt = w => fmt(w, w % 1 ? 1 : 0);

function todayStr() { return dateStr(new Date()); }
function dateStr(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function longDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

const bridge = window.AndroidBridge || null;
function vibrate(ms) {
  try {
    if (bridge && bridge.vibrate) bridge.vibrate(ms);
    else if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) {}
}
function keepScreenOn(on) { try { if (bridge && bridge.keepScreenOn) bridge.keepScreenOn(!!on); } catch (e) {} }

/* ------------------------------------------------------------------ *
 *  Datos (localStorage) y fotos (IndexedDB)
 * ------------------------------------------------------------------ */
const KEY = 'miprogreso.v1';   // misma clave desde la 1.0: los datos se conservan al actualizar

function defaultProfile() {
  return {
    name: '', height: 180, age: 29,
    startWeight: 88, startDate: '2026-10-09', goalWeight: 81,
    phase: 'definicion', somatotype: 'meso',
    autoMacros: true, kcal: 2300, protein: 175,
    steps: 9000, waterGoal: 3000, sugarMax: 35,
    routine: 'pro', habitsStart: todayStr()
  };
}
function defaultData() {
  return {
    version: 2,
    profile: defaultProfile(),
    days: { '2026-10-09': { weight: 88 } },
    measures: [], lifts: [], sessions: [],
    active: null, pwo: null,
    custom: { name: 'Mi rutina', desc: 'Rutina creada por ti.', days: [] },
    units: {}, achievements: []
  };
}

let DB;
function loadData() {
  const def = defaultData();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return {
        version: 2,
        profile: Object.assign(defaultProfile(), d.profile || {}),
        days: d.days || {},
        measures: d.measures || [],
        lifts: d.lifts || [],
        sessions: d.sessions || [],
        active: d.active || null,
        pwo: d.pwo || null,
        custom: d.custom || def.custom,
        units: d.units || {},
        achievements: d.achievements || []
      };
    }
  } catch (e) { console.error(e); }
  return def;
}
function saveData() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { toast('No se pudo guardar: ' + e.message); }
}
function day(date) { return DB.days[date] || (DB.days[date] = {}); }

const photoStore = (() => {
  let dbp;
  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('miprogreso-fotos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode);
      const out = fn(t.objectStore('photos'));
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    all: () => tx('readonly', s => s.getAll()).then(list => (list || []).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0))),
    put: p => tx('readwrite', s => s.put(p)),
    del: id => tx('readwrite', s => s.delete(id)),
    clear: () => tx('readwrite', s => s.clear())
  };
})();

/* ------------------------------------------------------------------ *
 *  Peso
 * ------------------------------------------------------------------ */
function weightEntries() {
  return Object.keys(DB.days).filter(d => DB.days[d].weight != null).sort().map(d => ({ date: d, w: DB.days[d].weight }));
}
function weekAvg(end) {
  const start = addDays(end, -6);
  const vals = weightEntries().filter(e => e.date >= start && e.date <= end).map(e => e.w);
  return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
}
function movingAvg(entries) { return entries.map(e => { const a = weekAvg(e.date); return { date: e.date, y: a ? a.avg : e.w }; }); }
function currentWeight() {
  const w = weekAvg(todayStr());
  if (w) return w.avg;
  const all = weightEntries();
  return all.length ? all[all.length - 1].w : DB.profile.startWeight;
}
function weeklyRates() {
  const t = todayStr();
  const w0 = weekAvg(t), w1 = weekAvg(addDays(t, -7)), w2 = weekAvg(addDays(t, -14));
  return { w0, w1, w2, r1: w0 && w1 ? w0.avg - w1.avg : null, r2: w1 && w2 ? w1.avg - w2.avg : null };
}
function weightAdvice() {
  const p = DB.profile;
  const { r1, r2, w0 } = weeklyRates();
  if (r1 == null) return { cls: 'info', title: 'Faltan datos', text: 'Pésate cada mañana en ayunas. Con 2 semanas de registros te digo si vas al ritmo correcto.' };
  const pct = w0 ? (r1 / w0.avg) * 100 : 0;
  if (p.phase === 'definicion') {
    const loss = -r1, prev = r2 == null ? null : -r2;
    if (loss > 1.0) return { cls: 'bad', title: 'Bajas demasiado rápido', text: `Perdiste ${fmt(loss)} kg esta semana. Por encima de 1 kg/sem arriesgas músculo: suma ~150 kcal (sobre todo carbohidratos).` };
    if (loss < 0.4 && prev != null && prev < 0.4) return { cls: 'warn', title: '2 semanas por debajo del ritmo', text: 'Quita 150–200 kcal (de carbohidratos) o suma ~2,000 pasos diarios.' };
    if (loss < 0.4) return { cls: 'warn', title: 'Semana lenta', text: `Bajaste ${fmt(loss)} kg (${fmt(-pct)} %). Si la próxima semana se repite, toca ajustar.` };
    return { cls: 'good', title: 'Vas bien', text: `Bajaste ${fmt(loss)} kg esta semana (${fmt(-pct)} % de tu peso). El ritmo ideal es 0.5–0.8 kg/sem.` };
  }
  if (p.phase === 'volumen') {
    if (r1 > 0.25) return { cls: 'warn', title: 'Subes rápido', text: `Ganaste ${fmt(r1)} kg esta semana. Para que sea músculo y no grasa, quita ~150 kcal (meta: 0.25–0.5 kg al mes).` };
    if (r1 < 0 && r2 != null && r2 < 0) return { cls: 'warn', title: 'No estás subiendo', text: 'Dos semanas bajando de peso en volumen: suma ~150 kcal.' };
    return { cls: 'good', title: 'Vas bien', text: `Cambio esta semana: ${signed(r1)} kg. Meta: subir 0.25–0.5 kg al mes.` };
  }
  if (Math.abs(r1) > 0.4) return { cls: 'warn', title: 'Te mueves del mantenimiento', text: `Cambio esta semana: ${signed(r1)} kg. Ajusta ±150 kcal.` };
  return { cls: 'good', title: 'Manteniendo', text: `Cambio esta semana: ${signed(r1)} kg.` };
}
function projection() {
  const p = DB.profile, cur = currentWeight(), t = todayStr();
  const now = weekAvg(t), p3 = weekAvg(addDays(t, -21)), past = p3 || weekAvg(addDays(t, -14));
  if (cur == null || !now || !past) return null;
  const rate = (now.avg - past.avg) / (p3 ? 3 : 2);
  const remaining = p.goalWeight - cur;
  if (Math.abs(remaining) < 0.2) return { done: true };
  if (rate === 0 || Math.sign(rate) !== Math.sign(remaining)) return { stalled: true, rate };
  const wks = remaining / rate;
  return { weeks: wks, date: addDays(t, Math.round(wks * 7)), rate };
}

/* ------------------------------------------------------------------ *
 *  Nutrición: fórmula de McLean + reparto por somatotipo
 * ------------------------------------------------------------------ */
function targets() {
  const p = DB.profile;
  const lb = currentWeight() * KG_TO_LB;
  const factor = KCAL_FACTOR[p.phase] || 12;
  const s = SOMATOTYPES[p.somatotype] || SOMATOTYPES.meso;
  let kcal, protein;
  if (p.autoMacros) {
    kcal = round10(lb * factor);
    protein = Math.round(kcal * s.p / 100 / 4);
  } else {
    kcal = p.kcal; protein = p.protein;
  }
  // Lo que no es proteína se reparte entre carbohidratos y grasa en la proporción del somatotipo.
  const rest = Math.max(0, kcal - protein * 4);
  const cShare = s.c / (s.c + s.f);
  const carbs = Math.round(rest * cShare / 4);
  const fat = Math.round(rest * (1 - cShare) / 9);
  return { kcal, protein, carbs, fat, lb, factor, soma: s, water: p.waterGoal, sugar: p.sugarMax };
}
function dayTotals(date) {
  const e = DB.days[date] || {};
  const meals = e.meals || [];
  const t = { p: 0, c: 0, f: 0, s: 0, meals: meals.length };
  let kcal = 0;
  meals.forEach(m => {
    t.p += m.p || 0; t.c += m.c || 0; t.f += m.f || 0; t.s += m.s || 0;
    kcal += m.kcal != null ? m.kcal : (m.p || 0) * 4 + (m.c || 0) * 4 + (m.f || 0) * 9;   // algunos productos solo traen kcal
  });
  t.kcal = Math.round(kcal);
  if (!meals.length) { t.kcal = e.kcal || 0; t.p = e.protein || 0; }   // registros de la 1.x
  t.water = e.water || 0;
  return t;
}

/* Ventana post-entreno */
function pwoLeft() {
  if (!DB.pwo) return null;
  const left = DB.pwo.start + PWO_MINUTES * 60000 - Date.now();
  return left > 0 ? left : null;
}
function startPwo() {
  DB.pwo = { start: Date.now(), date: todayStr() };
  saveData();
}

/* ------------------------------------------------------------------ *
 *  Entrenamiento
 * ------------------------------------------------------------------ */
const e1rm = (w, r) => w * (1 + r / 30);
function getRoutine(key) { return key === 'custom' ? DB.custom : ROUTINES[key] || ROUTINES.pro; }
function exInfo(name) { return EX[name] || { g: 'otro', t: 'c', p: 'otro', e: 'maq', pf: false, icon: 'curl' }; }
function activeSession() { return DB.active ? DB.sessions.find(s => s.id === DB.active) || null : null; }

/* Unidades: se guarda siempre en kg; máquinas y poleas se muestran en lb por defecto (sus placas vienen en lb). */
const LB = 0.45359237;
function unitFor(ex) { return DB.units[ex] || (['maq', 'polea'].includes(exInfo(ex).e) ? 'lb' : 'kg'); }
const toKg = (w, u) => u === 'lb' ? w * LB : w;
const fromKg = (kg, u) => u === 'lb' ? kg / LB : kg;
function wFmt(kg, u) { const v = fromKg(kg, u); return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1)) + ' ' + u; }
function roundTo(v, step) { return Math.round(v / step) * step; }
function stepFor(ex, u) { return u === 'lb' ? 5 : exInfo(ex).e === 'manc' ? 1 : 2.5; }

/** Siguiente día del ciclo según la última sesión hecha con esa rutina. */
function nextDay(routineKey) {
  const r = getRoutine(routineKey);
  if (!r.days.length) return null;
  const last = DB.sessions.filter(s => s.routine === routineKey && s.end).sort((a, b) => b.start - a.start)[0];
  if (!last) return r.days[0];
  const i = r.days.findIndex(d => d.id === last.dayId);
  return r.days[(i + 1) % r.days.length];
}

/** Series de la sesión anterior (otro día) para ese ejercicio. */
function lastTime(ex, excludeSid) {
  const prev = DB.lifts.filter(l => l.ex === ex && l.sid !== excludeSid).sort((a, b) => (b.t || 0) - (a.t || 0));
  if (!prev.length) return null;
  const date = prev[0].date;
  const sets = prev.filter(l => l.date === date).sort((a, b) => (a.t || 0) - (b.t || 0));
  const top = sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a);
  return { date, sets, top, best: e1rm(top.w, top.r) };
}
function bestBefore(ex, t) {
  const prev = DB.lifts.filter(l => l.ex === ex && (l.t || 0) < t);
  return prev.length ? Math.max(...prev.map(s => e1rm(s.w, s.r))) : null;
}

/** Rango de repeticiones objetivo a partir del texto de la rutina ("12–15", "15, 12, 10, 8", "6–7 explosivas"). */
function repRange(text) {
  const n = String(text || '').match(/\d+/g);
  if (!n) return [8, 12];
  const v = n.map(Number).filter(x => x > 0 && x <= 50);
  return v.length ? [Math.min(...v), Math.max(...v)] : [8, 12];
}

/**
 * Sugerencia de sobrecarga progresiva según la mejor serie de la sesión anterior y su RIR:
 * mucho margen (RIR ≥ 3) → más peso; margen normal → +1 rep o +1 escalón de peso;
 * al fallo → mismo peso y +1 rep. En día de descarga, −10 % y RIR 3–4.
 */
function suggestion(ex, repsText, sid) {
  const last = lastTime(ex, sid);
  if (!last) return null;
  const u = unitFor(ex), step = stepFor(ex, u);
  const [lo, hi] = repRange(repsText);
  const w = fromKg(last.top.w, u), r = last.top.r, rir = last.top.rir == null ? 2 : last.top.rir;
  const opt = (wt, reps) => ({ w: Math.max(step, roundTo(wt, step)), r: Math.max(1, reps) });
  let a, b, why;
  if (isDeload()) {
    a = opt(w * 0.9, Math.min(r, hi)); b = null;
    why = 'Día de descarga: menos peso, deja 3–4 reps en reserva.';
  } else if (rir >= 3) {
    a = opt(w * 1.05 + step / 2, r); b = opt(w, r + 2);
    why = `La última vez te sobraron ${rir}+ reps: sube peso.`;
  } else if (rir === 0 && r < lo) {
    a = opt(w, r + 1); b = opt(w - step, lo);
    why = 'La última vez llegaste al fallo por debajo del rango: consolida el peso.';
  } else if (r >= hi) {
    a = opt(w + step, lo); b = opt(w, r + 1);
    why = `Llegaste al tope del rango (${hi}): toca subir peso.`;
  } else {
    a = opt(w, r + 1); b = opt(w + step, Math.max(lo, r - 1));
    why = 'Una rep más con el mismo peso, o un escalón más de peso.';
  }
  return { u, a, b, why, last };
}

function weeklyBest(ex, weeksBack) {
  const t = todayStr(), out = [];
  for (let i = 0; i < weeksBack; i++) {
    const end = addDays(t, -7 * i), start = addDays(end, -6);
    const sets = DB.lifts.filter(l => l.ex === ex && l.date >= start && l.date <= end);
    out.push(sets.length ? Math.max(...sets.map(l => e1rm(l.w, l.r))) : null);
  }
  return out;
}
function strengthAlerts() {
  return Array.from(new Set(DB.lifts.map(l => l.ex))).filter(ex => {
    const [w0, w1, w2] = weeklyBest(ex, 3);
    return w0 != null && w1 != null && w2 != null && w0 < w1 && w1 < w2;
  });
}

/**
 * Volumen de los últimos 7 días. Serie efectiva = serie de trabajo con RIR ≤ 3 (o sin RIR anotado).
 * El grupo secundario de los compuestos no se cuenta: es una aproximación sencilla.
 */
function weekVolume() {
  const start = addDays(todayStr(), -6);
  const sets = DB.lifts.filter(l => l.date >= start && (l.rir == null || l.rir <= 3));
  const groups = {};
  let comp = 0, iso = 0;
  sets.forEach(l => {
    const info = exInfo(l.ex);
    groups[info.g] = (groups[info.g] || 0) + 1;
    if (info.t === 'c') comp++; else iso++;
  });
  const sessions = DB.sessions.filter(s => s.date >= start && s.end).length;
  return { groups, comp, iso, total: sets.length, sessions };
}

/* ------------------------------------------------------------------ *
 *  Recuperación y descarga
 * ------------------------------------------------------------------ */
function recoveryToday() {
  const t = todayStr(), rec = (DB.days[t] && DB.days[t].rec) || null;
  if (!rec) return null;
  const hrvs = [];
  for (let i = 1; i <= 7; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r && r.hrv) hrvs.push(r.hrv); }
  const base = hrvs.length >= 3 ? hrvs.reduce((a, b) => a + b, 0) / hrvs.length : null;
  const reasons = [];
  if (rec.hrv && base && rec.hrv < base * 0.9) reasons.push(`HRV ${rec.hrv} ms, ${Math.round((1 - rec.hrv / base) * 100)} % por debajo de tu media (${Math.round(base)} ms)`);
  if (rec.sleepH != null && rec.sleepH < 6) reasons.push(`dormiste ${fmt(rec.sleepH)} h`);
  if (rec.sleepQ != null && rec.sleepQ <= 2) reasons.push('sueño de mala calidad');
  if (rec.soreness != null && rec.soreness >= 4) reasons.push('mucha fatiga o dolor muscular');
  let score = 100;
  if (base && rec.hrv) score -= Math.max(0, (1 - rec.hrv / base) * 200);
  if (rec.sleepH != null) score -= Math.max(0, (7 - rec.sleepH) * 8);
  if (rec.sleepQ != null) score -= (5 - rec.sleepQ) * 6;
  if (rec.soreness != null) score -= (rec.soreness - 1) * 6;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { rec, base, reasons, score, low: reasons.length > 0 };
}
/** Descarga: recuperación baja hoy, fuerza cayendo o el usuario la activó a mano. */
function isDeload() {
  const t = todayStr();
  if (DB.days[t] && DB.days[t].deload != null) return DB.days[t].deload;
  const r = recoveryToday();
  return !!(r && r.low);
}

/* ------------------------------------------------------------------ *
 *  Logros y nivel de fuerza
 * ------------------------------------------------------------------ */
function unlock(id, title, detail) {
  if (DB.achievements.some(a => a.id === id)) return false;
  DB.achievements.unshift({ id, title, detail, date: todayStr(), t: Date.now() });
  setTimeout(() => toast('🏆 Logro desbloqueado: ' + title), 400);
  vibrate(150);
  return true;
}
/** Récords de una serie recién guardada: peso máximo, reps a ese peso y 1RM estimado. */
function checkSetRecords(set) {
  const prev = DB.lifts.filter(l => l.ex === set.ex && l.id !== set.id && (l.t || 0) < set.t);
  const out = [];
  if (!prev.length) return out;
  if (set.w > Math.max(...prev.map(l => l.w)) + 0.01) out.push('peso');
  const atW = prev.filter(l => l.w >= set.w - 0.01);
  if (atW.length && set.r > Math.max(...atW.map(l => l.r))) out.push('reps');
  if (e1rm(set.w, set.r) > Math.max(...prev.map(l => e1rm(l.w, l.r))) + 0.01) out.push('1rm');
  out.forEach(k => {
    const u = unitFor(set.ex);
    const label = { peso: 'Récord de peso', reps: 'Récord de reps a ' + wFmt(set.w, u), '1rm': 'Récord de 1RM estimado' }[k];
    DB.achievements.unshift({ id: 'pr-' + set.id + '-' + k, title: label + ' · ' + set.ex, detail: wFmt(set.w, u) + ' × ' + set.r, date: set.date, t: set.t, pr: true });
  });
  return out;
}
function weekKey(date) { const d = parseDate(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return dateStr(d); }
function trainingStreakWeeks() {
  const weeks = {};
  DB.sessions.filter(s => s.end).forEach(s => { const k = weekKey(s.date); weeks[k] = (weeks[k] || 0) + 1; });
  let streak = 0, k = weekKey(todayStr());
  if ((weeks[k] || 0) < 3) k = addDays(k, -7);   // la semana en curso aún no cuenta si no llega a 3
  while ((weeks[k] || 0) >= 3) { streak++; k = addDays(k, -7); }
  return streak;
}
function weighStreakDays() {
  let n = 0, d = todayStr();
  if (!(DB.days[d] && DB.days[d].weight != null)) d = addDays(d, -1);
  while (DB.days[d] && DB.days[d].weight != null) { n++; d = addDays(d, -1); }
  return n;
}
function sessionVolume(sid) { return DB.lifts.filter(l => l.sid === sid).reduce((a, l) => a + l.w * l.r, 0); }
/** Logros de hitos: se revisan al terminar una sesión. */
function checkMilestones(s) {
  const done = DB.sessions.filter(x => x.end);
  [1, 10, 25, 50, 100, 200].forEach(n => { if (done.length >= n) unlock('sessions-' + n, n === 1 ? 'Primera sesión registrada' : n + ' sesiones registradas', 'Constancia'); });
  const vol = sessionVolume(s.id), prevMax = Math.max(0, ...done.filter(x => x.id !== s.id).map(x => sessionVolume(x.id)));
  if (prevMax > 0 && vol > prevMax) DB.achievements.unshift({ id: 'vol-' + s.id, title: 'Récord de volumen en una sesión', detail: Math.round(vol).toLocaleString('es-MX') + ' kg movidos', date: s.date, t: Date.now(), pr: true });
  const total = DB.lifts.reduce((a, l) => a + l.w * l.r, 0);
  [10000, 50000, 100000, 250000, 500000].forEach(v => { if (total >= v) unlock('tonnage-' + v, (v / 1000) + ' toneladas acumuladas', 'Volumen total levantado'); });
  const wk = trainingStreakWeeks();
  [2, 4, 8, 12, 26, 52].forEach(n => { if (wk >= n) unlock('streak-' + n, n + ' semanas seguidas entrenando 3+ días', 'Racha'); });
  strengthLevels().forEach(l => { if (l.level >= 1) unlock('lvl-' + l.name + '-' + l.level, l.name + ': nivel ' + STRENGTH_LEVELS[l.level], fmt(l.ratio, 2) + '× tu peso corporal'); });
}
function checkDailyMilestones() {
  const n = weighStreakDays();
  [7, 14, 30, 60, 100].forEach(d => { if (n >= d) unlock('weigh-' + d, d + ' días seguidos registrando tu peso', 'Racha'); });
  const p = DB.profile, cur = currentWeight();
  if (p.phase === 'definicion' && p.startWeight - cur >= 1) [1, 3, 5, 7, 10].forEach(k => { if (p.startWeight - cur >= k) unlock('lost-' + k, '−' + k + ' kg desde el inicio', 'Media de 7 días'); });
}

function strengthLevels() {
  const bw = currentWeight();
  return STRENGTH_LIFTS.map(L => {
    const sets = DB.lifts.filter(l => L.ex.includes(l.ex));
    if (!sets.length || !bw) return { name: L.name, level: -1, ratio: null, best: null, cuts: L.cuts };
    const top = sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a);
    const best = e1rm(top.w, top.r), ratio = best / bw;
    const level = L.cuts.filter(c => ratio >= c).length;
    return { name: L.name, level, ratio, best, cuts: L.cuts, smith: top.ex.includes('Smith') };
  });
}

/* ------------------------------------------------------------------ *
 *  Cronómetro de descanso (barra fija)
 * ------------------------------------------------------------------ */
const REST = { end: 0, total: 0, label: '', timer: null, fired: false };
function startRest(seconds, label) {
  REST.total = seconds; REST.end = Date.now() + seconds * 1000; REST.label = label || 'Descanso'; REST.fired = false;
  $('#timer-bar').classList.add('show');
  $('#timer-bar').classList.remove('done');
  document.body.classList.add('timer-on');
  clearInterval(REST.timer);
  REST.timer = setInterval(tickRest, 250);
  tickRest();
}
function tickRest() {
  const left = (REST.end - Date.now()) / 1000;
  $('#tb-time').textContent = mmss(Math.max(0, Math.ceil(left)));
  $('#tb-label').textContent = left > 0 ? REST.label : '¡A la siguiente serie!';
  if (left <= 0 && !REST.fired) {
    REST.fired = true;
    $('#timer-bar').classList.add('done');
    vibrate(600);
    setTimeout(() => { if (REST.fired) stopRest(); }, 8000);
  }
}
function stopRest() {
  clearInterval(REST.timer);
  REST.fired = false;
  $('#timer-bar').classList.remove('show', 'done');
  document.body.classList.remove('timer-on');
}

/* ------------------------------------------------------------------ *
 *  Gráficas (canvas)
 * ------------------------------------------------------------------ */
const getVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function drawChart(canvas, opts) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const cMuted = getVar('--muted'), cLine = getVar('--line');
  const pts = opts.series.flatMap(s => s.points), hl = opts.hlines || [];
  if (!pts.length) {
    ctx.fillStyle = cMuted; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Sin datos todavía', W / 2, H / 2);
    return;
  }
  const xs = pts.map(p => parseDate(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  const ys = pts.map(p => p.y).concat(hl.map(h => h.y));
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max((y1 - y0) * 0.12, opts.minPad || 0.5);
  y0 -= pad; y1 += pad;
  const L = 38, R = 10, T = 10, B = 22;
  const px = t => L + (t - x0) / (x1 - x0) * (W - L - R);
  const py = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  ctx.font = '11px system-ui'; ctx.fillStyle = cMuted; ctx.strokeStyle = cLine; ctx.lineWidth = 1;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + (y1 - y0) * i / 3, y = py(v);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
    ctx.fillText(v.toFixed(opts.yDec == null ? 1 : opts.yDec), L - 6, y);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.fillText(shortDate(dateStr(new Date(x0))), L, H - 5);
  ctx.textAlign = 'right'; ctx.fillText(shortDate(dateStr(new Date(x1))), W - R, H - 5);
  hl.forEach(h => {
    const y = py(h.y);
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = h.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.restore();
    if (h.label) { ctx.fillStyle = h.color; ctx.textAlign = 'right'; ctx.fillText(h.label, W - R - 2, y - 5); }
  });
  opts.series.forEach(s => {
    const p = s.points.map(q => [px(parseDate(q.date).getTime()), py(q.y)]);
    if (s.line !== false && p.length > 1) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.5; ctx.lineJoin = 'round';
      ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    if (s.dots) { ctx.fillStyle = s.color; p.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, s.r || 2.5, 0, Math.PI * 2); ctx.fill(); }); }
  });
}
let redrawChart = () => {};
function showChart(draw) { redrawChart = draw; requestAnimationFrame(draw); }

function ring(value, goal, color, label) {
  const r = 38, c = 2 * Math.PI * r, pct = goal ? Math.min(1, value / goal) : 0;
  return `<svg class="ring" viewBox="0 0 86 86"><circle class="track" cx="43" cy="43" r="${r}"/>
    <circle class="fill" cx="43" cy="43" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
    <text x="43" y="43">${label}</text></svg>`;
}
function bar(value, goal) { return `<div class="bar"><div style="width:${goal ? Math.min(100, value / goal * 100) : 0}%"></div></div>`; }

/* ------------------------------------------------------------------ *
 *  Navegación y modales
 * ------------------------------------------------------------------ */
const TITLES = { home: 'Inicio', train: 'Entreno', food: 'Nutrición', progress: 'Progreso', more: 'Más' };
let currentTab = 'home';
function showTab(tab) {
  currentTab = tab;
  $$('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('section.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + tab));
  $('#hdr-title').textContent = TITLES[tab];
  redrawChart = () => {};
  render(tab);
  window.scrollTo(0, 0);
}
function render(tab) {
  ({ home: renderHome, train: renderTrain, food: renderFood, progress: renderProgress, more: renderMore })[tab]();
  const p = DB.profile;
  $('#hdr-sub').textContent = (p.name ? p.name + ' · ' : '') + longDate(todayStr());
}
function openModal(html, onMount) {
  $('#modal').innerHTML = html;
  $('#modal-bg').classList.add('open');
  if (onMount) onMount($('#modal'));
}
function closeModal() {
  $$('#modal video').forEach(v => { if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); });
  $('#modal-bg').classList.remove('open'); $('#modal').innerHTML = '';
}

/* ------------------------------------------------------------------ *
 *  INICIO
 * ------------------------------------------------------------------ */
function mindsetOfDay() {
  const d = parseDate(todayStr());
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return MINDSET[doy % MINDSET.length];
}

/** Hábitos activos: se suma uno por semana desde que empezaste. */
function activeHabits() {
  const weeks = Math.max(0, Math.floor(daysBetween(DB.profile.habitsStart, todayStr()) / 7));
  return HABITS.slice(0, Math.min(HABITS.length, weeks + 1));
}
function habitAuto(h, date) {
  const t = dayTotals(date), e = DB.days[date] || {}, tg = targets();
  if (h.auto === 'water') return t.water >= 2500;
  if (h.auto === 'sugar') return (e.meals || []).length > 0 && t.s <= tg.sugar;
  if (h.auto === 'meals') return t.meals >= 3;
  if (h.auto === 'journal') return DB.lifts.some(l => l.date === date);
  return false;
}
function habitDone(h, date) { const e = DB.days[date] || {}; return !!(e.habits && e.habits[h.id]) || habitAuto(h, date); }

function pwoCard() {
  const left = pwoLeft();
  if (left == null) return '';
  const e = DB.days[todayStr()] || {}, s = e.supps || {};
  return `<div class="card" style="border-color:rgba(249,115,22,.5)">
    <div class="row spread"><h2 style="margin:0">Ventana post-entreno</h2><span class="pill" id="pwo-left">${mmss(left / 1000)}</span></div>
    <p class="small muted" style="margin:6px 0 8px">Tu cuerpo pasa de catabólico a anabólico: aprovecha los primeros ${PWO_MINUTES} min.</p>
    ${PWO_ITEMS.map(([id, name, sub]) => `<label class="check" style="margin:6px 0"><input type="checkbox" data-pwo="${id}" ${s[id] ? 'checked' : ''}> <span>${esc(name)}<br><span class="small muted">${esc(sub)}</span></span></label>`).join('')}
  </div>`;
}
function bindPwo(root) {
  $$('[data-pwo]', root).forEach(cb => cb.onchange = () => {
    const e = day(todayStr()); e.supps = e.supps || {};
    e.supps[cb.dataset.pwo] = cb.checked;
    if (cb.dataset.pwo === 'pwo_protein') e.supps.protein = cb.checked;
    if (cb.dataset.pwo === 'pwo_creatine') e.supps.creatine = cb.checked;
    saveData();
  });
}

function renderHome() {
  const p = DB.profile, t = todayStr(), tg = targets(), tot = dayTotals(t);
  const cur = currentWeight(), { r1 } = weeklyRates(), adv = weightAdvice();
  const total = p.startWeight - p.goalWeight, done = cur == null ? 0 : p.startWeight - cur;
  const pct = total ? Math.max(0, Math.min(100, done / total * 100)) : 0;
  const [mTitle, mText, mSrc] = mindsetOfDay();
  const act = activeSession(), nd = nextDay(p.routine), r = getRoutine(p.routine);
  const habits = activeHabits(), alerts = strengthAlerts();

  $('#view-home').innerHTML = `
    <div class="card"><div class="quote"><b>${esc(mTitle)}</b>${esc(mText)}<small>Idea de ${esc(mSrc)}</small></div></div>

    ${pwoCard()}

    <div class="card">
      <div class="row spread">
        <div><div class="muted small">Peso (media 7 días)</div>
          <div class="big">${fmt(cur)} <span class="muted" style="font-size:16px;font-weight:500">kg</span></div></div>
        <div style="text-align:right"><div class="muted small">Esta semana</div>
          <div style="font-size:20px;font-weight:700;color:${r1 == null ? 'var(--muted)' : (p.phase === 'definicion' ? (r1 <= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--text)')}">${r1 == null ? '—' : signed(r1, 2) + ' kg'}</div></div>
      </div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="row spread small muted"><span>Inicio ${fmt(p.startWeight)}</span><span>${fmt(Math.max(0, done))} de ${fmt(total)} kg</span><span>Meta ${fmt(p.goalWeight)}</span></div>
      <div class="status ${adv.cls}"><b>${esc(adv.title)}</b>${esc(adv.text)}</div>
      <button class="secondary block" style="margin-top:10px" id="home-weight">Registrar peso de hoy</button>
    </div>

    <div class="card">
      <h2>Hoy <small>· ${tg.kcal.toLocaleString('es-MX')} kcal objetivo</small></h2>
      <div class="ring-wrap">
        ${ring(tot.water, tg.water, '#60a5fa', fmt(tot.water / 1000, 1) + ' L')}
        <div style="flex:1">
          <div class="small muted">Agua · meta ${fmt(tg.water / 1000, 1)} L</div>
          <div class="row" style="margin-top:8px;gap:6px">
            <button class="secondary" data-water="250" style="flex:1;padding:9px 4px">+250 ml</button>
            <button class="secondary" data-water="500" style="flex:1;padding:9px 4px">+500 ml</button>
            <button class="ghost" data-water="-250">−</button>
          </div>
        </div>
      </div>
      <div class="row spread small" style="margin-top:12px"><span><b>${tot.kcal.toLocaleString('es-MX')}</b> / ${tg.kcal.toLocaleString('es-MX')} kcal</span><span class="${tot.s > tg.sugar ? '' : 'muted'}" style="${tot.s > tg.sugar ? 'color:var(--bad)' : ''}">Azúcar ${Math.round(tot.s)} / ${tg.sugar} g</span></div>
      <div class="macros">
        <div class="macro p"><div class="label"><span>Proteína</span><span>${Math.round(tot.p)}/${tg.protein}</span></div>${bar(tot.p, tg.protein)}</div>
        <div class="macro c"><div class="label"><span>Carbos</span><span>${Math.round(tot.c)}/${tg.carbs}</span></div>${bar(tot.c, tg.carbs)}</div>
        <div class="macro f"><div class="label"><span>Grasa</span><span>${Math.round(tot.f)}/${tg.fat}</span></div>${bar(tot.f, tg.fat)}</div>
      </div>
      <button class="block" style="margin-top:12px" id="home-meal">+ Añadir comida</button>
    </div>

    ${recoveryCard()}

    <div class="card">
      <h2>Entreno</h2>
      ${act ? `<p style="margin:0 0 10px">Sesión en curso: <b>${esc(act.dayName)}</b></p><button class="block" id="home-train">Continuar entreno</button>`
        : nd ? `<p style="margin:0 0 4px">Hoy toca: <b>${esc(nd.name)}</b></p><p class="small muted" style="margin:0 0 10px">${esc(r.name)}</p>
          ${nd.rest ? '<p class="small muted" style="margin:0">Día de descanso: recupera, camina y come bien.</p>' : '<button class="block" id="home-train">Empezar entreno</button>'}`
        : '<p class="small muted">Elige o crea una rutina en la pestaña Entreno.</p>'}
      ${alerts.length ? `<div class="status warn"><b>Fuerza a la baja</b>${esc(alerts.join(', '))}: 2 semanas bajando.</div>` : ''}
    </div>

    ${DB.achievements.length ? `<div class="card">
      <div class="row spread"><h2 style="margin:0">Logros recientes</h2><button class="ghost" id="home-ach">Ver todos</button></div>
      ${DB.achievements.slice(0, 3).map(a => `<div class="badge-row"><span class="badge">${a.pr ? '↑' : '🏆'}</span><span><b>${esc(a.title)}</b><br><small class="muted">${esc(a.detail || '')} · ${shortDate(a.date)}</small></span></div>`).join('')}
    </div>` : ''}

    <div class="card">
      <h2>Reglas de oro <small>· semana ${habits.length} de ${HABITS.length}: +1 hábito por semana</small></h2>
      ${habits.map(h => `<label class="habit"><input type="checkbox" data-habit="${h.id}" ${habitDone(h, t) ? 'checked' : ''}> ${esc(h.name)}${h.auto && habitAuto(h, t) ? '<span class="auto">auto ✓</span>' : ''}</label>`).join('')}
    </div>`;

  $('#home-weight').onclick = () => openDayForm(t);
  $('#home-meal').onclick = () => openMealForm(t);
  const tr = $('#home-train');
  if (tr) tr.onclick = () => { if (!act) startSession(p.routine, nd.id); showTab('train'); };
  $$('#view-home [data-water]').forEach(b => b.onclick = () => {
    const e = day(t); e.water = Math.max(0, (e.water || 0) + Number(b.dataset.water)); saveData(); renderHome();
  });
  $$('#view-home [data-habit]').forEach(cb => cb.onchange = () => {
    const e = day(t); e.habits = e.habits || {}; e.habits[cb.dataset.habit] = cb.checked; saveData();
  });
  bindPwo($('#view-home'));
  bindRecovery($('#view-home'), renderHome);
  const ach = $('#home-ach'); if (ach) ach.onclick = () => { progMode = 'logros'; showTab('progress'); };
}

/* ------------------------------------------------------------------ *
 *  ENTRENO (Gym Bible)
 * ------------------------------------------------------------------ */
function startSession(routineKey, dayId) {
  let name, id;
  if (routineKey === 'libre') { name = 'Entreno libre'; id = null; }
  else {
    const d = getRoutine(routineKey).days.find(x => x.id === dayId);
    if (!d) return;
    name = d.name; id = d.id;
  }
  const s = { id: uid(), routine: routineKey, dayId: id, dayName: name, date: todayStr(), start: Date.now(), end: null, extra: [], swaps: {} };
  DB.sessions.push(s);
  DB.active = s.id;
  saveData();
  keepScreenOn(true);
}
function closeSession() { DB.active = null; saveData(); keepScreenOn(false); stopRest(); }
function finishSession() {
  const s = activeSession();
  if (!s) return;
  const n = DB.lifts.filter(l => l.sid === s.id).length;
  if (!n) {
    if (!confirm('No registraste ninguna serie. ¿Descartar la sesión?')) return;
    DB.sessions = DB.sessions.filter(x => x.id !== s.id);
    closeSession(); renderTrain();
    return;
  }
  s.end = Date.now();
  day(s.date).trained = true;
  startPwo();
  checkMilestones(s);
  closeSession();
  toast(`Sesión guardada: ${n} series y ${Math.round(sessionVolume(s.id)).toLocaleString('es-MX')} kg de volumen. ¡Arrancó tu ventana post-entreno!`);
  showTab('home');
}

/* Mapa de calor muscular (frente y espalda) */
const BODY_FRONT = {
  hombro: '<ellipse cx="29" cy="42" rx="8" ry="7"/><ellipse cx="71" cy="42" rx="8" ry="7"/>',
  pecho: '<path d="M37 38Q50 34 63 38L63 56Q50 61 37 56Z"/>',
  biceps: '<ellipse cx="25" cy="63" rx="5" ry="11"/><ellipse cx="75" cy="63" rx="5" ry="11"/>',
  abdomen: '<rect x="40" y="61" width="20" height="36" rx="5"/>',
  pierna: '<ellipse cx="42" cy="128" rx="8" ry="22"/><ellipse cx="58" cy="128" rx="8" ry="22"/>',
  pantorrilla: '<ellipse cx="42" cy="168" rx="5" ry="12"/><ellipse cx="58" cy="168" rx="5" ry="12"/>'
};
const BODY_BACK = {
  hombro: '<ellipse cx="29" cy="42" rx="8" ry="7"/><ellipse cx="71" cy="42" rx="8" ry="7"/>',
  espalda: '<path d="M37 37L63 37L60 82Q50 86 40 82Z"/>',
  triceps: '<ellipse cx="25" cy="63" rx="5" ry="11"/><ellipse cx="75" cy="63" rx="5" ry="11"/>',
  gluteo: '<ellipse cx="43" cy="100" rx="8" ry="9"/><ellipse cx="57" cy="100" rx="8" ry="9"/>',
  femoral: '<ellipse cx="42" cy="130" rx="7" ry="19"/><ellipse cx="58" cy="130" rx="7" ry="19"/>',
  pantorrilla: '<ellipse cx="42" cy="168" rx="5" ry="12"/><ellipse cx="58" cy="168" rx="5" ry="12"/>'
};
function heatColor(g, groups) {
  const n = groups[g] || 0, ratio = n / WEEKLY_TARGET[g];
  if (!n) return 'var(--surface-2)';
  if (ratio > OVERREACH) return '#ef4444';
  if (ratio >= 0.85) return '#22c55e';
  if (ratio >= 0.5) return '#eab308';
  return '#60a5fa';
}
function bodySvg(parts, groups, label) {
  const silhouette = '<circle cx="50" cy="14" r="10"/><path d="M38 28H62L80 40L84 90H76L72 52L66 58L66 104L62 190H52L50 110L48 190H38L34 104L34 58L28 52L24 90H16L20 40Z"/>';
  return `<svg viewBox="0 0 100 200" class="body-map" aria-label="${label}">
    <g fill="var(--surface-2)" opacity=".55">${silhouette}</g>
    ${Object.keys(parts).map(g => `<g fill="${heatColor(g, groups)}" data-g="${g}">${parts[g]}</g>`).join('')}
    <text x="50" y="198" text-anchor="middle" font-size="9" fill="var(--muted)">${label}</text></svg>`;
}
function heatmapCard(vol) {
  const g = vol.groups;
  return `<div class="card">
    <h2>Mapa muscular <small>· series efectivas, últimos 7 días</small></h2>
    <div class="body-maps">${bodySvg(BODY_FRONT, g, 'Frente')}${bodySvg(BODY_BACK, g, 'Espalda')}</div>
    <div class="legend" style="justify-content:center;margin-bottom:8px">
      <span><i style="background:#60a5fa"></i>Poco</span><span><i style="background:#eab308"></i>Casi</span>
      <span><i style="background:#22c55e"></i>Óptimo</span><span><i style="background:#ef4444"></i>Exceso</span></div>
    ${Object.keys(WEEKLY_TARGET).map(k => {
      const n = g[k] || 0, t = WEEKLY_TARGET[k];
      return `<div class="vol-row"><span>${GROUPS[k]}</span><div class="bar"><div style="width:${Math.min(100, n / (t * OVERREACH) * 100)}%;background:${heatColor(k, g)}"></div></div><span style="text-align:right">${n}/${t}</span></div>`;
    }).join('')}
    <p class="small muted" style="margin:8px 0 0">Serie efectiva = serie de trabajo con RIR ≤ 3. Cuenta solo el músculo principal de cada ejercicio.</p>
  </div>`;
}

function recoveryCard() {
  const r = recoveryToday(), t = todayStr(), forced = DB.days[t] && DB.days[t].deload;
  const dl = isDeload();
  return `<div class="card">
    <div class="row spread"><h2 style="margin:0">Recuperación</h2>${r ? `<span class="pill ${r.score >= 70 ? 'good' : r.score >= 45 ? 'warn' : ''}">${r.score}/100</span>` : ''}</div>
    ${r ? `<p class="small muted" style="margin:6px 0">${r.rec.hrv ? 'HRV ' + r.rec.hrv + ' ms · ' : ''}${r.rec.sleepH != null ? 'Sueño ' + fmt(r.rec.sleepH) + ' h · ' : ''}${r.rec.sleepQ != null ? 'calidad ' + r.rec.sleepQ + '/5 · ' : ''}${r.rec.rhr ? 'FC reposo ' + r.rec.rhr : ''}</p>`
      : '<p class="small muted" style="margin:6px 0">Anota HRV y sueño de tu reloj (Garmin, WHOOP, Mi Fitness…) para que la app decida si hoy toca descarga.</p>'}
    ${dl ? `<div class="status warn"><b>Hoy toca descarga</b>${r && r.reasons.length ? esc(r.reasons.join('; ')) + '. ' : ''}Mismos ejercicios con ~10 % menos peso, la mitad de las series y 3–4 reps en reserva. Las sugerencias ya lo aplican.</div>` : ''}
    <div class="row" style="margin-top:10px">
      <button class="secondary" id="rec-log" style="flex:1">${r ? 'Editar' : 'Registrar'} recuperación</button>
      <button class="secondary" id="rec-toggle" style="flex:1">${dl ? 'Entrenar normal' : 'Hacer descarga'}</button>
    </div>
    ${forced != null ? '<p class="small muted" style="margin:6px 0 0">Elegido a mano para hoy.</p>' : ''}
  </div>`;
}
function bindRecovery(root, rerender) {
  const t = todayStr();
  $('#rec-log', root).onclick = () => openRecoveryForm(rerender);
  $('#rec-toggle', root).onclick = () => { day(t).deload = !isDeload(); saveData(); rerender(); };
}
function openRecoveryForm(rerender) {
  const t = todayStr(), r = (DB.days[t] && DB.days[t].rec) || {};
  const v = x => x == null ? '' : x;
  const scale = (id, val, labels) => `<select id="${id}"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${val === n ? 'selected' : ''}>${n} · ${labels[n - 1]}</option>`).join('')}</select>`;
  openModal(`
    <h3>Recuperación de hoy</h3>
    <p class="small muted" style="margin-top:0">Copia los datos de la app de tu reloj. Todo es opcional.</p>
    <div class="grid2">
      <label>HRV (ms)<input id="rc-hrv" inputmode="numeric" value="${v(r.hrv)}"></label>
      <label>FC en reposo<input id="rc-rhr" inputmode="numeric" value="${v(r.rhr)}"></label>
      <label>Horas de sueño<input id="rc-sleep" inputmode="decimal" value="${v(r.sleepH)}"></label>
      <label>Calidad del sueño${scale('rc-q', r.sleepQ, ['Pésima', 'Mala', 'Normal', 'Buena', 'Excelente'])}</label>
    </div>
    <label>Fatiga / dolor muscular${scale('rc-sore', r.soreness, ['Nada', 'Poco', 'Moderado', 'Alto', 'Muy alto'])}</label>
    <div class="row"><button class="secondary" id="rc-cancel" style="flex:1">Cancelar</button><button id="rc-save" style="flex:1">Guardar</button></div>`, m => {
    $('#rc-cancel', m).onclick = closeModal;
    $('#rc-save', m).onclick = () => {
      const rec = { hrv: num($('#rc-hrv', m).value), rhr: num($('#rc-rhr', m).value), sleepH: num($('#rc-sleep', m).value), sleepQ: num($('#rc-q', m).value), soreness: num($('#rc-sore', m).value) };
      Object.keys(rec).forEach(k => rec[k] == null && delete rec[k]);
      const d = day(t);
      if (Object.keys(rec).length) d.rec = rec; else delete d.rec;
      delete d.deload;
      if (rec.sleepH != null) d.sleep = rec.sleepH;
      saveData(); closeModal(); rerender();
    };
  });
}

function renderTrain() {
  const s = activeSession();
  if (s) return renderSession(s);
  const p = DB.profile, r = getRoutine(p.routine), nd = nextDay(p.routine);
  const vol = weekVolume(), alerts = strengthAlerts();
  const compPct = vol.total ? Math.round(vol.comp / vol.total * 100) : null;
  const over = Object.keys(vol.groups).filter(g => WEEKLY_TARGET[g] && vol.groups[g] / WEEKLY_TARGET[g] > OVERREACH);
  const recent = DB.sessions.filter(x => x.end).sort((a, b) => b.start - a.start).slice(0, 8);

  $('#view-train').innerHTML = `
    <div class="grid2" style="margin-bottom:12px">
      <button id="tr-free">Entreno libre</button>
      <button class="secondary" id="tr-lib">Ejercicios y máquinas</button>
    </div>
    <label>Rutina
      <select id="rt-sel">
        ${Object.keys(ROUTINES).map(k => `<option value="${k}" ${p.routine === k ? 'selected' : ''}>${esc(ROUTINES[k].name)}</option>`).join('')}
        <option value="custom" ${p.routine === 'custom' ? 'selected' : ''}>${esc(DB.custom.name)} (personalizada)</option>
      </select>
    </label>
    <p class="small muted" style="margin-top:-4px">${esc(r.desc || '')}</p>
    ${p.routine === 'custom' ? '<button class="secondary block" id="rt-edit" style="margin-bottom:12px">Editar mi rutina</button>' : ''}

    <div class="card">
      <h2>Días</h2>
      ${r.days.length ? r.days.map(d => `
        <details ${nd && d.id === nd.id ? 'open' : ''}>
          <summary><span>${esc(d.name)} ${nd && d.id === nd.id ? '<span class="pill">HOY</span>' : ''}</span></summary>
          ${d.rest ? '<p class="small muted">Descanso: camina, estira y come bien. El músculo crece cuando descansas.</p>' : `
          <div class="ex-mini-list">${d.ex.map(e => `<div class="ex-mini">${exIcon(e[0], 30)}<span>${esc(e[0])}<br><small>${e[1]} × ${esc(e[2])}${exInfo(e[0]).pf ? ' · PF' : ''}</small></span></div>`).join('')}</div>
          <button class="block" data-start="${d.id}" style="margin:8px 0 12px">Empezar ${esc(d.name.split('·').pop().trim())}</button>`}
        </details>`).join('') : '<div class="empty">Esta rutina no tiene días. Pulsa “Editar mi rutina”.</div>'}
    </div>

    ${recoveryCard()}
    ${heatmapCard(vol)}

    <div class="card">
      <h2>Balance de la semana</h2>
      ${vol.total ? `
      <div class="grid3" style="margin-bottom:10px">
        <div class="stat"><div class="label">Sesiones</div><div class="value">${vol.sessions}</div></div>
        <div class="stat"><div class="label">Series efectivas</div><div class="value">${vol.total}</div></div>
        <div class="stat"><div class="label">Compuestos</div><div class="value" style="color:${compPct >= 65 ? 'var(--good)' : 'var(--warn)'}">${compPct}%</div></div>
      </div>
      <p class="small muted" style="margin:0">Regla 75/25: ~75 % compuestos, ~25 % aislamiento.${compPct < 65 ? ' <b style="color:var(--warn)">Te faltan básicos.</b>' : ''}</p>`
        : '<div class="empty">Cuando registres sesiones verás tu balance semanal.</div>'}
      ${over.length ? `<div class="status bad"><b>Riesgo de sobreentrenamiento</b>${esc(over.map(g => GROUPS[g] || g).join(', '))}: más de ${Math.round(OVERREACH * 100)} % de las series óptimas. Considera una descarga.</div>` : ''}
      ${alerts.length ? `<div class="status warn"><b>Fuerza a la baja</b>${esc(alerts.join(', '))}: 2 semanas bajando. Revisa sueño, proteína y calorías.</div>` : ''}
      ${vol.sessions >= 7 ? '<div class="status warn"><b>Sin días de descanso</b>7 sesiones en 7 días: tu cuerpo necesita recuperar.</div>' : ''}
    </div>

    <div class="card">
      <h2>Técnicas de intensidad</h2>
      ${Object.keys(TECHNIQUES).filter(k => k !== 'normal').map(k => `<details><summary>${esc(TECHNIQUES[k].name)}</summary><p class="small" style="margin:0 0 12px">${esc(TECHNIQUES[k].text)}</p></details>`).join('')}
    </div>

    <div class="card">
      <h2>Últimas sesiones</h2>
      ${recent.length ? `<table><tbody>${recent.map(x => `<tr class="tap" data-sess="${x.id}"><td>${shortDate(x.date)}</td><td>${esc(x.dayName)}</td><td class="num">${DB.lifts.filter(l => l.sid === x.id).length} series</td><td class="num">${Math.round((x.end - x.start) / 60000)} min</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Aún no hay sesiones.</div>'}
    </div>`;

  $('#tr-free').onclick = () => { startSession('libre'); renderTrain(); window.scrollTo(0, 0); };
  $('#tr-lib').onclick = () => openExercisePicker(null);
  $('#rt-sel').onchange = e => { DB.profile.routine = e.target.value; saveData(); renderTrain(); };
  const ed = $('#rt-edit'); if (ed) ed.onclick = openRoutineEditor;
  $$('#view-train [data-start]').forEach(b => b.onclick = () => { startSession(p.routine, b.dataset.start); renderTrain(); window.scrollTo(0, 0); });
  $$('#view-train [data-sess]').forEach(tr => tr.onclick = () => openSessionDetail(tr.dataset.sess));
  bindRecovery($('#view-train'), renderTrain);
}

/** Ejercicios de la sesión: los del día (con los cambios por máquina ocupada) más los añadidos. */
function sessionExercises(s) {
  let base = [];
  if (s.routine !== 'libre') {
    const d = getRoutine(s.routine).days.find(x => x.id === s.dayId);
    base = d ? d.ex : [];
  }
  return base.concat(s.extra || []).map((e, i) => s.swaps && s.swaps[i] ? [s.swaps[i]].concat(e.slice(1)) : e);
}

function renderSession(s) {
  const exs = sessionExercises(s);
  const mins = Math.round((Date.now() - s.start) / 60000);
  const done = DB.lifts.filter(l => l.sid === s.id);
  const vol = done.reduce((a, l) => a + l.w * l.r, 0);
  $('#view-train').innerHTML = `
    <div class="card">
      <div class="row spread"><div><div class="small muted">Sesión en curso · ${mins} min</div><div style="font-size:18px;font-weight:700">${esc(s.dayName)}</div></div>
      <div style="text-align:right"><span class="pill">${done.length} series</span><div class="small muted" style="margin-top:4px">${Math.round(vol).toLocaleString('es-MX')} kg</div></div></div>
      ${isDeload() ? '<div class="status warn"><b>Día de descarga</b>Haz la mitad de las series con ~10 % menos peso y 3–4 reps en reserva.</div>'
        : '<p class="small muted" style="margin:8px 0 0">Visualiza la serie, pon la mente en el músculo y supera a tu yo de la última vez.</p>'}
    </div>
    ${exs.length ? exs.map((e, i) => exerciseCard(s, e, i)).join('') : '<div class="card"><div class="empty">Entreno libre: añade el primer ejercicio.</div></div>'}
    <button class="secondary block" id="ss-add" style="margin-bottom:10px">+ Añadir ejercicio</button>
    <button class="block" id="ss-finish">Terminar entreno</button>
    <button class="ghost block" id="ss-cancel" style="margin-top:6px">Descartar sesión</button>`;

  $$('#view-train [data-log]').forEach(b => b.onclick = () => logSet(s, Number(b.dataset.log)));
  $$('#view-train [data-unit]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.unit), ex = exs[i][0], u = unitFor(ex), nu = u === 'kg' ? 'lb' : 'kg';
    const inp = $('#w-' + i), val = num(inp.value);
    DB.units[ex] = nu; saveData();
    keepScroll(() => renderSession(s));
    if (val != null) $('#w-' + i).value = roundTo(fromKg(toKg(val, u), nu), nu === 'lb' ? 1 : 0.5);
  });
  $$('#view-train [data-sug]').forEach(b => b.onclick = () => {
    const [i, w, r] = b.dataset.sug.split('|'); $('#w-' + i).value = w; $('#r-' + i).value = r;
  });
  $$('#view-train [data-edit]').forEach(b => b.onclick = () => openEditSet(b.dataset.edit, () => keepScroll(() => renderSession(s))));
  $$('#view-train [data-swap]').forEach(b => b.onclick = () => openSwap(s, Number(b.dataset.swap)));
  $$('#view-train [data-video]').forEach(b => b.onclick = () => openVideo(exs[Number(b.dataset.video)][0]));
  $('#ss-add').onclick = () => openExercisePicker(name => {
    s.extra = s.extra || [];
    s.extra.push([name, 3, exInfo(name).t === 'c' ? '8–12' : '10–15', exInfo(name).t === 'c' ? 120 : 75]);
    saveData(); closeModal(); renderSession(s);
    setTimeout(() => { const cards = $$('#view-train .ex-card'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth' }); }, 50);
  });
  $('#ss-finish').onclick = finishSession;
  $('#ss-cancel').onclick = () => {
    if (!confirm('¿Descartar esta sesión y sus series?')) return;
    DB.lifts = DB.lifts.filter(l => l.sid !== s.id);
    DB.sessions = DB.sessions.filter(x => x.id !== s.id);
    closeSession(); renderTrain();
  };
}
function keepScroll(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

function exerciseCard(s, e, i) {
  const [name, sets, reps, rest] = e;
  const info = exInfo(name), u = unitFor(name);
  const done = DB.lifts.filter(l => l.sid === s.id && l.ex === name).sort((a, b) => a.t - b.t);
  const sug = suggestion(name, reps, s.id);
  const lastSet = done[done.length - 1];
  const preW = lastSet ? roundTo(fromKg(lastSet.w, u), u === 'lb' ? 1 : 0.5) : sug ? sug.a.w : '';
  const preR = lastSet ? lastSet.r : sug ? sug.a.r : '';
  const preRir = lastSet && lastSet.rir != null ? lastSet.rir : 2;
  const best = done.length ? Math.max(...done.map(d => e1rm(d.w, d.r))) : null;
  const swapped = s.swaps && s.swaps[i];
  return `<div class="ex-card">
    <div class="ex-head">
      <div class="ex-ico-wrap">${exIcon(name, 46)}</div>
      <div style="flex:1;min-width:0"><h4>${esc(name)}</h4>
        <div class="small muted">${EQUIP[info.e] || ''}${info.pf ? ' · <span style="color:#a78bfa">Planet Fitness</span>' : ''} · ${info.t === 'c' ? 'compuesto' : 'aislamiento'}${swapped ? ' · sustituto' : ''}</div></div>
    </div>
    <div class="target">${sets} series × ${esc(reps)} · descanso ${mmss(rest || 90)}</div>
    <div class="row" style="gap:6px;margin-bottom:8px">
      <button class="secondary small-btn" data-swap="${i}">⇄ Máquina ocupada</button>
      <button class="secondary small-btn" data-video="${i}">🎥 Técnica</button>
    </div>
    ${sug ? `<div class="suggest">
      <b>Hoy intenta:</b>
      <button class="chip-btn" data-sug="${i}|${sug.a.w}|${sug.a.r}">${sug.a.w} ${u} × ${sug.a.r}</button>
      ${sug.b ? `o <button class="chip-btn" data-sug="${i}|${sug.b.w}|${sug.b.r}">${sug.b.w} ${u} × ${sug.b.r}</button>` : ''}
      <div class="small muted" style="margin-top:4px">${esc(sug.why)} Última vez (${shortDate(sug.last.date)}): ${sug.last.sets.map(x => wFmt(x.w, u) + ' × ' + x.r + (x.rir != null ? ' (RIR ' + x.rir + ')' : '')).join(', ')}</div>
    </div>` : '<div class="last">Primera vez: anota tu punto de partida.</div>'}
    ${done.map((d, k) => {
      const tech = TECHNIQUES[d.tech] && d.tech !== 'normal' ? ` <span class="pill warn">${TECHNIQUES[d.tech].short}</span>` : '';
      const prs = DB.achievements.filter(a => a.id.startsWith('pr-' + d.id)).length;
      return `<div class="set-done tap" data-edit="${d.id}"><span>${k + 1}. <b>${wFmt(d.w, u)} × ${d.r}</b>${d.rir != null ? ` <span class="muted">RIR ${d.rir}</span>` : ''}${tech}${prs ? ' <span class="pill good">↑ PR</span>' : ''}</span><span class="small muted">1RM ${fmt(fromKg(e1rm(d.w, d.r), u), 0)}</span></div>`;
    }).join('')}
    ${best ? `<div class="small muted" style="margin:4px 0 0">1RM estimado hoy: <b style="color:var(--text)">${wFmt(best, u)}</b>${sug ? ` · antes: ${wFmt(sug.last.best, u)}` : ''}</div>` : ''}
    <div class="set-row" style="margin-top:8px">
      <span class="n">${done.length + 1}</span>
      <input id="w-${i}" inputmode="decimal" placeholder="peso" value="${preW}">
      <button class="secondary unit-btn" data-unit="${i}">${u}</button>
      <input id="r-${i}" inputmode="numeric" placeholder="reps" value="${preR}">
      <button data-log="${i}">✓</button>
    </div>
    <div class="grid2" style="gap:6px">
      <select id="q-${i}" class="small-sel">${RIR_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === preRir ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="t-${i}" class="small-sel">${Object.keys(TECHNIQUES).map(k => `<option value="${k}">${esc(TECHNIQUES[k].name)}</option>`).join('')}</select>
    </div>
  </div>`;
}

function logSet(s, i) {
  const e = sessionExercises(s)[i], ex = e[0], u = unitFor(ex);
  const w = num($('#w-' + i).value), r = num($('#r-' + i).value);
  if (w == null || w < 0 || r == null || r < 1 || r > 100) { toast('Revisa peso y repeticiones'); return; }
  const set = { id: uid(), ex, w: toKg(w, u), r: Math.round(r), rir: Number($('#q-' + i).value), date: s.date, t: Date.now(), sid: s.id, tech: $('#t-' + i).value };
  DB.lifts.push(set);
  const prs = checkSetRecords(set);
  saveData();
  if (prs.length) { toast('🏆 ¡Récord en ' + ex + '!'); vibrate(150); }
  startRest(e[3] || 90, 'Descanso · ' + ex);
  keepScroll(() => renderSession(s));
}

function openEditSet(id, after) {
  const l = DB.lifts.find(x => x.id === id);
  if (!l) return;
  const u = unitFor(l.ex);
  openModal(`
    <h3>Editar serie</h3>
    <p class="small muted" style="margin-top:0">${esc(l.ex)} · ${longDate(l.date)}</p>
    <div class="grid2">
      <label>Peso (${u})<input id="es-w" inputmode="decimal" value="${roundTo(fromKg(l.w, u), u === 'lb' ? 1 : 0.5)}"></label>
      <label>Repeticiones<input id="es-r" inputmode="numeric" value="${l.r}"></label>
    </div>
    <label>Esfuerzo<select id="es-q">${RIR_OPTIONS.map(([v, t]) => `<option value="${v}" ${v === l.rir ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label>Técnica<select id="es-t">${Object.keys(TECHNIQUES).map(k => `<option value="${k}" ${k === (l.tech || 'normal') ? 'selected' : ''}>${esc(TECHNIQUES[k].name)}</option>`).join('')}</select></label>
    <div class="row"><button class="danger" id="es-del">Borrar</button><button class="secondary" id="es-cancel" style="flex:1">Cancelar</button><button id="es-save" style="flex:1">Guardar</button></div>`, m => {
    $('#es-cancel', m).onclick = closeModal;
    $('#es-del', m).onclick = () => {
      DB.lifts = DB.lifts.filter(x => x.id !== id);
      DB.achievements = DB.achievements.filter(a => !a.id.startsWith('pr-' + id));
      saveData(); closeModal(); after();
    };
    $('#es-save', m).onclick = () => {
      const w = num($('#es-w', m).value), r = num($('#es-r', m).value);
      if (w == null || r == null || r < 1) { toast('Revisa peso y repeticiones'); return; }
      l.w = toKg(w, u); l.r = Math.round(r); l.rir = Number($('#es-q', m).value); l.tech = $('#es-t', m).value;
      saveData(); closeModal(); after();
    };
  });
}

/** Biblioteca de ejercicios: búsqueda, filtro por grupo y por Planet Fitness. Con onPick elige uno; sin él solo consulta. */
let pickerGroup = 'all', pickerPf = true;
function openExercisePicker(onPick) {
  const draw = (m, q) => {
    const list = Object.keys(EX).filter(n => (pickerGroup === 'all' || EX[n].g === pickerGroup) && (!pickerPf || EX[n].pf) && (!q || n.toLowerCase().includes(q.toLowerCase())));
    $('#pk-list', m).innerHTML = list.length ? list.map(n => {
      const x = EX[n];
      return `<button class="pick-row" data-pick="${esc(n)}">${exIcon(n, 40)}<span><b>${esc(n)}</b><br><small>${GROUPS[x.g] || x.g} · ${EQUIP[x.e]} · ${x.t === 'c' ? 'compuesto' : 'aislamiento'}${x.pf ? ' · PF' : ''}</small></span></button>`;
    }).join('') : '<div class="empty">Sin resultados.</div>';
    $$('[data-pick]', m).forEach(b => b.onclick = () => { if (onPick) onPick(b.dataset.pick); else openExerciseInfo(b.dataset.pick); });
  };
  openModal(`
    <div class="row spread"><h3 style="margin:0">${onPick ? 'Elige un ejercicio' : 'Ejercicios y máquinas'}</h3><button class="ghost" id="pk-close">Cerrar</button></div>
    <p class="small muted">${esc(PF_NOTE)}</p>
    <input id="pk-q" placeholder="Buscar (ej. prensa, remo, Smith)…">
    <div class="row" style="gap:6px;margin:8px 0">
      <select id="pk-g" style="flex:1"><option value="all">Todos los grupos</option>${Object.keys(GROUPS).map(g => `<option value="${g}" ${pickerGroup === g ? 'selected' : ''}>${GROUPS[g]}</option>`).join('')}</select>
      <label class="check" style="margin:0;white-space:nowrap"><input type="checkbox" id="pk-pf" ${pickerPf ? 'checked' : ''}> Solo PF</label>
    </div>
    <div id="pk-list"></div>`, m => {
    $('#pk-close', m).onclick = closeModal;
    $('#pk-q', m).oninput = e => draw(m, e.target.value);
    $('#pk-g', m).onchange = e => { pickerGroup = e.target.value; draw(m, $('#pk-q', m).value); };
    $('#pk-pf', m).onchange = e => { pickerPf = e.target.checked; draw(m, $('#pk-q', m).value); };
    draw(m, '');
  });
}
function openExerciseInfo(name) {
  const x = EX[name], subs = substitutes(name);
  const sets = DB.lifts.filter(l => l.ex === name), u = unitFor(name);
  const top = sets.length ? sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a) : null;
  openModal(`
    <div class="row spread"><h3 style="margin:0">${esc(name)}</h3><button class="ghost" id="ei-back">Volver</button></div>
    <div class="ex-hero">${exIcon(name, 120)}</div>
    <p class="small">${GROUPS[x.g] || x.g} · ${EQUIP[x.e]} · ${x.t === 'c' ? 'compuesto' : 'aislamiento'}${x.pf ? ' · disponible en Planet Fitness' : ''}</p>
    ${top ? `<p class="small">Tu mejor serie: <b>${wFmt(top.w, u)} × ${top.r}</b> · 1RM estimado ${wFmt(e1rm(top.w, top.r), u)}</p>` : ''}
    <p class="small muted" style="margin-bottom:4px">Sustitutos si está ocupado:</p>
    <div class="chips">${subs.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>`, m => {
    $('#ei-back', m).onclick = () => openExercisePicker(null);
  });
}

function openSwap(s, i) {
  const all = sessionExercises(s), cur = all[i][0];
  const inSession = all.map(e => e[0]);
  const subs = substitutes(cur).filter(n => !inSession.includes(n));   // sin repetir uno que ya está en la sesión
  openModal(`
    <div class="row spread"><h3 style="margin:0">¿${esc(cur)} ocupado?</h3><button class="ghost" id="sw-close">Cerrar</button></div>
    <p class="small muted">Mismo patrón de movimiento y mismos músculos. Planet Fitness primero.</p>
    ${subs.map(n => `<button class="pick-row" data-sub="${esc(n)}">${exIcon(n, 40)}<span><b>${esc(n)}</b><br><small>${EQUIP[EX[n].e]}${EX[n].pf ? ' · PF' : ''}${EX[n].p === EX[cur].p ? ' · mismo movimiento' : ' · alternativa'}</small></span></button>`).join('')}
    ${s.swaps && s.swaps[i] ? '<button class="secondary block" id="sw-undo" style="margin-top:8px">Volver al original</button>' : ''}`, m => {
    $('#sw-close', m).onclick = closeModal;
    $$('[data-sub]', m).forEach(b => b.onclick = () => { s.swaps = s.swaps || {}; s.swaps[i] = b.dataset.sub; saveData(); closeModal(); keepScroll(() => renderSession(s)); toast('Cambiado por ' + b.dataset.sub); });
    const un = $('#sw-undo', m); if (un) un.onclick = () => { delete s.swaps[i]; saveData(); closeModal(); keepScroll(() => renderSession(s)); };
  });
}

/**
 * Video de técnica: cámara lenta, avance cuadro a cuadro y marcas manuales de cada repetición
 * (inicio y fin de la subida) para medir la duración de la fase concéntrica y la pérdida de velocidad.
 */
function openVideo(name) {
  openModal(`
    <div class="row spread"><h3 style="margin:0">Técnica · ${esc(name)}</h3><button class="ghost" id="vd-close">Cerrar</button></div>
    <p class="small muted">Graba de lado, con todo el cuerpo y la barra en el cuadro. El video no se guarda en la app.</p>
    <label>Video<input type="file" id="vd-file" accept="video/*"></label>
    <div id="vd-box" style="display:none">
      <video id="vd" playsinline controls style="width:100%;border-radius:12px;background:#000"></video>
      <div class="row" style="gap:6px;margin:8px 0">${[0.25, 0.5, 1].map(r => `<button class="secondary small-btn" data-rate="${r}">${r}×</button>`).join('')}
        <button class="secondary small-btn" data-step="-1">◀ cuadro</button><button class="secondary small-btn" data-step="1">cuadro ▶</button></div>
      <div class="grid2"><button class="secondary" id="vd-a">Inicio de subida</button><button class="secondary" id="vd-b">Fin de subida</button></div>
      <div id="vd-reps" class="small" style="margin-top:10px"></div>
    </div>`, m => {
    let url = null, mark = null; const reps = [];
    const v = $('#vd', m);
    const drawReps = () => {
      if (!reps.length) { $('#vd-reps', m).innerHTML = '<span class="muted">Marca el inicio y el fin de la subida de cada repetición.</span>'; return; }
      const loss = reps.length > 1 ? Math.round((1 - reps[0] / reps[reps.length - 1]) * 100) : 0;
      $('#vd-reps', m).innerHTML = reps.map((d, k) => `Rep ${k + 1}: <b>${d.toFixed(2)} s</b> de subida`).join('<br>') +
        (reps.length > 1 ? `<div class="status ${loss > 30 ? 'warn' : 'info'}" style="margin-top:8px"><b>Pérdida de velocidad: ${loss} %</b>${loss > 30 ? 'La última rep fue mucho más lenta que la primera: estás cerca del fallo (RIR 0–1). Para fuerza, corta la serie antes.' : 'Velocidad estable: te quedaban reps en reserva.'}</div>` : '');
    };
    $('#vd-close', m).onclick = () => { if (url) URL.revokeObjectURL(url); closeModal(); };
    $('#vd-file', m).onchange = ev => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(f); v.src = url; $('#vd-box', m).style.display = 'block'; drawReps();
    };
    $$('[data-rate]', m).forEach(b => b.onclick = () => { v.playbackRate = Number(b.dataset.rate); });
    $$('[data-step]', m).forEach(b => b.onclick = () => { v.pause(); v.currentTime = Math.max(0, v.currentTime + Number(b.dataset.step) / 30); });
    $('#vd-a', m).onclick = () => { mark = v.currentTime; toast('Inicio marcado en ' + mark.toFixed(2) + ' s'); };
    $('#vd-b', m).onclick = () => {
      if (mark == null || v.currentTime <= mark) { toast('Marca primero el inicio de la subida'); return; }
      reps.push(v.currentTime - mark); mark = null; drawReps();
    };
  });
}

function openSessionDetail(id) {
  const s = DB.sessions.find(x => x.id === id);
  if (!s) return;
  const sets = DB.lifts.filter(l => l.sid === id).sort((a, b) => a.t - b.t);
  const byEx = {};
  sets.forEach(l => (byEx[l.ex] = byEx[l.ex] || []).push(l));
  openModal(`
    <div class="row spread"><h3 style="margin:0">${esc(s.dayName)}</h3><button class="ghost" id="sd-close">Cerrar</button></div>
    <p class="small muted">${longDate(s.date)} · ${Math.round((s.end - s.start) / 60000)} min · ${sets.length} series · ${Math.round(sessionVolume(id)).toLocaleString('es-MX')} kg de volumen</p>
    ${Object.keys(byEx).map(ex => { const u = unitFor(ex); return `<div class="row" style="margin:10px 0 2px;gap:8px">${exIcon(ex, 28)}<b>${esc(ex)}</b></div><p class="small muted" style="margin:0">${byEx[ex].map(l => wFmt(l.w, u) + ' × ' + l.r + (l.rir != null ? ' @RIR' + l.rir : '') + (l.tech && l.tech !== 'normal' ? ' ' + TECHNIQUES[l.tech].short : '')).join(' · ')}</p>`; }).join('')}
    <button class="danger block" id="sd-del" style="margin-top:16px">Borrar sesión</button>`, m => {
    $('#sd-close', m).onclick = closeModal;
    $('#sd-del', m).onclick = () => {
      if (!confirm('¿Borrar la sesión y sus series?')) return;
      const ids = new Set(DB.lifts.filter(l => l.sid === id).map(l => l.id));
      DB.lifts = DB.lifts.filter(l => l.sid !== id);
      DB.achievements = DB.achievements.filter(a => !(a.pr && [...ids].some(x => a.id.startsWith('pr-' + x))) && a.id !== 'vol-' + id);
      DB.sessions = DB.sessions.filter(x => x.id !== id);
      saveData(); closeModal(); renderTrain();
    };
  });
}

/* Editor de rutina personalizada */
function openRoutineEditor() {
  const c = DB.custom;
  const draw = m => {
    m.innerHTML = `
      <div class="row spread"><h3 style="margin:0">Mi rutina</h3><button class="ghost" id="re-close">Listo</button></div>
      <label style="margin-top:10px">Nombre<input id="re-name" value="${esc(c.name)}"></label>
      <p class="small muted" style="margin-top:0">Consejo del libro: 75 % compuestos y 25 % aislamiento.</p>
      ${c.days.map((d, di) => `
        <div class="ex-card">
          <div class="row spread"><h4>${esc(d.name)}</h4><button class="ghost" data-delday="${di}">Borrar día</button></div>
          ${d.ex.map((e, ei) => `<div class="set-done"><span>${esc(e[0])} · ${e[1]}×${esc(e[2])}</span><button class="ghost" data-delex="${di}:${ei}">✕</button></div>`).join('')}
          <select id="re-ex-${di}" style="margin-top:8px">${Object.keys(EX).map(n => `<option>${esc(n)}</option>`).join('')}</select>
          <div class="grid3" style="margin-top:6px">
            <input id="re-sets-${di}" inputmode="numeric" value="4" placeholder="series">
            <input id="re-reps-${di}" value="8–12" placeholder="reps">
            <input id="re-rest-${di}" inputmode="numeric" value="90" placeholder="desc. s">
          </div>
          <button class="secondary block" data-addex="${di}" style="margin-top:6px">+ Añadir a ${esc(d.name)}</button>
        </div>`).join('')}
      <div class="row" style="margin-top:6px"><input id="re-dayname" placeholder="Nombre del día (ej. Día 1 · Pecho)"><button id="re-addday">+ Día</button></div>`;
    $('#re-close', m).onclick = () => { c.name = $('#re-name', m).value.trim() || 'Mi rutina'; saveData(); closeModal(); renderTrain(); };
    $('#re-addday', m).onclick = () => {
      const n = $('#re-dayname', m).value.trim();
      if (!n) { toast('Escribe el nombre del día'); return; }
      c.days.push({ id: uid(), name: n, ex: [] }); saveData(); draw(m);
    };
    $$('[data-delday]', m).forEach(b => b.onclick = () => { if (confirm('¿Borrar este día?')) { c.days.splice(Number(b.dataset.delday), 1); saveData(); draw(m); } });
    $$('[data-delex]', m).forEach(b => b.onclick = () => { const [di, ei] = b.dataset.delex.split(':').map(Number); c.days[di].ex.splice(ei, 1); saveData(); draw(m); });
    $$('[data-addex]', m).forEach(b => b.onclick = () => {
      const di = Number(b.dataset.addex);
      c.days[di].ex.push([$('#re-ex-' + di, m).value, num($('#re-sets-' + di, m).value) || 3, $('#re-reps-' + di, m).value || '10', num($('#re-rest-' + di, m).value) || 90]);
      saveData(); draw(m);
    });
  };
  openModal('', draw);
}

/* ------------------------------------------------------------------ *
 *  NUTRICIÓN
 * ------------------------------------------------------------------ */
function renderFood() {
  const p = DB.profile, t = todayStr(), tg = targets(), tot = dayTotals(t);
  const meals = (DB.days[t] && DB.days[t].meals) || [];
  const left = pwoLeft();
  $('#view-food').innerHTML = `
    <div class="card">
      <h2>Tu objetivo diario</h2>
      <div class="big">${tg.kcal.toLocaleString('es-MX')} <span class="muted" style="font-size:16px;font-weight:500">kcal</span></div>
      <p class="small muted" style="margin:4px 0 10px">${p.autoMacros
        ? `${fmt(currentWeight())} kg = ${Math.round(tg.lb)} lb × ${tg.factor} (${p.phase === 'definicion' ? 'definición' : p.phase === 'volumen' ? 'volumen' : 'mantenimiento'}) · fórmula de Marc McLean. Se recalcula sola con tu peso.`
        : 'Calorías y proteína manuales (cámbialo en Más → Perfil).'}</p>
      <div class="grid3">
        <div class="stat"><div class="label">Proteína</div><div class="value">${tg.protein}<small> g</small></div><div class="small muted">${fmt(tg.protein / currentWeight(), 1)} g/kg</div></div>
        <div class="stat"><div class="label">Carbos</div><div class="value">${tg.carbs}<small> g</small></div></div>
        <div class="stat"><div class="label">Grasa</div><div class="value">${tg.fat}<small> g</small></div></div>
      </div>
      <p class="small muted" style="margin:10px 0 0">${esc(tg.soma.name)}: ${tg.soma.c} % carbohidratos · ${tg.soma.p} % proteína · ${tg.soma.f} % grasa. Reparte en 3–4 comidas completas.</p>
    </div>

    <div class="card">
      <h2>Hoy</h2>
      <div class="row spread small"><span><b>${tot.kcal.toLocaleString('es-MX')}</b> / ${tg.kcal.toLocaleString('es-MX')} kcal</span><span>${tot.meals} comida${tot.meals === 1 ? '' : 's'}</span></div>
      <div class="macros">
        <div class="macro p"><div class="label"><span>Proteína</span><span>${Math.round(tot.p)}/${tg.protein}</span></div>${bar(tot.p, tg.protein)}</div>
        <div class="macro c"><div class="label"><span>Carbos</span><span>${Math.round(tot.c)}/${tg.carbs}</span></div>${bar(tot.c, tg.carbs)}</div>
        <div class="macro f"><div class="label"><span>Grasa</span><span>${Math.round(tot.f)}/${tg.fat}</span></div>${bar(tot.f, tg.fat)}</div>
      </div>
      <div class="row spread small" style="margin-top:10px"><span>Azúcar refinada</span><span style="color:${tot.s > tg.sugar ? 'var(--bad)' : 'var(--good)'}">${Math.round(tot.s)} / ${tg.sugar} g máx.</span></div>
      <div class="row spread small" style="margin-top:4px"><span>Agua</span><span>${fmt(tot.water / 1000, 2)} / ${fmt(tg.water / 1000, 1)} L</span></div>
      ${meals.length ? `<table style="margin-top:10px"><thead><tr><th>Comida</th><th class="num">P</th><th class="num">C</th><th class="num">G</th><th></th></tr></thead><tbody>
        ${meals.map((m, i) => `<tr><td>${esc(m.name)}${m.partial ? ' <span class="muted small">(' + m.kcal + ' kcal, sin macros)</span>' : ''}</td><td class="num">${Math.round(m.p)}</td><td class="num">${Math.round(m.c)}</td><td class="num">${Math.round(m.f)}</td><td class="num"><button class="ghost" data-delmeal="${i}">✕</button></td></tr>`).join('')}
      </tbody></table>` : ''}
      <button class="block" id="fd-add" style="margin-top:12px">+ Añadir comida</button>
    </div>

    ${left != null ? pwoCard() : `
    <div class="card">
      <h2>Ventana post-entreno</h2>
      <p class="small" style="margin-top:0">De 30 a 45 min después de entrenar el cuerpo pasa de catabólico a anabólico. En los primeros 5–15 min:</p>
      <ul class="list-plain small">${PWO_ITEMS.map(([, n, s]) => `<li><b>${esc(n)}</b> · <span class="muted">${esc(s)}</span></li>`).join('')}</ul>
      <p class="small muted">Arranca sola al terminar un entreno.</p>
      <button class="secondary block" id="fd-pwo">Iniciar ventana ahora</button>
    </div>`}

    <div class="card">
      <h2>Proteína completa</h2>
      <div class="chips">${PROTEIN_SOURCES.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
      <p class="small muted" style="margin:10px 0 0">Los libros llegan a 1.5 g por libra (~3.3 g/kg) en hipertrofia avanzada. Tu objetivo actual, según el reparto por somatotipo, es ${tg.protein} g (${fmt(tg.protein / currentWeight(), 1)} g/kg).</p>
    </div>`;

  $('#fd-add').onclick = () => openMealForm(t);
  const pw = $('#fd-pwo'); if (pw) pw.onclick = () => { startPwo(); renderFood(); };
  $$('#view-food [data-delmeal]').forEach(b => b.onclick = () => {
    DB.days[t].meals.splice(Number(b.dataset.delmeal), 1); saveData(); renderFood();
  });
  bindPwo($('#view-food'));
}

let mealTab = 'basic';
function openMealForm(date) {
  const foodGrid = () => mealTab === 'basic'
    ? FOODS.map((f, i) => `<button class="secondary food-btn" data-food="${i}">${esc(f[0])}<small>P ${f[1]} · C ${f[2]} · G ${f[3]}</small></button>`).join('')
    : MCDONALDS.map((f, i) => `<button class="secondary food-btn" data-mc="${i}">${esc(f[0])}<small>${f[1]} kcal${f[2] != null ? ` · P ${f[2]} · C ${f[3]} · G ${f[4]}` : ' · solo kcal'}${f[5] ? ' · ⚠' : ''}</small></button>`).join('');
  openModal(`
    <h3>Añadir comida</h3>
    <div class="seg"><button data-mt="basic" class="${mealTab === 'basic' ? 'on' : ''}">Básicos</button><button data-mt="mc" class="${mealTab === 'mc' ? 'on' : ''}">McDonald's</button></div>
    <p class="small muted" style="margin-top:0">${mealTab === 'basic' ? 'Toca un alimento para sumarlo (valores aproximados) o escribe los tuyos.'
      : 'De tu Excel: FatSecret México, datos no oficiales. Los que solo traen kcal suman calorías pero no macros. ⚠ = dato dudoso en la fuente.'}</p>
    <div class="grid2" style="margin-bottom:12px" id="ml-grid">${foodGrid()}</div>
    <label>Nombre<input id="ml-name" placeholder="Ej. Comida 2: pollo con arroz"></label>
    <div class="grid2">
      <label>Proteína (g)<input id="ml-p" inputmode="decimal"></label>
      <label>Carbohidratos (g)<input id="ml-c" inputmode="decimal"></label>
      <label>Grasa (g)<input id="ml-f" inputmode="decimal"></label>
      <label>Azúcar refinada (g)<input id="ml-s" inputmode="decimal"></label>
      <label>Kcal (si no sabes los macros)<input id="ml-k" inputmode="numeric"></label>
    </div>
    <div class="row"><button class="secondary" id="ml-close" style="flex:1">Cerrar</button><button id="ml-save" style="flex:1">Guardar</button></div>`, m => {
    const add = meal => {
      const e = day(date); e.meals = e.meals || []; e.meals.push(meal); saveData();
      toast('Sumado: ' + meal.name + (meal.kcal != null ? ' (' + meal.kcal + ' kcal)' : ''));
    };
    $$('[data-mt]', m).forEach(b => b.onclick = () => { mealTab = b.dataset.mt; openMealForm(date); });
    $$('[data-food]', m).forEach(b => b.onclick = () => {
      const f = FOODS[Number(b.dataset.food)];
      add({ name: f[0], p: f[1], c: f[2], f: f[3], s: f[4], t: Date.now() });
    });
    $$('[data-mc]', m).forEach(b => b.onclick = () => {
      const f = MCDONALDS[Number(b.dataset.mc)];
      add({ name: "McDonald's · " + f[0], kcal: f[1], p: f[2] || 0, c: f[3] || 0, f: f[4] || 0, s: 0, partial: f[2] == null, t: Date.now() });
    });
    $('#ml-close', m).onclick = () => { closeModal(); render(currentTab); };
    $('#ml-save', m).onclick = () => {
      const meal = { name: $('#ml-name', m).value.trim() || 'Comida', p: num($('#ml-p', m).value) || 0, c: num($('#ml-c', m).value) || 0, f: num($('#ml-f', m).value) || 0, s: num($('#ml-s', m).value) || 0, t: Date.now() };
      const k = num($('#ml-k', m).value);
      if (k != null) meal.kcal = k;
      if (!meal.p && !meal.c && !meal.f && k == null) { toast('Escribe macros o kcal'); return; }
      add(meal); closeModal(); render(currentTab);
    };
  });
}

/* ------------------------------------------------------------------ *
 *  PROGRESO: peso, medidas, fuerza y fotos
 * ------------------------------------------------------------------ */
let progMode = 'weight';
function renderProgress() {
  const seg = `<div class="seg">${[['weight', 'Peso'], ['measures', 'Medidas'], ['strength', 'Fuerza'], ['photos', 'Fotos'], ['logros', 'Logros']].map(([k, n]) => `<button data-mode="${k}" class="${progMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const v = $('#view-progress');
  v.innerHTML = seg + '<div id="prog-body"></div>';
  $$('#view-progress .seg button').forEach(b => b.onclick = () => { progMode = b.dataset.mode; redrawChart = () => {}; renderProgress(); });
  ({ weight: renderWeight, measures: renderMeasures, strength: renderStrength, photos: renderPhotos, logros: renderAchievements })[progMode]($('#prog-body'));
}

function renderWeight(el) {
  const p = DB.profile, t = todayStr();
  const proj = projection();
  let projTxt = 'Necesito al menos 2 semanas de pesos para estimarlo.';
  if (proj && proj.done) projTxt = '¡Llegaste a tu peso objetivo! Cambia la fase en Más → Perfil.';
  else if (proj && proj.stalled) projTxt = 'Con el ritmo actual no te estás acercando al objetivo.';
  else if (proj) projTxt = `A ${fmt(Math.abs(proj.rate), 2)} kg/sem llegarías hacia el <b>${longDate(proj.date)}</b> (~${Math.round(proj.weeks)} semanas).`;
  const dates = Object.keys(DB.days).sort().reverse().slice(0, 60);
  el.innerHTML = `
    <button class="block" id="pw-add">+ Registrar día</button>
    <div class="card" style="margin-top:12px">
      <h2>Peso <small>· últimos 90 días</small></h2>
      <canvas class="chart" id="w-chart"></canvas>
      <div class="legend"><span><i style="background:var(--muted)"></i>Diario</span><span><i style="background:var(--accent)"></i>Media 7 días</span><span><i style="background:var(--good)"></i>Meta</span></div>
      <p class="small" style="margin:10px 0 0">${projTxt}</p>
    </div>
    <div class="card">
      <h2>Historial <small>· toca un día para editarlo</small></h2>
      ${dates.length ? `<table><thead><tr><th>Día</th><th class="num">Kg</th><th class="num">Kcal</th><th class="num">Prot</th><th class="num">Agua</th><th></th></tr></thead><tbody>
        ${dates.map(d => { const e = DB.days[d], tt = dayTotals(d); return `<tr class="tap" data-date="${d}"><td>${shortDate(d)}</td><td class="num">${e.weight != null ? fmt(e.weight) : '—'}</td><td class="num">${tt.kcal || '—'}</td><td class="num">${tt.p ? Math.round(tt.p) : '—'}</td><td class="num">${tt.water ? fmt(tt.water / 1000, 1) : '—'}</td><td>${e.trained ? '💪' : ''}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">Aún no hay registros.</div>'}
    </div>`;
  $('#pw-add').onclick = () => openDayForm(t);
  $$('#prog-body tr.tap').forEach(tr => tr.onclick = () => openDayForm(tr.dataset.date));
  const entries = weightEntries().filter(e => e.date >= addDays(t, -90));
  showChart(() => drawChart($('#w-chart'), {
    series: [{ points: entries.map(e => ({ date: e.date, y: e.w })), color: getVar('--muted'), dots: true, line: false },
      { points: movingAvg(entries), color: getVar('--accent'), width: 3 }],
    hlines: [{ y: p.goalWeight, color: getVar('--good'), label: 'Meta' }]
  }));
}

function openDayForm(date) {
  const e = DB.days[date] || {};
  const v = x => x == null ? '' : x;
  openModal(`
    <h3>Registro del día</h3>
    <label>Fecha<input type="date" id="f-date" value="${date}" max="${todayStr()}"></label>
    <div class="grid2">
      <label>Peso (kg)<input id="f-weight" inputmode="decimal" placeholder="88.0" value="${v(e.weight)}"></label>
      <label>Pasos<input id="f-steps" inputmode="numeric" placeholder="${DB.profile.steps}" value="${v(e.steps)}"></label>
      <label>Sueño (horas)<input id="f-sleep" inputmode="decimal" placeholder="7.5" value="${v(e.sleep)}"></label>
      <label>Agua (ml)<input id="f-water" inputmode="numeric" placeholder="${DB.profile.waterGoal}" value="${v(e.water)}"></label>
    </div>
    <label class="check"><input type="checkbox" id="f-trained" ${e.trained ? 'checked' : ''}> Entrené este día</label>
    <label>Nota / sensaciones<textarea id="f-note" rows="2" placeholder="Energía, bombeo, comida libre…">${esc(e.note || '')}</textarea></label>
    <div class="row">
      <button class="secondary" id="f-cancel" style="flex:1">Cancelar</button>
      <button id="f-save" style="flex:1">Guardar</button>
    </div>`, m => {
    $('#f-cancel', m).onclick = closeModal;
    $('#f-date', m).onchange = ev => { if (ev.target.value) openDayForm(ev.target.value); };
    $('#f-save', m).onclick = () => {
      const d = $('#f-date', m).value || date;
      const rec = day(d);
      const set = (k, val) => { if (val == null || val === '' || val === false) delete rec[k]; else rec[k] = val; };
      const w = num($('#f-weight', m).value);
      if (w != null && (w < 30 || w > 300)) { toast('Revisa el peso'); return; }
      set('weight', w); set('steps', num($('#f-steps', m).value)); set('sleep', num($('#f-sleep', m).value));
      set('water', num($('#f-water', m).value)); set('trained', $('#f-trained', m).checked); set('note', $('#f-note', m).value.trim());
      if (!Object.keys(rec).length) delete DB.days[d];
      checkDailyMilestones();
      saveData(); closeModal(); render(currentTab); toast('Guardado');
    };
  });
}

function renderMeasures(el) {
  const list = DB.measures.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const waist = DB.measures.filter(m => m.waist != null).sort((a, b) => a.date < b.date ? -1 : 1);
  el.innerHTML = `
    <button class="block" id="meas-add">+ Nuevas medidas</button>
    <div class="card" style="margin-top:12px"><h2>Cintura <small>· a la altura del ombligo</small></h2><canvas class="chart" id="waist-chart"></canvas></div>
    <div class="card"><h2>Historial</h2>
      ${list.length ? `<table><thead><tr><th>Día</th><th class="num">Cintura</th><th class="num">Pecho</th><th class="num">Brazo</th><th class="num">Cadera</th></tr></thead><tbody>
        ${list.map(m => `<tr class="tap" data-id="${m.id}"><td>${shortDate(m.date)}</td><td class="num">${fmt(m.waist)}</td><td class="num">${fmt(m.chest)}</td><td class="num">${fmt(m.arm)}</td><td class="num">${fmt(m.hip)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Mide cintura, pecho y brazo cada 4 semanas.</div>'}
    </div>
    <p class="small muted">Si la cintura baja y la fuerza se mantiene, estás perdiendo grasa y no músculo.</p>`;
  $('#meas-add').onclick = () => openMeasureForm();
  $$('#prog-body tr.tap').forEach(tr => tr.onclick = () => openMeasureForm(tr.dataset.id));
  showChart(() => drawChart($('#waist-chart'), { series: [{ points: waist.map(m => ({ date: m.date, y: m.waist })), color: getVar('--blue'), dots: true, r: 3.5 }] }));
}

function openMeasureForm(id) {
  const m0 = DB.measures.find(x => x.id === id) || { date: todayStr() };
  const v = x => x == null ? '' : x;
  openModal(`
    <h3>Medidas</h3>
    <label>Fecha<input type="date" id="m-date" value="${m0.date}" max="${todayStr()}"></label>
    <div class="grid2">
      <label>Cintura (cm)<input id="m-waist" inputmode="decimal" value="${v(m0.waist)}"></label>
      <label>Pecho (cm)<input id="m-chest" inputmode="decimal" value="${v(m0.chest)}"></label>
      <label>Brazo (cm)<input id="m-arm" inputmode="decimal" value="${v(m0.arm)}" placeholder="flexionado"></label>
      <label>Cadera (cm)<input id="m-hip" inputmode="decimal" value="${v(m0.hip)}"></label>
    </div>
    <div class="row">${id ? '<button class="danger" id="m-del">Borrar</button>' : ''}<button class="secondary" id="m-cancel" style="flex:1">Cancelar</button><button id="m-save" style="flex:1">Guardar</button></div>`, m => {
    $('#m-cancel', m).onclick = closeModal;
    const del = $('#m-del', m);
    if (del) del.onclick = () => { DB.measures = DB.measures.filter(x => x.id !== id); saveData(); closeModal(); renderProgress(); };
    $('#m-save', m).onclick = () => {
      const rec = { id: id || uid(), date: $('#m-date', m).value || todayStr(), waist: num($('#m-waist', m).value), chest: num($('#m-chest', m).value), arm: num($('#m-arm', m).value), hip: num($('#m-hip', m).value) };
      if ([rec.waist, rec.chest, rec.arm, rec.hip].every(x => x == null)) { toast('Escribe al menos una medida'); return; }
      DB.measures = DB.measures.filter(x => x.id !== rec.id).concat(rec);
      saveData(); closeModal(); renderProgress(); toast('Guardado');
    };
  });
}

let liftSel = null;
function strengthLevelCard() {
  const lv = strengthLevels(), bw = currentWeight();
  return `<div class="card">
    <h2>Nivel de fuerza <small>· 1RM estimado ÷ peso corporal (${fmt(bw)} kg)</small></h2>
    ${lv.map(l => {
      const max = l.cuts[2] * 1.25, pos = l.ratio == null ? 0 : Math.min(100, l.ratio / max * 100);
      return `<div style="margin:10px 0">
        <div class="row spread small"><b>${l.name}</b><span>${l.ratio == null ? '<span class="muted">sin datos</span>' : `${fmt(l.best, 0)} kg · ${fmt(l.ratio, 2)}× · <b style="color:var(--accent)">${STRENGTH_LEVELS[l.level]}</b>${l.smith ? ' <span class="muted">(Smith)</span>' : ''}`}</span></div>
        <div class="level-bar">${l.cuts.map(c => `<i style="left:${c / max * 100}%"></i>`).join('')}<div style="width:${pos}%"></div></div>
        <div class="row spread small muted" style="font-size:11px"><span>Princ.</span><span>${l.cuts[0]}×</span><span>${l.cuts[1]}×</span><span>${l.cuts[2]}× Élite</span></div>
      </div>`;
    }).join('')}
    <p class="small muted" style="margin:6px 0 0">Estándares generales aproximados para hombres. En Smith la barra guiada infla un poco la marca.</p>
  </div>`;
}

function renderStrength(el) {
  const used = Array.from(new Set(DB.lifts.map(l => l.ex)));
  if (!liftSel || !used.includes(liftSel)) liftSel = used[0] || null;
  if (!liftSel) { el.innerHTML = strengthLevelCard() + '<div class="card"><div class="empty">Registra tus entrenos en la pestaña Entreno y aquí verás la evolución de cada ejercicio.</div></div>'; return; }
  const u = unitFor(liftSel);
  const sets = DB.lifts.filter(l => l.ex === liftSel);
  const byDay = {};
  sets.forEach(s => { const v = e1rm(s.w, s.r); if (!byDay[s.date] || v > byDay[s.date]) byDay[s.date] = v; });
  const pts = Object.keys(byDay).sort().map(d => ({ date: d, y: fromKg(byDay[d], u) }));
  const best = sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a);
  const [w0, w1] = weeklyBest(liftSel, 2);
  const vol = {}; sets.forEach(s => { vol[s.date] = (vol[s.date] || 0) + s.w * s.r; });
  el.innerHTML = `
    ${strengthLevelCard()}
    <div class="card">
      <label style="margin-bottom:12px">Ejercicio<select id="lift-sel">${used.map(n => `<option ${n === liftSel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat"><div class="label">Mejor serie</div><div class="value" style="font-size:16px">${wFmt(best.w, u)}×${best.r}</div></div>
        <div class="stat"><div class="label">1RM estimado</div><div class="value" style="font-size:16px">${wFmt(e1rm(best.w, best.r), u)}</div></div>
        <div class="stat"><div class="label">vs. sem. pasada</div><div class="value" style="font-size:16px;color:${w0 != null && w1 != null ? (w0 >= w1 ? 'var(--good)' : 'var(--warn)') : 'var(--muted)'}">${w0 != null && w1 != null ? signed(fromKg(w0 - w1, u), 1) : '—'}</div></div>
      </div>
      <canvas class="chart" id="lift-chart"></canvas>
      <div class="legend"><span><i style="background:var(--accent)"></i>1RM estimado (${u}) = peso × (1 + reps / 30), mejor serie del día</span></div>
    </div>
    <div class="card"><h2>Volumen por sesión <small>· peso × reps</small></h2>
      <table><tbody>${Object.keys(vol).sort().reverse().slice(0, 12).map(d => `<tr><td>${shortDate(d)}</td><td class="num">${Math.round(fromKg(vol[d], u)).toLocaleString('es-MX')} ${u}</td></tr>`).join('')}</tbody></table>
    </div>`;
  $('#lift-sel').onchange = e => { liftSel = e.target.value; renderProgress(); };
  showChart(() => drawChart($('#lift-chart'), { series: [{ points: pts, color: getVar('--accent'), dots: true, r: 3.5 }], yDec: 0, minPad: 2 }));
}

function renderAchievements(el) {
  checkDailyMilestones(); saveData();
  const list = DB.achievements.slice().sort((a, b) => (b.t || 0) - (a.t || 0));
  const prs = list.filter(a => a.pr), badges = list.filter(a => !a.pr);
  el.innerHTML = `
    <div class="grid3" style="margin-bottom:12px">
      <div class="stat"><div class="label">Racha semanas</div><div class="value">${trainingStreakWeeks()}</div><div class="small muted">3+ entrenos</div></div>
      <div class="stat"><div class="label">Días pesándote</div><div class="value">${weighStreakDays()}</div><div class="small muted">seguidos</div></div>
      <div class="stat"><div class="label">Récords</div><div class="value">${prs.length}</div><div class="small muted">personales</div></div>
    </div>
    <div class="card"><h2>Logros desbloqueados</h2>
      ${badges.length ? badges.map(a => `<div class="badge-row"><span class="badge">🏆</span><span><b>${esc(a.title)}</b><br><small class="muted">${esc(a.detail || '')} · ${shortDate(a.date)}</small></span></div>`).join('')
        : '<div class="empty">Termina tu primera sesión para desbloquear el primero.</div>'}
    </div>
    <div class="card"><h2>Récords personales recientes</h2>
      ${prs.length ? prs.slice(0, 30).map(a => `<div class="badge-row"><span class="badge">↑</span><span><b>${esc(a.title)}</b><br><small class="muted">${esc(a.detail || '')} · ${shortDate(a.date)}</small></span></div>`).join('')
        : '<div class="empty">Supera una marca (peso, reps a un peso o 1RM) y aparecerá aquí.</div>'}
    </div>`;
}

/* Fotos */
function photoWeight(p) { const w = p.weight || (weekAvg(p.date) && weekAvg(p.date).avg); return w ? ' · ' + fmt(w) + ' kg' : ''; }
const POSES = { frente: 'Frente', lado: 'Lado', espalda: 'Espalda', objetivo: 'Objetivo' };
let photoCache = [], cmpA = null, cmpB = null, cmpMode = 'side', cmpOpacity = 50, cmpGrid = true;

async function renderPhotos(el) {
  el.innerHTML = '<div class="empty">Cargando fotos…</div>';
  try { photoCache = await photoStore.all(); }
  catch (e) { el.innerHTML = '<div class="empty">No se pudieron abrir las fotos: ' + esc(e.message) + '</div>'; return; }
  if (progMode !== 'photos' || currentTab !== 'progress') return;
  const list = photoCache;
  if (!list.find(p => p.id === cmpA)) cmpA = null;
  if (!list.find(p => p.id === cmpB)) cmpB = null;
  if (!cmpA || !cmpB) {
    const fr = list.filter(p => p.pose === 'frente');
    if (fr.length >= 2) { cmpA = fr[fr.length - 1].id; cmpB = fr[0].id; }
    else if (list.length >= 2) { cmpA = list[list.length - 1].id; cmpB = list[0].id; }
  }
  const opt = sel => list.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${shortDate(p.date)} · ${POSES[p.pose] || p.pose}</option>`).join('');
  const A = list.find(p => p.id === cmpA), B = list.find(p => p.id === cmpB);
  const gap = A && B ? Math.abs(daysBetween(A.date, B.date)) : 0;
  el.innerHTML = `
    <div class="grid2"><button id="ph-cam">📷 Cámara con silueta</button><button class="secondary" id="ph-add">+ Desde galería</button></div>
    <p class="small muted">Misma luz, mismo sitio, misma hora y misma postura cada 4 semanas. La superposición sirve para evaluar simetría, vascularidad y cortes.</p>
    ${list.length >= 2 ? `
    <div class="card">
      <h2>Comparar ${gap ? `<small>· ${gap} días</small>` : ''}</h2>
      <div class="seg" style="margin-bottom:8px"><button data-cm="side" class="${cmpMode === 'side' ? 'on' : ''}">Lado a lado</button><button data-cm="overlay" class="${cmpMode === 'overlay' ? 'on' : ''}">Superposición</button></div>
      <div class="grid2" style="margin-bottom:8px"><select id="cmp-a">${opt(cmpA)}</select><select id="cmp-b">${opt(cmpB)}</select></div>
      ${cmpMode === 'side' ? `
      <div class="compare">
        <figure><img src="${A ? A.data : ''}" alt=""><figcaption>${A ? longDate(A.date) + photoWeight(A) : ''}</figcaption></figure>
        <figure><img src="${B ? B.data : ''}" alt=""><figcaption>${B ? longDate(B.date) + photoWeight(B) : ''}</figcaption></figure>
      </div>` : `
      <div class="overlay-box">
        <img src="${A ? A.data : ''}" alt="">
        <img id="ov-top" src="${B ? B.data : ''}" alt="" style="opacity:${cmpOpacity / 100}">
        ${cmpGrid ? '<div class="grid-lines"></div>' : ''}
      </div>
      <div class="row small muted" style="margin-top:8px"><span>${A ? shortDate(A.date) + photoWeight(A) : ''}</span><input type="range" id="ov-op" min="0" max="100" value="${cmpOpacity}" style="flex:1"><span>${B ? shortDate(B.date) + photoWeight(B) : ''}</span></div>
      <label class="check"><input type="checkbox" id="ov-grid" ${cmpGrid ? 'checked' : ''}> Línea central y guías de simetría</label>`}
    </div>` : ''}
    <div class="card">
      <h2>Galería <small>· ${list.length} foto${list.length === 1 ? '' : 's'}</small></h2>
      ${list.length ? `<div class="photos">${list.map(p => `<div class="photo" data-id="${p.id}"><img src="${p.data}" alt="" loading="lazy"><span>${shortDate(p.date)} · ${POSES[p.pose] || esc(p.pose)}${photoWeight(p)}</span></div>`).join('')}</div>`
        : '<div class="empty">Sube tus fotos de hoy (frente, lado y espalda) y tu foto objetivo.</div>'}
    </div>`;
  $('#ph-add').onclick = openPhotoForm;
  $('#ph-cam').onclick = openGhostCamera;
  const a = $('#cmp-a'), b = $('#cmp-b');
  if (a) { a.onchange = () => { cmpA = a.value; renderProgress(); }; b.onchange = () => { cmpB = b.value; renderProgress(); }; }
  $$('[data-cm]', el).forEach(x => x.onclick = () => { cmpMode = x.dataset.cm; renderProgress(); });
  const op = $('#ov-op'); if (op) op.oninput = () => { cmpOpacity = Number(op.value); $('#ov-top').style.opacity = cmpOpacity / 100; };
  const gr = $('#ov-grid'); if (gr) gr.onchange = () => { cmpGrid = gr.checked; renderProgress(); };
  $$('.photo', el).forEach(x => x.onclick = () => openPhotoViewer(x.dataset.id));
}

/**
 * Cámara con silueta: muestra en vivo la cámara con la foto anterior de la misma postura
 * superpuesta y semitransparente, para repetir encuadre, distancia y postura.
 */
async function openGhostCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('La cámara no está disponible: usa "Desde galería"'); return; }
  let stream = null, facing = 'user', pose = 'frente', timer = 0;
  const ghostFor = pz => photoCache.filter(p => p.pose === pz).slice(-1)[0] || photoCache.filter(p => p.pose === pz)[0];
  const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  openModal(`
    <div class="row spread"><h3 style="margin:0">Cámara con silueta</h3><button class="ghost" id="gc-close">Cerrar</button></div>
    <div class="cam-box">
      <video id="gc-video" playsinline autoplay muted></video>
      <img id="gc-ghost" alt="">
      <div class="grid-lines"></div>
      <div id="gc-count" class="cam-count"></div>
    </div>
    <div class="grid2" style="margin-top:8px">
      <select id="gc-pose">${Object.keys(POSES).filter(k => k !== 'objetivo').map(k => `<option value="${k}">${POSES[k]}</option>`).join('')}</select>
      <button class="secondary" id="gc-flip">Cambiar cámara</button>
    </div>
    <div class="row small muted" style="margin:8px 0"><span>Silueta</span><input type="range" id="gc-op" min="0" max="80" value="35" style="flex:1"></div>
    <div class="grid2"><button class="secondary" id="gc-timer">Temporizador 5 s</button><button id="gc-shot">Tomar foto</button></div>
    <p class="small muted">Alinea tu cuerpo con la silueta de la última foto: misma distancia, altura de cámara y postura.</p>`, async m => {
    const video = $('#gc-video', m), ghost = $('#gc-ghost', m);
    const setGhost = () => {
      const g = ghostFor(pose);
      ghost.style.display = g ? 'block' : 'none';
      if (g) ghost.src = g.data;
      ghost.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
    };
    const start = async () => {
      stop();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
        video.srcObject = stream;
        video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
      } catch (e) { toast('Sin permiso de cámara: actívalo en Ajustes → Apps → Mi Progreso'); }
      setGhost();
    };
    const shoot = async () => {
      if (!stream || !video.videoWidth) { toast('La cámara aún no está lista'); return; }
      const c = document.createElement('canvas'), W = video.videoWidth, H = video.videoHeight;
      const s = Math.min(1, 1280 / Math.max(W, H));
      c.width = Math.round(W * s); c.height = Math.round(H * s);
      const ctx = c.getContext('2d');
      if (facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, c.width, c.height);
      const pw = weekAvg(todayStr());
      await photoStore.put({ id: uid(), date: todayStr(), pose, data: c.toDataURL('image/jpeg', 0.82), created: Date.now(), weight: pw ? Math.round(pw.avg * 10) / 10 : null });
      vibrate(80); toast('Foto guardada (' + POSES[pose] + ')');
      photoCache = await photoStore.all(); setGhost();
    };
    $('#gc-close', m).onclick = () => { clearInterval(timer); stop(); closeModal(); renderProgress(); };
    $('#gc-pose', m).onchange = e => { pose = e.target.value; setGhost(); };
    $('#gc-flip', m).onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; start(); };
    $('#gc-op', m).oninput = e => { ghost.style.opacity = e.target.value / 100; };
    ghost.style.opacity = 0.35;
    $('#gc-shot', m).onclick = shoot;
    $('#gc-timer', m).onclick = () => {
      let n = 5; const el = $('#gc-count', m); el.textContent = n;
      clearInterval(timer);
      timer = setInterval(() => { n--; el.textContent = n > 0 ? n : ''; if (n <= 0) { clearInterval(timer); shoot(); } }, 1000);
    };
    await start();
  });
}

function openPhotoForm() {
  openModal(`
    <h3>Añadir foto</h3>
    <label>Foto<input type="file" id="p-file" accept="image/*"></label>
    <img id="p-prev" style="display:none;width:100%;border-radius:12px;margin-bottom:10px" alt="">
    <div class="grid2">
      <label>Postura<select id="p-pose">${Object.keys(POSES).map(k => `<option value="${k}">${POSES[k]}</option>`).join('')}</select></label>
      <label>Fecha<input type="date" id="p-date" value="${todayStr()}"></label>
    </div>
    <div class="row"><button class="secondary" id="p-cancel" style="flex:1">Cancelar</button><button id="p-save" style="flex:1" disabled>Guardar</button></div>`, m => {
    let dataUrl = null;
    $('#p-cancel', m).onclick = closeModal;
    $('#p-file', m).onchange = async ev => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        dataUrl = await shrinkImage(f, 1280, 0.82);
        const prev = $('#p-prev', m); prev.src = dataUrl; prev.style.display = 'block';
        $('#p-save', m).disabled = false;
      } catch (e) { toast('No se pudo leer la imagen'); }
    };
    $('#p-save', m).onclick = async () => {
      if (!dataUrl) return;
      $('#p-save', m).disabled = true;
      try {
        const pd = $('#p-date', m).value || todayStr(), pw = weekAvg(pd);
        await photoStore.put({ id: uid(), date: pd, pose: $('#p-pose', m).value, data: dataUrl, created: Date.now(), weight: pw ? Math.round(pw.avg * 10) / 10 : null });
        closeModal(); toast('Foto guardada'); renderProgress();
      } catch (e) { toast('Error al guardar: ' + e.message); $('#p-save', m).disabled = false; }
    };
  });
}
function openPhotoViewer(id) {
  const p = photoCache.find(x => x.id === id);
  if (!p) return;
  openModal(`<div class="viewer">
      <div class="row spread" style="margin-bottom:10px"><h3 style="margin:0">${longDate(p.date)} · ${POSES[p.pose] || esc(p.pose)}</h3><button class="ghost" id="v-close">Cerrar</button></div>
      <img src="${p.data}" alt="">
      <button class="danger block" id="v-del" style="margin-top:12px">Borrar foto</button></div>`, m => {
    $('#v-close', m).onclick = closeModal;
    $('#v-del', m).onclick = async () => { if (!confirm('¿Borrar esta foto?')) return; await photoStore.del(id); closeModal(); toast('Foto borrada'); renderProgress(); };
  });
}
function shrinkImage(file, maxSide, quality) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagen')); };
    img.src = url;
  });
}

/* ------------------------------------------------------------------ *
 *  MÁS
 * ------------------------------------------------------------------ */
function renderMore() {
  const p = DB.profile, tg = targets(), t = todayStr(), s = (DB.days[t] && DB.days[t].supps) || {};
  $('#view-more').innerHTML = `
    <div class="card">
      <h2>Perfil y objetivos</h2>
      <div class="grid2">
        <label>Nombre<input id="pr-name" value="${esc(p.name)}" placeholder="Opcional"></label>
        <label>Objetivo<select id="pr-phase">
          <option value="definicion" ${p.phase === 'definicion' ? 'selected' : ''}>Definición (× 12)</option>
          <option value="volumen" ${p.phase === 'volumen' ? 'selected' : ''}>Volumen (× 17)</option>
          <option value="mantener" ${p.phase === 'mantener' ? 'selected' : ''}>Mantenimiento (× 15)</option>
        </select></label>
        <label>Somatotipo<select id="pr-soma">${Object.keys(SOMATOTYPES).map(k => `<option value="${k}" ${p.somatotype === k ? 'selected' : ''}>${SOMATOTYPES[k].name}</option>`).join('')}</select></label>
        <label>Altura (cm)<input id="pr-height" inputmode="numeric" value="${p.height}"></label>
        <label>Edad<input id="pr-age" inputmode="numeric" value="${p.age}"></label>
        <label>Peso inicial (kg)<input id="pr-start" inputmode="decimal" value="${p.startWeight}"></label>
        <label>Fecha de inicio<input type="date" id="pr-sdate" value="${p.startDate}"></label>
        <label>Peso objetivo (kg)<input id="pr-goal" inputmode="decimal" value="${p.goalWeight}"></label>
        <label>Pasos diarios<input id="pr-steps" inputmode="numeric" value="${p.steps}"></label>
        <label>Agua diaria (ml)<input id="pr-water" inputmode="numeric" value="${p.waterGoal}"></label>
      </div>
      <p class="small muted" style="margin-top:0">${esc(SOMATOTYPES[p.somatotype].desc)}</p>
      <label class="check"><input type="checkbox" id="pr-auto" ${p.autoMacros ? 'checked' : ''}> Calcular calorías y macros con la fórmula del libro</label>
      <div class="grid2" id="pr-manual" style="${p.autoMacros ? 'display:none' : ''}">
        <label>Calorías diarias<input id="pr-kcal" inputmode="numeric" value="${p.kcal}"></label>
        <label>Proteína diaria (g)<input id="pr-protein" inputmode="numeric" value="${p.protein}"></label>
      </div>
      <p class="small" style="margin-top:0">Ahora: <b>${tg.kcal.toLocaleString('es-MX')} kcal</b> · P ${tg.protein} g · C ${tg.carbs} g · G ${tg.fat} g</p>
      <button class="block" id="pr-save">Guardar perfil</button>
    </div>

    <div class="card">
      <h2>Suplementos de hoy</h2>
      ${SUPPLEMENTS.map(x => `<label class="habit"><input type="checkbox" data-supp="${x.id}" ${s[x.id] ? 'checked' : ''}><span>${esc(x.name)}${x.caution ? ' <span class="pill warn">PRECAUCIÓN</span>' : ''}<br><span class="small muted">${esc(x.when)}</span></span></label>`).join('')}
      <details style="border-bottom:0"><summary>Para qué sirve cada uno</summary>
        <table class="small"><tbody>${SUPPLEMENTS.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.what)}</td></tr>`).join('')}</tbody></table>
        <p class="small muted">Información de los libros. Antes de usar precursores de óxido nítrico o glicerina, consúltalo con un médico, sobre todo si tienes la presión alta o problemas de riñón.</p>
      </details>
    </div>

    <div class="card">
      <h2>Fisiología del bombeo</h2>
      ${PUMP_STEPS.map(([n, txt], i) => `<details><summary>${i + 1}. ${esc(n)}</summary><p class="small" style="margin:0 0 12px">${esc(txt)}</p></details>`).join('')}
    </div>

    <div class="card">
      <h2>Mentalidad</h2>
      ${MINDSET.map(([n, txt, src]) => `<details><summary>${esc(n)}</summary><p class="small" style="margin:0 0 4px">${esc(txt)}</p><p class="small muted" style="margin:0 0 12px">Idea de ${esc(src)}</p></details>`).join('')}
    </div>

    <div class="card">
      <h2>Las 7 reglas de oro</h2>
      <ol class="list-plain small">${HABITS.map(h => `<li>${esc(h.name)}</li>`).join('')}</ol>
      <p class="small muted">Se activa una por semana para no abrumarte. Come limpio de lunes a viernes y date flexibilidad moderada el fin de semana.</p>
      <button class="secondary block" id="hb-reset">Reiniciar el conteo de semanas</button>
    </div>

    <div class="card">
      <h2>Copia de seguridad</h2>
      <p class="small muted" style="margin-top:0">Los datos se guardan solo en este teléfono. Exporta una copia de vez en cuando.</p>
      <div class="grid2"><button class="secondary" id="bk-export">Exportar</button><button class="secondary" id="bk-import">Importar</button></div>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="bk-photos" checked> Incluir fotos en la copia</label>
      <input type="file" id="bk-file" accept=".json,application/json" style="display:none">
    </div>

    <div class="card"><h2>Zona peligrosa</h2><button class="danger block" id="reset">Borrar todos los datos</button></div>
    <p class="small muted" style="text-align:center">Mi Progreso 3.0 · tus datos no salen del teléfono</p>`;

  $('#pr-auto').onchange = e => { $('#pr-manual').style.display = e.target.checked ? 'none' : ''; };
  $('#pr-save').onclick = () => {
    const g = id => num($(id).value);
    const np = {
      name: $('#pr-name').value.trim(), phase: $('#pr-phase').value, somatotype: $('#pr-soma').value,
      height: g('#pr-height'), age: g('#pr-age'), startWeight: g('#pr-start'), startDate: $('#pr-sdate').value || p.startDate,
      goalWeight: g('#pr-goal'), steps: g('#pr-steps'), waterGoal: g('#pr-water'),
      autoMacros: $('#pr-auto').checked, kcal: g('#pr-kcal'), protein: g('#pr-protein')
    };
    const req = ['height', 'age', 'startWeight', 'goalWeight', 'steps', 'waterGoal'].concat(np.autoMacros ? [] : ['kcal', 'protein']);
    for (const k of req) if (np[k] == null || np[k] <= 0) { toast('Revisa el campo: ' + k); return; }
    if (np.autoMacros) { delete np.kcal; delete np.protein; }
    DB.profile = Object.assign(DB.profile, np);
    saveData(); toast('Perfil guardado'); renderMore();
  };
  $$('#view-more [data-supp]').forEach(cb => cb.onchange = () => {
    const e = day(t); e.supps = e.supps || {}; e.supps[cb.dataset.supp] = cb.checked; saveData();
  });
  $('#hb-reset').onclick = () => { DB.profile.habitsStart = todayStr(); saveData(); toast('Empiezas de nuevo con el hábito 1'); };
  $('#bk-export').onclick = exportBackup;
  $('#bk-import').onclick = () => $('#bk-file').click();
  $('#bk-file').onchange = importBackup;
  $('#reset').onclick = async () => {
    if (!confirm('Esto borra pesos, comidas, entrenos y fotos. ¿Seguro?')) return;
    if (!confirm('Última confirmación: no se puede deshacer.')) return;
    DB = defaultData(); DB.days = {}; saveData();
    try { await photoStore.clear(); } catch (e) {}
    toast('Datos borrados'); showTab('home');
  };
}

async function exportBackup() {
  const payload = { app: 'miprogreso', version: 3, exportedAt: new Date().toISOString(), data: DB };
  if ($('#bk-photos').checked) payload.photos = await photoStore.all();
  const json = JSON.stringify(payload), name = 'miprogreso-' + todayStr() + '.json';
  if (bridge && bridge.saveFile) { if (!bridge.saveFile(name, json)) toast('No se pudo guardar la copia'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Copia descargada');
}
function importBackup(ev) {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const obj = JSON.parse(r.result);
      if (obj.app !== 'miprogreso' || !obj.data) throw new Error('No es una copia de Mi Progreso');
      const nPhotos = (obj.photos || []).length;
      if (!confirm(`Copia del ${obj.exportedAt ? obj.exportedAt.slice(0, 10) : '?'}: ${Object.keys(obj.data.days || {}).length} días, ${(obj.data.lifts || []).length} series, ${nPhotos} fotos.\n\nReemplazará los datos actuales. ¿Continuar?`)) return;
      localStorage.setItem(KEY, JSON.stringify(obj.data));
      DB = loadData();
      if (obj.photos) { await photoStore.clear(); for (const p of obj.photos) await photoStore.put(p); }
      toast('Copia restaurada'); showTab('home');
    } catch (e) { toast('Error: ' + e.message); }
  };
  r.readAsText(f);
}

/* ------------------------------------------------------------------ *
 *  Arranque
 * ------------------------------------------------------------------ */
$('#modal-bg').addEventListener('click', e => { if (e.target.id === 'modal-bg') closeModal(); });
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
$('#tb-minus').onclick = () => { REST.end -= 15000; tickRest(); };
$('#tb-plus').onclick = () => { REST.end += 15000; REST.fired = false; $('#timer-bar').classList.remove('done'); tickRest(); };
$('#tb-stop').onclick = stopRest;

window.onAndroidBack = function () {
  if ($('#modal-bg').classList.contains('open')) { closeModal(); return true; }
  if (currentTab !== 'home') { showTab('home'); return true; }
  return false;
};

// Al abrir el teclado Android redimensiona la ventana. Solo se redibujan las
// gráficas: volver a pintar la vista quitaría el foco del campo y cerraría el teclado.
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(redrawChart, 150); });

// Contador de la ventana post-entreno (sin repintar la vista).
setInterval(() => {
  const el = $('#pwo-left');
  if (!el) return;
  const left = pwoLeft();
  el.textContent = left == null ? 'Cerrada' : mmss(left / 1000);
}, 1000);

DB = loadData();
saveData();
if (DB.active) keepScreenOn(true);
showTab('home');
