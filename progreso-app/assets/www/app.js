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
    theme: 'dark', logoTheme: true,
    name: '', height: 180, age: 29,
    startWeight: 88, startDate: '2026-10-09', goalWeight: 81,
    phase: 'definicion', somatotype: 'meso',
    autoMacros: true, kcal: 2300, protein: 175,
    steps: 9000, waterGoal: 3000, sugarMax: 35,
    routine: 'pro', habitsStart: todayStr(),
    // 5.0: equipo disponible, molestias, modo libreta, logros opcionales
    gym: 'pf', equip: GYM_PRESETS.pf.equip.slice(), limits: [],
    mode: 'completo', gamify: true, restAlerts: true, weeklyTarget: 3
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
    units: {}, achievements: [], customEx: [], pauses: [],
    // 6.1: grupos de ejercicios ("Mis entrenos") y qué entreno toca cada día (0 = lunes … 6 = domingo)
    workouts: [], plan: [null, null, null, null, null, null, null],
    goals: [], challenges: null,
    activities: [], commits: [], events: [], hardWeeks: [], moves: {}
  };
}
/** Pasa los días de la rutina personalizada anterior a "Mis entrenos" y los reparte en la semana. */
function migrateWorkouts(custom) {
  const ws = ((custom && custom.days) || []).filter(d => d.ex && d.ex.length).map(d => ({ id: d.id, name: d.name, ex: d.ex.map(e => e.slice()) }));
  const spots = [[], [0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]][Math.min(7, ws.length)];
  const plan = [null, null, null, null, null, null, null];
  spots.forEach((k, j) => { plan[k] = ws[j].id; });
  return { workouts: ws, plan };
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
        achievements: d.achievements || [],
        customEx: d.customEx || [],
        pauses: d.pauses || [],
        goals: d.goals || [], challenges: d.challenges || null,
        activities: d.activities || [], commits: d.commits || [], events: d.events || [], hardWeeks: d.hardWeeks || [], moves: d.moves || {},
        ...(d.workouts ? { workouts: d.workouts, plan: d.plan || def.plan } : migrateWorkouts(d.custom))
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
function getRoutine(key) { return key === 'custom' ? weekRoutine() : ROUTINES[key] || ROUTINES.pro; }
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function weekdayIdx(date) { return (parseDate(date).getDay() + 6) % 7; }
function workoutById(id) { return id ? DB.workouts.find(w => w.id === id) || null : null; }
/** Rutina personalizada = tu semana: cada día tiene el entreno que le asignaste, o descanso. */
function weekRoutine() {
  return {
    name: 'Mi semana', desc: 'Tú decides qué entreno toca cada día de la semana.',
    days: WEEKDAYS.map((n, k) => {
      const w = workoutById(DB.plan[k]);
      return w ? { id: 'w' + k, name: n + ' · ' + w.name, ex: w.ex, wid: w.id } : { id: 'w' + k, name: n + ' · Descanso', rest: true, ex: [] };
    })
  };
}
function exInfo(name) { return EX[name] || { g: 'otro', t: 'c', p: 'otro', e: 'maq', pf: false, icon: 'curl' }; }
function activeSession() { return DB.active ? DB.sessions.find(s => s.id === DB.active) || null : null; }

/* Ejercicios creados por el usuario: se suman al catálogo al cargar. */
function registerCustomExercises() {
  (DB.customEx || []).forEach(c => { EX[c.name] = { g: c.g, t: c.t, p: 'custom-' + c.g, e: c.e, pf: false, icon: c.t === 'c' ? 'bench' : 'curl', custom: true }; });
}
/* Equipo disponible y molestias del usuario. */
function hasEquip(name) {
  const s = DB.active ? activeSession() : null, env = s && s.env ? envEquip(s.env) : null;   // 8.0: casa u hotel
  return (env || DB.profile.equip || []).includes(exInfo(name).e);
}
function exIssues(name) { return (hasEquip(name) ? [] : ['equipo']).concat(limitsFor(name, DB.profile.limits)); }
function okForMe(name) { return exIssues(name).length === 0; }
function issueText(issues, name) {
  return issues.map(k => k === 'equipo' ? 'no tienes ' + (EQUIP[exInfo(name).e] || 'ese equipo').toLowerCase() : 'cuida tu ' + LIMITS[k].name.toLowerCase()).join(' y ');
}
/** Sustitutos que puedes hacer con tu equipo y sin cargar tus zonas con molestias. */
const REGION = { pierna: 'inf', femoral: 'inf', gluteo: 'inf', pantorrilla: 'inf', pecho: 'emp', hombro: 'emp', triceps: 'emp', espalda: 'tir', biceps: 'tir', abdomen: 'core' };
function smartSubs(name) {
  const direct = substitutes(name).filter(okForMe);
  // Si nada del mismo patrón te sirve (ej. rodilla + sentadillas), busca en la misma zona del cuerpo.
  const me = exInfo(name), reg = REGION[me.g];
  const score = n => (EX[n].g === me.g ? 4 : EX[n].g === 'pantorrilla' || me.g === 'pantorrilla' ? 0 : 2) + (EX[n].t === me.t ? 1 : 0);
  const region = Object.keys(EX).filter(n => n !== name && !direct.includes(n) && REGION[EX[n].g] === reg && okForMe(n))
    .sort((a, b) => score(b) - score(a));
  return direct.concat(region);
}
/** Si un ejercicio de la rutina no te sirve, propone el mejor reemplazo. */
function adaptFor(name, avoid) {
  const iss = exIssues(name);
  if (!iss.length) return null;
  const subs = smartSubs(name), calf = exInfo(name).g === 'pantorrilla';
  const cand = subs.filter(n => (EX[n].g === 'pantorrilla') === calf);   // no cambiar una sentadilla por pantorrilla
  return { alt: cand.find(n => !(avoid || []).includes(n)) || cand[0] || subs[0] || null, why: issueText(iss, name) };
}

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
  if (routineKey === 'custom') return r.days[weekdayIdx(todayStr())];
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
  } else if (r >= hi && last.sets.filter(x => Math.abs(x.w - last.top.w) < 0.01).every(x => x.r >= hi)) {
    a = opt(w + step, lo); b = opt(w, r + 1);
    why = `Hiciste el tope del rango (${hi}) en todas las series con ese peso: toca subir.`;
  } else if (r >= hi) {
    a = opt(w, hi); b = opt(w + step, lo);
    why = `Llegaste a ${hi} en tu mejor serie, pero no en todas: mismo peso hasta completar ${hi} en cada serie.`;
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
  const s = activeSession();
  if (s && s.adjustDone) return s.adjust === 'modificar';
  const rd = readiness();
  return !!(rd && rd.plan === 'modificar');
}

/* ------------------------------------------------------------------ *
 *  Logros y nivel de fuerza
 * ------------------------------------------------------------------ */
function unlock(id, title, detail) {
  if (DB.achievements.some(a => a.id === id)) return false;
  DB.achievements.unshift({ id, title, detail, date: todayStr(), t: Date.now() });
  if (gamify()) { setTimeout(() => toast('🏆 Logro desbloqueado: ' + title), 400); vibrate(150); }
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
/**
 * Semanas seguidas cumpliendo tu meta semanal. Las semanas en pausa (vacaciones, lesión,
 * descarga) no rompen la racha: simplemente no suman. La semana en curso nunca resta.
 */
function trainingStreakWeeks() {
  const weeks = {};
  activeDates().forEach(d => { const k = weekKey(d); weeks[k] = (weeks[k] || 0) + 1; });
  const paused = k => DB.pauses.includes(k), target = k => weekTarget(k);
  let streak = 0, k = weekKey(todayStr());
  if ((weeks[k] || 0) < target(k)) k = addDays(k, -7);
  for (let guard = 0; guard < 520; guard++) {
    if ((weeks[k] || 0) >= target(k)) streak++;
    else if (!paused(k)) break;
    k = addDays(k, -7);
  }
  return streak;
}
function bestStreakWeeks() {
  const target = DB.profile.weeklyTarget || 3, weeks = {};
  DB.sessions.filter(s => s.end).forEach(s => { const k = weekKey(s.date); weeks[k] = (weeks[k] || 0) + 1; });
  const keys = Object.keys(weeks).sort();
  if (!keys.length) return 0;
  let best = 0, cur = 0;
  for (let k = keys[0]; k <= weekKey(todayStr()); k = addDays(k, 7)) {
    if ((weeks[k] || 0) >= target) { cur++; best = Math.max(best, cur); }
    else if (!DB.pauses.includes(k) && k !== weekKey(todayStr())) cur = 0;
  }
  return best;
}
/** Días activos de esta semana: entrenos de fuerza y cualquier otra actividad de 15 min o más. */
function sessionsThisWeek() { return activeDaysInWeek(weekKey(todayStr())); }
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
  [2, 4, 8, 12, 26, 52].forEach(n => { if (wk >= n) unlock('streak-' + n, n + ' semanas seguidas cumpliendo tu meta', 'Constancia'); });
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
const REST = { end: 0, total: 0, label: '', timer: null, fired: false, repeat: null };
const REST_KEY = 'miprogreso.rest';
/** El descanso se guarda con su hora de fin: si la app se cierra o se minimiza, se retoma donde iba. */
function saveRest() {
  try {
    if (REST.end > Date.now()) localStorage.setItem(REST_KEY, JSON.stringify({ end: REST.end, total: REST.total, label: REST.label, repeat: REST.repeat }));
    else localStorage.removeItem(REST_KEY);
  } catch (e) {}
}
function scheduleRestAlarm() {
  try {
    if (!bridge || !bridge.scheduleRest) return;
    if (DB.profile.restAlerts && REST.end > Date.now()) bridge.scheduleRest(String(REST.end), 'Descanso terminado', REST.repeat ? '¡A la siguiente serie de ' + REST.repeat.ex + '!' : '¡A la siguiente serie!');
    else bridge.cancelRest();
  } catch (e) {}
}
function restoreRest() {
  try {
    const r = JSON.parse(localStorage.getItem(REST_KEY) || 'null');
    if (r && r.end > Date.now()) { startRest((r.end - Date.now()) / 1000, r.label, r.repeat); REST.total = r.total; }
  } catch (e) {}
}
function startRest(seconds, label, repeat) {
  REST.total = seconds; REST.end = Date.now() + seconds * 1000; REST.label = label || 'Descanso'; REST.fired = false; REST.repeat = repeat || null;
  saveRest(); scheduleRestAlarm();
  $('#tb-repeat').hidden = !REST.repeat;
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
    saveRest();
    try { if (bridge && bridge.cancelRest) bridge.cancelRest(); } catch (e) {}
    setTimeout(() => { if (REST.fired) stopRest(); }, 20000);
  }
}
function stopRest() {
  clearInterval(REST.timer);
  REST.fired = false; REST.end = 0; REST.repeat = null;
  saveRest(); scheduleRestAlarm();
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
    <circle class="fill" cx="43" cy="43" r="${r}" style="stroke:${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
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
  $('#tabs').classList.toggle('four', isSimple());
  $('[data-tab=food]').hidden = isSimple();
  $('#hdr-title').textContent = tab === 'home' ? greeting() + (DB.profile.name ? ', ' + DB.profile.name : '') : TITLES[tab];
  redrawChart = () => {};
  document.body.classList.remove('in-session');
  render(tab);
  window.scrollTo(0, 0);
}
function render(tab) {
  ({ home: renderHome, train: renderTrain, food: renderFood, progress: renderProgress, more: renderMore })[tab]();
  const p = DB.profile;
  $('#hdr-sub').textContent = tab === 'home' ? longDate(todayStr()) : (p.name ? p.name + ' · ' : '') + longDate(todayStr());
}
function openModal(html, onMount) {
  $('#modal').innerHTML = html;
  $('#modal-bg').classList.add('open');
  if (onMount) onMount($('#modal'));
}
let MODAL_LOCK = false;
function closeModal(force) {
  if (MODAL_LOCK && force !== true) return;
  MODAL_LOCK = false;
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
  return `<div class="card keep" style="border:1px solid rgba(255,95,10,.5)">
    <div class="row spread"><h2 style="margin:0">Ventana post-entreno</h2><span class="pill" id="pwo-left">${mmss(left / 1000)}</span></div>
    <p class="small muted" style="margin:6px 0 8px">Tu cuerpo pasa de catabólico a anabólico: aprovecha los primeros ${PWO_MINUTES} min.</p>
    ${PWO_ITEMS.map(([id, name, sub]) => `<label class="check" style="margin:6px 0"><input type="checkbox" data-pwo="${id}" ${s[id] ? 'checked' : ''}> <span>${esc(name)}<br><span class="small muted">${esc(sub)}</span></span></label>`).join('')}
    <div class="row" style="margin-top:8px"><button class="secondary small-btn" data-pwo-act="restart" style="flex:1">↺ Reiniciar a ${PWO_MINUTES}:00</button><button class="secondary small-btn" data-pwo-act="cancel" style="flex:1">✕ Cancelar ventana</button></div>
  </div>`;
}
function bindPwo(root) {
  $$('[data-pwo-act]', root).forEach(b => b.onclick = () => {
    if (b.dataset.pwoAct === 'restart') { startPwo(); toast('↺ Ventana reiniciada: ' + PWO_MINUTES + ' min'); }
    else {
      if (!confirm('¿Cancelar la ventana post-entreno? Se desmarca lo que hayas palomeado en ella.')) return;
      DB.pwo = null;
      const e = DB.days[todayStr()];
      if (e && e.supps) PWO_ITEMS.forEach(([id]) => { delete e.supps[id]; });
      saveData(); toast('Ventana cancelada');
    }
    render(currentTab);
  });
  $$('[data-pwo]', root).forEach(cb => cb.onchange = () => {
    const e = day(todayStr()); e.supps = e.supps || {};
    e.supps[cb.dataset.pwo] = cb.checked;
    if (cb.dataset.pwo === 'pwo_protein') e.supps.protein = cb.checked;
    if (cb.dataset.pwo === 'pwo_creatine') e.supps.creatine = cb.checked;
    saveData();
  });
}

