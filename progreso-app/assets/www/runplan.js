/* Mi Progreso 12.0 · Planes de running, planificación de carrera, siguiente sesión con su
   misión, recomendaciones según historial y coordinación con la fuerza.
   Reglas de seguridad: el volumen semanal sube como máximo 10 %, una semana de descarga cada
   4 y reducción antes de la carrera. Nunca se recuperan sesiones perdidas acumulándolas. */

const RUN_PLANS = {
  inicio: { name: 'Empezar a correr', ico: '🌱', weeks: 8, dist: 5, desc: 'De caminar a correr 30 minutos seguidos, alternando correr y caminar.' },
  '5k': { name: '5K', ico: '🏃', weeks: 8, dist: 5, base: 10, peak: 25, longMax: 10 },
  '10k': { name: '10K', ico: '🏃', weeks: 10, dist: 10, base: 15, peak: 35, longMax: 14 },
  '21k': { name: 'Medio maratón', ico: '🏅', weeks: 12, dist: 21.0975, base: 20, peak: 45, longMax: 19 },
  '42k': { name: 'Maratón', ico: '🏆', weeks: 16, dist: 42.195, base: 30, peak: 65, longMax: 32 }
};
// Empezar a correr: [segundos corriendo, segundos caminando, repeticiones] por semana
const C25K = [[60, 90, 8], [90, 120, 6], [180, 90, 5], [300, 150, 3], [480, 300, 2], [600, 180, 2], [1500, 0, 1], [1800, 0, 1]];
const SESSION_INFO = {
  suave: { name: 'Suave', ico: '🟢', why: 'Construye tu base aeróbica sin acumular fatiga. Debes poder platicar.' },
  largo: { name: 'Largo', ico: '🔵', why: 'Prepara a tus piernas y a tu corazón para la distancia de la carrera.' },
  intervalos: { name: 'Intervalos', ico: '🟠', why: 'Mejora tu velocidad y tu VO₂máx. con repeticiones cortas y rápidas.' },
  tempo: { name: 'Tempo', ico: '🟠', why: 'Te enseña a sostener un ritmo exigente por más tiempo.' },
  intervalos_cc: { name: 'Correr y caminar', ico: '🌱', why: 'Alternar te permite acumular minutos corriendo sin agotarte ni lesionarte.' },
  carrera: { name: 'Día de carrera', ico: '🏁', why: 'Todo el plan llevó a esto. Sal a tu ritmo planeado y disfruta.' }
};

/* ---------- ritmos de referencia ---------- */
/** Predicción de Riegel: T2 = T1 × (D2 / D1)^1.06, a partir de tu mejor esfuerzo reciente. */
function riegel(t1, d1, d2) { return t1 * Math.pow(d2 / d1, 1.06); }
function recentBest(days) {
  const from = addDays(todayStr(), -(days || 90));
  let best = null;
  (DB.runs || []).filter(r => r.date >= from).forEach(r => Object.keys(r.best || {}).forEach(k => {
    const d = Number(k), t5 = riegel(r.best[k], d, 5);
    if (!best || t5 < best.t5) best = { d, t: r.best[k], t5, date: r.date };
  }));
  return best;
}
/** Predicción para una distancia con un rango que crece cuanto más se extrapola. */
function predictRace(dist) {
  const b = recentBest(90);
  if (!b) return null;
  const t = riegel(b.t, b.d, dist), ratio = Math.max(dist / b.d, b.d / dist);
  const spread = ratio <= 2 ? 0.03 : ratio <= 4.5 ? 0.05 : 0.08;
  return { t, lo: t * (1 - spread), hi: t * (1 + spread), from: b };
}
function paceZones() {
  const b = recentBest(90);
  if (!b) return null;
  const p5 = b.t5 / 5;
  return { suave: [p5 + 60, p5 + 90], tempo: [p5 + 15, p5 + 25], intervalos: [p5 - 10, p5], largo: [p5 + 60, p5 + 90] };
}
function zoneTxt(type) { const z = paceZones(); const k = type === 'largo' ? 'largo' : type; return z && z[k] ? `${paceStr(z[k][0])}–${paceStr(z[k][1])}/km` : null; }

