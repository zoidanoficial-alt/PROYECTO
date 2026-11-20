'use strict';
/* =====================================================================
 *  30.0 · Tu cuerpo hoy (Health Connect) y entrenamientos iniciados en el reloj
 *  - Sueño con fases, pulso, presión arterial y oxígeno: lo que Mi Fitness (u otra app) comparte.
 *  - Energía y Estrés: Xiaomi no los comparte con ninguna app (no existen en Health Connect).
 *    Mi Progreso calcula su propia versión con HRV, pulso en reposo, pulso del día, sueño y carga,
 *    y lo dice siempre: "estimado por Mi Progreso".
 *  - Entrenamientos del reloj: inícialos y páralos en la muñeca (modo Entrenamiento); al sincronizar
 *    la app pregunta qué fueron y los registra en HYROX Lab con su pulso y sus vueltas.
 * ===================================================================== */

const STAGE = { 1: 'awake', 7: 'awake', 3: 'awake', 4: 'light', 2: 'light', 5: 'deep', 6: 'rem' };
const EX_TYPE = { 56: 'Carrera', 57: 'Caminadora', 36: 'HIIT', 70: 'Fuerza', 79: 'Caminata', 54: 'Remo', 10: 'Bootcamp', 13: 'Calistenia', 0: 'Entrenamiento' };
const isXiaomi = p => /com\.mi\.health|com\.xiaomi/i.test(p || '');

/** Guarda por día lo que llegó de Health Connect (sin pisar lo escrito a mano). */
function bodyIngest(data) {
  const day = ms => dateStr(new Date(ms)), D = d => (DB.days[d] = DB.days[d] || {});
  // Fases del sueño (al día en que despiertas)
  const st = {};
  (data.sleep || []).forEach(([s, e, stages]) => {
    const d = day(e), o = st[d] = st[d] || { deep: 0, rem: 0, light: 0, awake: 0, total: 0 };
    o.total += (e - s) / 60000;
    (stages || []).forEach(([a, b, t]) => { const k = STAGE[t]; if (k) o[k] += (b - a) / 60000; });
  });
  Object.entries(st).forEach(([d, o]) => { D(d).sleepStages = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)])); });
  // Presión arterial: la última lectura del día
  (data.bp || []).forEach(([t, sys, dia, src]) => { const d = day(t), cur = D(d).bp; if (!cur || t > cur.at) D(d).bp = { sys: Math.round(sys), dia: Math.round(dia), at: t, src: src || '' }; });
  // Oxígeno en sangre: media y mínimo del día
  const sp = {}; (data.spo2 || []).forEach(([t, v]) => { (sp[day(t)] = sp[day(t)] || []).push(v); });
  Object.entries(sp).forEach(([d, v]) => { D(d).spo2 = { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10, min: Math.round(Math.min(...v) * 10) / 10, n: v.length }; });
  // Pulso del día fuera de los entrenamientos (base del estrés estimado)
  const ex = (data.ex || []).map(x => [x[0], x[1]]), inEx = t => ex.some(([a, b]) => t >= a - 5 * 60e3 && t <= b + 10 * 60e3);
  const hd = {}; (data.hr || []).forEach(([t, v]) => { if (!inEx(t)) (hd[day(t)] = hd[day(t)] || []).push(v); });
  Object.entries(hd).forEach(([d, v]) => { if (v.length >= 10) D(d).hrDay = { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), min: Math.min(...v), max: Math.max(...v), n: v.length }; });
  // Entrenamientos iniciados en el reloj → bandeja para clasificarlos
  const w = wst(); w.seenEx = w.seenEx || []; w.exInbox = w.exInbox || [];
  (data.ex || []).forEach(([s, e, type, title, origin, laps, segs]) => {
    const key = String(s);
    if (w.seenEx.includes(key) || e - s < 60e3) return;
    w.seenEx.push(key);
    const pts = (data.hr || []).filter(([t]) => t >= s && t <= e);
    w.exInbox.push({ key, start: s, end: e, type, title: title || '', origin: origin || '', laps: laps || [], segs: segs || [],
      hrAvg: pts.length ? Math.round(pts.reduce((a, x) => a + x[1], 0) / pts.length) : null, hrMax: pts.length ? Math.max(...pts.map(x => x[1])) : null, hr: pts.filter((_, i) => i % 3 === 0) });
  });
  w.seenEx = w.seenEx.slice(-200);
}