const isSimple = () => DB.profile.mode === 'simple';
const gamify = () => DB.profile.gamify !== false && !isSimple();

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function renderHome() {
  const p = DB.profile, t = todayStr(), tg = targets(), tot = dayTotals(t);
  const cur = currentWeight(), { r1 } = weeklyRates(), adv = weightAdvice();
  const total = p.startWeight - p.goalWeight, done = cur == null ? 0 : p.startWeight - cur;
  const pct = total ? Math.max(0, Math.min(100, done / total * 100)) : 0;
  const [mTitle, mText, mSrc] = mindsetOfDay();
  const act = activeSession(), nd = nextDay(p.routine), r = getRoutine(p.routine);
  const habits = activeHabits(), habitsDone = habits.filter(h => habitDone(h, t)).length;
  const rec = recoveryToday(), dl = isDeload();
  const todayW = DB.days[t] && DB.days[t].weight;

  // Tarjeta principal: lo que toca hoy
  let hero;
  if (act) {
    const n = DB.lifts.filter(l => l.sid === act.id).length;
    hero = `<div class="hero"><div class="eyebrow">Entreno en curso</div><h3>${esc(act.dayName)}</h3><p>${n} series registradas · ${Math.round((Date.now() - act.start) / 60000)} min</p><button id="home-train">Continuar entreno</button></div>`;
  } else if (nd && nd.rest) {
    hero = `<div class="hero rest"><div class="eyebrow">Hoy toca</div><h3>Descanso</h3><p>El músculo crece cuando descansas. Camina, hidrátate y come bien.</p><button id="home-free">Entrenar de todos modos</button></div>`;
  } else if (nd) {
    hero = `<div class="hero"><div class="eyebrow">Hoy toca${dl ? ' · descarga' : ''}</div><h3>${esc(nd.name.split('·').pop().trim())}</h3><p>${nd.ex.length} ejercicios · ~${Math.round(nd.ex.reduce((a, e) => a + e[1] * ((e[3] || 90) + 40), 0) / 60)} min · ${esc(r.name)}</p><button id="home-train">Empezar entreno</button></div>`;
  } else {
    hero = `<div class="hero"><div class="eyebrow">Entreno</div><h3>Entreno libre</h3><p>Elige ejercicios sobre la marcha.</p><button id="home-free">Empezar</button></div>`;
  }

  if (!act && stage() === 1) hero = starterHero();
  const full = !isSimple();
  $('#view-home').innerHTML = `
    ${hero}
    ${glanceStrip()}
    ${full ? pwoCard() : ''}

    <div class="quick">
      <button data-q="weight"><span class="q-ico" style="background:var(--accent-soft)">⚖️</span>${todayW ? fmt(todayW) + ' kg' : 'Peso'}</button>
      ${full ? `<button data-q="water"><span class="q-ico" style="background:var(--blue-soft)">💧</span>+250 ml</button>
      <button data-q="meal"><span class="q-ico" style="background:var(--good-soft)">🍽️</span>Comida</button>` : `<button data-q="train"><span class="q-ico" style="background:var(--good-soft)">🏋️</span>Libre</button>
      <button data-q="history"><span class="q-ico" style="background:var(--blue-soft)">📒</span>Historial</button>`}
      <button data-q="photo"><span class="q-ico" style="background:var(--warn-soft)">📷</span>Foto</button>
    </div>

    ${full ? `<div class="card" data-fold-title="Comida y agua" data-fold-ico="🍽️" data-fold-sum="${tot.kcal.toLocaleString('es-MX')} de ${tg.kcal.toLocaleString('es-MX')} kcal · ${Math.round(tot.p)} g proteína · ${fmt(tot.water / 1000, 1)} L">
      <div class="row spread" style="margin-bottom:10px"><h2 style="margin:0">Hoy</h2><span class="small muted">${tg.kcal.toLocaleString('es-MX')} kcal objetivo</span></div>
      <div class="rings">
        <div>${ring(tot.kcal, tg.kcal, 'var(--accent)', Math.round(tot.kcal / Math.max(1, tg.kcal) * 100) + '%')}<div class="ring-label"><b>${tot.kcal.toLocaleString('es-MX')}</b>kcal</div></div>
        <div>${ring(tot.p, tg.protein, 'var(--orange)', Math.round(tot.p) + 'g')}<div class="ring-label"><b>de ${tg.protein} g</b>proteína</div></div>
        <div>${ring(tot.water, tg.water, 'var(--blue)', fmt(tot.water / 1000, 1) + 'L')}<div class="ring-label"><b>de ${fmt(tg.water / 1000, 1)} L</b>agua</div></div>
      </div>
      ${tot.s > tg.sugar ? `<div class="status bad"><b>Azúcar: ${Math.round(tot.s)} g</b>Pasaste el máximo de ${tg.sugar} g de hoy.</div>` : ''}
    </div>` : ''}

    <div class="card" data-fold-title="Peso" data-fold-sum="${esc(adv.title)}" data-fold-badge="${r1 == null ? '' : signed(r1, 2) + ' kg/sem'}">
      <div class="row spread">
        <div><div class="small muted">Peso · media 7 días</div><div class="big">${fmt(cur)}<span class="muted" style="font-size:17px;font-weight:600"> kg</span></div></div>
        <div style="text-align:right"><div class="small muted">Esta semana</div>
          <div style="font-size:19px;font-weight:750;color:${r1 == null ? 'var(--muted)' : (p.phase === 'definicion' ? (r1 <= 0 ? 'var(--good)' : 'var(--bad)') : 'var(--text)')}">${r1 == null ? '—' : signed(r1, 2) + ' kg'}</div></div>
      </div>
      <canvas class="spark" id="home-spark"></canvas>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="row spread small muted"><span>${fmt(p.startWeight)} kg</span><span><b style="color:var(--text)">${fmt(Math.max(0, done))}</b> de ${fmt(total)} kg</span><span>Meta ${fmt(p.goalWeight)}</span></div>
      <div class="status ${adv.cls}"><b>${esc(adv.title)}</b>${esc(adv.text)}</div>
    </div>

    ${weekCard()}
    ${stage() >= 2 ? agendaCard() : ''}
    ${challengesCard()}
    ${commitsCard()}
    ${cycleCard()}
    ${stageCard()}
    ${full ? whatWorksCard() : ''}

    ${full ? readinessCard() + `
    <div class="card">
      <div class="row spread" style="margin-bottom:4px"><h2 style="margin:0">Reglas de oro</h2><span class="pill ${habitsDone === habits.length ? 'good' : 'gray'}">${habitsDone}/${habits.length}</span></div>
      <p class="small muted" style="margin:0 0 4px">Semana ${habits.length} de ${HABITS.length}: un hábito nuevo cada semana.</p>
      ${habits.map(h => `<label class="habit"><input type="checkbox" data-habit="${h.id}" ${habitDone(h, t) ? 'checked' : ''}> ${esc(h.name)}${h.auto && habitAuto(h, t) ? '<span class="auto">auto ✓</span>' : ''}</label>`).join('')}
    </div>

    <div class="card" data-fold-title="Idea del día" data-fold-sum="${esc(mTitle)}" data-fold-ico="💭"><div class="quote"><b>💡 ${esc(mTitle)}</b>${esc(mText)}<small>Idea de ${esc(mSrc)}</small></div></div>` : ''}

    ${gamify() && DB.achievements.length ? `<div class="card">
      <div class="row spread"><h2 style="margin:0">Logros recientes</h2><button class="ghost" id="home-ach">Ver todos ›</button></div>
      ${DB.achievements.slice(0, 2).map(a => `<div class="badge-row"><span class="badge">${a.pr ? '↑' : '🏆'}</span><span><b>${esc(a.title)}</b><br><small class="muted">${esc(a.detail || '')} · ${shortDate(a.date)}</small></span></div>`).join('')}
    </div>` : ''}`;

  const tr = $('#home-train');
  if (tr) tr.onclick = () => { if (!act) startSession(p.routine, nd.id); showTab('train'); };
  const fr = $('#home-free');
  if (fr) fr.onclick = () => { startSession('libre'); showTab('train'); };
  $$('#view-home [data-q]').forEach(b => b.onclick = () => quickAction(b.dataset.q));
  $$('#view-home [data-habit]').forEach(cb => cb.onchange = () => {
    const e = day(t); e.habits = e.habits || {}; e.habits[cb.dataset.habit] = cb.checked; saveData(); renderHome();
  });
  bindPwo($('#view-home'));
  if (full) bindRecovery($('#view-home'), renderHome);
  const ach = $('#home-ach'); if (ach) ach.onclick = () => { progMode = 'logros'; showTab('progress'); };
  const vh = $('#view-home');
  bindCycleCard(vh, renderHome); bindStage(vh, renderHome); bindStarter(vh); bindAgenda(vh, renderHome); bindCommits(vh, renderHome);
  bindGlance(vh);
  foldify(vh, [['Para hoy', ['Chequeo', 'Tu ciclo', 'Comida y agua', 'Reglas de oro', 'compromisos']], ['Esta semana', ['Tu semana', 'agenda', 'Retos', 'Peso']], ['Tu camino', '*']]);
  const entries = weightEntries().filter(e => e.date >= addDays(t, -60));
  showChart(() => drawSpark($('#home-spark'), movingAvg(entries).map(e => e.y)));
}

/** Semana actual sin culpa: cuenta lo hecho, nunca lo que faltó. */
function weekCard() {
  const n = sessionsThisWeek(), target = weekTarget(), paused = DB.pauses.includes(weekKey(todayStr()));
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], wk = weekKey(todayStr()), act = activeDates();
  const trained = d => act.has(addDays(wk, d));
  const msg = paused ? 'Semana en pausa: descansa tranquilo, tu racha se conserva.' : n >= target ? '¡Meta de la semana cumplida! Lo demás es extra.' : n === 0 ? 'Cualquier día es bueno para empezar. Descansar también es parte del plan.' : `Llevas ${n} de ${target}. Vas bien.`;
  return `<div class="card">
    <div class="row spread"><h2 style="margin:0">Tu semana</h2><span class="pill ${n >= target ? 'good' : 'gray'}">${n}/${target}</span></div>
    <div class="week-dots">${days.map((d, i) => `<span class="${trained(i) ? 'on' : ''} ${addDays(wk, i) === todayStr() ? 'today' : ''}">${d}</span>`).join('')}</div>
    <p class="small muted" style="margin:6px 0 0">${msg}${gamify() && trainingStreakWeeks() ? ' · Racha: ' + trainingStreakWeeks() + ' sem.' : ''}</p>
  </div>`;
}

/** Mini gráfica sin ejes para la tarjeta de peso. */
function drawSpark(canvas, ys) {
  if (!canvas || ys.length < 2) { if (canvas) canvas.style.display = 'none'; return; }
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(hi - lo, 0.5);
  const px = i => 4 + i / (ys.length - 1) * (W - 8), py = v => 6 + (1 - (v - lo) / span) * (H - 12);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(30,227,224,.22)'); g.addColorStop(1, 'rgba(30,227,224,0)');
  ctx.beginPath(); ys.forEach((v, i) => i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)));
  ctx.lineTo(px(ys.length - 1), H); ctx.lineTo(px(0), H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ys.forEach((v, i) => i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)));
  ctx.strokeStyle = getVar('--accent'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(px(ys.length - 1), py(ys[ys.length - 1]), 4, 0, Math.PI * 2); ctx.fillStyle = getVar('--accent'); ctx.fill();
}

/* Registro rápido: botones de Inicio y el botón + flotante. */
function quickAction(k) {
  const t = todayStr();
  if (k === 'weight') return openWeightQuick();
  if (k === 'water') { const e = day(t); e.water = (e.water || 0) + 250; e.waterLog = (e.waterLog || []).concat(250); saveData(); toast('💧 +250 ml · ' + fmt(e.water / 1000, 2) + ' L hoy'); vibrate(30); return render(currentTab); }
  if (k === 'meal') return openMealForm(t);
  if (k === 'photo') { progMode = 'photos'; showTab('progress'); return openGhostCamera(); }
  if (k === 'measure') return openMeasureForm();
  if (k === 'train') { if (!activeSession()) startSession('libre'); return showTab('train'); }
  if (k === 'recovery') return openCheckin(() => render(currentTab));
  if (k === 'activity') return openActivityForm();
  if (k === 'export') return openExport();
  if (k === 'history') { progMode = 'strength'; return showTab('progress'); }
}
function openQuickSheet() {
  openModal(`
    <h3>¿Qué quieres registrar?</h3>
    <div class="sheet-grid">
      <button data-qs="weight"><span>⚖️</span>Peso</button>
      ${isSimple() ? '' : `<button data-qs="meal"><span>🍽️</span>Comida</button>
      <button data-qs="water"><span>💧</span>Agua</button>`}
      <button data-qs="train"><span>🏋️</span>Entreno</button>
      <button data-qs="activity"><span>🏃</span>Actividad</button>
      <button data-qs="photo"><span>📷</span>Foto</button>
      <button data-qs="measure"><span>📏</span>Medidas</button>
      ${isSimple() ? '' : '<button data-qs="recovery"><span>😴</span>Chequeo</button>'}
      <button data-qs="export"><span>📄</span>Exportar</button>
    </div>`, m => {
    $$('[data-qs]', m).forEach(b => b.onclick = () => { closeModal(); quickAction(b.dataset.qs); });
  });
}
/** Peso rápido: un solo campo grande. */
function openWeightQuick() {
  const t = todayStr(), cur = (DB.days[t] && DB.days[t].weight) || Math.round(currentWeight() * 10) / 10;
  openModal(`
    <h3>Peso de hoy</h3>
    <p class="small muted" style="margin-top:0">En ayunas, después de ir al baño. Lo que importa es la media semanal.</p>
    <div class="stepper" style="margin-bottom:14px"><div class="s-row">
      <button id="wq-minus">−</button><input id="wq" inputmode="decimal" value="${cur}"><button id="wq-plus">+</button></div>
      <div class="s-label">kilogramos</div></div>
    <button class="block" id="wq-save">Guardar</button>
    <button class="ghost block" id="wq-more" style="margin-top:6px">Más datos del día (pasos, sueño, notas)</button>`, m => {
    const inp = $('#wq', m);
    const step = d => { const v = num(inp.value) || cur; inp.value = (Math.round((v + d) * 10) / 10).toFixed(1); };
    $('#wq-minus', m).onclick = () => step(-0.1); $('#wq-plus', m).onclick = () => step(0.1);
    $('#wq-more', m).onclick = () => openDayForm(t);
    $('#wq-save', m).onclick = () => {
      const w = num(inp.value);
      if (w == null || w < 30 || w > 300) { toast('Revisa el peso'); return; }
      day(t).weight = w; checkDailyMilestones(); saveData(); closeModal(); render(currentTab); toast('⚖️ Peso guardado: ' + fmt(w) + ' kg');
    };
  });
}

/* ------------------------------------------------------------------ *
 *  ENTRENO (Gym Bible)
 * ------------------------------------------------------------------ */