/* ---------- generador de planes ---------- */
function weeklyKmRecent() {
  const wb = weekBuckets(5).slice(0, 4);
  const runs = allRuns();
  return wb.reduce((a, b) => a + runs.filter(r => r.date >= b.start && r.date <= b.end).reduce((x, r) => x + (r.km || 0), 0), 0) / 4;
}
function buildRunPlan(type, days, raceDate, goalSec, currentKm) {
  const P = RUN_PLANS[type], nW = P.weeks;
  const runDays = { 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [0, 1, 3, 4, 6] }[days];   // largo en fin de semana
  let start = weekKey(todayStr());
  if (raceDate) { const s = addDays(weekKey(raceDate), -7 * (nW - 1)); if (s > start) start = s; }
  const weeks = [];
  if (type === 'inicio') {
    C25K.forEach(([run, walk, reps], w) => {
      const sessions = runDays.slice(0, 3).map(k => {
        const segs = [{ type: 'warm', sec: 300, label: 'Camina para calentar', say: 'Camina 5 minutos para calentar.' }];
        for (let r = 0; r < reps; r++) {
          segs.push({ type: 'easy', sec: run, label: `Corre suave (${r + 1}/${reps})`, say: `Corre suave ${run >= 120 ? Math.round(run / 60) + ' minutos' : run + ' segundos'}.` });
          if (walk && r < reps - 1) segs.push({ type: 'walk', sec: walk, label: 'Camina', say: `Camina ${walk >= 120 ? Math.round(walk / 60) + ' minutos' : walk + ' segundos'}.` });
        }
        segs.push({ type: 'cool', sec: 300, label: 'Camina para enfriar', say: 'Camina 5 minutos para enfriar. ¡Muy bien!' });
        return { id: uid(), date: addDays(addDays(start, 7 * w), k), type: 'intervalos_cc', label: reps > 1 ? `${reps} × ${run >= 120 ? Math.round(run / 60) + ' min' : run + ' s'} corriendo` : `${Math.round(run / 60)} min corriendo seguido`, min: Math.round(segs.reduce((a, s) => a + s.sec, 0) / 60), segs };
      });
      weeks.push({ w: w + 1, km: null, sessions });
    });
  } else {
    let km = Math.max(P.base, Math.min(currentKm || 0, P.peak * 0.8)), lastFull = km;
    for (let w = 0; w < nW; w++) {
      const fromEnd = nW - 1 - w, taper = type === '42k' || type === '21k' ? (fromEnd === 1 ? 0.7 : fromEnd === 0 ? 0.45 : 0) : fromEnd === 0 ? 0.6 : 0;
      const cut = !taper && (w + 1) % 4 === 0;
      // Todo en múltiplos de 0.5 km y redondeando hacia abajo: así ninguna semana completa sube más del 10 %.
      const down = x => Math.floor(x * 2) / 2;
      let wk;
      if (w === 0) wk = down(km);
      else if (taper) wk = down(lastFull * taper);
      else if (cut) wk = down(lastFull * 0.8);
      else { wk = down(Math.min(P.peak, lastFull * 1.1)); lastFull = wk; }
      if (w === 0) lastFull = wk;
      const n = runDays.length, longShare = n === 3 ? 0.42 : n === 4 ? 0.35 : 0.3, qShare = 0.2;
      // Reparto en múltiplos de 0.5 km cuya suma es exactamente la meta semanal (redondeada a 0.5).
      const half = x => Math.round(x * 2) / 2, total = half(wk);
      const longKm = Math.max(2, half(Math.min(P.longMax, wk * longShare))), qKm = Math.max(2, half(wk * qShare));
      const easyN = n - 2, easyTot = Math.max(easyN * 2, total - longKm - qKm), easyEach = Math.floor(easyTot / easyN * 2) / 2;
      const easyKms = Array.from({ length: easyN }, (_, j) => j === easyN - 1 ? half(easyTot - easyEach * (easyN - 1)) : easyEach);
      let ei = 0;
      const sessions = runDays.map((k, i) => {
        const date = addDays(addDays(start, 7 * w), k), isLast = i === n - 1, isQ = i === 1;
        if (fromEnd === 0 && isLast && raceDate) return { id: uid(), date: raceDate, type: 'carrera', km: P.dist, label: P.name + ' · ¡día de carrera!', segs: [{ type: 'easy', m: P.dist * 1000, label: 'Carrera', say: 'Sal a tu ritmo planeado. ¡Disfruta!' }] };
        if (isLast) return mkSession(date, 'largo', longKm);
        if (isQ) return mkSession(date, w >= 1 && fromEnd !== 0 ? (w % 2 ? 'intervalos' : 'tempo') : 'suave', qKm);
        return mkSession(date, 'suave', easyKms[ei++]);
      });
      weeks.push({ w: w + 1, target: Math.round(wk * 10) / 10, km: Math.round(sessions.reduce((a, s) => a + (s.km || 0), 0) * 10) / 10, cut, taper: !!taper, sessions });
    }
  }
  return { type, days, start, raceDate: raceDate || addDays(start, 7 * nW - 1), goalSec: goalSec || null, weeks, created: todayStr() };
}
function mkSession(date, type, km) {
  km = Math.max(2, Math.round(km * 2) / 2);
  const s = { id: uid(), date, type, km };
  if (type === 'intervalos') {
    const reps = Math.max(4, Math.min(10, Math.round((km - 3) / 0.6)));
    const segs = [{ type: 'warm', sec: 600, label: 'Calienta trotando', say: 'Calienta trotando suave 10 minutos.' }];
    for (let r = 0; r < reps; r++) { segs.push({ type: 'fast', m: 400, label: `Rápido 400 m (${r + 1}/${reps})`, say: `Repetición ${r + 1}. 400 metros rápido.` }); if (r < reps - 1) segs.push({ type: 'walk', sec: 90, label: 'Recupera trotando', say: 'Recupera trotando suave 90 segundos.' }); }
    segs.push({ type: 'cool', sec: 600, label: 'Enfría trotando', say: 'Últimos 10 minutos suaves para enfriar.' });
    s.label = `${reps} × 400 m rápidos`; s.segs = segs;
  } else if (type === 'tempo') {
    const tmin = Math.max(12, Math.min(40, Math.round((km - 3) * 5)));
    s.label = `${tmin} min a ritmo tempo`;
    s.segs = [{ type: 'warm', sec: 600, label: 'Calienta trotando', say: 'Calienta trotando suave 10 minutos.' }, { type: 'fast', sec: tmin * 60, label: 'Tempo: exigente pero sostenible', say: `Ahora ${tmin} minutos a ritmo tempo: exigente pero sostenible.` }, { type: 'cool', sec: 600, label: 'Enfría trotando', say: 'Últimos 10 minutos suaves para enfriar.' }];
  } else {
    s.label = `${fmt(km, km % 1 ? 1 : 0)} km ${type === 'largo' ? 'largos y suaves' : 'suaves'}`;
    s.segs = [{ type: 'easy', m: km * 1000, label: type === 'largo' ? 'Largo suave' : 'Suave', say: `Corre ${fmt(km, km % 1 ? 1 : 0)} kilómetros ${type === 'largo' ? 'largos y suaves' : 'suaves'}. Debes poder platicar.` }];
  }
  return s;
}

