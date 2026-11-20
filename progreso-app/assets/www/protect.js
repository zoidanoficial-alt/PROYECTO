'use strict';
/* Mi Progreso 24.0 · Principios aplicados a tus datos.
   1. Protección del rendimiento en definición: no asume que hay que bajar pesos ni sumar cardio. Observa
      rendimiento (fuerza estimada por ejercicio), esfuerzo y recuperación (sueño, energía, dolor, check-ins,
      ritmo de pérdida de peso) y solo sugiere cambios cuando la tendencia es preocupante.
      Una caída aislada no es pérdida muscular.
   2. Calentamiento adaptativo: series de aproximación según el ejercicio, la carga de hoy y si ya calentaste
      ese músculo; y una pregunta breve sobre molestias al empezar. */

/* ------------------------------------------------------------------ *
 *  1. Protección del rendimiento
 * ------------------------------------------------------------------ */
const isCutting = () => DB.profile.phase === 'definicion' || (typeof compPhase === 'function' && ['prep', 'show'].includes(compPhase().k));
/** Tendencia por ejercicio: las 3 últimas sesiones contra tu mejor marca previa de las últimas 6 semanas. */
function perfRows() {
  const from = addDays(todayStr(), -42), rows = [];
  trainedExercises().forEach(ex => {
    const h = exSessions(ex).filter(x => x.date >= from);
    if (h.length < 4) return;
    const val = x => x.bw ? x.top.r : x.best, last3 = h.slice(-3), ref = Math.max(...h.slice(0, -3).map(val)), last = h[h.length - 1];
    const drops = last3.filter(x => val(x) < ref * 0.95).length;
    rows.push({ ex, drops, ref, last: val(last), pct: (val(last) / ref - 1) * 100, bw: last.bw, u: unitFor(ex) });
  });
  return rows;
}
/** Señales de recuperación: últimos 7 días contra los 7 anteriores (chequeos diarios) y los check-ins semanales. */
function recoverySignals() {
  const t = todayStr(), avg = (from, to, k) => { const v = []; for (let i = from; i <= to; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r && r[k] != null) v.push(r[k]); } return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const out = [];
  const cmp = (k, label, worseIfLower, th) => { const a = avg(0, 6, k), b = avg(7, 13, k); if (a == null || b == null) return; if (worseIfLower ? a <= b - th : a >= b + th) out.push(`${label}: ${fmt(b, 1)} → ${fmt(a, 1)}`); };
  cmp('sleepH', 'Horas de sueño', true, 0.5); cmp('sleepQ', 'Calidad del sueño', true, 0.6); cmp('energy', 'Energía', true, 0.6); cmp('soreness', 'Dolor muscular', false, 0.6); cmp('stress', 'Estrés', false, 0.8);
  const ck = (DB.checkins || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (ck.length >= 2) { const a = ck[ck.length - 1], b = ck[ck.length - 2]; if (a.energy < b.energy) out.push(`Energía en tu check-in: ${b.energy} → ${a.energy}`); if (a.sleep < b.sleep) out.push(`Sueño en tu check-in: ${b.sleep} → ${a.sleep}`); }
  else if (ck.length === 1 && (ck[0].energy <= 2 || ck[0].sleep <= 2)) out.push('Tu último check-in marca energía o sueño bajos');
  return out;
}
function lossRate() {
  const { r1 } = weeklyRates(), w = currentWeight();
  return r1 != null && w ? -r1 / w * 100 : null;   // % de tu peso por semana (positivo = bajando)
}
/** Diagnóstico: sin datos, estable, a vigilar o tendencia preocupante. */
function perfGuard() {
  const rows = perfRows(), rec = recoverySignals(), loss = lossRate();
  if (rows.length < 2) return { k: 'nodata', rows, rec, loss };
  const repeated = rows.filter(r => r.drops >= 2), single = rows.filter(r => r.drops === 1);
  const recBad = rec.length > 0 || (loss != null && loss > 1);
  if (repeated.length >= 2 && recBad) return { k: 'alert', rows, repeated, rec, loss };
  if (repeated.length >= 2) return { k: 'watch2', rows, repeated, rec, loss };
  if (repeated.length || single.length) return { k: 'watch', rows, repeated, single, rec, loss };
  return { k: 'ok', rows, rec, loss };
}
const fatigueWeekActive = () => !!(DB.profile.fatigueUntil && todayStr() <= DB.profile.fatigueUntil);
function perfGuardCard() {
  if (!isCutting()) return '';
  const g = perfGuard(), head = { nodata: 'Juntando datos', ok: 'Tu rendimiento está estable', watch: 'Una caída aislada', watch2: 'Bajó en varios ejercicios', alert: 'Tendencia a revisar' }[g.k];
  const text = {
    nodata: 'Necesito al menos 4 sesiones de 2 ejercicios para ver tu tendencia. Mientras, entrena como siempre: en definición no hace falta bajar pesos.',
    ok: 'Mantienes tus marcas mientras bajas grasa: buena señal de que conservas músculo. No cambies nada.',
    watch: 'Un mal día no significa pérdida muscular (sueño, comida o estrés lo explican). No bajes pesos ni sumes cardio: observa las próximas sesiones.',
    watch2: 'Tu fuerza bajó varias veces, pero tu recuperación se ve bien. Revisa técnica, sueño y comida antes de entrenar; si sigue la próxima semana, toca reducir fatiga.',
    alert: 'Tu fuerza bajó varias veces y además empeoró tu recuperación. Antes de bajar pesos o sumar cardio, reduce la fatiga acumulada y revisa tu plan.'
  }[g.k];
  return `<div class="card keep pg-card ${g.k}"><div class="row spread"><div><div class="small muted">Protección del rendimiento · definición</div><h2 style="margin:0">${head}</h2></div><span class="pg-dot ${g.k}"></span></div>
    <p class="small" style="margin:8px 0">${text}</p>
    ${fatigueWeekActive() ? `<div class="adapt-note">${ico('shield', 16, 'lead')}Semana de menos fatiga activa hasta el ${shortDate(DB.profile.fatigueUntil)}: mismos pesos, una serie menos y 2–3 reps en reserva.</div>` : ''}
    <button class="ghost block" id="pg-open">Ver el detalle</button></div>`;
}
function bindPerfGuard(root, rerender) { const b = $('#pg-open', root); if (b) b.onclick = () => openPerfGuard(rerender); }
function openPerfGuard(after) {
  const g = perfGuard();
  const rows = g.rows.slice().sort((a, b) => a.pct - b.pct).slice(0, 8);
  const recs = [];
  if (g.k === 'alert' || g.k === 'watch2') {
    recs.push(['Reduce la fatiga una semana', 'Mismos ejercicios y pesos, una serie menos y 2–3 reps en reserva. No es retroceder: es dejar que el cuerpo se recupere.', 'fatigue']);
    if (g.loss != null && g.loss > 1) recs.push(['Revisa tu déficit', `Bajas ${fmt(g.loss, 1)} % de tu peso por semana: más de 1 % suele costar músculo. Sube 100–200 kcal, sobre todo carbohidratos cerca del entreno.`, 'food']);
    recs.push(['Prioriza el sueño', '7–9 h. Es lo que más rápido devuelve la fuerza.', null]);
    recs.push(['Si sigue 2 semanas más', 'Busca orientación profesional (nutriólogo o entrenador) para revisar el plan completo.', null]);
  }
  openModal(`<h3>Protección del rendimiento</h3>
    <p class="small muted" style="margin-top:0">Comparo tus 3 últimas sesiones de cada ejercicio con tu mejor marca de las 6 semanas previas (fuerza estimada), y lo cruzo con tu recuperación. Una caída aislada no significa pérdida muscular.</p>
    <div class="rir-label"><span>Rendimiento</span></div>
    ${rows.length ? rows.map(r => `<div class="ck-row"><span class="grow"><b>${esc(r.ex)}</b><small>${r.drops ? `bajó en ${r.drops} de sus 3 últimas sesiones` : 'estable'}</small></span><span class="rs-tag ${r.pct < -5 ? 'down' : r.pct > 1 ? 'up' : ''}">${signed(r.pct, 0)} %</span></div>`).join('') : '<p class="small muted">Aún no hay suficientes sesiones.</p>'}
    <div class="rir-label" style="margin-top:12px"><span>Recuperación</span></div>
    ${g.rec.length ? `<ul class="comp-list">${g.rec.map(t => `<li>${ico('triangle-alert', 16)}<span>${esc(t)}</span></li>`).join('')}</ul>` : '<p class="small muted">Sin señales de peor recuperación en tus chequeos y check-ins (o aún no hay datos: haz el chequeo antes de entrenar).</p>'}
    ${g.loss != null ? `<p class="small">Ritmo de pérdida: <b>${fmt(g.loss, 1)} % de tu peso por semana</b>${g.loss > 1 ? ' (rápido)' : ''}.</p>` : ''}
    ${recs.length ? `<div class="rir-label" style="margin-top:12px"><span>Qué haría</span></div>${recs.map(([t, d, k]) => `<div class="pg-rec"><b>${t}</b><small>${d}</small>${k === 'fatigue' && !fatigueWeekActive() ? '<button class="secondary block" id="pg-fat" style="margin-top:8px">Activar semana de menos fatiga</button>' : ''}${k === 'food' ? '<button class="secondary block" id="pg-food" style="margin-top:8px">Subir 150 kcal</button>' : ''}</div>`).join('')}` : ''}
    <p class="small muted" style="margin-top:12px">No bajo tus pesos ni te sumo cardio automáticamente: solo te propongo cambios cuando la tendencia es clara.</p>
    <button class="block" id="pg-x">Entendido</button>`, m => {
    const f = $('#pg-fat', m); if (f) f.onclick = () => { DB.profile.fatigueUntil = addDays(todayStr(), 6); saveData(); toast('Semana de menos fatiga activa'); openPerfGuard(after); };
    const fd = $('#pg-food', m); if (fd) fd.onclick = () => { const t = targets(); Object.assign(DB.profile, { autoMacros: false, kcal: t.kcal + 150, protein: t.protein, fatG: DB.profile.fatG || null }); saveData(); toast('Metas: ' + (t.kcal + 150) + ' kcal'); };
    $('#pg-x', m).onclick = () => { closeModal(); if (after) after(); };
  });
}

/* ------------------------------------------------------------------ *
 *  2. Calentamiento adaptativo y molestias
 * ------------------------------------------------------------------ */
/** Series de aproximación para un ejercicio compuesto, según la carga de hoy y si ya calentaste ese músculo. */
function warmupPlan(s, e, i) {
  const name = e[0], x = exInfo(name);
  if (x.t !== 'c' || ['corporal', 'fija'].includes(x.e)) return null;
  const exs = sessionExercises(s);
  const warmed = exs.slice(0, i).some(p => exInfo(p[0]).g === x.g && DB.lifts.some(l => l.sid === s.id && l.ex === p[0]));
  const u = unitFor(name), st = exStory(name, e[2], s.id), target = st && st.next && st.next.a.w ? st.next.a.w : null;
  if (!target) return { sets: null, why: warmed ? 'Ya calentaste este músculo: 1 serie ligera para sentir el movimiento.' : 'Primera vez: 1–2 series ligeras de 8–10 para encontrar tu peso.' };
  const heavy = toKg(target, u) >= 60 || repRange(e[2])[0] <= 6, step = stepFor(name, u);
  const plan = warmed ? [[0.6, 3]] : heavy ? [[0.4, 8], [0.6, 5], [0.8, 2]] : [[0.5, 8], [0.75, 4]];
  return { u, target, sets: plan.map(([p, r]) => [Math.max(step, roundTo(target * p, step)), r]),
    why: warmed ? `Ya calentaste ${(GROUPS[x.g] || x.g).toLowerCase()} con el ejercicio anterior: solo 1 serie de ajuste.` : heavy ? 'Es compuesto y pesado: 3 series subiendo la carga, con pocas reps para no cansarte.' : 'Compuesto con carga moderada: 2 series de aproximación.' };
}
function warmupHtml(s, e, i) {
  const done = DB.lifts.some(l => l.sid === s.id && l.ex === e[0]);
  if (done) return '';
  const w = warmupPlan(s, e, i); if (!w) return '';
  const ok = (s.warm && s.warm[i]) || [];
  return `<div class="warm"><div class="warm-h">${ico('flame', 16)}<b>Calentamiento</b><small>no cuenta como serie</small></div>
    <p class="small muted" style="margin:4px 0 8px">${esc(w.why)}${w.sets ? ` Objetivo de hoy: ${w.target} ${w.u}.` : ''}</p>
    ${w.sets ? `<div class="warm-sets">${w.sets.map(([kg, r], k) => `<button class="ws ${ok.includes(k) ? 'on' : ''}" data-warm="${i}|${k}">${ok.includes(k) ? ico('check', 14) : ''}${kg} ${w.u} × ${r}</button>`).join('')}</div>` : ''}
  </div>`;
}
/** Pregunta breve al empezar: ¿alguna molestia hoy? */
function painAskCard(s) {
  if (s.painAsked && !(s.pain && s.pain.length)) return '';
  if (s.pain && s.pain.length) {
    const hit = sessionExercises(s).filter(e => limitsFor(e[0], s.pain).length).length;
    return `<div class="card pain-card"><b>Hoy cuidas: ${s.pain.map(k => LIMITS[k].name.toLowerCase()).join(', ')}</b>
      <p class="small" style="margin:4px 0 8px">${hit ? `${hit} ejercicio${hit > 1 ? 's la cargan' : ' la carga'}. Calienta más ligero y usa un rango sin dolor; si duele, toca "Me duele" o ⇄.` : 'Ningún ejercicio de hoy la carga directamente. Si algo duele, para.'}</p>
      ${hit ? '<button class="secondary block" id="pa-swap">Cambiar los que la cargan</button>' : ''}<button class="ghost block" id="pa-clear" style="margin-top:6px">Ya no me molesta</button></div>`;
  }
  return `<div class="card pain-card"><b>¿Alguna molestia hoy?</b>
    <div class="chips" style="margin-top:8px"><button class="chip-btn" id="pa-no">No, todo bien</button>${Object.keys(LIMITS).filter(k => k !== 'impacto').map(k => `<button class="chip-btn" data-pa="${k}">${esc(LIMITS[k].name)}</button>`).join('')}</div></div>`;
}
function painNote(s, name) {
  const z = s.pain ? limitsFor(name, s.pain) : [];
  return z.length ? `<div class="adapt-note warn">${ico('bandage', 15, 'lead')}Hoy cuidas tu ${z.map(k => LIMITS[k].name.toLowerCase()).join(' y ')}: empieza ligero y en un rango sin dolor.</div>` : '';
}
/** Enlaces de la sesión para calentamiento y molestias (se llama al pintar la sesión). */
function bindSessionExtras(s) {
  const v = $('#view-train'), rr = () => keepScroll(() => renderSession(s));
  $$('[data-warm]', v).forEach(b => b.onclick = () => {
    const [i, k] = b.dataset.warm.split('|').map(Number); s.warm = s.warm || {}; const a = s.warm[i] = s.warm[i] || [];
    const j = a.indexOf(k); if (j >= 0) a.splice(j, 1); else { a.push(k); vibrate(20); } saveData(); rr();
  });
  const no = $('#pa-no', v); if (no) no.onclick = () => { s.painAsked = true; saveData(); rr(); };
  $$('[data-pa]', v).forEach(b => b.onclick = () => { s.painAsked = true; s.pain = (s.pain || []).concat(b.dataset.pa); saveData(); rr(); });
  const cl = $('#pa-clear', v); if (cl) cl.onclick = () => { s.pain = []; saveData(); rr(); };
  const sw = $('#pa-swap', v); if (sw) sw.onclick = () => {
    const exs = sessionExercises(s), used = exs.map(e => e[0]); let n = 0;
    exs.forEach((e, i) => {
      const z = limitsFor(e[0], s.pain); if (!z.length) return;
      const comp = exInfo(e[0]).t === 'c', cands = smartSubs(e[0]).filter(c => !limitsFor(c, s.pain).length && !used.includes(c) && okForMe(c));
      const alt = cands.find(c => !comp || EX[c].t === 'c') || cands[0];   // un compuesto se cambia por otro compuesto
      if (alt) { s.swaps = s.swaps || {}; s.adapt = s.adapt || {}; s.swaps[i] = alt; s.adapt[i] = 'En vez de ' + e[0] + ' (hoy cuidas tu ' + z.map(k => LIMITS[k].name.toLowerCase()).join(' y ') + ')'; used.push(alt); n++; }
    });
    saveData(); rr(); toast(n ? `${n} ejercicio${n > 1 ? 's cambiados' : ' cambiado'}` : 'No encontré sustitutos que no la carguen');
  };
}