function startSession(routineKey, dayId, wid) {
  let name, id = null, base = null;
  const w = workoutById(wid);
  if (w) { name = w.name; base = w.ex; routineKey = 'custom'; }
  else if (routineKey === 'libre') name = 'Entreno libre';
  else {
    const d = getRoutine(routineKey).days.find(x => x.id === dayId);
    if (!d || d.rest) return;
    name = d.name; id = d.id; base = d.ex;
  }
  // Se guarda una copia de los ejercicios: editar tus entrenos no cambia una sesión ya empezada.
  const s = { id: uid(), routine: routineKey, dayId: id, dayName: name, date: todayStr(), start: Date.now(), end: null, extra: [], swaps: {}, adapt: {}, base: base ? base.map(e => e.slice()) : null };
  // Adapta la rutina a tu equipo y molestias antes de empezar.
  if (base) {
    const used = base.map(e => e[0]).filter(okForMe);
    base.forEach((e, i) => {
      const a = adaptFor(e[0], used);
      if (a && a.alt) { s.swaps[i] = a.alt; s.adapt[i] = 'En vez de ' + e[0] + ' (' + a.why + ')'; used.push(a.alt); }
    });
  }
  const rd = readiness();
  if (rd) { s.adjust = rd.plan === 'mantener' ? null : rd.plan; s.adjustDone = true; }
  DB.sessions.push(s);
  DB.active = s.id;
  if (DB.profile.restAlerts && !DB.profile.notifAsked) { DB.profile.notifAsked = true; requestNotifications(); }
  saveData();
  keepScreenOn(true);
}
function closeSession() { DB.active = null; saveData(); keepScreenOn(false); stopRest(); document.body.classList.remove('in-session'); }
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
  showTab('home');
  openSessionSummary(s);
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
  if (!n) return 'var(--line)';
  if (ratio > OVERREACH) return '#ff5f0a';
  if (ratio >= 0.85) return '#1ee3e0';
  if (ratio >= 0.5) return '#0e9fae';
  return '#4f6b7a';
}
function bodySvg(parts, groups, label) {
  const silhouette = '<circle cx="50" cy="14" r="10"/><path d="M38 28H62L80 40L84 90H76L72 52L66 58L66 104L62 190H52L50 110L48 190H38L34 104L34 58L28 52L24 90H16L20 40Z"/>';
  return `<svg viewBox="0 0 100 200" class="body-map" aria-label="${label}">
    <g style="fill:var(--surface-2)">${silhouette}</g>
    ${Object.keys(parts).map(g => `<g style="fill:${heatColor(g, groups)}" data-g="${g}">${parts[g]}</g>`).join('')}
    <text x="50" y="198" text-anchor="middle" font-size="9" style="fill:var(--muted)">${label}</text></svg>`;
}
function heatmapCard(vol) {
  const g = vol.groups;
  return `<div class="card">
    <h2>Mapa muscular <small>· series efectivas, últimos 7 días</small></h2>
    <div class="body-maps">${bodySvg(BODY_FRONT, g, 'Frente')}${bodySvg(BODY_BACK, g, 'Espalda')}</div>
    <div class="legend" style="justify-content:center;margin-bottom:8px">
      <span><i style="background:#4f6b7a"></i>Poco</span><span><i style="background:#0e9fae"></i>Casi</span>
      <span><i style="background:#1ee3e0"></i>Óptimo</span><span><i style="background:#ff5f0a"></i>Exceso</span></div>
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
    ${r ? `<p class="small muted" style="margin:6px 0">${[r.rec.hrv ? 'HRV ' + r.rec.hrv + ' ms' : '', r.rec.sleepH != null ? 'sueño ' + fmt(r.rec.sleepH) + ' h' : '', r.rec.sleepQ != null ? 'calidad ' + r.rec.sleepQ + '/5' : '', r.rec.rhr ? 'FC reposo ' + r.rec.rhr : ''].filter(Boolean).join(' · ')}</p>`
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
  const b = $('#ck-open', root); if (b) b.onclick = () => openCheckin(rerender);
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
    ${coachPlanCard()}
    <div class="tool-row">
      <button id="tr-free"><span>⚡</span>Libre</button>
      <button id="tr-act"><span>🏃</span>Actividad</button>
      <button id="tr-hotel"><span>🧳</span>Hotel</button>
      <button id="tr-lib"><span>📚</span>Ejercicios</button>
    </div>
    ${isSimple() ? '' : readinessCard()}
    <div class="card" data-fold-title="Tu rutina" data-fold-sum="${esc(p.routine === 'custom' ? 'Mi semana (personalizada)' : r.name)}" data-fold-ico="📋">
      <label style="margin-bottom:6px">Rutina
        <select id="rt-sel">
          ${Object.keys(ROUTINES).map(k => `<option value="${k}" ${p.routine === k ? 'selected' : ''}>${esc(ROUTINES[k].name)}</option>`).join('')}
          <option value="custom" ${p.routine === 'custom' ? 'selected' : ''}>⭐ Mi semana (personalizada)</option>
        </select>
      </label>
      <p class="small muted" style="margin:0">${esc(r.desc || '')}</p>
    </div>
    ${p.routine === 'custom' ? weekPlanCard() : `<div class="card" data-fold-title="Días de la rutina" data-fold-sum="${nd ? 'Hoy: ' + esc(nd.name.split('·').pop().trim()) : ''}" data-fold-ico="🗓️">
      <h2>Días</h2>
      ${r.days.length ? r.days.map(d => `
        <details ${nd && d.id === nd.id ? 'open' : ''}>
          <summary><span>${esc(d.name)} ${nd && d.id === nd.id ? '<span class="pill">HOY</span>' : ''}</span></summary>
          ${d.rest ? '<p class="small muted">Descanso: camina, estira y come bien. El músculo crece cuando descansas.</p>' : `
          <div class="ex-mini-list">${d.ex.map(e => `<div class="ex-mini" data-howto="${esc(e[0])}">${exIcon(e[0], 52)}<span>${esc(e[0])}<br><small>${e[1]} × ${esc(e[2])}${exInfo(e[0]).pf ? ' · PF' : ''}</small></span></div>`).join('')}</div>
          <button class="block" data-start="${d.id}" style="margin:8px 0 12px">Empezar ${esc(d.name.split('·').pop().trim())}</button>`}
        </details>`).join('') : '<div class="empty">Esta rutina no tiene días.</div>'}
    </div>`}

    ${isSimple() ? '' : heatmapCard(vol)}

    ${isSimple() ? '' : `<div class="card">
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
    </div>`}

    ${activitiesCard()}
    <div class="card">
      <h2>Últimas sesiones</h2>
      ${recent.length ? `<table><tbody>${recent.map(x => `<tr class="tap" data-sess="${x.id}"><td>${shortDate(x.date)}</td><td>${esc(x.dayName)}</td><td class="num">${DB.lifts.filter(l => l.sid === x.id).length} series</td><td class="num">${Math.round((x.end - x.start) / 60000)} min</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Aún no hay sesiones.</div>'}
    </div>`;

  $('#tr-free').onclick = () => { startSession('libre'); renderTrain(); window.scrollTo(0, 0); };
  $$('#view-train [data-howto]').forEach(b => b.onclick = () => openHowTo(b.dataset.howto));
  $('#tr-lib').onclick = () => openExercisePicker(null);
  $('#rt-sel').onchange = e => { DB.profile.routine = e.target.value; saveData(); renderTrain(); };
  if (p.routine === 'custom') bindWeekPlan();
  foldify($('#view-train'), [['Tu entrenamiento', ['Chequeo', 'Tu rutina', 'Días', 'Mi semana', 'Mis entrenos']], ['Tu semana', ['Mapa', 'Balance', 'actividades', 'sesiones']], ['Aprende', '*']]);
  $$('#view-train [data-start]').forEach(b => b.onclick = () => { startSession(p.routine, b.dataset.start); renderTrain(); window.scrollTo(0, 0); });
  $$('#view-train [data-sess]').forEach(tr => tr.onclick = () => openSessionDetail(tr.dataset.sess));
  bindRecovery($('#view-train'), renderTrain);
  bindCoach($('#view-train'));
  bindActivities($('#view-train'), renderTrain);
  $('#tr-act').onclick = () => openActivityForm();
  $('#tr-hotel').onclick = () => { startSession('libre'); const s = activeSession(); s.dayName = 'Sesión de hotel'; s.base = HOTEL_SESSION.map(e => e.slice()); s.env = 'hotel'; saveData(); renderTrain(); window.scrollTo(0, 0); };
}

/** Ejercicios de la sesión: los del día (con los cambios por máquina ocupada) más los añadidos. */
function sessionExercises(s) {
  let base = s.base || [];
  if (!s.base && s.routine !== 'libre') {
    const d = getRoutine(s.routine).days.find(x => x.id === s.dayId) || workoutById(s.dayId);
    base = d ? d.ex : [];
  }
  return base.concat(s.extra || []).map((e, i) => {
    let x = s.swaps && s.swaps[i] ? [s.swaps[i]].concat(e.slice(1)) : e;
    if (s.sets && s.sets[i] != null) x = [x[0], s.sets[i]].concat(x.slice(2));   // meta de series cambiada en la sesión
    else if (s.adjust) x = [x[0], adjSets(x[1], s.adjust)].concat(x.slice(2));   // plan del chequeo: reducir o descarga
    if (s.short && !(s.sets && s.sets[i] != null)) x = [x[0], Math.min(2, x[1])].concat(x.slice(2));   // versión de 15 min
    return x;
  });
}

/* Estado de la pantalla de sesión: ejercicio abierto, RIR elegido, series iguales a guardar y
   el avance que ya mostraba cada barra (para animarla desde ahí). */
const SESS_UI = { sid: null, open: 0, rir: {}, more: {}, n: {}, prog: {}, celebrate: null };

/** Mensaje de la barra de un ejercicio: siempre en positivo, nunca lo que falta como reproche. */
function progMsg(n, sets, beat) {
  if (!n) return '💪 ¡Vamos por la primera!';
  if (n > sets) return `🦾 ¡Modo bestia! +${n - sets} extra`;
  if (n === sets) return beat ? '💯 ¡Al 1000%! Superaste tu última vez' : '🏆 ¡Completado! Lo diste todo';
  if (n === sets - 1) return '⚡ ¡Última serie! Dalo todo';
  if (n / sets >= 0.5) return '🔥 ¡Mitad hecha! No aflojes';
  return '🚀 ¡Buen arranque! Sigue así';
}
/** Barra de progreso con una marca por serie; se anima desde el valor que tenía antes de guardar. */
function progBar(n, sets, key, big) {
  const pct = sets ? Math.min(1, n / sets) : 0;
  const from = SESS_UI.prog[key] != null ? SESS_UI.prog[key] : pct;
  SESS_UI.prog[key] = pct;
  const ticks = sets > 1 && sets <= 12 ? Array.from({ length: sets - 1 }, (_, k) => `<i style="left:${(k + 1) / sets * 100}%"></i>`).join('') : '';
  return `<div class="xp ${big ? 'big' : ''} ${pct >= 1 ? 'full' : ''} ${n > sets ? 'extra' : ''}">
    <div class="xp-track"><div class="xp-fill" data-to="${(pct * 100).toFixed(1)}" style="width:${(from * 100).toFixed(1)}%"></div>${big ? '' : ticks}</div>
    <b class="xp-num">${big ? Math.round(pct * 100) + '%' : n + '/' + sets}</b></div>`;
}
/** Trabajo comparable con la última vez: kg × reps, o solo reps si es con peso corporal. */
function beatLast(name, done, sid) {
  const lt = lastTime(name, sid);
  if (!lt) return null;
  const bw = lt.sets.every(x => !x.w);
  const work = arr => arr.reduce((a, x) => a + (bw ? x.r : x.w * x.r), 0);
  const prev = work(lt.sets), now = work(done);
  return prev ? { bw, prev, now, ratio: now / prev } : null;
}
/** Confeti con los colores del logo al completar un ejercicio. */
function burst(el) {
  if (!el || !gamify()) return;
  const colors = ['#1ee3e0', '#8af5f0', '#ff5f0a', '#ff8a3d', '#0e9fae'];
  for (let k = 0; k < 22; k++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 110;
    c.style.cssText = `background:${colors[k % colors.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 30}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .12}s`;
    el.appendChild(c);
    setTimeout(() => c.remove(), 1400);
  }
  el.classList.add('celebrate');
  setTimeout(() => el.classList.remove('celebrate'), 1300);
}

function renderSession(s) {
  document.body.classList.add('in-session');
  const exs = sessionExercises(s);
  if (SESS_UI.sid !== s.id) {
    SESS_UI.sid = s.id; SESS_UI.rir = {}; SESS_UI.more = {}; SESS_UI.n = {}; SESS_UI.prog = {};
    const firstOpen = exs.findIndex(e => DB.lifts.filter(l => l.sid === s.id && l.ex === e[0]).length < e[1]);
    SESS_UI.open = s.open != null ? s.open : firstOpen < 0 ? 0 : firstOpen;
  }
  if (s.open !== SESS_UI.open) { s.open = SESS_UI.open; saveData(); }
  const mins = Math.round((Date.now() - s.start) / 60000);
  const done = DB.lifts.filter(l => l.sid === s.id);
  const vol = done.reduce((a, l) => a + l.w * l.r, 0);
  const targetSets = exs.reduce((a, e) => a + e[1], 0);
  $('#view-train').innerHTML = `
    <div class="card">
      <div class="row spread"><div><div class="small muted">En curso · ${mins} min</div><div style="font-size:19px;font-weight:750">${esc(s.dayName)}</div></div>
        <div style="text-align:right"><div style="font-size:19px;font-weight:750">${done.length}<span class="muted" style="font-size:14px">/${targetSets || '–'}</span></div><div class="small muted">series</div></div></div>
      ${progBar(done.length, targetSets, 'all', true)}
      <div class="xp-msg">${!done.length ? '🔥 Hoy vienes por todo. ¡Primera serie!' : done.length >= targetSets ? '🏆 ¡Entreno completo! Termina cuando quieras' : done.length / targetSets >= 0.5 ? '⚡ Ya pasaste la mitad, ¡no aflojes!' : '🚀 Vas encendido, sigue sumando'}</div>
      <div class="small muted">${Math.round(vol).toLocaleString('es-MX')} kg movidos${isDeload() ? ' · <b style="color:var(--warn)">día de descarga</b>' : ''}</div>
    </div>
    ${!s.adjustDone && !isSimple() ? `<div class="card ck-prompt"><b>¿Cómo llegas hoy?</b><p class="small muted" style="margin:2px 0 8px">30 s para ajustar series e intensidad a tu recuperación.</p><div class="row"><button id="ss-ck" style="flex:2">Hacer chequeo</button><button class="secondary" id="ss-ck-skip" style="flex:1">Omitir</button></div></div>`
      : s.adjust ? `<div class="adapt-note" style="margin:0 0 12px">${PLAN_INFO[s.adjust].icon} <b>Plan ${PLAN_INFO[s.adjust].name.toLowerCase()}:</b> ${PLAN_INFO[s.adjust].text} <button class="ghost" id="ss-ck" style="padding:0 4px">Cambiar</button></div>` : ''}
    <div class="env-row"><span class="small muted">📍 Hoy entreno en</span>${Object.keys(ENVS).map(k => `<button class="chip-btn ${(s.env || 'gym') === k ? 'on' : ''}" data-env="${k}">${ENVS[k][0]} ${ENVS[k][1]}</button>`).join('')}</div>
    ${s.short ? '<div class="adapt-note" style="margin:0 0 12px">⏱️ <b>Versión corta:</b> 4 ejercicios y 2 series. Hecho es mejor que perfecto.</div>' : ''}
    ${exs.length ? exs.map((e, i) => exerciseCard(s, e, i)).join('') : '<div class="card"><div class="empty"><span class="emoji">🏋️</span>Añade tu primer ejercicio.</div></div>'}
    <div class="grid2" style="margin-bottom:10px"><button class="secondary" id="ss-add">+ Añadir ejercicio</button><button class="secondary" id="ss-save">⭐ Guardar como entreno</button></div>
    <button class="block" id="ss-finish">Terminar entreno</button>
    <button class="ghost block" id="ss-cancel" style="margin-top:6px">Descartar sesión</button>`;

  $$('#view-train [data-howto]').forEach(b => b.onclick = ev => { ev.stopPropagation(); openHowTo(b.dataset.howto); });
  $$('#view-train [data-open]').forEach(h => h.onclick = () => {
    const i = Number(h.dataset.open);
    SESS_UI.open = SESS_UI.open === i ? -1 : i;
    keepScroll(() => renderSession(s));
  });
  const relabel = i => { const b = $('#save-' + i); if (b) b.textContent = saveLabel($('#w-' + i).value, $('#r-' + i).value, unitFor(exs[i][0]), SESS_UI.n[i] || 1); };
  // Series iguales: guarda varias series con el mismo peso y reps de una vez.
  $$('#view-train [data-nset]').forEach(b => b.onclick = () => {
    const [i, d] = b.dataset.nset.split('|').map(Number);
    SESS_UI.n[i] = Math.max(1, Math.min(10, (SESS_UI.n[i] || 1) + d));
    $('#n-' + i).textContent = SESS_UI.n[i]; vibrate(15); relabel(i);
  });
  // Meta de series de hoy para este ejercicio.
  $$('#view-train [data-meta]').forEach(b => b.onclick = () => {
    const [i, d] = b.dataset.meta.split('|').map(Number);
    s.sets = s.sets || {};
    s.sets[i] = Math.max(1, Math.min(12, exs[i][1] + d));
    saveData(); vibrate(15); keepScroll(() => renderSession(s));
  });
  // Las barras crecen desde donde estaban hasta el nuevo avance.
  const fills = $$('#view-train .xp-fill[data-to]');
  if (fills.length) { void fills[0].offsetWidth; requestAnimationFrame(() => fills.forEach(f => { f.style.width = f.dataset.to + '%'; })); }
  if (SESS_UI.celebrate != null) { const c = $(`#view-train [data-card="${SESS_UI.celebrate}"]`); SESS_UI.celebrate = null; setTimeout(() => burst(c), 350); }
  $$('#view-train [data-step]').forEach(b => b.onclick = () => {
    const [i, field, dir] = b.dataset.step.split('|'), ex = exs[Number(i)][0];
    const inp = $('#' + field + '-' + i), v = num(inp.value) || 0;
    const st = field === 'w' ? stepFor(ex, unitFor(ex)) : 1;
    inp.value = Math.max(0, Math.round((v + Number(dir) * st) * 10) / 10);
    vibrate(15); relabel(Number(i));
  });
  $$('#view-train .stepper input').forEach(inp => inp.oninput = () => relabel(Number(inp.id.split('-')[1])));
  $$('#view-train [data-rir]').forEach(b => b.onclick = () => {
    const [i, v] = b.dataset.rir.split('|').map(Number);
    SESS_UI.rir[i] = v;
    $$(`#view-train [data-rir^="${i}|"]`).forEach(x => x.classList.toggle('on', x === b));
  });
  $$('#view-train [data-log]').forEach(b => b.onclick = () => logSet(s, Number(b.dataset.log)));
  $$('#view-train [data-unit]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.unit), ex = exs[i][0], u = unitFor(ex), nu = u === 'kg' ? 'lb' : 'kg';
    const val = num($('#w-' + i).value);
    DB.units[ex] = nu; saveData();
    keepScroll(() => renderSession(s));
    if (val != null) $('#w-' + i).value = roundTo(fromKg(toKg(val, u), nu), nu === 'lb' ? 1 : 0.5);
  });
  $$('#view-train [data-sug]').forEach(b => b.onclick = () => {
    const [i, w, r] = b.dataset.sug.split('|'); $('#w-' + i).value = w; $('#r-' + i).value = r; vibrate(15); relabel(Number(i));
  });
  $$('#view-train [data-edit]').forEach(b => b.onclick = () => openEditSet(b.dataset.edit, () => keepScroll(() => renderSession(s))));
  $$('#view-train [data-swap]').forEach(b => b.onclick = ev => { ev.stopPropagation(); openSwap(s, Number(b.dataset.swap)); });
  $$('#view-train [data-video]').forEach(b => b.onclick = () => openVideo(exs[Number(b.dataset.video)][0]));
  $$('#view-train [data-more]').forEach(b => b.onclick = () => { const i = Number(b.dataset.more); SESS_UI.more[i] = !SESS_UI.more[i]; keepScroll(() => renderSession(s)); });
  $$('#view-train [data-info]').forEach(b => b.onclick = () => explainRir());
  $('#ss-add').onclick = () => openExercisePicker(name => {
    s.extra = s.extra || [];
    s.extra.push([name, 3, exInfo(name).t === 'c' ? '8–12' : '10–15', exInfo(name).t === 'c' ? 120 : 75]);
    SESS_UI.open = sessionExercises(s).length - 1;
    saveData(); closeModal(); renderSession(s);
    setTimeout(() => { const cards = $$('#view-train .ex-card'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  });
  $('#ss-save').onclick = () => saveSessionAsWorkout(s);
  $$('#view-train [data-env]').forEach(b => b.onclick = () => { setSessionEnv(s, b.dataset.env); s.missions = {}; keepScroll(() => renderSession(s)); toast(ENVS[b.dataset.env][0] + ' Rutina adaptada a ' + ENVS[b.dataset.env][1].toLowerCase()); });
  $$('#view-train [data-pain]').forEach(b => b.onclick = () => { const i = Number(b.dataset.pain); openPain(s, i, exs[i][0], () => keepScroll(() => renderSession(s))); });
  const ck = $('#ss-ck'); if (ck) ck.onclick = () => openCheckin(() => { SESS_UI.prog = {}; renderSession(s); });
  const sk = $('#ss-ck-skip'); if (sk) sk.onclick = () => { s.adjustDone = true; saveData(); keepScroll(() => renderSession(s)); };
  // Reiniciar un ejercicio: borra solo sus series de hoy, sin tocar la rutina ni lo demás.
  $$('#view-train [data-reset]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.reset), ex = exs[i][0];
    const ids = DB.lifts.filter(l => l.sid === s.id && l.ex === ex).map(l => l.id);
    if (!confirm(`¿Reiniciar ${ex}? Se borran sus ${ids.length} series de hoy y empiezas este ejercicio de cero. Lo demás no cambia.`)) return;
    DB.lifts = DB.lifts.filter(l => !ids.includes(l.id));
    DB.achievements = DB.achievements.filter(a => !ids.some(id => a.id.startsWith('pr-' + id)));
    if (s.sets) delete s.sets[i];
    delete SESS_UI.n[i]; delete SESS_UI.prog['ex' + i];
    if (REST.repeat && REST.repeat.ex === ex) stopRest();
    SESS_UI.open = i; saveData(); vibrate(40);
    keepScroll(() => renderSession(s)); toast('↺ ' + ex + ' reiniciado');
  });
  $$('#view-train [data-undo]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.undo), ex = exs[i][0];
    const last = DB.lifts.filter(l => l.sid === s.id && l.ex === ex).sort((a, c) => c.t - a.t)[0];
    if (!last) return;
    DB.lifts = DB.lifts.filter(l => l.id !== last.id);
    DB.achievements = DB.achievements.filter(a => !a.id.startsWith('pr-' + last.id));
    if (REST.repeat && REST.repeat.ex === ex) stopRest();
    saveData(); vibrate(30);
    keepScroll(() => renderSession(s)); toast('↶ Borrada la serie de ' + wFmt(last.w, unitFor(ex)) + ' × ' + last.r);
  });
  $('#ss-finish').onclick = finishSession;
  $('#ss-cancel').onclick = () => {
    if (!confirm('¿Descartar esta sesión y sus series?')) return;
    DB.lifts = DB.lifts.filter(l => l.sid !== s.id);
    DB.sessions = DB.sessions.filter(x => x.id !== s.id);
    closeSession(); renderTrain();
  };
}
/* ------------------------------------------------------------------ *
 *  10.0 · Diseño minimalista: secciones plegables (revelación progresiva)
 * ------------------------------------------------------------------ */
const FOLD_ICONS = [['Peso', '⚖️'], ['Hoy', '🍽️'], ['Tu semana', '📅'], ['agenda', '🗓️'], ['Retos', '🏆'], ['compromisos', '🤝'], ['funciona', '💡'],
  ['Chequeo', '⚡'], ['Reglas de oro', '✨'], ['7 reglas', '✨'], ['Logros', '🏅'], ['ciclo', '🌙'], ['Ciclo', '🌙'], ['camino', '🧭'], ['Idea', '💭'], ['Días', '📋'], ['Mi semana', '🗓️'],
  ['Mis entrenos', '🗂️'], ['Mapa muscular', '🫀'], ['Balance', '⚖️'], ['Técnicas', '🔥'], ['sesiones', '🕘'], ['actividades', '🏃'], ['objetivo', '🎯'], ['Hambre', '🤔'],
  ['Calidad', '🌈'], ['post-entreno', '⏱️'], ['Proteína', '🥩'], ['Panza', '🫃'], ['microbiota', '🦠'], ['temporada', '🍓'], ['Mitos', '❌'], ['Exportar', '📄'], ['Cómo quieres', '🧩'],
  ['Dónde entrenas', '📍'], ['Molestias', '🩹'], ['Constancia', '🗓️'], ['trucos', '🤝'], ['Apariencia', '🎨'], ['Perfil', '👤'], ['Suplementos', '💊'], ['bombeo', '💥'], ['Mentalidad', '🧠'],
  ['Copia', '💾'], ['peligrosa', '⚠️'], ['Equipo', '🎒'], ['moverte', '🗺️'], ['plan de hoy', '🎯'], ['Recuperación', '😴']];
/**
 * Convierte las tarjetas de un contenedor en filas plegables de una línea (título, resumen y
 * flecha). Mueve los nodos sin recrearlos, así sus botones siguen funcionando. Las tarjetas con
 * la clase "keep" quedan a la vista. `groups` ordena las secciones bajo títulos.
 */
function foldify(root, groups) {
  const open = DB.profile.folds || {};
  const cards = Array.from(root.children).filter(c => c.classList.contains('card') && !c.classList.contains('keep'));
  const made = [];
  cards.forEach(card => {
    const h = card.querySelector(':scope > h2, :scope > .row > h2, :scope > .row > div > h2, :scope > h3, :scope > .row > div > h3');
    const title = card.dataset.foldTitle || (h ? (h.childNodes[0] ? h.childNodes[0].textContent : h.textContent).replace(/^[^\wÁÉÍÓÚÑ¿¡]+/u, '').trim() : '');
    if (!title) return;
    const sub = card.dataset.foldSum || (h && h.querySelector('small') ? h.querySelector('small').textContent.replace(/^\s*·\s*/, '') : '');
    const pill = card.querySelector(':scope > .row .pill');
    const badge = card.dataset.foldBadge || (pill ? pill.textContent : '');
    const ico = card.dataset.foldIco || (FOLD_ICONS.find(([k]) => title.includes(k)) || [0, '•'])[1];
    const id = 'f-' + title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    if (h && !card.dataset.foldKeepHead) h.classList.add('fold-head-hidden');
    const d = document.createElement('details');
    d.className = 'fold'; d.dataset.fold = id;
    if (open[id] || card.classList.contains('open')) d.open = true;
    d.innerHTML = `<summary><span class="f-ico">${ico}</span><span class="f-txt"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${badge ? `<span class="f-badge">${esc(badge)}</span>` : ''}</summary><div class="fold-body"></div>`;
    card.replaceWith(d);
    d.lastChild.appendChild(card);
    made.push({ d, title });
  });
  if (groups) {
    const placed = new Set();
    groups.forEach(([name, keys]) => {
      const mine = made.filter(m => !placed.has(m) && (keys === '*' || keys.some(k => m.title.includes(k))));
      if (!mine.length) return;
      const t = document.createElement('div'); t.className = 'section-title'; t.textContent = name;
      root.appendChild(t);
      mine.forEach(m => { placed.add(m); root.appendChild(m.d); });
    });
  }
}
// Recordar qué secciones dejaste abiertas y redibujar las gráficas al abrir.
document.addEventListener('toggle', e => {
  const d = e.target;
  if (!d.classList || !d.classList.contains('fold')) return;
  DB.profile.folds = DB.profile.folds || {};
  if (d.open) DB.profile.folds[d.dataset.fold] = true; else delete DB.profile.folds[d.dataset.fold];
  saveData();
  if (d.open) requestAnimationFrame(() => redrawChart());
}, true);

/** Vistazo de hoy: 3–4 datos clave en una sola fila. */
function glanceStrip() {
  const r = typeof readiness === 'function' ? readiness() : null, n = sessionsThisWeek(), g = weekTarget(), cur = currentWeight();
  const tiles = [
    ['ck', r ? PLAN_INFO[r.plan].icon : '⚡', r ? r.score + '' : 'Chequeo', r ? PLAN_INFO[r.plan].name : '¿cómo llegas?'],
    ['wk', '📅', n + '/' + g, 'días activos'],
    ['wt', '⚖️', cur ? fmt(cur) : '—', 'kg · media 7 d']
  ];
  if (cycleOn()) { const ph = phaseOn(todayStr()); tiles.push(['cy', ph ? CYC_PHASES[ph.key].ico : '🌙', ph ? 'Día ' + ph.n : 'Ciclo', ph ? CYC_PHASES[ph.key].name.split(' (')[0].replace('Días previos a la regla', 'Premenstrual') : 'registrar']); }
  return `<div class="glance g${tiles.length}">${tiles.map(([k, i, v, l]) => `<button data-glance="${k}"><span class="g-ico">${i}</span><b>${v}</b><small>${esc(l)}</small></button>`).join('')}</div>`;
}
function bindGlance(root) {
  $$('[data-glance]', root).forEach(b => b.onclick = () => {
    const k = b.dataset.glance;
    if (k === 'ck') openCheckin(() => render(currentTab));
    else if (k === 'wt') openWeightQuick();
    else if (k === 'cy') openCycleDay(todayStr(), () => render(currentTab));
    else { const f = $('#view-home [data-fold^="f-mi-agenda"]') || $('#view-home [data-fold^="f-tu-semana"]'); if (f) { f.open = true; f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  });
}

function keepScroll(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

function explainRir() {
  openModal(`
    <h3>¿Qué es el RIR?</h3>
    <p><b>RIR = repeticiones en reserva.</b> Al terminar la serie, ¿cuántas más podrías haber hecho con buena técnica?</p>
    <ul class="small" style="padding-left:18px">
      <li><b>0</b>: no podías hacer ni una más (fallo).</li>
      <li><b>1–2</b>: la zona ideal para crecer.</li>
      <li><b>3</b>: te sobraban unas cuantas.</li>
      <li><b>4+</b>: fácil, como calentamiento.</li>
    </ul>
    <p class="small muted">Con esto la app calcula cuánto peso sugerirte la próxima vez. RPE es lo mismo al revés: RPE 8 = RIR 2.</p>
    <button class="block" id="ri-ok">Entendido</button>`, m => { $('#ri-ok', m).onclick = closeModal; });
}

function exerciseCard(s, e, i) {
  const [name, sets, reps, rest] = e;
  const info = exInfo(name), u = unitFor(name);
  const done = DB.lifts.filter(l => l.sid === s.id && l.ex === name).sort((a, b) => a.t - b.t);
  const complete = done.length >= sets;
  const open = SESS_UI.open === i;
  const sug = suggestion(name, reps, s.id);
  const beat = beatLast(name, done, s.id), won = beat && beat.ratio >= 1;
  const mis = missionFor(s, i, name, sets, reps), misOk = s.missionOk && s.missionOk[i];
  const head = `<div class="ex-head" data-open="${i}">
      <div class="ex-ico-wrap" data-howto="${esc(name)}">${exIcon(name, 68)}${complete ? '<span class="ex-done">✓</span>' : ''}</div>
      <div style="flex:1;min-width:0"><h4>${esc(name)}</h4>
        <div class="ex-meta">${sets} × ${esc(reps)} · ${EQUIP[info.e] || ''}${info.pf && DB.profile.gym === 'pf' ? ' · <span style="color:var(--violet)">PF</span>' : ''}</div>
        ${progBar(done.length, sets, 'ex' + i)}
        <div class="xp-msg">${misOk ? '🎯 ¡Misión cumplida! · ' : ''}${progMsg(done.length, sets, won)}${won && done.length < sets ? ' · 🚀 ya superaste tu última vez' : ''}</div></div>
      <button class="icon-btn" data-swap="${i}" aria-label="Cambiar ejercicio" title="Máquina ocupada: cambiar">⇄</button>
    </div>
    ${s.adapt && s.adapt[i] && s.swaps && s.swaps[i] === name ? `<div class="adapt-note">✨ Adaptado: ${esc(s.adapt[i])}</div>` : ''}
    ${exIssues(name).length ? `<div class="adapt-note warn">⚠ ${esc(issueText(exIssues(name), name))}. Toca ⇄ para cambiarlo.</div>` : ''}`;
  if (!open) return `<div class="ex-card ${complete ? 'done' : ''}" data-card="${i}">${head}</div>`;

  const lastSet = done[done.length - 1];
  const bodyweight = ['corporal', 'fija'].includes(info.e);
  const preW = lastSet ? roundTo(fromKg(lastSet.w, u), u === 'lb' ? 1 : 0.5) : sug ? sug.a.w : bodyweight ? 0 : '';
  const preR = lastSet ? lastSet.r : sug ? sug.a.r : '';
  const rir = SESS_UI.rir[i] != null ? SESS_UI.rir[i] : lastSet && lastSet.rir != null ? lastSet.rir : 2;
  const best = done.length ? Math.max(...done.map(d => e1rm(d.w, d.r))) : null;
  const n = SESS_UI.n[i] || 1;
  const beatHtml = beat ? `<div class="beat ${won ? 'win' : ''}">
      <div class="row spread small"><span>⚔️ Contra tu última vez</span><b>${Math.round(beat.ratio * 100)}%</b></div>
      <div class="beat-track"><div class="beat-fill" style="width:${Math.min(100, beat.ratio / 1.25 * 100)}%"></div><i class="beat-goal" style="left:80%"></i></div>
      <div class="small muted">${won ? '🚀 ¡Ya la superaste! Cada rep extra es ganancia pura.' : `Te faltan ${beat.bw ? Math.ceil(beat.prev - beat.now) + ' reps' : wFmt(beat.prev - beat.now, u).replace(/ (kg|lb)$/, ' $1 de volumen')} para superarla. ¡Tú puedes!`}</div></div>` : '';
  return `<div class="ex-card" data-card="${i}">
    ${head}
    <div class="ex-body">
      <div class="mission ${mis.kind} ${misOk ? 'ok' : ''}">${misOk ? '✅ ' : ''}${esc(mis.text)}</div>
      ${sug ? `<div class="suggest"><b>Para superarte hoy:</b><br>
        <button class="chip-btn" data-sug="${i}|${sug.a.w}|${sug.a.r}">${sug.a.w} ${u} × ${sug.a.r}</button>${sug.b ? ` o <button class="chip-btn" data-sug="${i}|${sug.b.w}|${sug.b.r}">${sug.b.w} ${u} × ${sug.b.r}</button>` : ''}
        <div class="small muted" style="margin-top:4px">${esc(sug.why)}<br>Última vez: ${sug.last.sets.map(x => wFmt(x.w, u) + ' × ' + x.r).join(', ')}</div></div>`
        : '<div class="target">Primera vez: elige un peso cómodo y anota tu punto de partida.</div>'}
      ${done.length ? `<div class="done-sets">${done.map((d, k) => {
        const pr = DB.achievements.some(a => a.id.startsWith('pr-' + d.id));
        const tech = TECHNIQUES[d.tech] && d.tech !== 'normal' ? ' · ' + TECHNIQUES[d.tech].short : '';
        return `<span class="set-chip ${pr ? 'pr' : ''}" data-edit="${d.id}">${k + 1}. <b>${wFmt(d.w, u)} × ${d.r}</b>${d.rir != null ? ' · RIR ' + d.rir : ''}${tech}${pr ? ' ↑' : ''}</span>`;
      }).join('')}</div>
      <div class="fix-row"><span class="small muted">¿Te equivocaste? Toca una serie para corregirla.</span>
        <span class="row" style="gap:6px"><button class="secondary small-btn" data-undo="${i}">↶ Última</button><button class="secondary small-btn" data-reset="${i}">↺ Reiniciar</button></span></div>` : ''}
      ${beatHtml}
      <div class="meta-row"><span>Serie ${done.length + 1}${done.length < sets ? ' de ' + sets : ' (extra)'} · descanso ${mmss(rest || 90)}</span>
        <span class="mini-step" title="Meta de series de hoy"><button data-meta="${i}|-1" aria-label="Una serie menos">−</button><b>Meta ${sets}</b><button data-meta="${i}|1" aria-label="Una serie más">+</button></span></div>
      <div class="steppers">
        <div class="stepper"><div class="s-label">${bodyweight ? 'Peso extra' : 'Peso'} <button class="unit-toggle" data-unit="${i}">${u} ⇄</button></div>
          <div class="s-row"><button data-step="${i}|w|-1">−</button><input id="w-${i}" inputmode="decimal" value="${preW}" placeholder="0"><button data-step="${i}|w|1">+</button></div></div>
        <div class="stepper"><div class="s-label">Repeticiones</div>
          <div class="s-row"><button data-step="${i}|r|-1">−</button><input id="r-${i}" inputmode="numeric" value="${preR}" placeholder="0"><button data-step="${i}|r|1">+</button></div></div>
      </div>
      <div class="rir-label"><span>¿Cuántas más podías hacer? (RIR)</span><button class="info-btn" data-info="1">?</button></div>
      <div class="rir-row">${[[0, 'fallo'], [1, 'una'], [2, 'dos'], [3, 'tres'], [4, 'fácil']].map(([v, l]) => `<button data-rir="${i}|${v}" class="${v === rir ? 'on' : ''}">${v === 4 ? '4+' : v}<small>${l}</small></button>`).join('')}</div>
      <div class="sets-row"><span>¿Cuántas series así?<small>Si hiciste varias iguales, guárdalas de una vez</small></span>
        <span class="mini-step"><button data-nset="${i}|-1" aria-label="Menos series">−</button><b id="n-${i}">${n}</b><button data-nset="${i}|1" aria-label="Más series">+</button></span></div>
      <button class="block save-set" data-log="${i}" id="save-${i}">${saveLabel(preW, preR, u, n)}</button>
      ${best && !isSimple() ? `<div class="small muted" style="margin-top:8px;text-align:center">1RM estimado hoy: <b style="color:var(--text)">${wFmt(best, u)}</b>${sug ? ' · antes ' + wFmt(sug.last.best, u) : ''}</div>` : ''}
      <div class="ex-tools">
        <button class="secondary small-btn" data-howto="${esc(name)}">📖 Cómo se hace</button>
        <button class="secondary small-btn" data-swap="${i}">⇄ Cambiar ejercicio</button>
        <button class="secondary small-btn" data-pain="${i}">🩹 Me duele</button>
        ${isSimple() ? '' : `<button class="secondary small-btn" data-video="${i}">🎥 Video</button>
        <button class="secondary small-btn" data-more="${i}">${SESS_UI.more[i] ? 'Menos opciones' : 'Técnica de intensidad'}</button>`}
      </div>
      ${SESS_UI.more[i] ? `<select id="t-${i}" class="small-sel" style="margin-top:8px">${Object.keys(TECHNIQUES).map(k => `<option value="${k}">${esc(TECHNIQUES[k].name)}</option>`).join('')}</select>` : ''}
    </div>
  </div>`;
}

/** Botón "Igual" de la barra de descanso: repite la última serie con un solo toque. */
function repeatFromTimer() {
  const r = REST.repeat, s = activeSession();
  if (!r || !s || s.id !== r.sid) { stopRest(); return; }
  const last = DB.lifts.filter(l => l.sid === s.id && l.ex === r.ex).sort((a, b) => b.t - a.t)[0];
  if (!last) { stopRest(); return; }
  const exs = sessionExercises(s), e = exs[r.i] && exs[r.i][0] === r.ex ? exs[r.i] : exs.find(x => x[0] === r.ex) || [r.ex, 3, '', 90];
  const set = Object.assign({}, last, { id: uid(), t: Date.now(), tech: 'normal' });
  DB.lifts.push(set);
  const prs = checkSetRecords(set);
  saveData(); vibrate(prs.length ? 150 : 40);
  const n = DB.lifts.filter(l => l.sid === s.id && l.ex === r.ex).length;
  toast((prs.length ? '🏆 ' : '✓ ') + 'Serie ' + n + ' guardada: ' + wFmt(set.w, unitFor(set.ex)) + ' × ' + set.r);
  if (n === e[1]) SESS_UI.celebrate = exs.indexOf(e);
  if (n >= e[1]) {
    const next = exs.findIndex((x, k) => k > r.i && DB.lifts.filter(l => l.sid === s.id && l.ex === x[0]).length < x[1]);
    if (next >= 0) SESS_UI.open = next;
  }
  startRest(e[3] || 90, 'Descanso · ' + r.ex, n < e[1] ? r : null);
  if (currentTab === 'train') keepScroll(() => renderSession(s));
}

function saveLabel(w, r, u, n) {
  n = n || 1;
  const what = n > 1 ? n + ' series' : 'serie';
  if (num(w) == null || !num(r)) return '✓ Guardar ' + what;
  const load = num(w) === 0 ? `${num(r)} reps` : `${num(w)} ${u} × ${num(r)}`;
  return n > 1 ? `✓ Guardar ${n} series · ${load}` : `✓ Guardar ${load}`;
}

function logSet(s, i) {
  const exs = sessionExercises(s), e = exs[i], ex = e[0], u = unitFor(ex);
  const w = num($('#w-' + i).value), r = num($('#r-' + i).value);
  if (w == null || w < 0 || r == null || r < 1 || r > 100) { toast('Revisa peso y repeticiones'); return; }
  const lastSet = DB.lifts.filter(l => l.sid === s.id && l.ex === ex).sort((a, b) => b.t - a.t)[0];
  const rir = SESS_UI.rir[i] != null ? SESS_UI.rir[i] : lastSet && lastSet.rir != null ? lastSet.rir : 2;
  const techSel = $('#t-' + i);
  const before = DB.lifts.filter(l => l.sid === s.id && l.ex === ex).length;
  const count = Math.max(1, Math.min(10, SESS_UI.n[i] || 1));
  let prs = [];
  for (let k = 0; k < count; k++) {
    const set = { id: uid(), ex, w: toKg(w, u), r: Math.round(r), rir, date: s.date, t: Date.now() + k, sid: s.id, tech: techSel ? techSel.value : 'normal' };
    DB.lifts.push(set);
    prs = prs.concat(checkSetRecords(set));
  }
  SESS_UI.n[i] = 1;
  saveData();
  vibrate(prs.length ? 150 : 40);
  if (prs.length && gamify()) toast('🏆 ¡Récord en ' + ex + '!');
  else if (count > 1) toast('✓ ' + count + ' series guardadas');
  // Al completar las series objetivo: festejo y se abre el siguiente ejercicio pendiente.
  const n = before + count, finished = before < e[1] && n >= e[1];
  if (finished) SESS_UI.celebrate = i;
  const mis = s.missions && s.missions[i];
  if (mis && !(s.missionOk && s.missionOk[i]) && missionMet(s, mis)) { s.missionOk = s.missionOk || {}; s.missionOk[i] = true; saveData(); setTimeout(() => toast('🎯 ¡Misión cumplida en ' + ex + '!'), 900); }
  if (n >= e[1]) {
    const next = exs.findIndex((x, k) => k > i && DB.lifts.filter(l => l.sid === s.id && l.ex === x[0]).length < x[1]);
    if (next >= 0) { SESS_UI.open = next; toast(prs.length ? '🏆 ¡Récord! Siguiente: ' + exs[next][0] : '✓ ¡Ejercicio completo! Siguiente: ' + exs[next][0]); }
    else if (finished) toast('🏆 ¡' + ex + ' completo!');
  }
  startRest(e[3] || 90, 'Descanso · ' + ex, n < e[1] ? { sid: s.id, i, ex } : null);
  keepScroll(() => renderSession(s));
  // Si hubo festejo, se espera a que se vea antes de bajar al siguiente ejercicio.
  if (n >= e[1]) setTimeout(() => { const c = $(`#view-train [data-card="${SESS_UI.open}"]`); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, finished ? 1100 : 60);
}

function openEditSet(id, after) {
  const l = DB.lifts.find(x => x.id === id);
  if (!l) return;
  const u = unitFor(l.ex);
  openModal(`
    <h3>Editar serie</h3>
    <p class="small muted" style="margin-top:0">${esc(l.ex)} · ${longDate(l.date)}</p>
    <div class="small muted" style="font-weight:600;margin-bottom:6px">¿En qué unidad era ese peso?</div>
    <div class="seg" id="es-u"><button data-u="kg" class="${u === 'kg' ? 'on' : ''}">kg</button><button data-u="lb" class="${u === 'lb' ? 'on' : ''}">lb</button></div>
    <div class="grid2">
      <label>Peso<input id="es-w" inputmode="decimal" value="${roundTo(fromKg(l.w, u), u === 'lb' ? 1 : 0.5)}"></label>
      <label>Repeticiones<input id="es-r" inputmode="numeric" value="${l.r}"></label>
    </div>
    <label>Esfuerzo<select id="es-q">${RIR_OPTIONS.map(([v, t]) => `<option value="${v}" ${v === l.rir ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label>Técnica<select id="es-t">${Object.keys(TECHNIQUES).map(k => `<option value="${k}" ${k === (l.tech || 'normal') ? 'selected' : ''}>${esc(TECHNIQUES[k].name)}</option>`).join('')}</select></label>
    <div class="row"><button class="danger" id="es-del">Borrar</button><button class="secondary" id="es-cancel" style="flex:1">Cancelar</button><button id="es-save" style="flex:1">Guardar</button></div>`, m => {
    // Cambiar la unidad no convierte el número: sirve si anotaste 50 en lb pero eran 50 kg.
    let eu = u;
    $$('#es-u [data-u]', m).forEach(b => b.onclick = () => { eu = b.dataset.u; $$('#es-u [data-u]', m).forEach(x => x.classList.toggle('on', x === b)); });
    $('#es-cancel', m).onclick = closeModal;
    $('#es-del', m).onclick = () => {
      DB.lifts = DB.lifts.filter(x => x.id !== id);
      DB.achievements = DB.achievements.filter(a => !a.id.startsWith('pr-' + id));
      saveData(); closeModal(); after();
    };
    $('#es-save', m).onclick = () => {
      const w = num($('#es-w', m).value), r = num($('#es-r', m).value);
      if (w == null || r == null || r < 1) { toast('Revisa peso y repeticiones'); return; }
      l.w = toKg(w, eu); l.r = Math.round(r);
      if (eu !== u) DB.units[l.ex] = eu; l.rir = Number($('#es-q', m).value); l.tech = $('#es-t', m).value;
      saveData(); closeModal(); after();
    };
  });
}

/** Biblioteca de ejercicios: búsqueda, filtro por grupo y por Planet Fitness. Con onPick elige uno; sin él solo consulta. */
let pickerGroup = 'all', pickerMine = true;
function exRow(n, attr) {
  const x = EX[n], iss = exIssues(n);
  return `<button class="pick-row ${iss.length ? 'dim' : ''}" ${attr}="${esc(n)}">${exIcon(n, 60)}<span><b>${esc(n)}</b>${x.custom ? ' <span class="pill gray">propio</span>' : ''}<br><small>${GROUPS[x.g] || x.g} · ${EQUIP[x.e] || ''}${x.pf ? ' · PF' : ''}${iss.length ? ` · <span style="color:var(--warn)">⚠ ${esc(issueText(iss, n))}</span>` : ''}</small></span></button>`;
}
function openExercisePicker(onPick) {
  const draw = (m, q) => {
    const list = Object.keys(EX).filter(n => (pickerGroup === 'all' || EX[n].g === pickerGroup) && (!pickerMine || hasEquip(n)) && (!q || n.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => okForMe(b) - okForMe(a));
    $('#pk-list', m).innerHTML = (list.length ? list.map(n => exRow(n, 'data-pick')).join('') : '<div class="empty">Sin resultados.</div>') +
      '<button class="secondary block" id="pk-new" style="margin-top:6px">＋ Crear un ejercicio que no está en la lista</button>';
    $$('[data-pick]', m).forEach(b => b.onclick = () => { if (onPick) onPick(b.dataset.pick); else openExerciseInfo(b.dataset.pick); });
    $('#pk-new', m).onclick = () => openCustomExercise(onPick, $('#pk-q', m).value);
  };
  openModal(`
    <div class="row spread"><h3 style="margin:0">${onPick ? 'Elige un ejercicio' : 'Ejercicios y máquinas'}</h3><button class="ghost" id="pk-close">Cerrar</button></div>
    <input id="pk-q" placeholder="Buscar (ej. prensa, remo, lagartijas)…">
    <div class="row" style="gap:6px;margin:8px 0">
      <select id="pk-g" style="flex:1"><option value="all">Todos los grupos</option>${Object.keys(GROUPS).map(g => `<option value="${g}" ${pickerGroup === g ? 'selected' : ''}>${GROUPS[g]}</option>`).join('')}</select>
      <label class="check" style="margin:0;white-space:nowrap"><input type="checkbox" id="pk-mine" ${pickerMine ? 'checked' : ''}> Mi equipo</label>
    </div>
    <div id="pk-list"></div>`, m => {
    $('#pk-close', m).onclick = closeModal;
    $('#pk-q', m).oninput = e => draw(m, e.target.value);
    $('#pk-g', m).onchange = e => { pickerGroup = e.target.value; draw(m, $('#pk-q', m).value); };
    $('#pk-mine', m).onchange = e => { pickerMine = e.target.checked; draw(m, $('#pk-q', m).value); };
    draw(m, '');
  });
}

/** Crear un ejercicio propio (gratis, sin límite). Queda en el catálogo, en las rutinas y en las exportaciones. */
function openCustomExercise(onPick, preset) {
  openModal(`
    <h3>Nuevo ejercicio</h3>
    <label>Nombre<input id="ce-name" value="${esc(preset || '')}" placeholder="Ej. Remo en máquina Hammer"></label>
    <div class="grid2">
      <label>Músculo principal<select id="ce-g">${Object.keys(GROUPS).map(g => `<option value="${g}">${GROUPS[g]}</option>`).join('')}</select></label>
      <label>Equipo<select id="ce-e">${Object.keys(EQUIP).map(e => `<option value="${e}" ${e === 'maq' ? 'selected' : ''}>${EQUIP[e]}</option>`).join('')}</select></label>
    </div>
    <label>Tipo<select id="ce-t"><option value="c">Compuesto (varias articulaciones)</option><option value="a">Aislamiento (una articulación)</option></select></label>
    <div class="row"><button class="secondary" id="ce-cancel" style="flex:1">Cancelar</button><button id="ce-save" style="flex:1">Crear</button></div>`, m => {
    $('#ce-cancel', m).onclick = () => openExercisePicker(onPick);
    $('#ce-save', m).onclick = () => {
      const name = $('#ce-name', m).value.trim();
      if (name.length < 3) { toast('Escribe un nombre'); return; }
      if (EX[name]) { toast('Ya existe un ejercicio con ese nombre'); return; }
      const c = { name, g: $('#ce-g', m).value, e: $('#ce-e', m).value, t: $('#ce-t', m).value };
      DB.customEx.push(c); registerCustomExercises();
      if (!DB.profile.equip.includes(c.e)) DB.profile.equip.push(c.e);
      saveData(); toast('Ejercicio creado: ' + name);
      if (onPick) onPick(name); else openExercisePicker(null);
    };
  });
}

/** Fotos de inicio y final alternándose (animación de 2 cuadros) + músculos, pasos y error común. */
function howToBlock(name) {
  const id = EX_PHOTO[name], x = exInfo(name), h = HOWTO_EX[name] || HOWTO[x.p];
  return `${id ? `<div class="howto-anim"><img src="img/ex/${id}-0.jpg" alt="Posición inicial"><img src="img/ex/${id}-1.jpg" alt="Posición final" class="b">
      <span class="howto-tag a">Inicio</span><span class="howto-tag b">Final</span></div>` : `<div class="ex-hero">${exIcon(name, 120)}</div>`}
    <div class="howto-muscle"><b>Trabaja:</b> ${esc(MUSCLES[x.p] || GROUPS[x.g] || '')}</div>
    ${h ? `<ol class="howto-steps">${h[0].map(t => `<li>${esc(t)}</li>`).join('')}</ol>
    <div class="status warn" style="margin-top:8px"><b>Error común</b>${esc(h[1])}</div>` : ''}`;
}
function openHowTo(name) {
  const x = exInfo(name);
  openModal(`
    <div class="row spread"><h3 style="margin:0">${esc(name)}</h3><button class="ghost" id="ht-close">Cerrar</button></div>
    <p class="small muted" style="margin:2px 0 10px">${EQUIP[x.e] || ''} · ${x.t === 'c' ? 'compuesto' : 'aislamiento'}${x.pf ? ' · disponible en Planet Fitness' : ''}</p>
    ${howToBlock(name)}
    <p class="small muted" style="margin-top:12px">La foto muestra el movimiento; tu máquina puede verse distinta según el gimnasio.</p>`, m => {
    $('#ht-close', m).onclick = closeModal;
  });
}

function openExerciseInfo(name) {
  const x = EX[name], subs = substitutes(name);
  const sets = DB.lifts.filter(l => l.ex === name), u = unitFor(name);
  const top = sets.length ? sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a) : null;
  openModal(`
    <div class="row spread"><h3 style="margin:0">${esc(name)}</h3><button class="ghost" id="ei-back">Volver</button></div>
    ${howToBlock(name)}
    <p class="small">${GROUPS[x.g] || x.g} · ${EQUIP[x.e]} · ${x.t === 'c' ? 'compuesto' : 'aislamiento'}${x.pf ? ' · disponible en Planet Fitness' : ''}</p>
    ${top ? `<p class="small">Tu mejor serie: <b>${wFmt(top.w, u)} × ${top.r}</b> · 1RM estimado ${wFmt(e1rm(top.w, top.r), u)}</p>` : ''}
    <p class="small muted" style="margin-bottom:4px">Sustitutos si está ocupado:</p>
    <div class="chips">${smartSubs(name).slice(0, 8).map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>`, m => {
    $('#ei-back', m).onclick = () => openExercisePicker(null);
  });
}

function openSwap(s, i) {
  const all = sessionExercises(s), cur = all[i][0];
  const inSession = all.map(e => e[0]);
  const subs = substitutes(cur).filter(n => !inSession.includes(n)).sort((a, b) => okForMe(b) - okForMe(a)).slice(0, 10);
  openModal(`
    <div class="row spread"><h3 style="margin:0">Cambiar ${esc(cur)}</h3><button class="ghost" id="sw-close">Cerrar</button></div>
    <p class="small muted">Mismo patrón de movimiento y mismos músculos. Primero lo que puedes hacer con tu equipo y sin molestias.</p>
    ${subs.map(n => exRow(n, 'data-sub')).join('') || '<div class="empty">No hay alternativas en el catálogo.</div>'}
    <button class="secondary block" id="sw-pick" style="margin-top:6px">Elegir otro ejercicio</button>
    ${s.swaps && s.swaps[i] ? '<button class="ghost block" id="sw-undo" style="margin-top:4px">Volver al original</button>' : ''}`, m => {
    const apply = name => { s.swaps = s.swaps || {}; s.swaps[i] = name; if (s.adapt) delete s.adapt[i]; saveData(); closeModal(); keepScroll(() => renderSession(s)); toast('Cambiado por ' + name); };
    $('#sw-close', m).onclick = closeModal;
    $$('[data-sub]', m).forEach(b => b.onclick = () => apply(b.dataset.sub));
    $('#sw-pick', m).onclick = () => openExercisePicker(apply);
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
    ${Object.keys(byEx).map(ex => { const u = unitFor(ex); return `<div class="row" style="margin:10px 0 2px;gap:8px">${exIcon(ex, 40)}<b>${esc(ex)}</b></div><p class="small muted" style="margin:0">${byEx[ex].map(l => wFmt(l.w, u) + ' × ' + l.r + (l.rir != null ? ' @RIR' + l.rir : '') + (l.tech && l.tech !== 'normal' ? ' ' + TECHNIQUES[l.tech].short : '')).join(' · ')}</p>`; }).join('')}
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
/* ---------- Mi semana: grupos de ejercicios por día ---------- */
function weekPlanCard() {
  const today = weekdayIdx(todayStr());
  const opts = sel => `<option value="">😴 Descanso</option>` + DB.workouts.map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
  return `<div class="card">
      <h2>Mi semana <small>· elige qué entrenas cada día</small></h2>
      ${WEEKDAYS.map((n, k) => {
        const w = workoutById(DB.plan[k]);
        return `<div class="wk-row ${k === today ? 'today' : ''}">
          <b class="wk-day">${n.slice(0, 3)}${k === today ? '<small>HOY</small>' : ''}</b>
          <select data-plan="${k}" ${DB.workouts.length ? '' : 'disabled'}>${opts(DB.plan[k])}</select>
          ${w ? `<button class="icon-btn wk-go" data-wkstart="${k}" aria-label="Empezar ${esc(w.name)}">▶</button>` : '<span class="wk-go"></span>'}
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <div class="row spread" style="margin-bottom:8px"><h2 style="margin:0">Mis entrenos <small>· grupos de ejercicios</small></h2></div>
      ${DB.workouts.length ? DB.workouts.map(w => {
        const days = WEEKDAYS.filter((_, k) => DB.plan[k] === w.id).map(d => d.slice(0, 3));
        return `<div class="wo-row">
          <div class="wo-pics">${w.ex.slice(0, 3).map(e => exIcon(e[0], 40)).join('')}</div>
          <div class="grow" data-woedit="${w.id}"><b>${esc(w.name)}</b><br><small class="muted">${w.ex.length} ejercicio${w.ex.length === 1 ? '' : 's'} · ${days.length ? days.join(', ') : 'sin día asignado'}</small></div>
          <button class="icon-btn" data-woedit="${w.id}" aria-label="Editar">✏️</button>
          <button class="icon-btn wk-go" data-wostart="${w.id}" aria-label="Empezar">▶</button>
        </div>`;
      }).join('') : '<div class="empty"><span class="emoji">🗂️</span>Crea tus entrenos (por ejemplo "Pecho y tríceps" o "Pierna") y asígnalos a los días que quieras.</div>'}
      <button class="block" id="wo-new" style="margin-top:10px">+ Nuevo entreno</button>
    </div>`;
}
function bindWeekPlan() {
  const v = $('#view-train');
  $$('[data-plan]', v).forEach(sel => sel.onchange = () => { DB.plan[Number(sel.dataset.plan)] = sel.value || null; saveData(); keepScroll(renderTrain); });
  $$('[data-wkstart]', v).forEach(b => b.onclick = () => { startSession('custom', 'w' + b.dataset.wkstart); renderTrain(); window.scrollTo(0, 0); });
  $$('[data-wostart]', v).forEach(b => b.onclick = () => { startSession('custom', null, b.dataset.wostart); renderTrain(); window.scrollTo(0, 0); });
  $$('[data-woedit]', v).forEach(b => b.onclick = () => openWorkoutEditor(b.dataset.woedit));
  $('#wo-new', v).onclick = () => openWorkoutEditor(null);
}

/**
 * Editor de un entreno (grupo de ejercicios): nombre, días de la semana y ejercicios con
 * series, reps y descanso. Trabaja sobre una copia y solo guarda al pulsar Guardar.
 * `draft` permite volver al editor después de elegir un ejercicio en la biblioteca.
 */
function openWorkoutEditor(id, draft) {
  const orig = workoutById(id);
  const d = draft || {
    id: orig ? orig.id : uid(), isNew: !orig, name: orig ? orig.name : '',
    ex: orig ? orig.ex.map(e => e.slice()) : [],
    days: WEEKDAYS.map((_, k) => orig ? DB.plan[k] === orig.id : false)
  };
  const sync = m => {
    d.name = $('#wo-name', m).value;
    d.ex.forEach((e, k) => {
      e[1] = Math.max(1, Math.min(12, num($('#wo-s-' + k, m).value) || e[1]));
      e[2] = $('#wo-r-' + k, m).value.trim() || e[2];
      e[3] = Math.max(15, Math.min(600, num($('#wo-d-' + k, m).value) || e[3]));
    });
  };
  const draw = m => {
    m.innerHTML = `
      <h3>${d.isNew ? 'Nuevo entreno' : 'Editar entreno'}</h3>
      <label>Nombre<input id="wo-name" value="${esc(d.name)}" placeholder="Ej. Pecho y tríceps"></label>
      <div class="small muted" style="font-weight:600;margin-bottom:6px">¿Qué días lo haces?</div>
      <div class="wo-days">${WEEKDAYS.map((n, k) => {
        const other = !d.days[k] && DB.plan[k] && DB.plan[k] !== d.id ? workoutById(DB.plan[k]) : null;
        return `<button class="${d.days[k] ? 'on' : ''} ${other ? 'taken' : ''}" data-wday="${k}" title="${other ? 'Ahora: ' + esc(other.name) : ''}">${n.slice(0, 2)}</button>`;
      }).join('')}</div>
      <p class="small muted" style="margin:4px 0 12px">Un punto naranja = ese día ya tiene otro entreno; si lo marcas, lo reemplazas.</p>
      <div class="section-title" style="margin-top:4px">Ejercicios (${d.ex.length})</div>
      ${d.ex.length ? d.ex.map((e, k) => `
        <div class="wo-ex">
          <div class="row">${exIcon(e[0], 44)}<b class="grow" style="font-size:14px">${k + 1}. ${esc(e[0])}</b>
            <button class="icon-btn" data-womove="${k}|-1" ${k ? '' : 'disabled'} aria-label="Subir">↑</button>
            <button class="icon-btn" data-womove="${k}|1" ${k < d.ex.length - 1 ? '' : 'disabled'} aria-label="Bajar">↓</button>
            <button class="icon-btn" data-wodel="${k}" aria-label="Quitar">✕</button></div>
          <div class="grid3" style="margin-top:6px">
            <label class="mini">Series<input id="wo-s-${k}" inputmode="numeric" value="${e[1]}"></label>
            <label class="mini">Reps<input id="wo-r-${k}" value="${esc(e[2])}"></label>
            <label class="mini">Descanso (s)<input id="wo-d-${k}" inputmode="numeric" value="${e[3] || 90}"></label>
          </div>
        </div>`).join('') : '<div class="empty">Añade los ejercicios de este entreno.</div>'}
      <button class="secondary block" id="wo-add" style="margin:4px 0 14px">+ Añadir ejercicio</button>
      <div class="row">${d.isNew ? '' : '<button class="danger" id="wo-del">Borrar</button>'}<button class="secondary" id="wo-cancel" style="flex:1">Cancelar</button><button id="wo-save" style="flex:1">Guardar</button></div>`;
    $$('[data-wday]', m).forEach(b => b.onclick = () => { sync(m); const k = Number(b.dataset.wday); d.days[k] = !d.days[k]; draw(m); });
    $$('[data-womove]', m).forEach(b => b.onclick = () => {
      sync(m); const [k, dir] = b.dataset.womove.split('|').map(Number);
      const t = d.ex[k]; d.ex[k] = d.ex[k + dir]; d.ex[k + dir] = t; draw(m);
    });
    $$('[data-wodel]', m).forEach(b => b.onclick = () => { sync(m); d.ex.splice(Number(b.dataset.wodel), 1); draw(m); });
    $('#wo-add', m).onclick = () => {
      sync(m);
      openExercisePicker(name => {
        const comp = exInfo(name).t === 'c';
        d.ex.push([name, comp ? 4 : 3, comp ? '8–12' : '10–15', comp ? 120 : 75]);
        openWorkoutEditor(d.id, d);
      });
    };
    $('#wo-cancel', m).onclick = closeModal;
    const del = $('#wo-del', m);
    if (del) del.onclick = () => {
      if (!confirm('¿Borrar el entreno "' + d.name + '"? Tus series ya registradas no se borran.')) return;
      DB.workouts = DB.workouts.filter(w => w.id !== d.id);
      DB.plan = DB.plan.map(x => x === d.id ? null : x);
      saveData(); closeModal(); renderTrain(); toast('Entreno borrado');
    };
    $('#wo-save', m).onclick = () => {
      sync(m);
      const name = d.name.trim();
      if (!name) { toast('Ponle nombre a tu entreno'); return; }
      if (!d.ex.length) { toast('Añade al menos un ejercicio'); return; }
      const w = workoutById(d.id);
      if (w) { w.name = name; w.ex = d.ex; } else DB.workouts.push({ id: d.id, name, ex: d.ex });
      DB.plan = DB.plan.map((x, k) => d.days[k] ? d.id : x === d.id ? null : x);
      saveData(); closeModal();
      if (currentTab === 'train') renderTrain();
      const days = WEEKDAYS.filter((_, k) => d.days[k]);
      toast('✓ "' + name + '" guardado' + (days.length ? ' para ' + days.join(', ').toLowerCase() : ''));
    };
  };
  openModal('', draw);
}

/** Guarda los ejercicios de la sesión actual como un entreno reutilizable. */
function saveSessionAsWorkout(s) {
  const exs = sessionExercises(s);
  if (!exs.length) { toast('Añade ejercicios primero'); return; }
  openWorkoutEditor(null, {
    id: uid(), isNew: true, name: s.routine === 'libre' ? '' : s.dayName.split('·').pop().trim(),
    ex: exs.map(e => [e[0], Math.max(e[1], DB.lifts.filter(l => l.sid === s.id && l.ex === e[0]).length), e[2], e[3]]),
    days: WEEKDAYS.map(() => false)
  });
}

/* ------------------------------------------------------------------ *
 *  NUTRICIÓN
 * ------------------------------------------------------------------ */
function renderFood() {
  const p = DB.profile, t = todayStr(), tg = targets(), tot = dayTotals(t);
  const meals = (DB.days[t] && DB.days[t].meals) || [];
  const left = pwoLeft();
  $('#view-food').innerHTML = `
    <div class="card" data-fold-sum="${tg.kcal.toLocaleString('es-MX')} kcal · P ${tg.protein} g · C ${tg.carbs} g · G ${tg.fat} g">
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

    <div class="card keep">
      <h2>Hoy</h2>
      <div class="row spread small"><span><b>${tot.kcal.toLocaleString('es-MX')}</b> / ${tg.kcal.toLocaleString('es-MX')} kcal</span><span>${tot.meals} comida${tot.meals === 1 ? '' : 's'}</span></div>
      <div class="macros">
        <div class="macro p"><div class="label"><span>Proteína</span><span>${Math.round(tot.p)}/${tg.protein}</span></div>${bar(tot.p, tg.protein)}</div>
        <div class="macro c"><div class="label"><span>Carbos</span><span>${Math.round(tot.c)}/${tg.carbs}</span></div>${bar(tot.c, tg.carbs)}</div>
        <div class="macro f"><div class="label"><span>Grasa</span><span>${Math.round(tot.f)}/${tg.fat}</span></div>${bar(tot.f, tg.fat)}</div>
      </div>
      <div class="row spread small" style="margin-top:10px"><span>Azúcar refinada</span><span style="color:${tot.s > tg.sugar ? 'var(--bad)' : 'var(--good)'}">${Math.round(tot.s)} / ${tg.sugar} g máx.</span></div>
      <div class="row spread small" style="margin-top:4px"><span>Agua</span><span>${fmt(tot.water / 1000, 2)} / ${fmt(tg.water / 1000, 1)} L</span></div>
      <div class="fix-bar"><button class="secondary small-btn" data-wat="250">💧 +250 ml</button><button class="secondary small-btn" data-wat="500">+500 ml</button>${tot.water ? '<button class="secondary small-btn" data-wat="undo">↶ Deshacer</button><button class="ghost small-btn" data-wat="reset">Reiniciar</button>' : ''}</div>
      ${meals.length ? `<table style="margin-top:10px"><thead><tr><th>Comida</th><th class="num">P</th><th class="num">C</th><th class="num">G</th><th></th></tr></thead><tbody>
        ${meals.map((m, i) => `<tr><td>${esc(m.name)}${m.partial ? ' <span class="muted small">(' + m.kcal + ' kcal, sin macros)</span>' : ''}</td><td class="num">${Math.round(m.p)}</td><td class="num">${Math.round(m.c)}</td><td class="num">${Math.round(m.f)}</td><td class="num"><button class="ghost" data-delmeal="${i}">✕</button></td></tr>`).join('')}
      </tbody></table>` : ''}
      ${meals.length ? '<div class="fix-bar" style="margin-top:8px"><span class="small muted" style="flex:1">¿Te equivocaste? Usa ✕ en una comida o:</span><button class="secondary small-btn" id="fd-undo">↶ Última</button><button class="ghost small-btn" id="fd-reset">Reiniciar día</button></div>' : ''}
      <button class="block" id="fd-add" style="margin-top:12px">+ Añadir comida</button>
    </div>

    ${cravingCard()}
    ${qualityCard(t)}

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
    </div>
    ${gutCard()}
    ${microbiomeCard()}
    ${seasonCard()}
    <div class="card">
      <h2>Mitos y datos <small>· lo que sí tiene respaldo</small></h2>
      ${FOOD_FACTS.map(([m, f]) => `<details><summary>❌ ${esc(m)}</summary><p class="small" style="margin:0 0 12px">✅ ${esc(f)}</p></details>`).join('')}
    </div>`;
  bindFoodExtras(t);
  foldify($('#view-food'), [['Para hoy', ['Hambre', 'Calidad', 'post-entreno']], ['Tu plan', ['objetivo', 'Proteína']], ['Salud y conocimiento', '*']]);

  $('#fd-add').onclick = () => openMealForm(t);
  $$('#view-food [data-wat]').forEach(b => b.onclick = () => {
    const e = day(t), a = b.dataset.wat;
    if (a === 'undo') { const last = (e.waterLog || []).pop() || 250; e.water = Math.max(0, (e.water || 0) - last); toast('↶ −' + last + ' ml'); }
    else if (a === 'reset') { if (!confirm('¿Poner el agua de hoy en 0 para volver a registrarla?')) return; e.water = 0; e.waterLog = []; }
    else { e.water = (e.water || 0) + Number(a); e.waterLog = (e.waterLog || []).concat(Number(a)); vibrate(20); }
    saveData(); keepScroll(renderFood);
  });
  const fu = $('#fd-undo'); if (fu) fu.onclick = () => { const e = DB.days[t]; const m = e.meals.pop(); saveData(); keepScroll(renderFood); toast('↶ Quitada: ' + m.name); };
  const fr = $('#fd-reset'); if (fr) fr.onclick = () => {
    if (!confirm('¿Borrar todas las comidas de hoy (kcal y proteína en 0) para registrarlas de nuevo?')) return;
    const e = DB.days[t]; e.meals = []; delete e.kcal; delete e.protein; saveData(); keepScroll(renderFood); toast('Comidas de hoy reiniciadas');
  };
  const pw = $('#fd-pwo'); if (pw) pw.onclick = () => { startPwo(); renderFood(); };
  $$('#view-food [data-delmeal]').forEach(b => b.onclick = () => {
    DB.days[t].meals.splice(Number(b.dataset.delmeal), 1); saveData(); renderFood();
  });
  bindPwo($('#view-food'));
}

/* ---------- 6.2: hambre vs antojo, calidad del día, digestión y temporada ---------- */
function daysBack(n) { const out = []; for (let k = 0; k < n; k++) out.push(addDays(todayStr(), -k)); return out; }
function cravingsWeek() {
  const wk = weekKey(todayStr()), out = [];
  Object.keys(DB.days).forEach(d => { if (weekKey(d) === wk) (DB.days[d].cravings || []).forEach(c => out.push(c)); });
  return out;
}
function cravingCard() {
  const list = cravingsWeek(), ant = list.filter(c => c.kind === 'antojo');
  const trig = {};
  ant.forEach(c => { if (c.trig && c.trig !== 'ninguno') trig[c.trig] = (trig[c.trig] || 0) + 1; });
  const top = Object.keys(trig).sort((a, b) => trig[b] - trig[a])[0];
  const won = ant.filter(c => c.swap).length;
  return `<div class="card">
    <h2>¿Hambre o antojo?</h2>
    <p class="small muted" style="margin-top:0">Si te comerías cualquier cosa, es hambre. Si solo te sirve algo en especial, es antojo. Responde 5 preguntas y te digo qué hacer.</p>
    <button class="block" id="fd-hunger">🤔 Tengo ganas de comer</button>
    ${list.length ? `<p class="small" style="margin:10px 0 0">Esta semana: <b>${ant.length}</b> antojo${ant.length === 1 ? '' : 's'}${won ? ` · <b style="color:var(--good)">${won}</b> cambiado${won === 1 ? '' : 's'} por algo mejor 💪` : ''}${top ? ` · más seguido por <b>${esc(TRIGGERS[top])}</b>` : ''}</p>` : ''}
  </div>`;
}
function openHungerCheck() {
  const ans = {};
  const draw = m => {
    const done = HUNGER_QS.every(([id]) => ans[id] != null);
    let res = '';
    if (done) {
      const score = HUNGER_QS.reduce((a, [id, , real]) => a + (ans[id] === real ? (id === 'any' ? 2 : 1) : 0), 0);
      const real = score >= 4, tg = targets(), tot = dayTotals(todayStr());
      res = real ? `<div class="status good"><b>Es hambre real 🍽️</b>Tu cuerpo pide energía: come una comida completa con proteína.${tg.protein - tot.p > 0 ? ` Hoy te faltan <b>${Math.round(tg.protein - tot.p)} g de proteína</b> y ${Math.max(0, tg.kcal - tot.kcal).toLocaleString('es-MX')} kcal.` : ''} Lo que más sacia: proteína, legumbres, avena, huevo, plátano o aguacate.</div>
          <div class="row" style="margin-top:12px"><button class="secondary" id="hc-close" style="flex:1">Cerrar</button><button id="hc-meal" style="flex:1">Registrar comida</button></div>`
        : `<div class="status warn"><b>Parece antojo 🧠</b>Es normal: casi todos los tenemos. Prueba esto:</div>
          <ol class="small" style="padding-left:20px">${CRAVING_STEPS.map(x => `<li style="margin:5px 0">${esc(x)}</li>`).join('')}</ol>
          <div class="small muted" style="font-weight:600;margin:6px 0">¿Qué se te antoja? Cámbialo por:</div>
          ${CRAVING_SWAPS.map(([f, sw], k) => `<button class="swap-row ${ans.swap === k ? 'on' : ''}" data-swap-food="${k}"><b>${f}</b><span>→ ${esc(sw)}</span></button>`).join('')}
          <div class="small muted" style="font-weight:600;margin:10px 0 6px">¿Qué lo provocó?</div>
          <div class="chips">${Object.keys(TRIGGERS).map(k => `<button class="chip-btn ${ans.trig === k ? 'on' : ''}" data-trig="${k}">${TRIGGERS[k]}</button>`).join('')}</div>
          <button class="block" id="hc-save" style="margin-top:12px">${ans.swap != null ? '💪 Lo cambié por algo mejor' : 'Anotar antojo'}</button>`;
    }
    m.innerHTML = `<h3>¿Hambre o antojo?</h3>
      ${HUNGER_QS.map(([id, q]) => `<div class="hq"><span>${esc(q)}</span><div class="seg" style="margin:0"><button data-hq="${id}|1" class="${ans[id] === true ? 'on' : ''}">Sí</button><button data-hq="${id}|0" class="${ans[id] === false ? 'on' : ''}">No</button></div></div>`).join('')}
      ${res}`;
    $$('[data-hq]', m).forEach(b => b.onclick = () => { const [id, v] = b.dataset.hq.split('|'); ans[id] = v === '1'; draw(m); });
    $$('[data-swap-food]', m).forEach(b => b.onclick = () => { const k = Number(b.dataset.swapFood); ans.swap = ans.swap === k ? null : k; draw(m); });
    $$('[data-trig]', m).forEach(b => b.onclick = () => { ans.trig = b.dataset.trig; draw(m); });
    const save = (kind) => {
      const e = day(todayStr()); e.cravings = e.cravings || [];
      e.cravings.push({ t: Date.now(), kind, trig: ans.trig || null, swap: ans.swap != null ? CRAVING_SWAPS[ans.swap][0] : null });
      saveData();
    };
    if ($('#hc-close', m)) $('#hc-close', m).onclick = () => { save('hambre'); closeModal(); renderFood(); };
    if ($('#hc-meal', m)) $('#hc-meal', m).onclick = () => { save('hambre'); openMealForm(todayStr()); };
    if ($('#hc-save', m)) $('#hc-save', m).onclick = () => {
      save('antojo'); closeModal(); renderFood();
      toast(ans.swap != null ? '💪 ¡Bien jugado! Antojo cambiado' : '✓ Anotado. Ver el patrón ya es avanzar');
    };
  };
  openModal('', draw);
}

function qualityCard(t) {
  const q = (DB.days[t] && DB.days[t].quality) || {}, n = QUALITY.filter(([id]) => q[id]).length;
  return `<div class="card">
    <div class="row spread"><h2 style="margin:0">Calidad de hoy</h2><span class="pill ${n >= 5 ? 'good' : ''}">${n}/${QUALITY.length}</span></div>
    <p class="small muted" style="margin:4px 0 10px">Las calorías mandan en el peso; esto cuida tu salud y tu digestión. Toca lo que ya comiste.</p>
    <div class="q-grid">${QUALITY.map(([id, ico, name, ex]) => `<button class="q-item ${q[id] ? 'on' : ''}" data-q="${id}"><span>${ico}</span><b>${name}</b><small>${ex}</small></button>`).join('')}</div>
    ${n === QUALITY.length ? '<p class="small" style="margin:10px 0 0;color:var(--good);font-weight:650">🌈 ¡Día completo! Tu cuerpo (y tu microbiota) lo agradecen.</p>' : ''}
  </div>`;
}

function gutCard() {
  const logs = [];
  daysBack(30).forEach(d => ((DB.days[d] && DB.days[d].gut) || []).forEach(g => logs.push(g)));
  let pattern = '';
  if (logs.length >= 3) {
    const cnt = {};
    logs.forEach(g => (g.sus || []).forEach(x => { cnt[x] = (cnt[x] || 0) + 1; }));
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (top && cnt[top] >= 2 && cnt[top] / logs.length >= 0.5) pattern = `<div class="status warn"><b>Posible patrón: ${GUT_SUSPECTS[top][0]}</b>Aparece en ${cnt[top]} de tus ${logs.length} molestias del último mes. ${esc(GUT_SUSPECTS[top][1])}</div>`;
    else pattern = `<p class="small muted" style="margin:10px 0 0">${logs.length} molestias en 30 días, sin un culpable claro todavía. Sigue anotando.</p>`;
  }
  return `<div class="card">
    <h2>Panza en paz <small>· molestias digestivas</small></h2>
    <p class="small muted" style="margin-top:0">Si algo te cae mal (de 30 min a 2 h después de comer), anótalo. Con 3 registros te muestro si se repite un alimento.</p>
    <button class="secondary block" id="fd-gut">+ Anotar molestia</button>
    ${pattern}
    <p class="small muted" style="margin:10px 0 0">⚠️ Si se te hinchan labios o lengua, te falta el aire, hay sangre, fiebre o bajas de peso sin querer: ve al médico. Esto no es un diagnóstico.</p>
  </div>`;
}
function openGutForm() {
  const g = { sym: [], sus: [], sev: 2 };
  const draw = m => {
    m.innerHTML = `<h3>¿Qué sentiste?</h3>
      <div class="chips">${Object.keys(GUT_SYMPTOMS).map(k => `<button class="chip-btn ${g.sym.includes(k) ? 'on' : ''}" data-gs="${k}">${GUT_SYMPTOMS[k]}</button>`).join('')}</div>
      <div class="small muted" style="font-weight:600;margin:14px 0 6px">¿Qué comiste antes? (lo que sospeches)</div>
      <div class="chips">${Object.keys(GUT_SUSPECTS).map(k => `<button class="chip-btn ${g.sus.includes(k) ? 'on' : ''}" data-gx="${k}">${GUT_SUSPECTS[k][0]}</button>`).join('')}</div>
      <div class="small muted" style="font-weight:600;margin:14px 0 6px">¿Qué tan fuerte?</div>
      <div class="seg">${[[1, 'Leve'], [2, 'Moderada'], [3, 'Fuerte']].map(([v, l]) => `<button data-gv="${v}" class="${g.sev === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row"><button class="secondary" id="gf-cancel" style="flex:1">Cancelar</button><button id="gf-save" style="flex:1">Guardar</button></div>`;
    const tog = (arr, k) => { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); };
    $$('[data-gs]', m).forEach(b => b.onclick = () => { tog(g.sym, b.dataset.gs); draw(m); });
    $$('[data-gx]', m).forEach(b => b.onclick = () => { tog(g.sus, b.dataset.gx); draw(m); });
    $$('[data-gv]', m).forEach(b => b.onclick = () => { g.sev = Number(b.dataset.gv); draw(m); });
    $('#gf-cancel', m).onclick = closeModal;
    $('#gf-save', m).onclick = () => {
      if (!g.sym.length) { toast('Elige al menos un síntoma'); return; }
      const e = day(todayStr()); e.gut = e.gut || [];
      e.gut.push(Object.assign({ t: Date.now() }, g)); saveData(); closeModal(); renderFood(); toast('✓ Anotado');
    };
  };
  openModal('', draw);
}

function microbiomeCard() {
  const male = DB.profile.sex !== 'f';
  return `<div class="card">
    <h2>Tu microbiota <small>· el "segundo genoma"</small></h2>
    <p class="small" style="margin-top:0">Las bacterias de tu intestino comen fibra y la convierten en compuestos que bajan la inflamación. Meta de fibra: <b>~${male ? 38 : 25} g al día</b> (unos 14 g por cada 1000 kcal).</p>
    <div class="small muted" style="font-weight:600;margin-bottom:6px">Probióticos (bacterias vivas)</div>
    <div class="chips">${PROBIOTICS.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    <div class="small muted" style="font-weight:600;margin:12px 0 6px">Prebióticos (su comida)</div>
    <div class="chips">${PREBIOTICS.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    <p class="small muted" style="margin:10px 0 0">Ojo: los encurtidos en vinagre o pasteurizados ya no traen bacterias vivas, y el miso pierde las suyas si lo hierves.</p>
  </div>`;
}

function seasonCard() {
  const north = DB.profile.hemi !== 'sur', m = new Date().getMonth(), key = north ? (m + 6) % 12 : m;
  const name = Object.keys(SEASONS_SOUTH).find(k => SEASONS_SOUTH[k].months.includes(key)), sz = SEASONS_SOUTH[name];
  const label = { verano: 'Verano', otono: 'Otoño', invierno: 'Invierno', primavera: 'Primavera' }[name];
  return `<div class="card">
    <div class="row spread"><h2 style="margin:0">De temporada · ${label}</h2><button class="ghost" id="fd-hemi">${north ? 'Hemisferio norte' : 'Hemisferio sur'} ⇄</button></div>
    <p class="small muted" style="margin:4px 0 10px">En su temporada están más frescos, más baratos y con más nutrientes.</p>
    <p class="small" style="margin:0 0 6px">🍓 <b>Frutas:</b> ${esc(sz.fruits)}</p>
    <p class="small" style="margin:0">🥕 <b>Verduras:</b> ${esc(sz.veg)}</p>
  </div>`;
}

function bindFoodExtras(t) {
  const v = $('#view-food');
  $('#fd-hunger', v).onclick = openHungerCheck;
  $('#fd-gut', v).onclick = openGutForm;
  $('#fd-hemi', v).onclick = () => { DB.profile.hemi = DB.profile.hemi === 'sur' ? 'norte' : 'sur'; saveData(); keepScroll(renderFood); };
  $$('[data-q]', v).forEach(b => b.onclick = () => {
    const e = day(t); e.quality = e.quality || {};
    e.quality[b.dataset.q] = !e.quality[b.dataset.q]; saveData(); vibrate(15); keepScroll(renderFood);
  });
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
let progMode = 'analysis';
function renderProgress() {
  if (progMode === 'logros' && !gamify()) progMode = 'weight';
  if (progMode === 'ciclo' && !cycleOn()) progMode = 'analysis';
  const seg = `<div class="seg wrap scroll">${[['analysis', '📊 Análisis'], ['historia', '📖 Historia']].concat(cycleOn() ? [['ciclo', '🌙 Ciclo']] : []).concat([['weight', 'Peso'], ['measures', 'Medidas'], ['strength', 'Fuerza'], ['photos', 'Fotos']]).concat(gamify() ? [['logros', 'Logros']] : []).map(([k, n]) => `<button data-mode="${k}" class="${progMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const v = $('#view-progress');
  v.innerHTML = seg + '<div id="prog-body"></div><button class="secondary block" id="prog-export" style="margin-top:4px">📄 Exportar PDF / Excel para analizar con IA</button>';
  $('#prog-export').onclick = openExport;
  $$('#view-progress .seg button').forEach(b => b.onclick = () => { progMode = b.dataset.mode; redrawChart = () => {}; renderProgress(); });
  ({ analysis: renderAnalysis, historia: renderHistory, ciclo: renderCycle, weight: renderWeight, measures: renderMeasures, strength: renderStrength, photos: renderPhotos, logros: renderAchievements })[progMode]($('#prog-body'));
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
      <h2>Exportar progreso</h2>
      <p class="small muted" style="margin-top:0">PDF o Excel para guardarlo o pedirle un análisis a una IA.</p>
      <button class="block" id="mo-export">📄 Exportar PDF / Excel</button>
    </div>

    <div class="card">
      <h2>Cómo quieres la app</h2>
      <div class="seg" style="margin:0 0 8px"><button data-mode="simple" class="${p.mode === 'simple' ? 'on' : ''}">📒 Libreta simple</button><button data-mode="completo" class="${p.mode !== 'simple' ? 'on' : ''}">🧩 Completa</button></div>
      <p class="small muted" style="margin:0">${p.mode === 'simple' ? 'Solo lo esencial: rutina, series, peso y progreso. Sin nutrición, logros ni paneles extra.' : 'Todo: nutrición, recuperación, mapa muscular, logros y mentalidad.'}</p>
    </div>

    <div class="card">
      <h2>Dónde entrenas y tu equipo</h2>
      <div class="chips" style="margin-bottom:10px">${Object.keys(GYM_PRESETS).map(k => `<button class="chip-btn ${p.gym === k ? 'on' : ''}" data-gym="${k}">${GYM_PRESETS[k].ico} ${GYM_PRESETS[k].name}</button>`).join('')}</div>
      ${Object.keys(EQUIP).map(e => `<label class="habit"><input type="checkbox" data-equip="${e}" ${p.equip.includes(e) ? 'checked' : ''}> ${EQUIP[e]}</label>`).join('')}
      <p class="small muted" style="margin:8px 0 0">La app solo te propone ejercicios con este equipo y adapta tus rutinas solas.</p>
    </div>

    <div class="card">
      <h2>Molestias o lesiones</h2>
      <div class="chips">${Object.keys(LIMITS).map(k => `<button class="chip-btn ${p.limits.includes(k) ? 'on' : ''}" data-limit="${k}">${LIMITS[k].ico} ${LIMITS[k].name}</button>`).join('')}</div>
      ${p.limits.length ? `<ul class="small" style="margin:10px 0 0;padding-left:18px">${p.limits.map(k => `<li><b>${LIMITS[k].name}:</b> ${esc(LIMITS[k].tip)}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:8px 0 0">Si marcas alguna, la app cambia los ejercicios que cargan esa zona por alternativas más seguras.</p>'}
      <p class="small muted" style="margin:8px 0 0">No sustituye la opinión de un médico o fisioterapeuta.</p>
    </div>

    <div class="card">
      <h2>Constancia sin culpa</h2>
      <div class="rir-label"><span>Meta de entrenos por semana</span></div>
      <div class="seg" style="margin:0 0 10px">${[2, 3, 4, 5, 6].map(n => `<button data-target="${n}" class="${(p.weeklyTarget || 3) === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="rir-label"><span>Mis días de entreno (para la agenda)</span></div>
      <div class="wo-days" style="margin-bottom:10px">${WEEKDAYS.map((n, k) => `<button class="${plannedDays().includes(k) ? 'on' : ''}" data-tday="${k}">${n.slice(0, 2)}</button>`).join('')}</div>
      <div class="rir-label"><span>Mi etapa</span></div>
      <div class="seg" style="margin:0 0 10px">${[1, 2, 3, 4].map(k => `<button data-stage="${k}" class="${stage() === k ? 'on' : ''}">${STAGES[k].ico} ${k}</button>`).join('')}</div>
      <p class="small muted" style="margin:-4px 0 10px">${STAGES[stage()].name}: ${esc(STAGES[stage()].goal)}</p>
      <label class="habit"><input type="checkbox" id="st-pause" ${DB.pauses.includes(weekKey(todayStr())) ? 'checked' : ''}> Pausar esta semana (vacaciones, lesión, descarga)</label>
      <label class="habit"><input type="checkbox" id="st-gamify" ${p.gamify !== false ? 'checked' : ''}> Mostrar logros y rachas</label>
      <label class="habit"><input type="checkbox" id="st-rest" ${p.restAlerts ? 'checked' : ''}> Avisar cuando termine el descanso (aunque la app esté minimizada)</label>
      <p class="small muted" style="margin:8px 0 0">La app no manda recordatorios ni avisos de racha. Las semanas en pausa no rompen tu racha.</p>
    </div>

    <div class="card">
      <h2>Ciclo menstrual <small>· opcional</small></h2>
      <p class="small muted" style="margin-top:0">Registra tu ciclo y cómo te sientes para descubrir tus propios patrones. Tus datos se quedan solo en este teléfono.</p>
      <label class="habit"><input type="checkbox" id="cy-on" ${p.cycleOn ? 'checked' : ''}> Activar el seguimiento del ciclo</label>
      ${p.cycleOn ? `<label class="habit"><input type="checkbox" id="cy-horm" ${p.cycleHormonal ? 'checked' : ''}> Uso anticoncepción hormonal (píldora, DIU hormonal, implante…)</label>
      <label>Duración habitual de tu ciclo (días, mientras aprendo el tuyo)<input id="cy-len" inputmode="numeric" value="${p.cycleLen || 28}"></label>` : ''}
    </div>

    ${gearCard()}

    <div class="card">
      <h2>Sin trucos</h2>
      <ul class="small" style="margin:0;padding-left:18px">
        <li><b>Gratis y completa:</b> sin suscripción, sin anuncios, sin funciones bloqueadas.</li>
        <li><b>Sin cuenta ni tarjeta:</b> no pedimos registro ni datos de pago.</li>
        <li><b>Funciona sin internet:</b> ideal para gimnasios en sótano.</li>
        <li><b>Tus datos son tuyos:</b> se quedan en tu teléfono y los exportas cuando quieras (PDF, Excel, CSV).</li>
        <li><b>Sin cálculos inventados:</b> no estimamos "calorías quemadas"; solo lo que registras.</li>
      </ul>
    </div>

    <div class="card">
      <h2>Apariencia</h2>
      <div class="seg" style="margin:0"><button data-theme="light" class="${p.theme !== 'dark' ? 'on' : ''}">☀️ Claro</button><button data-theme="dark" class="${p.theme === 'dark' ? 'on' : ''}">🌙 Oscuro</button></div>
    </div>

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

    ${isSimple() ? '' : `<div class="card">
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
    </div>`}

    <div class="card">
      <h2>Copia de seguridad</h2>
      <p class="small muted" style="margin-top:0">Los datos se guardan solo en este teléfono. Exporta una copia de vez en cuando.</p>
      <div class="grid2"><button class="secondary" id="bk-export">Exportar</button><button class="secondary" id="bk-import">Importar</button></div>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="bk-photos" checked> Incluir fotos en la copia</label>
      <input type="file" id="bk-file" accept=".json,application/json" style="display:none">
    </div>

    <div class="card"><h2>Zona peligrosa</h2><button class="danger block" id="reset">Borrar todos los datos</button></div>
    <p class="small muted" id="more-foot" style="text-align:center;margin-top:20px">Mi Progreso 10.0 · gratis, sin anuncios y sin cuenta<br>Fotos de ejercicios: Free Exercise DB (dominio público)</p>`;

  $('#mo-export').onclick = openExport;
  const saveRe = () => { saveData(); renderMore(); };
  $$('#view-more [data-mode]').forEach(b => b.onclick = () => { DB.profile.mode = b.dataset.mode; saveData(); showTab('more'); });
  $$('#view-more [data-gym]').forEach(b => b.onclick = () => { DB.profile.gym = b.dataset.gym; DB.profile.equip = GYM_PRESETS[b.dataset.gym].equip.slice(); saveRe(); toast('Equipo: ' + GYM_PRESETS[b.dataset.gym].name); });
  $$('#view-more [data-equip]').forEach(cb => cb.onchange = () => {
    const e = cb.dataset.equip, set = new Set(DB.profile.equip);
    if (cb.checked) set.add(e); else set.delete(e);
    if (!set.size) set.add('corporal');
    DB.profile.equip = Array.from(set); DB.profile.gym = 'custom'; saveRe();
  });
  $$('#view-more [data-limit]').forEach(b => b.onclick = () => {
    const k = b.dataset.limit, l = DB.profile.limits;
    DB.profile.limits = l.includes(k) ? l.filter(x => x !== k) : l.concat(k); saveRe();
  });
  $$('#view-more [data-target]').forEach(b => b.onclick = () => { DB.profile.weeklyTarget = Number(b.dataset.target); DB.profile.trainDays = DEFAULT_DAYS[DB.profile.weeklyTarget]; saveRe(); });
  $$('#view-more [data-tday]').forEach(b => b.onclick = () => {
    const k = Number(b.dataset.tday), cur = plannedDays().slice();
    const nx = cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k).sort();
    if (!nx.length) return;
    DB.profile.trainDays = nx; DB.profile.weeklyTarget = nx.length; saveRe();
  });
  const cyo = $('#cy-on'); if (cyo) cyo.onchange = () => { DB.profile.cycleOn = cyo.checked; saveRe(); };
  const cyh = $('#cy-horm'); if (cyh) cyh.onchange = () => { DB.profile.cycleHormonal = cyh.checked; saveRe(); };
  const cyl = $('#cy-len'); if (cyl) cyl.onchange = () => { const n = num(cyl.value); if (n >= 15 && n <= 60) { DB.profile.cycleLen = Math.round(n); saveRe(); } };
  $$('#view-more [data-stage]').forEach(b => b.onclick = () => { const n = Number(b.dataset.stage); if (n !== stage()) addEvent(todayStr(), 'stage', 'Cambiaste a la etapa ' + n + ': ' + STAGES[n].name, STAGES[n].ico); DB.profile.stage = n; saveRe(); });
  $('#st-pause').onchange = e => { const k = weekKey(todayStr()); DB.pauses = DB.pauses.filter(x => x !== k).concat(e.target.checked ? [k] : []); saveData(); toast(e.target.checked ? 'Semana en pausa. Descansa tranquilo.' : 'Pausa quitada'); };
  $('#st-gamify').onchange = e => { DB.profile.gamify = e.target.checked; saveData(); };
  $('#st-rest').onchange = e => { DB.profile.restAlerts = e.target.checked; saveData(); if (e.target.checked) requestNotifications(); };
  $$('#view-more [data-theme]').forEach(b => b.onclick = () => { DB.profile.theme = b.dataset.theme; saveData(); applyTheme(); renderMore(); });
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
  if (!isSimple()) $('#hb-reset').onclick = () => { DB.profile.habitsStart = todayStr(); saveData(); toast('Empiezas de nuevo con el hábito 1'); };
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
  const foot = $('#more-foot');
  foldify($('#view-more'), [['Tu perfil', ['Perfil', 'Cómo quieres', 'Dónde entrenas', 'Molestias', 'Constancia', 'Ciclo', 'Apariencia']], ['Conocimiento', ['Suplementos', 'bombeo', 'Mentalidad', '7 reglas', 'Equipo', 'moverte']], ['Tus datos', '*']]);
  if (foot) $('#view-more').appendChild(foot);
}

async function exportBackup() {
  const payload = { app: 'miprogreso', version: 4, exportedAt: new Date().toISOString(), data: DB };
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
      DB = loadData(); registerCustomExercises();
      if (obj.photos) { await photoStore.clear(); for (const p of obj.photos) await photoStore.put(p); }
      toast('Copia restaurada'); showTab('home');
    } catch (e) { toast('Error: ' + e.message); }
  };
  r.readAsText(f);
}

/* ------------------------------------------------------------------ *
 *  Tema y bienvenida
 * ------------------------------------------------------------------ */
/** Permiso de notificaciones (Android 13+) solo para el aviso de fin de descanso. */
function requestNotifications() { try { if (bridge && bridge.requestNotifications) bridge.requestNotifications(); } catch (e) {} }

function applyTheme() {
  const dark = DB.profile.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const bg = getVar('--bg');
  $('meta[name=theme-color]').setAttribute('content', bg);
  try { if (bridge && bridge.setBars) bridge.setBars(bg, !dark); } catch (e) {}
}

/** Bienvenida en 4 pasos: datos básicos, objetivo, somatotipo y gimnasio. */
function openOnboarding() {
  const p = DB.profile, total = 7;
  let step = 0;
  const draft = { name: p.name, startWeight: p.startWeight, height: p.height, age: p.age, goalWeight: p.goalWeight, phase: p.phase, somatotype: p.somatotype, routine: p.routine, gym: 'pf', limits: [], mode: 'completo',
    stage: '2', minutes: '45', days: '3', enjoy: ['fuerza'], barriers: [] };
  const multi = (key, map) => `<div class="chips">${Object.keys(map).map(k => `<button class="chip-btn ${draft[key].includes(k) ? 'on' : ''}" data-multi="${key}|${k}">${map[k][0]} ${map[k][1]}</button>`).join('')}</div>`;
  const progress = () => `<div class="ob-step">Paso ${step + 1} de ${total}</div><div class="ob-progress">${Array.from({ length: total }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const choice = (key, val, ico, title, sub) => `<button class="choice ${draft[key] === val ? 'on' : ''}" data-ch="${key}|${val}"><span class="c-ico">${ico}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
  const steps = [
    () => `<img class="ob-logo" src="img/logo.png" alt=""><h3>¡Hola! 👋 Configuremos tu app</h3><p class="small muted" style="margin-top:0">Gratis, sin anuncios, sin cuenta y sin internet. Con esto calculo tus metas; lo puedes cambiar luego en Más.</p>
      <label>¿Cómo te llamas?<input id="ob-name" value="${esc(draft.name)}" placeholder="Tu nombre"></label>
      <div class="grid2">
        <label>Peso actual (kg)<input id="ob-w" inputmode="decimal" value="${draft.startWeight}"></label>
        <label>Peso meta (kg)<input id="ob-g" inputmode="decimal" value="${draft.goalWeight}"></label>
        <label>Altura (cm)<input id="ob-h" inputmode="numeric" value="${draft.height}"></label>
        <label>Edad<input id="ob-a" inputmode="numeric" value="${draft.age}"></label>
      </div>
      <label class="check"><input type="checkbox" id="ob-cyc" ${draft.cycleOn ? 'checked' : ''}> <span>Quiero registrar mi ciclo menstrual (opcional)</span></label>`,
    () => `<h3>Tu punto de partida</h3>
      <p class="small muted" style="margin-top:0">Sin juicios: así sé por dónde empezar contigo.</p>
      ${[1, 2, 3, 4].map(k => choice('stage', String(k), STAGES[k].ico, STAGES[k].who, 'Etapa ' + k + ': ' + STAGES[k].name)).join('')}
      <div class="rir-label" style="margin-top:6px"><span>¿Cuánto tiempo tienes por sesión?</span></div>
      <div class="seg">${['15', '30', '45', '60'].map(v => `<button data-ch="minutes|${v}" class="${draft.minutes === v ? 'on' : ''}">${v === '60' ? '60+' : v} min</button>`).join('')}</div>
      <div class="rir-label"><span>¿Cuántos días a la semana puedes?</span></div>
      <div class="seg">${['2', '3', '4', '5'].map(v => `<button data-ch="days|${v}" class="${draft.days === v ? 'on' : ''}">${v}</button>`).join('')}</div>`,
    () => `<h3>¿Qué disfrutas?</h3>
      <p class="small muted" style="margin-top:0">No todos quieren músculos grandes o un maratón. Elige lo que te gusta (varias).</p>
      ${multi('enjoy', ACTIVITY_TYPES)}
      <div class="rir-label" style="margin-top:14px"><span>¿Qué te ha impedido ser constante?</span></div>
      ${multi('barriers', BARRIERS)}`,
    () => `<h3>¿Cuál es tu objetivo?</h3>
      ${choice('phase', 'definicion', '🔥', 'Perder grasa (definición)', 'Déficit: peso en lb × 12 kcal')}
      ${choice('phase', 'volumen', '💪', 'Ganar músculo (volumen)', 'Superávit: peso en lb × 17 kcal')}
      ${choice('phase', 'mantener', '⚖️', 'Mantenerme', 'Mantenimiento: peso en lb × 15 kcal')}`,
    () => `<h3>¿Cómo es tu cuerpo?</h3><p class="small muted" style="margin-top:0">Define el reparto de carbohidratos, proteína y grasa.</p>
      ${Object.keys(SOMATOTYPES).map(k => choice('somatotype', k, k === 'ecto' ? '🦒' : k === 'meso' ? '🐆' : '🐻', SOMATOTYPES[k].name, SOMATOTYPES[k].desc + ` (C ${SOMATOTYPES[k].c} % · P ${SOMATOTYPES[k].p} % · G ${SOMATOTYPES[k].f} %)`)).join('')}`,
    () => `<h3>¿Dónde entrenas?</h3>
      ${Object.keys(GYM_PRESETS).map(k => choice('gym', k, GYM_PRESETS[k].ico, GYM_PRESETS[k].name, GYM_PRESETS[k].equip.map(e => EQUIP[e]).join(', '))).join('')}
      <div class="rir-label" style="margin-top:10px"><span>¿Alguna molestia o lesión? (opcional)</span></div>
      <div class="chips">${Object.keys(LIMITS).map(k => `<button class="chip-btn ${draft.limits.includes(k) ? 'on' : ''}" data-lim="${k}">${LIMITS[k].ico} ${LIMITS[k].name}</button>`).join('')}</div>`,
    () => `<h3>¿Cómo quieres entrenar?</h3>
      ${choice('routine', 'inicio', '🌱', ROUTINES.inicio.name, '3 días de 20 min con tu peso: ideal para empezar')}
      ${choice('routine', 'pro', '🏆', ROUTINES.pro.name, '1 grupo muscular por día, 5 días + 2 de descanso')}
      ${choice('routine', 'tp4', '🔁', ROUTINES.tp4.name, 'Básicos pesados, ideal para definir')}
      <div class="rir-label" style="margin-top:10px"><span>¿Qué tanto quieres ver?</span></div>
      ${choice('mode', 'simple', '📒', 'Libreta simple', 'Solo rutina, series, peso y progreso')}
      ${choice('mode', 'completo', '🧩', 'App completa', 'Además nutrición, recuperación, mapa muscular y logros')}`
  ];
  const draw = m => {
    m.innerHTML = progress() + steps[step]() + `<div class="row" style="margin-top:14px">${step ? '<button class="secondary" id="ob-back" style="flex:1">Atrás</button>' : ''}<button id="ob-next" style="flex:2">${step === total - 1 ? 'Empezar 🚀' : 'Siguiente'}</button></div>`;
    $$('[data-ch]', m).forEach(b => b.onclick = () => { const [k, v] = b.dataset.ch.split('|'); draft[k] = v; if (k === 'stage') draft.routine = v === '1' ? 'inicio' : draft.routine === 'inicio' ? 'pro' : draft.routine; draw(m); });
    $$('[data-multi]', m).forEach(b => b.onclick = () => { const [k, v] = b.dataset.multi.split('|'); draft[k] = draft[k].includes(v) ? draft[k].filter(x => x !== v) : draft[k].concat(v); draw(m); });
    $$('[data-lim]', m).forEach(b => b.onclick = () => { const k = b.dataset.lim; draft.limits = draft.limits.includes(k) ? draft.limits.filter(x => x !== k) : draft.limits.concat(k); draw(m); });
    const back = $('#ob-back', m); if (back) back.onclick = () => { step--; draw(m); };
    $('#ob-next', m).onclick = () => {
      if (step === 0) {
        draft.name = $('#ob-name', m).value.trim();
        draft.startWeight = num($('#ob-w', m).value); draft.goalWeight = num($('#ob-g', m).value);
        draft.height = num($('#ob-h', m).value); draft.age = num($('#ob-a', m).value); draft.cycleOn = $('#ob-cyc', m).checked;
        if (!(draft.startWeight > 30 && draft.goalWeight > 30 && draft.height > 100 && draft.age > 10)) { toast('Revisa tus datos'); return; }
      }
      if (step === total - 1) {
        Object.assign(DB.profile, { name: draft.name, startWeight: draft.startWeight, goalWeight: draft.goalWeight, height: draft.height, age: draft.age,
          phase: draft.phase, somatotype: draft.somatotype, routine: draft.routine, startDate: todayStr(), habitsStart: todayStr(), autoMacros: true, onboarded: true,
          gym: draft.gym, equip: GYM_PRESETS[draft.gym].equip.slice(), limits: draft.limits, mode: draft.mode,
          stage: Number(draft.stage), minutes: Number(draft.minutes), weeklyTarget: Number(draft.days), trainDays: DEFAULT_DAYS[Number(draft.days)], enjoy: draft.enjoy, barriers: draft.barriers, cycleOn: !!draft.cycleOn });
        addEvent(todayStr(), 'stage', 'Empezaste en la etapa ' + draft.stage + ': ' + STAGES[draft.stage].name, STAGES[draft.stage].ico);
        pickerMine = true;
        if (!Object.values(DB.days).some(d => d.weight != null)) day(todayStr()).weight = draft.startWeight;
        saveData(); closeModal(true); showTab('home');
        toast(`¡Listo${draft.name ? ', ' + draft.name : ''}! Tu objetivo: ${targets().kcal.toLocaleString('es-MX')} kcal al día`);
        return;
      }
      step++; draw(m);
    };
  };
  openModal('', draw);
  MODAL_LOCK = true;
}

/* ------------------------------------------------------------------ *
 *  Arranque
 * ------------------------------------------------------------------ */
$('#modal-bg').addEventListener('click', e => { if (e.target.id === 'modal-bg') closeModal(); });
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
$('#tb-minus').onclick = () => { REST.end -= 15000; tickRest(); };
$('#tb-plus').onclick = () => { REST.end += 15000; REST.fired = false; $('#timer-bar').classList.remove('done'); tickRest(); };
$('#tb-stop').onclick = stopRest;
$('#tb-repeat').onclick = repeatFromTimer;
// Al volver a la app (minimizada o con la pantalla apagada) el descanso se recalcula con su hora de fin.
document.addEventListener('visibilitychange', () => { if (!document.hidden && REST.end) tickRest(); });

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
  const els = $$('[id="pwo-left"]');
  if (!els.length) return;
  const left = pwoLeft();
  els.forEach(el => { el.textContent = left == null ? 'Cerrada' : mmss(left / 1000); });
}, 1000);

DB = loadData();
registerCustomExercises();
// 6.0: los colores del logo son oscuros; se aplica una sola vez el tema oscuro (luego se puede volver a Claro).
if (!DB.profile.logoTheme) { DB.profile.theme = 'dark'; DB.profile.logoTheme = true; }
// Quien ya usaba la app (tiene registros) no ve la bienvenida.
if (DB.profile.onboarded == null) DB.profile.onboarded = DB.lifts.length > 0 || Object.keys(DB.days).length > 1;
saveData();
applyTheme();
if (DB.active) keepScreenOn(true);
$('#fab').onclick = openQuickSheet;
// Si la app se cerró a mitad de un entreno, vuelve directo a la sesión con su descanso.
showTab(DB.active && activeSession() ? 'train' : 'home');
restoreRest();
if (!DB.profile.onboarded) openOnboarding();