/* ---------- siguiente sesión, recomendaciones y coordinación ---------- */
function planSessions() { return DB.runPlan ? DB.runPlan.weeks.flatMap(w => w.sessions.map(s => Object.assign({ week: w.w, weeks: DB.runPlan.weeks.length, cut: w.cut, taper: w.taper }, s))).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : []; }
function nextRunSession() { const t = todayStr(); return planSessions().find(s => s.date >= t && !s.done) || null; }
function legSetsOn(date) { return DB.lifts.filter(l => l.date === date && ['pierna', 'femoral', 'gluteo'].includes(exInfo(l.ex).g)).length; }
function hardRunOn(date) { return (DB.runs || []).some(r => r.date === date && (r.rpe >= 7 || (r.km || 0) >= 14)) || planSessions().some(s => s.date === date && s.done && ['largo', 'intervalos', 'tempo', 'carrera'].includes(s.type)); }
/** Ajustes razonados para una sesión de running: recuperación, piernas cansadas y último esfuerzo. */
function runAdvice(s) {
  const t = todayStr(), out = [], rd = typeof readiness === 'function' ? readiness() : null;
  const hard = ['intervalos', 'tempo', 'largo'].includes(s.type);
  if (s.date === t && rd && rd.plan === 'modificar') out.push({ kind: 'swap', text: 'Tu chequeo de hoy recomienda descarga: cambia esta sesión por 20–30 min caminando o movilidad, o descansa.' });
  else if (s.date === t && rd && rd.plan === 'reducir' && hard) out.push({ kind: 'easy', text: 'Tu chequeo pide reducir: haz la misma duración pero a ritmo suave.' });
  if (hard && s.date === t && legSetsOn(addDays(t, -1)) >= 6) out.push({ kind: 'coord', text: `Ayer hiciste ${legSetsOn(addDays(t, -1))} series de pierna: si sientes las piernas pesadas, muévela a mañana o hazla suave.` });
  const last = (DB.runs || []).slice().sort((a, b) => b.start - a.start)[0];
  if (last && last.rpe >= 8 && s.type === 'suave') out.push({ kind: 'pace', text: `Tu última carrera se sintió ${last.rpe}/10: hoy baja el ritmo; suave de verdad es poder platicar.` });
  const missed = planSessions().filter(x => x.date < t && !x.done && x.date >= addDays(t, -7)).length;
  if (missed) out.push({ kind: 'missed', text: `${missed} ${missed > 1 ? 'sesiones' : 'sesión'} sin hacer esta semana: no las recuperes, sigue con la de hoy. El plan se adapta.` });
  return out;
}
/** Para la pestaña de fuerza: avisa si hoy toca pierna y ayer hubo una carrera dura. */
function strengthCoordNote(dayName) {
  const y = addDays(todayStr(), -1);
  if (!/pierna|legs|inferior/i.test(dayName || '') || !hardRunOn(y)) return '';
  return '🏃 Ayer tuviste una carrera exigente: hoy considera bajar una serie por ejercicio de pierna o mover este día.';
}
/** Misión de la siguiente sesión: objetivo, criterio de éxito y por qué. */
function runMission(s) {
  if (!s) return null;
  const I = SESSION_INFO[s.type], z = zoneTxt(s.type === 'carrera' ? 'tempo' : s.type);
  const goal = s.type === 'intervalos_cc' ? `Completa los ${s.segs.filter(x => x.type === 'easy').length} bloques corriendo (${s.min} min en total)`
    : s.type === 'intervalos' || s.type === 'tempo' ? `Completa: ${s.label}`
      : `Corre ${fmt(s.km, s.km % 1 ? 1 : 0)} km${s.type === 'carrera' ? '' : ' a ritmo cómodo'}`;
  const success = s.type === 'suave' || s.type === 'largo' ? 'Distancia de al menos el 90 % y esfuerzo de 5/10 o menos.'
    : s.type === 'intervalos_cc' ? 'Terminar todos los bloques; caminar más si lo necesitas también cuenta.'
      : s.type === 'carrera' ? 'Cruzar la meta sin dolor. El tiempo es un extra.' : 'Terminar todos los bloques con buena técnica, sin llegar al agotamiento.';
  const phase = s.taper ? 'Semana de reducción antes de la carrera.' : s.cut ? 'Semana de descarga: menos volumen para asimilar.' : '';
  return { goal, success, why: `${I.why} ${phase}`.trim(), pace: z, week: s.week, weeks: s.weeks };
}
/** Al guardar el esfuerzo de una carrera: marca la sesión del plan y evalúa la misión. */
function evalRunMission(run) {
  if (!DB.runPlan || !run.planRef) return;
  const s = DB.runPlan.weeks.flatMap(w => w.sessions).find(x => x.id === run.planRef);
  if (!s) return;
  s.done = run.id;
  const okDist = s.km ? run.km >= s.km * 0.9 : true, okEff = ['suave', 'largo'].includes(s.type) ? (run.rpe || 5) <= 5 : true;
  s.missionOk = okDist && okEff;
  setTimeout(() => toast(s.missionOk ? '🎯 ¡Misión de running cumplida!' : '✓ Sesión registrada. ' + (!okDist ? 'Fue más corta de lo planeado, y está bien.' : 'Se sintió dura: la próxima, más suave.')), 300);
}
/** Sin plan: recomendación según tu historial (sin subir de golpe). */
function runRecommendation() {
  const wk = weeklyKmRecent(), runs = allRuns().filter(r => r.date >= addDays(todayStr(), -28));
  if (!runs.length) return { title: 'Empieza suave', text: 'Sal 20 minutos alternando 1 minuto corriendo y 1:30 caminando. O crea el plan "Empezar a correr".', km: null };
  const km = Math.max(2, Math.round(wk / Math.max(2, Math.min(4, runs.length / 4)) * 2) / 2);
  return { title: `${fmt(km, km % 1 ? 1 : 0)} km suaves`, text: `Vienes promediando ${fmt(wk, 1)} km por semana. Una carrera suave de ${fmt(km, 1)} km mantiene tu base sin subir de golpe.`, km };
}