/* ---------- Estimaciones propias (no son las de Xiaomi) ---------- */
function bodyBase(k, d, n) {   // media de los n días anteriores
  const v = []; for (let i = 1; i <= (n || 7); i++) { const r = DB.days[addDays(d, -i)] && DB.days[addDays(d, -i)].rec; if (r && r[k] != null) v.push(r[k]); }
  return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
/** Energía 0–100: cómo llegas hoy (sueño y fases, HRV y pulso en reposo vs tu media, carga de ayer). */
function bodyEnergy(d) {
  d = d || todayStr();
  const day = DB.days[d] || {}, r = day.rec || {}, why = [];
  if (r.sleepH == null && r.hrv == null && r.rhr == null) return null;
  let e = 62;
  if (r.sleepH != null) { const x = Math.max(-25, Math.min(12, (r.sleepH - 7.5) * 9)); e += x; why.push(`sueño ${fmt(r.sleepH)} h`); }
  const ss = day.sleepStages; if (ss && ss.total > 120) { const q = (ss.deep + ss.rem) / ss.total; e += q >= 0.4 ? 6 : q < 0.25 ? -6 : 0; why.push(`profundo + REM ${Math.round(q * 100)} %`); }
  const hb = bodyBase('hrv', d), rb = bodyBase('rhr', d);
  if (r.hrv && hb) { e += Math.max(-20, Math.min(15, (r.hrv / hb - 1) * 80)); why.push(`HRV ${r.hrv} ms vs ${Math.round(hb)}`); }
  if (r.rhr && rb) { e -= Math.max(-6, Math.min(15, (r.rhr - rb) * 2.5)); why.push(`reposo ${r.rhr} lpm vs ${Math.round(rb)}`); }
  const y = addDays(d, -1), hard = ((DB.hyrox && DB.hyrox.sessions) || []).some(s => s.date === y && s.rpe >= 8) || ((DB.hyrox && DB.hyrox.runs) || []).some(s => s.date === y && s.mode === 'race');
  if (hard) { e -= 8; why.push('sesión dura ayer'); }
  return { v: Math.round(Math.max(5, Math.min(100, e))), why };
}
/** Estrés 0–100: HRV baja, pulso en reposo alto y pulso del día por encima del reposo (fuera de entrenos). */
function bodyStress(d) {
  d = d || todayStr();
  const day = DB.days[d] || {}, r = day.rec || {}, hd = day.hrDay, why = [];
  const hb = bodyBase('hrv', d), rb = bodyBase('rhr', d);
  if (!(r.hrv && hb) && !(r.rhr && rb) && !(hd && r.rhr)) return null;
  let s = 25;
  if (r.hrv && hb) { s += Math.max(-15, Math.min(35, (1 - r.hrv / hb) * 120)); why.push(`HRV ${r.hrv} vs ${Math.round(hb)} ms`); }
  if (r.rhr && rb) { s += Math.max(-8, Math.min(20, (r.rhr - rb) * 3)); why.push(`reposo ${r.rhr} vs ${Math.round(rb)} lpm`); }
  if (hd && r.rhr) { s += Math.max(0, Math.min(25, (hd.avg - r.rhr - 15) * 1.5)); why.push(`pulso del día ${hd.avg} lpm`); }
  return { v: Math.round(Math.max(1, Math.min(100, s))), why };
}
const stressLabel = v => v < 25 ? 'Relajado' : v < 50 ? 'Normal' : v < 75 ? 'Medio' : 'Alto';
const energyLabel = v => v >= 75 ? 'Alta' : v >= 50 ? 'Buena' : v >= 30 ? 'Baja' : 'Muy baja';
const hm = m => m == null ? '—' : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`;

/* ---------- Tarjeta "Tu cuerpo hoy" ---------- */
function bodyCard() {
  if (!DB.watch || !DB.watch.hcOn) return '';
  const t = todayStr(), d = DB.days[t] || {}, r = d.rec || {}, ss = d.sleepStages, en = bodyEnergy(t), sr = bodyStress(t);
  const tile = (k, ico, label, val, sub, est) => `<button class="bd-tile" data-bd="${k}"><small>${ico} ${label}</small><b>${val}</b><span>${sub || ''}${est ? '<em> · estimado</em>' : ''}</span></button>`;
  return `<div class="card keep bd-card"><div class="row spread"><div><div class="hx-eyebrow">TU CUERPO HOY</div><h2 style="margin:2px 0 8px">${en ? `Energía ${en.v} · ${energyLabel(en.v)}` : 'Datos del reloj'}</h2></div><button class="ghost" id="bd-sync">${ico('refresh-cw', 16)}</button></div>
    <div class="bd-grid">
      ${tile('sleep', '😴', 'Sueño', r.sleepH != null ? fmt(r.sleepH) + ' h' : '—', ss ? `profundo ${hm(ss.deep)} · REM ${hm(ss.rem)}` : '')}
      ${tile('hr', '❤️', 'Pulso', r.rhr != null ? r.rhr : '—', r.rhr != null ? `reposo${d.hrDay ? ' · día ' + d.hrDay.avg : ''} lpm` : '')}
      ${tile('bp', '🩺', 'Presión', d.bp ? `${d.bp.sys}/${d.bp.dia}` : '—', d.bp ? 'mmHg' : 'sin lecturas')}
      ${tile('spo2', '🫁', 'Oxígeno', d.spo2 ? fmt(d.spo2.avg, 0) + ' %' : '—', d.spo2 ? `mín ${fmt(d.spo2.min, 0)} %` : 'sin lecturas')}
      ${tile('energy', '⚡', 'Energía', en ? en.v : '—', en ? energyLabel(en.v) : 'faltan datos', true)}
      ${tile('stress', '🧠', 'Estrés', sr ? sr.v : '—', sr ? stressLabel(sr.v) : 'faltan datos', true)}
    </div>
    ${DB.watch.hcSync ? `<p class="small muted" style="margin:8px 0 0">Del reloj vía Mi Fitness · ${new Date(DB.watch.hcSync).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}. Energía y estrés los calcula Mi Progreso.</p>` : ''}</div>
    ${exInboxCard()}`;
}
function bindBodyCard(root) {
  $$('[data-bd]', root).forEach(b => b.onclick = () => openBodyDetail(b.dataset.bd));
  const s = $('#bd-sync', root); if (s) s.onclick = () => hcSync(true).then(() => render(currentTab));
  bindExInbox(root);
}
function openBodyDetail(k) {
  const t = todayStr(), days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const val = { sleep: d => (DB.days[d] && DB.days[d].rec && DB.days[d].rec.sleepH), hr: d => (DB.days[d] && DB.days[d].rec && DB.days[d].rec.rhr), bp: d => DB.days[d] && DB.days[d].bp && DB.days[d].bp.sys, spo2: d => DB.days[d] && DB.days[d].spo2 && DB.days[d].spo2.avg, energy: d => (bodyEnergy(d) || {}).v, stress: d => (bodyStress(d) || {}).v }[k];
  const vals = days.map(val), max = Math.max(1, ...vals.filter(v => v != null));
  const info = {
    sleep: ['Sueño', 'Horas y fases (profundo, REM, ligero) que Mi Fitness comparte. Llena tu chequeo de recuperación si no lo escribiste.'],
    hr: ['Pulso', 'Pulso en reposo y pulso medio del día fuera de tus entrenamientos. Un reposo 5+ lpm arriba de tu media suele indicar fatiga, poco sueño o que te estás enfermando.'],
    bp: ['Presión arterial', 'Se llena con cualquier app que comparta presión con Health Connect (por ejemplo, un baumanómetro conectado). El Mi Watch XMWTCL02 no tiene sensor de presión. Es informativa: no es un diagnóstico; si ves valores altos, consulta a tu médico.'],
    spo2: ['Oxígeno en sangre', 'SpO₂ del reloj si Mi Fitness la comparte. En reposo suele estar entre 95 y 100 %. Es informativa, no un diagnóstico.'],
    energy: ['Energía (estimada por Mi Progreso)', 'Xiaomi no comparte su "energía corporal" con ninguna app. Esta es nuestra versión: parte de cómo dormiste (horas y fases), tu HRV y tu pulso en reposo comparados con tu propia media de 7 días, y si ayer tuviste una sesión dura.'],
    stress: ['Estrés (estimado por Mi Progreso)', 'Xiaomi tampoco comparte su medición de estrés. La nuestra sube cuando tu HRV baja de tu media, tu pulso en reposo sube y tu pulso durante el día (fuera de entrenos) va muy por encima de tu reposo.']
  }[k];
  const est = k === 'energy' ? bodyEnergy(t) : k === 'stress' ? bodyStress(t) : null;
  openModal(`<h3>${info[0]}</h3><p class="small muted" style="margin-top:0">${info[1]}</p>
    ${est ? `<div class="pg-rec"><b>Hoy: ${est.v}</b><small>${esc(est.why.join(' · ') || 'Con los datos disponibles')}</small></div>` : ''}
    ${k === 'bp' && DB.days[t] && DB.days[t].bp ? `<p class="small">Fuente: ${esc(isXiaomi(DB.days[t].bp.src) ? 'Mi Fitness' : DB.days[t].bp.src || '—')}</p>` : ''}
    <div class="bd-bars">${days.map((d, i) => `<div><i style="height:${vals[i] != null ? Math.max(4, vals[i] / max * 100) : 0}%"></i><b>${vals[i] != null ? (k === 'sleep' ? fmt(vals[i]) : Math.round(vals[i])) : '—'}</b><small>${['D', 'L', 'M', 'M', 'J', 'V', 'S'][parseDate(d).getDay()]}</small></div>`).join('')}</div>
    <button class="block" id="bdd-x">Listo</button>`, m => { $('#bdd-x', m).onclick = closeModal; });
}

/* ---------- Entrenamientos iniciados en el reloj ---------- */
function exInboxCard() {
  const w = DB.watch; if (!w || !w.exInbox || !w.exInbox.length) return '';
  const x = w.exInbox[0], dur = (x.end - x.start) / 1000;
  return `<div class="card keep ex-inbox"><div class="hx-eyebrow">ENTRENAMIENTO DEL RELOJ${w.exInbox.length > 1 ? ` · 1 de ${w.exInbox.length}` : ''}</div>
    <h2 style="margin:4px 0">${esc(EX_TYPE[x.type] || x.title || 'Entrenamiento')} · ${hxT(dur)}</h2>
    <p class="small muted" style="margin:0 0 8px">${new Date(x.start).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${x.hrAvg ? ` · ${x.hrAvg} lpm (máx ${x.hrMax})` : ''}${x.laps.length > 1 ? ` · ${x.laps.length} vueltas` : ''}</p>
    <p class="small">¿Qué fue? Lo registro en HYROX Lab con su tiempo y su pulso.</p>
    <div class="ex-opts">
      ${dur <= 600 ? '<button class="chip" data-exa="run1k">1 km fresco</button>' : ''}
      <button class="chip" data-exa="station">Una estación</button>
      ${dur <= 900 ? '<button class="chip" data-exa="comp">1 km bajo fatiga</button>' : ''}
      ${dur >= 1800 ? '<button class="chip" data-exa="race">Simulación HYROX</button>' : ''}
      <button class="chip" data-exa="keep">Solo guardar</button>
    </div></div>`;
}
function bindExInbox(root) { $$('[data-exa]', root).forEach(b => b.onclick = () => exAssign(b.dataset.exa)); }
function exAssign(kind, stKey) {
  const w = wst(), x = w.exInbox[0]; if (!x) return;
  if ((kind === 'station' || kind === 'comp') && !stKey) {
    openModal(`<h3>${kind === 'comp' ? '¿Después de qué estación?' : '¿Qué estación fue?'}</h3><div class="kit-list">${HX_STATIONS.map(s => `<button class="kit-item" data-exs="${s.k}"><span class="grow"><b>${s.n} · ${s.d}</b></span>${ico('chevron-right', 16)}</button>`).join('')}</div><button class="ghost block" id="exs-x">Cancelar</button>`, m => {
      $$('[data-exs]', m).forEach(b => b.onclick = () => { closeModal(); exAssign(kind, b.dataset.exs); });
      $('#exs-x', m).onclick = closeModal;
    });
    return;
  }
  const ladderPrev = kind === 'race' && typeof hxMyBest === 'function' ? (hxMyBest() || {}).sec : null;
  const sec = Math.round((x.end - x.start) / 1000), date = dateStr(new Date(x.start)), base = { date, t: Date.now(), rpe: null, fromWatch: true, note: 'Iniciado en el reloj' };
  const laps = x.laps.map(([a, b]) => Math.round((b - a) / 1000));
  if (kind !== 'keep') {
    const id = 'wx' + x.key, segs = [];
    if (kind === 'run1k') hx().results.push({ ...base, id, kind: 'run1k', sec });
    else if (kind === 'station') hx().results.push({ ...base, id, kind: 'st', st: stKey, sec, std: true });
    else if (kind === 'comp') hx().results.push({ ...base, id, kind: 'comp', sec: laps.length >= 2 ? laps[laps.length - 1] : sec, after: stKey });
    else if (kind === 'race') {
      hx().results.push({ ...base, id, kind: 'sim', sec });
      // Con 16 vueltas (una por tramo) se guardan los parciales de cada estación
      if (laps.length === 16) HX_STATIONS.forEach((s, i) => hx().results.push({ ...base, id: id + s.k, kind: 'st', st: s.k, sec: Math.round(laps[i * 2 + 1] / 1.08), std: true, note: 'Vuelta del reloj (÷1.08)' }));
    }
    (laps.length ? laps : [sec]).forEach((v, i) => segs.push({ k: 'lap', n: laps.length ? `Vuelta ${i + 1}` : 'Total', sec: v, start: x.laps[i] ? x.laps[i][0] : x.start, end: x.laps[i] ? x.laps[i][1] : x.end, hrAvg: null }));
    hx().runs = (hx().runs || []).concat({ id, mode: kind, st: stKey || null, date, t0: x.start, t1: x.end, total: sec, segs, hrLive: false, hrFromWatch: !!x.hrAvg, hrAvg: x.hrAvg, hrMax: x.hrMax, hr: x.hr, fromWatch: true });
  }
  w.exInbox.shift(); saveData();
  const beaten = kind === 'race' && typeof hxLadderBeaten === 'function' ? hxLadderBeaten(ladderPrev, sec) : [];
  toast(beaten.length ? (beaten.some(b => !b.goal) ? '¡Superaste a ' + beaten.filter(b => !b.goal).map(b => b.name).join(', ') + '! Subes en Mi escalera' : '¡Rompiste ' + beaten[0].name + '!') : kind === 'keep' ? 'Guardado' : 'Registrado en HYROX Lab con el pulso del reloj');
  if (typeof render === 'function') render(currentTab);
}
