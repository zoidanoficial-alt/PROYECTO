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
const KEY = 'miprogreso.v1';   // misma clave que la 1.x: los datos se conservan al actualizar

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
    custom: { name: 'Mi rutina', desc: 'Rutina creada por ti.', days: [] }
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
        custom: d.custom || def.custom
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
  meals.forEach(m => { t.p += m.p || 0; t.c += m.c || 0; t.f += m.f || 0; t.s += m.s || 0; });
  t.kcal = Math.round(t.p * 4 + t.c * 4 + t.f * 9);
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
function exInfo(name) { return EX[name] || ['otro', 'c']; }
function activeSession() { return DB.active ? DB.sessions.find(s => s.id === DB.active) || null : null; }

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
  return { date, sets, best: Math.max(...sets.map(s => e1rm(s.w, s.r))) };
}
function bestBefore(ex, t) {
  const prev = DB.lifts.filter(l => l.ex === ex && (l.t || 0) < t);
  return prev.length ? Math.max(...prev.map(s => e1rm(s.w, s.r))) : null;
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

/** Series por grupo muscular y reparto compuesto/aislamiento de los últimos 7 días. */
function weekVolume() {
  const start = addDays(todayStr(), -6);
  const sets = DB.lifts.filter(l => l.date >= start);
  const groups = {};
  let comp = 0, iso = 0;
  sets.forEach(l => {
    const [g, type] = exInfo(l.ex);
    groups[g] = (groups[g] || 0) + 1;
    if (type === 'c') comp++; else iso++;
  });
  const sessions = DB.sessions.filter(s => s.date >= start && s.end).length;
  return { groups, comp, iso, total: sets.length, sessions };
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
function closeModal() { $('#modal-bg').classList.remove('open'); $('#modal').innerHTML = ''; }

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

    <div class="card">
      <h2>Entreno</h2>
      ${act ? `<p style="margin:0 0 10px">Sesión en curso: <b>${esc(act.dayName)}</b></p><button class="block" id="home-train">Continuar entreno</button>`
        : nd ? `<p style="margin:0 0 4px">Hoy toca: <b>${esc(nd.name)}</b></p><p class="small muted" style="margin:0 0 10px">${esc(r.name)}</p>
          ${nd.rest ? '<p class="small muted" style="margin:0">Día de descanso: recupera, camina y come bien.</p>' : '<button class="block" id="home-train">Empezar entreno</button>'}`
        : '<p class="small muted">Elige o crea una rutina en la pestaña Entreno.</p>'}
      ${alerts.length ? `<div class="status warn"><b>Fuerza a la baja</b>${esc(alerts.join(', '))}: 2 semanas bajando.</div>` : ''}
    </div>

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
}

/* ------------------------------------------------------------------ *
 *  ENTRENO (Gym Bible)
 * ------------------------------------------------------------------ */
function startSession(routineKey, dayId) {
  const r = getRoutine(routineKey), d = r.days.find(x => x.id === dayId);
  if (!d) return;
  const s = { id: uid(), routine: routineKey, dayId: d.id, dayName: d.name, date: todayStr(), start: Date.now(), end: null, extra: [] };
  DB.sessions.push(s);
  DB.active = s.id;
  saveData();
  keepScreenOn(true);
}
function finishSession() {
  const s = activeSession();
  if (!s) return;
  const n = DB.lifts.filter(l => l.sid === s.id).length;
  if (!n) {
    if (!confirm('No registraste ninguna serie. ¿Descartar la sesión?')) return;
    DB.sessions = DB.sessions.filter(x => x.id !== s.id);
    DB.active = null; saveData(); keepScreenOn(false); stopRest(); renderTrain();
    return;
  }
  s.end = Date.now();
  DB.active = null;
  day(s.date).trained = true;
  startPwo();
  saveData(); keepScreenOn(false); stopRest();
  toast(`Sesión guardada: ${n} series. ¡Arrancó tu ventana post-entreno!`);
  showTab('home');
}

function renderTrain() {
  const s = activeSession();
  if (s) return renderSession(s);
  const p = DB.profile, r = getRoutine(p.routine), nd = nextDay(p.routine);
  const vol = weekVolume(), alerts = strengthAlerts();
  const compPct = vol.total ? Math.round(vol.comp / vol.total * 100) : null;
  const over = Object.keys(vol.groups).filter(g => vol.groups[g] > VOLUME_BANDS.high);
  const recent = DB.sessions.filter(x => x.end).sort((a, b) => b.start - a.start).slice(0, 8);

  $('#view-train').innerHTML = `
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
          <ul>${d.ex.map(e => `<li>${esc(e[0])} <em>· ${e[1]} × ${esc(e[2])}</em> ${exInfo(e[0])[1] === 'c' ? '<span class="pill blue">C</span>' : ''}</li>`).join('')}</ul>
          <button class="block" data-start="${d.id}" style="margin-bottom:12px">Empezar ${esc(d.name.split('·').pop().trim())}</button>`}
        </details>`).join('') : '<div class="empty">Esta rutina no tiene días. Pulsa “Editar mi rutina”.</div>'}
    </div>

    <div class="card">
      <h2>Análisis de la semana <small>· últimos 7 días</small></h2>
      ${vol.total ? `
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat"><div class="label">Sesiones</div><div class="value">${vol.sessions}</div></div>
        <div class="stat"><div class="label">Series</div><div class="value">${vol.total}</div></div>
        <div class="stat"><div class="label">Compuestos</div><div class="value" style="color:${compPct >= 65 ? 'var(--good)' : 'var(--warn)'}">${compPct}%</div></div>
      </div>
      <p class="small muted" style="margin:0 0 8px">Regla 75/25: ~75 % compuestos, ~25 % aislamiento.${compPct < 65 ? ' <b style="color:var(--warn)">Te faltan básicos.</b>' : ''}</p>
      ${Object.keys(vol.groups).sort((a, b) => vol.groups[b] - vol.groups[a]).map(g => {
        const n = vol.groups[g], col = n > VOLUME_BANDS.high ? 'var(--bad)' : n < VOLUME_BANDS.low ? 'var(--muted)' : 'var(--good)';
        return `<div class="vol-row"><span>${esc(GROUPS[g] || g)}</span><div class="bar"><div style="width:${Math.min(100, n / 30 * 100)}%;background:${col}"></div></div><span style="text-align:right">${n}</span></div>`;
      }).join('')}
      <p class="small muted" style="margin:8px 0 0">Verde: ${VOLUME_BANDS.low}–${VOLUME_BANDS.high} series por grupo a la semana.</p>`
        : '<div class="empty">Cuando registres sesiones verás tu volumen por grupo y la regla 75/25.</div>'}
      ${over.length ? `<div class="status bad"><b>Riesgo de sobreentrenamiento</b>${esc(over.map(g => GROUPS[g] || g).join(', '))} pasa de ${VOLUME_BANDS.high} series esta semana. Considera una semana de descarga.</div>` : ''}
      ${alerts.length ? `<div class="status warn"><b>Fuerza a la baja</b>${esc(alerts.join(', '))}: 2 semanas bajando. Revisa sueño, proteína y calorías.</div>` : ''}
      ${vol.sessions >= 7 ? '<div class="status warn"><b>Sin días de descanso</b>7 sesiones en 7 días: tu cuerpo necesita recuperar.</div>' : ''}
    </div>

    <div class="card">
      <h2>Técnicas de intensidad</h2>
      ${Object.keys(TECHNIQUES).filter(k => k !== 'normal').map(k => `<details><summary>${esc(TECHNIQUES[k].name)}</summary><p class="small" style="margin:0 0 12px">${esc(TECHNIQUES[k].text)}</p></details>`).join('')}
      <p class="small muted" style="margin:8px 0 0">Márcalas al registrar una serie para tenerlas en tu diario.</p>
    </div>

    <div class="card">
      <h2>Últimas sesiones</h2>
      ${recent.length ? `<table><tbody>${recent.map(x => {
        const sets = DB.lifts.filter(l => l.sid === x.id);
        return `<tr class="tap" data-sess="${x.id}"><td>${shortDate(x.date)}</td><td>${esc(x.dayName)}</td><td class="num">${sets.length} series</td><td class="num">${Math.round((x.end - x.start) / 60000)} min</td></tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">Aún no hay sesiones.</div>'}
    </div>`;

  $('#rt-sel').onchange = e => { DB.profile.routine = e.target.value; saveData(); renderTrain(); };
  const ed = $('#rt-edit'); if (ed) ed.onclick = openRoutineEditor;
  $$('#view-train [data-start]').forEach(b => b.onclick = () => { startSession(p.routine, b.dataset.start); renderTrain(); window.scrollTo(0, 0); });
  $$('#view-train [data-sess]').forEach(tr => tr.onclick = () => openSessionDetail(tr.dataset.sess));
}

function sessionExercises(s) {
  const r = getRoutine(s.routine), d = r.days.find(x => x.id === s.dayId);
  const base = d ? d.ex : [];
  return base.concat(s.extra || []);
}

function renderSession(s) {
  const exs = sessionExercises(s);
  const mins = Math.round((Date.now() - s.start) / 60000);
  const done = DB.lifts.filter(l => l.sid === s.id);
  $('#view-train').innerHTML = `
    <div class="card">
      <div class="row spread"><div><div class="small muted">Sesión en curso · ${mins} min</div><div style="font-size:18px;font-weight:700">${esc(s.dayName)}</div></div>
      <span class="pill">${done.length} series</span></div>
      <p class="small muted" style="margin:8px 0 0">Visualiza la serie antes de empezar y pon la mente en el músculo. Supera lo que hiciste la última vez.</p>
    </div>
    ${exs.map((e, i) => exerciseCard(s, e, i)).join('')}
    <button class="secondary block" id="ss-add" style="margin-bottom:10px">+ Añadir ejercicio</button>
    <button class="block" id="ss-finish">Terminar entreno</button>
    <button class="ghost block" id="ss-cancel" style="margin-top:6px">Descartar sesión</button>`;

  $$('#view-train [data-log]').forEach(b => b.onclick = () => logSet(s, Number(b.dataset.log)));
  $$('#view-train [data-undo]').forEach(b => b.onclick = () => {
    DB.lifts = DB.lifts.filter(l => l.id !== b.dataset.undo); saveData(); renderSession(s);
  });
  $('#ss-add').onclick = () => openAddExercise(s);
  $('#ss-finish').onclick = finishSession;
  $('#ss-cancel').onclick = () => {
    if (!confirm('¿Descartar esta sesión y sus series?')) return;
    DB.lifts = DB.lifts.filter(l => l.sid !== s.id);
    DB.sessions = DB.sessions.filter(x => x.id !== s.id);
    DB.active = null; saveData(); keepScreenOn(false); stopRest(); renderTrain();
  };
}

function exerciseCard(s, e, i) {
  const [name, sets, reps, rest] = e;
  const done = DB.lifts.filter(l => l.sid === s.id && l.ex === name).sort((a, b) => a.t - b.t);
  const last = lastTime(name, s.id);
  const prevW = done.length ? done[done.length - 1].w : last ? last.sets[0].w : '';
  const prevR = done.length ? done[done.length - 1].r : last ? last.sets[0].r : '';
  const type = exInfo(name)[1];
  return `<div class="ex-card">
    <div class="row spread"><h4>${esc(name)}</h4>${type === 'c' ? '<span class="pill blue">COMPUESTO</span>' : '<span class="pill" style="background:var(--surface-2);color:var(--muted)">AISLAMIENTO</span>'}</div>
    <div class="target">${sets} series × ${esc(reps)} · descanso ${mmss(rest || 90)}</div>
    ${last ? `<div class="last">Última vez (${shortDate(last.date)}): ${last.sets.map(x => kgFmt(x.w) + '×' + x.r).join(', ')}</div>` : '<div class="last">Primera vez: anota tu punto de partida.</div>'}
    ${done.map((d, k) => {
      const prevBest = bestBefore(name, d.t);
      const pr = prevBest != null && e1rm(d.w, d.r) > prevBest + 0.01;
      const tech = TECHNIQUES[d.tech] && d.tech !== 'normal' ? ` <span class="pill warn">${TECHNIQUES[d.tech].short}</span>` : '';
      return `<div class="set-done"><span>Serie ${k + 1}: <b>${kgFmt(d.w)} kg × ${d.r}</b>${tech} ${pr ? '<span class="pill good">↑ RÉCORD</span>' : ''}</span><button class="ghost" data-undo="${d.id}">✕</button></div>`;
    }).join('')}
    <div class="set-row" style="margin-top:8px">
      <span class="n">${done.length + 1}</span>
      <input id="w-${i}" inputmode="decimal" placeholder="kg" value="${prevW}">
      <input id="r-${i}" inputmode="numeric" placeholder="reps" value="${prevR}">
      <button data-log="${i}">✓</button>
    </div>
    <select id="t-${i}" style="padding:8px 10px;font-size:13px">${Object.keys(TECHNIQUES).map(k => `<option value="${k}">${esc(TECHNIQUES[k].name)}</option>`).join('')}</select>
  </div>`;
}

function logSet(s, i) {
  const e = sessionExercises(s)[i];
  const w = num($('#w-' + i).value), r = num($('#r-' + i).value), tech = $('#t-' + i).value;
  if (w == null || w < 0 || r == null || r < 1 || r > 100) { toast('Revisa peso y repeticiones'); return; }
  const t = Date.now();
  const prevBest = bestBefore(e[0], t);
  DB.lifts.push({ id: uid(), ex: e[0], w, r: Math.round(r), date: s.date, t, sid: s.id, tech });
  saveData();
  if (prevBest != null && e1rm(w, r) > prevBest + 0.01) { toast('¡Nuevo récord en ' + e[0] + '!'); vibrate(120); }
  startRest(e[3] || 90, 'Descanso · ' + e[0]);
  const y = window.scrollY;
  renderSession(s);
  window.scrollTo(0, y);
}

function openAddExercise(s) {
  openModal(`
    <h3>Añadir ejercicio</h3>
    <label>Ejercicio<select id="ax-name">${Object.keys(EX).map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
    <div class="grid3">
      <label>Series<input id="ax-sets" inputmode="numeric" value="3"></label>
      <label>Reps<input id="ax-reps" value="10–12"></label>
      <label>Descanso (s)<input id="ax-rest" inputmode="numeric" value="90"></label>
    </div>
    <div class="row"><button class="secondary" id="ax-cancel" style="flex:1">Cancelar</button><button id="ax-ok" style="flex:1">Añadir</button></div>`, m => {
    $('#ax-cancel', m).onclick = closeModal;
    $('#ax-ok', m).onclick = () => {
      s.extra = s.extra || [];
      s.extra.push([$('#ax-name', m).value, num($('#ax-sets', m).value) || 3, $('#ax-reps', m).value || '10', num($('#ax-rest', m).value) || 90]);
      saveData(); closeModal(); renderSession(s);
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
    <p class="small muted">${longDate(s.date)} · ${Math.round((s.end - s.start) / 60000)} min · ${sets.length} series</p>
    ${Object.keys(byEx).map(ex => `<p style="margin:10px 0 2px"><b>${esc(ex)}</b></p><p class="small muted" style="margin:0">${byEx[ex].map(l => kgFmt(l.w) + '×' + l.r + (l.tech && l.tech !== 'normal' ? ' ' + TECHNIQUES[l.tech].short : '')).join(' · ')}</p>`).join('')}
    <button class="danger block" id="sd-del" style="margin-top:16px">Borrar sesión</button>`, m => {
    $('#sd-close', m).onclick = closeModal;
    $('#sd-del', m).onclick = () => {
      if (!confirm('¿Borrar la sesión y sus series?')) return;
      DB.lifts = DB.lifts.filter(l => l.sid !== id);
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
        ${meals.map((m, i) => `<tr><td>${esc(m.name)}</td><td class="num">${Math.round(m.p)}</td><td class="num">${Math.round(m.c)}</td><td class="num">${Math.round(m.f)}</td><td class="num"><button class="ghost" data-delmeal="${i}">✕</button></td></tr>`).join('')}
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

function openMealForm(date) {
  openModal(`
    <h3>Añadir comida</h3>
    <p class="small muted" style="margin-top:0">Toca un alimento para sumarlo (valores aproximados) o escribe los tuyos.</p>
    <div class="grid2" style="margin-bottom:12px">
      ${FOODS.map((f, i) => `<button class="secondary food-btn" data-food="${i}">${esc(f[0])}<small>P ${f[1]} · C ${f[2]} · G ${f[3]}</small></button>`).join('')}
    </div>
    <label>Nombre<input id="ml-name" placeholder="Ej. Comida 2: pollo con arroz"></label>
    <div class="grid2">
      <label>Proteína (g)<input id="ml-p" inputmode="decimal"></label>
      <label>Carbohidratos (g)<input id="ml-c" inputmode="decimal"></label>
      <label>Grasa (g)<input id="ml-f" inputmode="decimal"></label>
      <label>Azúcar refinada (g)<input id="ml-s" inputmode="decimal"></label>
    </div>
    <div class="row"><button class="secondary" id="ml-close" style="flex:1">Cerrar</button><button id="ml-save" style="flex:1">Guardar</button></div>`, m => {
    const add = meal => {
      const e = day(date); e.meals = e.meals || []; e.meals.push(meal); saveData();
      toast('Sumado: ' + meal.name);
    };
    $$('[data-food]', m).forEach(b => b.onclick = () => {
      const f = FOODS[Number(b.dataset.food)];
      add({ name: f[0], p: f[1], c: f[2], f: f[3], s: f[4], t: Date.now() });
    });
    $('#ml-close', m).onclick = () => { closeModal(); render(currentTab); };
    $('#ml-save', m).onclick = () => {
      const meal = { name: $('#ml-name', m).value.trim() || 'Comida', p: num($('#ml-p', m).value) || 0, c: num($('#ml-c', m).value) || 0, f: num($('#ml-f', m).value) || 0, s: num($('#ml-s', m).value) || 0, t: Date.now() };
      if (!meal.p && !meal.c && !meal.f) { toast('Escribe al menos un macro'); return; }
      add(meal); closeModal(); render(currentTab);
    };
  });
}

/* ------------------------------------------------------------------ *
 *  PROGRESO: peso, medidas, fuerza y fotos
 * ------------------------------------------------------------------ */
let progMode = 'weight';
function renderProgress() {
  const seg = `<div class="seg">${[['weight', 'Peso'], ['measures', 'Medidas'], ['strength', 'Fuerza'], ['photos', 'Fotos']].map(([k, n]) => `<button data-mode="${k}" class="${progMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const v = $('#view-progress');
  v.innerHTML = seg + '<div id="prog-body"></div>';
  $$('#view-progress .seg button').forEach(b => b.onclick = () => { progMode = b.dataset.mode; redrawChart = () => {}; renderProgress(); });
  ({ weight: renderWeight, measures: renderMeasures, strength: renderStrength, photos: renderPhotos })[progMode]($('#prog-body'));
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
function renderStrength(el) {
  const used = Array.from(new Set(DB.lifts.map(l => l.ex)));
  if (!liftSel || !used.includes(liftSel)) liftSel = used[0] || null;
  if (!liftSel) { el.innerHTML = '<div class="card"><div class="empty">Registra tus entrenos en la pestaña Entreno y aquí verás la evolución de cada ejercicio.</div></div>'; return; }
  const sets = DB.lifts.filter(l => l.ex === liftSel);
  const byDay = {};
  sets.forEach(s => { const v = e1rm(s.w, s.r); if (!byDay[s.date] || v > byDay[s.date]) byDay[s.date] = v; });
  const pts = Object.keys(byDay).sort().map(d => ({ date: d, y: byDay[d] }));
  const best = sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a);
  const [w0, w1] = weeklyBest(liftSel, 2);
  const vol = {}; sets.forEach(s => { vol[s.date] = (vol[s.date] || 0) + s.w * s.r; });
  el.innerHTML = `
    <div class="card">
      <label style="margin-bottom:12px">Ejercicio<select id="lift-sel">${used.map(n => `<option ${n === liftSel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat"><div class="label">Mejor serie</div><div class="value" style="font-size:16px">${kgFmt(best.w)}×${best.r}</div></div>
        <div class="stat"><div class="label">1RM estimado</div><div class="value" style="font-size:16px">${fmt(e1rm(best.w, best.r), 0)} kg</div></div>
        <div class="stat"><div class="label">vs. sem. pasada</div><div class="value" style="font-size:16px;color:${w0 != null && w1 != null ? (w0 >= w1 ? 'var(--good)' : 'var(--warn)') : 'var(--muted)'}">${w0 != null && w1 != null ? signed(w0 - w1, 1) : '—'}</div></div>
      </div>
      <canvas class="chart" id="lift-chart"></canvas>
      <div class="legend"><span><i style="background:var(--accent)"></i>1RM estimado (mejor serie del día)</span></div>
    </div>
    <div class="card"><h2>Volumen por sesión <small>· kg × reps</small></h2>
      <table><tbody>${Object.keys(vol).sort().reverse().slice(0, 12).map(d => `<tr><td>${shortDate(d)}</td><td class="num">${Math.round(vol[d]).toLocaleString('es-MX')} kg</td></tr>`).join('')}</tbody></table>
    </div>`;
  $('#lift-sel').onchange = e => { liftSel = e.target.value; renderProgress(); };
  showChart(() => drawChart($('#lift-chart'), { series: [{ points: pts, color: getVar('--accent'), dots: true, r: 3.5 }], yDec: 0, minPad: 2 }));
}

/* Fotos */
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
    <button class="block" id="ph-add">+ Añadir foto</button>
    <p class="small muted">Misma luz, mismo sitio, misma hora y misma postura cada 4 semanas. La superposición sirve para evaluar simetría, vascularidad y cortes.</p>
    ${list.length >= 2 ? `
    <div class="card">
      <h2>Comparar ${gap ? `<small>· ${gap} días</small>` : ''}</h2>
      <div class="seg" style="margin-bottom:8px"><button data-cm="side" class="${cmpMode === 'side' ? 'on' : ''}">Lado a lado</button><button data-cm="overlay" class="${cmpMode === 'overlay' ? 'on' : ''}">Superposición</button></div>
      <div class="grid2" style="margin-bottom:8px"><select id="cmp-a">${opt(cmpA)}</select><select id="cmp-b">${opt(cmpB)}</select></div>
      ${cmpMode === 'side' ? `
      <div class="compare">
        <figure><img src="${A ? A.data : ''}" alt=""><figcaption>${A ? longDate(A.date) : ''}</figcaption></figure>
        <figure><img src="${B ? B.data : ''}" alt=""><figcaption>${B ? longDate(B.date) : ''}</figcaption></figure>
      </div>` : `
      <div class="overlay-box">
        <img src="${A ? A.data : ''}" alt="">
        <img id="ov-top" src="${B ? B.data : ''}" alt="" style="opacity:${cmpOpacity / 100}">
        ${cmpGrid ? '<div class="grid-lines"></div>' : ''}
      </div>
      <div class="row small muted" style="margin-top:8px"><span>${A ? shortDate(A.date) : ''}</span><input type="range" id="ov-op" min="0" max="100" value="${cmpOpacity}" style="flex:1"><span>${B ? shortDate(B.date) : ''}</span></div>
      <label class="check"><input type="checkbox" id="ov-grid" ${cmpGrid ? 'checked' : ''}> Línea central y guías de simetría</label>`}
    </div>` : ''}
    <div class="card">
      <h2>Galería <small>· ${list.length} foto${list.length === 1 ? '' : 's'}</small></h2>
      ${list.length ? `<div class="photos">${list.map(p => `<div class="photo" data-id="${p.id}"><img src="${p.data}" alt="" loading="lazy"><span>${shortDate(p.date)} · ${POSES[p.pose] || esc(p.pose)}</span></div>`).join('')}</div>`
        : '<div class="empty">Sube tus fotos de hoy (frente, lado y espalda) y tu foto objetivo.</div>'}
    </div>`;
  $('#ph-add').onclick = openPhotoForm;
  const a = $('#cmp-a'), b = $('#cmp-b');
  if (a) { a.onchange = () => { cmpA = a.value; renderProgress(); }; b.onchange = () => { cmpB = b.value; renderProgress(); }; }
  $$('[data-cm]', el).forEach(x => x.onclick = () => { cmpMode = x.dataset.cm; renderProgress(); });
  const op = $('#ov-op'); if (op) op.oninput = () => { cmpOpacity = Number(op.value); $('#ov-top').style.opacity = cmpOpacity / 100; };
  const gr = $('#ov-grid'); if (gr) gr.onchange = () => { cmpGrid = gr.checked; renderProgress(); };
  $$('.photo', el).forEach(x => x.onclick = () => openPhotoViewer(x.dataset.id));
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
        await photoStore.put({ id: uid(), date: $('#p-date', m).value || todayStr(), pose: $('#p-pose', m).value, data: dataUrl, created: Date.now() });
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
    <p class="small muted" style="text-align:center">Mi Progreso 2.0 · tus datos no salen del teléfono</p>`;

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
  const payload = { app: 'miprogreso', version: 2, exportedAt: new Date().toISOString(), data: DB };
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