/* ---------- pantallas ---------- */
function runPlanCard() {
  const s = nextRunSession(), t = todayStr();
  if (!DB.runPlan || !s) {
    const rec = runRecommendation();
    return `<div class="card keep run-plan">
      <div class="small muted">${DB.runPlan ? '¡Plan completado! 🎉' : 'Recomendación para hoy'}</div>
      <h2 style="margin:2px 0 4px">${esc(rec.title)}</h2>
      <p class="small" style="margin:0 0 10px">${esc(rec.text)}</p>
      <div class="row"><button id="rp-go" data-km="${rec.km || ''}" style="flex:1">▶ Empezar</button><button class="secondary" id="rp-new" style="flex:1">🗓️ Crear plan</button></div>
    </div>`;
  }
  const m = runMission(s), adv = runAdvice(s), I = SESSION_INFO[s.type], P = RUN_PLANS[DB.runPlan.type];
  const isToday = s.date === t, days = daysBetween(t, DB.runPlan.raceDate), pred = P.dist && DB.runPlan.type !== 'inicio' ? predictRace(P.dist) : null;
  return `<div class="card keep run-plan">
    <div class="row spread"><div class="small muted">${P.ico} Plan ${P.name} · semana ${m.week} de ${m.weeks}</div>${days >= 0 && DB.runPlan.type !== 'inicio' ? `<span class="pill">🏁 ${days} días</span>` : ''}</div>
    <h2 style="margin:4px 0 2px">${isToday ? 'Hoy' : WEEKDAYS[weekdayIdx(s.date)]}: ${I.ico} ${esc(s.label)}</h2>
    ${m.pace ? `<div class="small muted">Ritmo guía: ${m.pace}</div>` : ''}
    <div class="mission progreso" style="margin-top:8px"><b>🎯 ${esc(m.goal)}</b><div class="small" style="font-weight:500;margin-top:4px">✔ Éxito: ${esc(m.success)}<br>💡 Por qué: ${esc(m.why)}</div></div>
    ${adv.map(a => `<div class="adapt-note ${a.kind === 'swap' ? 'warn' : ''}" style="margin:0 0 8px">${esc(a.text)}</div>`).join('')}
    ${pred ? `<p class="small" style="margin:4px 0 10px">Predicción para tu ${P.name}: <b>${durStr(pred.lo)} – ${durStr(pred.hi)}</b> <span class="tag-est">estimación</span>${DB.runPlan.goalSec ? ` · tu objetivo ${durStr(DB.runPlan.goalSec)} (${pred.t <= DB.runPlan.goalSec * 1.02 ? 'realista' : 'ambicioso'})` : ''}</p>` : ''}
    <div class="row"><button id="rp-start" data-sid="${s.id}" style="flex:2">▶ ${isToday ? 'Empezar sesión guiada' : 'Hacerla hoy'}</button><button class="secondary" id="rp-view" style="flex:1">Ver plan</button></div>
  </div>`;
}
function bindRunPlan(v) {
  const go = $('#rp-go', v); if (go) go.onclick = () => { const km = num(go.dataset.km); startRun(km ? { title: 'Carrera suave', segs: [{ type: 'easy', m: km * 1000, label: 'Suave', say: `Corre ${km} kilómetros suaves.` }], target: { km } } : { title: 'Correr y caminar', segs: Array.from({ length: 8 }, (_, i) => [{ type: 'easy', sec: 60, label: `Corre (${i + 1}/8)`, say: 'Corre suave un minuto.' }, { type: 'walk', sec: 90, label: 'Camina', say: 'Camina un minuto y medio.' }]).flat() }); };
  const nw = $('#rp-new', v); if (nw) nw.onclick = openRunPlanSetup;
  const st = $('#rp-start', v); if (st) st.onclick = () => { const s = planSessions().find(x => x.id === st.dataset.sid); if (!s) return; const adv = runAdvice(s); const easy = adv.some(a => a.kind === 'easy'); startRun({ title: (easy ? 'Suave (ajustada) · ' : '') + s.label, segs: easy ? [{ type: 'easy', m: (s.km || 5) * 1000, label: 'Suave', say: 'Hoy toca suave por tu recuperación.' }] : s.segs, planRef: s.id, target: { km: s.km } }); };
  const vw = $('#rp-view', v); if (vw) vw.onclick = openPlanView;
}
function openRunPlanSetup() {
  const cur = Math.round(weeklyKmRecent());
  const d = { type: cur < 5 ? 'inicio' : cur < 15 ? '5k' : '10k', days: '3', date: addDays(todayStr(), 7 * 10), goal: '' };
  const draw = m => {
    const P = RUN_PLANS[d.type];
    m.innerHTML = `<h3>Crear plan de running</h3>
      ${Object.keys(RUN_PLANS).map(k => `<button class="choice ${d.type === k ? 'on' : ''}" data-rpt="${k}"><span class="c-ico">${RUN_PLANS[k].ico}</span><span><b>${RUN_PLANS[k].name}</b><small>${RUN_PLANS[k].weeks} semanas${RUN_PLANS[k].desc ? ' · ' + RUN_PLANS[k].desc : ' · pico ~' + RUN_PLANS[k].peak + ' km/sem'}</small></span></button>`).join('')}
      <div class="ck-q">Días por semana</div>
      <div class="seg">${(d.type === 'inicio' ? ['3'] : ['3', '4', '5']).map(n => `<button data-rpd="${n}" class="${d.days === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${d.type !== 'inicio' ? `<label>Fecha de la carrera (opcional)<input type="date" id="rp-date" value="${d.date}" min="${addDays(todayStr(), 21)}"></label>
      <label>Tiempo objetivo (opcional, ej. 25:00 o 1:55:00)<input id="rp-goal" value="${esc(d.goal)}" placeholder="hh:mm:ss"></label>` : ''}
      <p class="small muted">Vienes corriendo ~${cur} km por semana. El plan empieza cerca de eso y sube como máximo 10 % por semana, con descarga cada 4 semanas.</p>
      <button class="block" id="rp-make">Crear plan</button>`;
    $$('[data-rpt]', m).forEach(b => b.onclick = () => { d.type = b.dataset.rpt; if (d.type === 'inicio') d.days = '3'; d.date = addDays(todayStr(), 7 * RUN_PLANS[d.type].weeks); draw(m); });
    $$('[data-rpd]', m).forEach(b => b.onclick = () => { d.days = b.dataset.rpd; draw(m); });
    $('#rp-make', m).onclick = () => {
      const date = $('#rp-date', m) ? $('#rp-date', m).value : null, gtxt = $('#rp-goal', m) ? $('#rp-goal', m).value.trim() : '';
      let goal = null;
      if (gtxt) { const parts = gtxt.split(':').map(Number); if (parts.some(x => !isFinite(x))) { toast('Escribe el tiempo como 25:00 o 1:55:00'); return; } goal = parts.reduce((a, x) => a * 60 + x, 0); }
      DB.runPlan = buildRunPlan(d.type, Number(d.days), date, goal, cur);
      addEvent(todayStr(), 'runplan', 'Empezaste el plan ' + RUN_PLANS[d.type].name, RUN_PLANS[d.type].ico);
      saveData(); closeModal(); render(currentTab); toast('🗓️ Plan creado');
    };
  };
  openModal('', draw);
}
function openPlanView() {
  const p = DB.runPlan, t = todayStr();
  openModal(`<h3>${RUN_PLANS[p.type].ico} Plan ${RUN_PLANS[p.type].name}</h3>
    <p class="small muted" style="margin-top:0">${longDate(p.start)} → ${longDate(p.raceDate)}</p>
    ${p.weeks.map(w => `<details class="plan-week" ${w.sessions.some(s => s.date >= t && s.date <= addDays(t, 6)) ? 'open' : ''}><summary><b>Semana ${w.w}</b><small>${w.km ? fmt(w.km, 1) + ' km' : ''}${w.cut ? ' · descarga' : ''}${w.taper ? ' · reducción' : ''}</small></summary>
      ${w.sessions.map(s => `<div class="pw-row ${s.done ? 'done' : s.date < t ? 'missed' : ''}"><span>${WEEKDAYS[weekdayIdx(s.date)].slice(0, 3)} ${shortDate(s.date)}</span><span>${SESSION_INFO[s.type].ico} ${esc(s.label)}</span><span>${s.done ? (s.missionOk ? '🎯' : '✓') : s.date < t ? '·' : ''}</span></div>`).join('')}</details>`).join('')}
    <p class="small muted">Las sesiones que no hagas no se acumulan: simplemente sigues con la siguiente.</p>
    <div class="row"><button class="danger" id="pv-del">Borrar plan</button><button id="pv-ok" style="flex:1">Cerrar</button></div>`, m => {
    $('#pv-ok', m).onclick = closeModal;
    $('#pv-del', m).onclick = () => { if (!confirm('¿Borrar el plan? Tus carreras registradas se conservan.')) return; DB.runPlan = null; saveData(); closeModal(); render(currentTab); };
  });
}
