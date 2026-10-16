'use strict';
/* Mi Progreso 20.0 · Los datos se convierten en decisiones.
   - Cada ejercicio responde tres cosas: esto hiciste, esto has mejorado y este es tu siguiente objetivo.
   - El primer entreno es guiado: qué ejercicio toca, cómo se hace, cuánto descansar y cuándo terminaste.
   - En días de descanso la misión es recuperar, no ir al gimnasio.
   - La pantalla final explica el resultado y el siguiente paso, con recompensas discretas.
   - Medición local (sin internet) para validar con personas reales si entienden la app y vuelven. */

/* ------------------------------------------------------------------ *
 *  Historial por ejercicio → decisión
 * ------------------------------------------------------------------ */
const topSet = sets => sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a);
const setTxt = (s, u) => s.w ? `${wFmt(s.w, u)} × ${s.r}` : `${s.r} reps`;

/** Rango de repeticiones de un ejercicio según tu plan (o su ficha). */
function repsFor(ex) {
  for (const w of DB.workouts || []) { const e = (w.ex || []).find(x => x[0] === ex); if (e) return e[2]; }
  for (const d of getRoutine(DB.profile.routine).days || []) { const e = (d.ex || []).find(x => x[0] === ex); if (e) return e[2]; }
  const m = typeof EX_META === 'object' && EX_META[ex];
  return m ? m.reps : exInfo(ex).t === 'c' ? '8–12' : '10–15';
}
/** Sesiones de un ejercicio (una entrada por entreno), de la más antigua a la más reciente. */
function exSessions(ex, excludeSid) {
  const by = {};
  DB.lifts.forEach(l => {
    if (l.ex !== ex || (excludeSid && l.sid === excludeSid)) return;
    const k = l.sid || l.date, x = by[k] || (by[k] = { date: l.date, t: Infinity, sets: [] });
    x.sets.push(l); x.t = Math.min(x.t, l.t || 0);
  });
  return Object.values(by).map(x => {
    const top = topSet(x.sets);
    return Object.assign(x, { top, best: e1rm(top.w, top.r), bw: x.sets.every(s => !s.w) });
  }).sort((a, b) => a.t - b.t);
}
/**
 * La historia de un ejercicio: qué hiciste la última vez, cuánto has mejorado desde el inicio
 * y cuál es tu siguiente objetivo (sobrecarga progresiva con tu RIR).
 */
function exStory(ex, repsText, excludeSid) {
  const h = exSessions(ex, excludeSid);
  if (!h.length) return null;
  const u = unitFor(ex), first = h[0], last = h[h.length - 1], bw = first.bw && last.bw;
  const val = x => bw ? x.top.r : x.best;
  const bestEver = h.reduce((a, b) => val(b) > val(a) ? b : a);
  const pct = h.length > 1 && val(first) ? (val(last) / val(first) - 1) * 100 : null;
  const did = `${last.sets.length} serie${last.sets.length > 1 ? 's' : ''} · mejor ${setTxt(last.top, u)}`;
  let improved, trend;
  if (h.length < 2) { improved = 'Punto de partida: desde aquí se mide tu progreso.'; trend = 'start'; }
  else if (pct > 1) { improved = `${bw ? '+' + (last.top.r - first.top.r) + ' reps' : '+' + Math.round(pct) + ' % de fuerza'} desde el ${shortDate(first.date)} (${setTxt(first.top, u)} → ${setTxt(last.top, u)})`; trend = 'up'; }
  else if (val(last) < val(bestEver) * 0.97) { improved = `Tu mejor marca sigue siendo ${setTxt(bestEver.top, u)} (${shortDate(bestEver.date)}). Un día bajo no borra tu tendencia.`; trend = 'down'; }
  else { improved = `Estable en ${setTxt(last.top, u)}: estás consolidando la técnica.`; trend = 'flat'; }
  const reps = repsText || repsFor(ex), sug = suggestion(ex, reps, excludeSid || null);
  let next = null, why = '';
  if (bw) { const hi = repRange(reps)[1], r = Math.min(hi + 5, last.top.r + 1); next = { a: { w: 0, r }, b: null, txt: `${r} reps` }; why = r > hi ? 'Ya dominas el rango: prueba una variante más difícil o añade peso.' : 'Una rep más que la última vez.'; }
  else if (sug) { next = { a: sug.a, b: sug.b, txt: `${sug.a.w} ${u} × ${sug.a.r}`, alt: sug.b ? `${sug.b.w} ${u} × ${sug.b.r}` : '' }; why = sug.why; }
  if (next && !bw && stalled(ex)) why = coachFor(ex, reps).text;
  return { ex, u, h, first, last, pct, trend, did, improved, next, why, bw };
}
/** Bloque "Esto hiciste · Has mejorado · Siguiente objetivo". */
function storyHtml(st) {
  if (!st) return '';
  const k2 = st.trend === 'up' ? 'Has mejorado' : st.trend === 'start' ? 'Tu inicio' : 'Tu progreso';
  return `<div class="story">
    <div class="st-row"><span class="st-k">Esto hiciste</span><span>${esc(shortDate(st.last.date))} · ${esc(st.did)}</span></div>
    <div class="st-row ${st.trend}"><span class="st-k">${k2}</span><span>${esc(st.improved)}</span></div>
    ${st.next ? `<div class="st-row next"><span class="st-k">Siguiente objetivo</span><span><b>${esc(st.next.txt)}</b>${st.next.alt ? `<small>o ${esc(st.next.alt)}</small>` : ''}<small>${esc(st.why)}</small></span></div>` : ''}
  </div>`;
}
/** La mejora más clara en cualquier ejercicio (para "Tu camino" y el resumen). */
function bestImprovement() {
  let best = null;
  trainedExercises().forEach(ex => {
    const st = exStory(ex);
    if (st && st.trend === 'up' && (!best || st.pct > best.pct)) best = { ex, pct: st.pct, txt: `${ex}: ${setTxt(st.first.top, st.u)} → ${setTxt(st.last.top, st.u)}${st.bw ? '' : ` (+${Math.round(st.pct)} %)`}` };
  });
  return best;
}
/** El objetivo concreto de hoy en el ejercicio principal del día. */
function keyTarget(nd) {
  if (!nd || !nd.ex) return null;
  for (const e of nd.ex) { const st = exStory(e[0], e[2]); if (st && st.next) return { ex: e[0], st }; }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Días: próximo entreno y misión de descanso
 * ------------------------------------------------------------------ */
/** Siguiente día con entreno a partir de mañana (o de hoy si includeToday). */
function nextWorkoutDay(includeToday) {
  const p = DB.profile, r = getRoutine(p.routine);
  if (p.routine === 'custom') {
    const t = weekdayIdx(todayStr());
    for (let k = includeToday ? 0 : 1; k <= 7; k++) {
      const d = r.days[(t + k) % 7];
      if (d && !d.rest && d.ex.length) return { k, label: k === 0 ? 'Hoy' : k === 1 ? 'Mañana' : WEEKDAYS[(t + k) % 7], name: d.name.split('·').pop().trim(), n: d.ex.length, day: d };
    }
    return null;
  }
  if (!r.days.length) return null;
  const nd = nextDay(p.routine), i0 = Math.max(0, r.days.findIndex(d => d.id === (nd && nd.id)));
  for (let k = 0; k < r.days.length; k++) {
    const d = r.days[(i0 + k) % r.days.length];
    if (!d.rest && d.ex.length) return { k: k + (includeToday ? 0 : 1), label: k === 0 && includeToday ? 'Hoy' : 'Tu siguiente sesión', name: d.name.split('·').pop().trim(), n: d.ex.length, day: d };
  }
  return null;
}
const RECOV = [['walk', 'footprints', 'Camina 20–30 min', 'Mueve la sangre sin cansarte'], ['mob', 'person-standing', 'Movilidad 10 min', 'Cadera, hombros y espalda'], ['sleep', 'moon', 'Duerme 7–9 h', 'Aquí se construye el músculo']];
/** Misión de un día de descanso: recuperar (y, si aún no entrenas, preparar tu primer entreno). */
function restHero() {
  const t = todayStr(), rc = (DB.days[t] && DB.days[t].recov) || {}, nx = nextWorkoutDay(false), first = !doneSessions();
  const items = (first ? [['prep', 'book-open', 'Mira tus ejercicios', '2 min: cómo se hace cada uno']] : []).concat(RECOV);
  const all = items.every(x => rc[x[0]]);
  return `<div class="hero mission rest-mission"><div class="m-body">
    <div class="eyebrow">${first ? 'Antes de tu primer entreno' : 'Hoy toca recuperar'}</div>
    <h3>${first ? 'Prepárate' : 'Descanso activo'}</h3>
    <p>${nx ? `${first ? 'Tu primer entreno' : 'Tu próximo entreno'}: <b>${esc(nx.label)} · ${esc(nx.name)}</b>. ` : ''}${first ? 'Hoy no te toca gimnasio: deja todo listo.' : 'Hoy tu cuerpo se adapta a lo que entrenaste.'}</p>
    <div class="recov">${items.map(([k, i, tt, sub]) => `<button class="rv ${rc[k] ? 'on' : ''}" data-recov="${k}">${ico(rc[k] ? 'check' : i, 18)}<span><b>${tt}</b><small>${sub}</small></span></button>`).join('')}</div>
    ${all ? `<div class="m-out">${ico('check', 16)}<span>Recuperación hecha. ${nx ? 'Llegas con energía a tu siguiente entreno.' : ''}</span></div>` : `<button id="home-recov">${ico('check', 18)} ${first ? 'Listo, ya estoy preparado' : 'Marcar recuperación hecha'}</button>`}
    ${nx ? `<button class="ghost m-alt" id="home-anyway">${first ? 'Prefiero empezar hoy' : 'Entrenar hoy de todos modos'}</button>` : ''}
  </div></div>`;
}
function bindRestHero(root, rerender) {
  const t = todayStr(), nx = nextWorkoutDay(false);
  const set = (k, v) => { const d = day(t); d.recov = d.recov || {}; d.recov[k] = v; saveData(); };
  $$('[data-recov]', root).forEach(b => b.onclick = () => {
    const k = b.dataset.recov;
    if (k === 'prep' && nx) { set('prep', true); rerender(); openRoutineDay(DB.profile.routine === 'custom' ? nx.day.id.slice(1) : nx.day.id); return; }
    const d = DB.days[t]; set(k, !(d && d.recov && d.recov[k])); rerender();
  });
  const all = $('#home-recov', root);
  if (all) all.onclick = () => { [['prep'], ...RECOV].forEach(x => set(x[0], true)); track('rest_done'); vibrate(30); rerender(); };
  const any = $('#home-anyway', root);
  if (any) any.onclick = () => { if (!nx) return; startSession(DB.profile.routine, nx.day.id); showTab('train'); };
}

/* ------------------------------------------------------------------ *
 *  Primer entreno guiado (experiencia principiante)
 * ------------------------------------------------------------------ */
/** Instrucciones cortas para leer de un vistazo en la sesión. */
function howSteps(name) {
  const meta = typeof EX_META === 'object' && EX_META[name], h = HOWTO_EX[name] || HOWTO[exInfo(name).p];
  if (meta && !meta.existing) return { steps: [meta.desc].concat(meta.tip ? [meta.tip] : []), avoid: '' };
  if (h) return { steps: h[0].slice(0, 3), avoid: h[1] };
  return { steps: ['Controla la bajada (2 s) y sube con fuerza.', 'Rango completo sin dolor.', 'Respira: suelta el aire al hacer fuerza.'], avoid: '' };
}
const EFFORT = [[4, 'Fácil', 'Me sobraban 4 o más'], [2, 'Bien', 'Me sobraban 2–3'], [0, 'Al límite', 'No podía otra']];
function guidedCard(s, e, i) {
  const [name, sets, reps, rest] = e, u = unitFor(name), info = exInfo(name);
  const done = DB.lifts.filter(l => l.sid === s.id && l.ex === name).sort((a, b) => a.t - b.t);
  const complete = done.length >= sets, open = SESS_UI.open === i;
  const head = `<div class="ex-head g-head" data-open="${i}"><span class="g-num ${complete ? 'ok' : ''}">${complete ? ico('check', 16) : i + 1}</span>
      <div class="grow"><h4>${esc(name)}</h4><div class="ex-meta">${sets} series × ${esc(reps)}${/^[\d\s–\-,/]+$/.test(reps) ? ' reps' : ''} · descanso ${mmss(rest || 90)}</div></div>
      <b class="g-count">${Math.min(done.length, sets)}/${sets}</b></div>`;
  if (!open) return `<div class="ex-card guided ${complete ? 'done' : ''}" data-card="${i}">${head}</div>`;
  const st = exStory(name, reps, s.id), id = EX_PHOTO[name], how = howSteps(name), [lo, hi] = repRange(reps);
  const lastSet = done[done.length - 1], bodyweight = ['corporal', 'fija'].includes(info.e);
  const preW = lastSet ? roundTo(fromKg(lastSet.w, u), u === 'lb' ? 1 : 0.5) : st && st.next ? st.next.a.w : bodyweight ? 0 : '';
  const preR = lastSet ? lastSet.r : st && st.next ? st.next.a.r : hi;
  const rir = SESS_UI.rir[i] != null ? SESS_UI.rir[i] : lastSet && lastSet.rir != null ? lastSet.rir : 2;
  const eff = rir >= 4 ? 4 : rir >= 2 ? 2 : 0;
  return `<div class="ex-card guided open" data-card="${i}">${head}<div class="ex-body">
    ${id ? `<button class="g-photo" data-howto="${esc(name)}" aria-label="Ver la técnica completa"><img src="img/ex/${id}-0.jpg" alt=""><img src="img/ex/${id}-1.jpg" alt="" class="b"></button>` : ''}
    ${typeof coachTip === 'function' ? coachTip(s, name, i) : ''}
    <div class="g-how"><b>Cómo se hace</b><ol>${how.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>${how.avoid ? `<p><b>Evita:</b> ${esc(how.avoid)}</p>` : ''}</div>
    <div class="g-goal">${ico('target', 18)}<span>${st && st.next
      ? `<b>Tu objetivo: ${esc(st.next.txt)}</b><small>La última vez: ${esc(setTxt(st.last.top, u))}. ${esc(st.why)}</small>`
      : `<b>${bodyweight ? `Haz ${lo}–${hi} reps con buena técnica` : `Elige un peso con el que hagas ${hi} reps y te sobren 2–3`}</b><small>Si dudas, empieza ligero. Hoy mides tu punto de partida; después la app te dice cuánto subir.</small>`}</span></div>
    ${done.length ? `<div class="done-sets">${done.map((d, k) => `<span class="set-chip" data-edit="${d.id}">${k + 1}. <b>${wFmt(d.w, u)} × ${d.r}</b></span>`).join('')}</div>` : ''}
    <div class="g-step">${complete ? `${ico('check', 16)} Ejercicio completado. Pasa al siguiente o haz una serie extra.` : `Serie ${done.length + 1} de ${sets}: hazla y anota lo que lograste`}</div>
    ${typeof painNote === 'function' ? painNote(s, name) : ''}
    ${typeof warmupHtml === 'function' ? warmupHtml(s, e, i) : ''}
    <div class="steppers">
      <div class="stepper"><div class="s-label">${bodyweight ? 'Peso extra' : 'Peso'} <button class="unit-toggle" data-unit="${i}">${u} ⇄</button></div>
        <div class="s-row"><button data-step="${i}|w|-1">−</button><input id="w-${i}" inputmode="decimal" value="${preW}" placeholder="0"><button data-step="${i}|w|1">+</button></div></div>
      <div class="stepper"><div class="s-label">Repeticiones</div>
        <div class="s-row"><button data-step="${i}|r|-1">−</button><input id="r-${i}" inputmode="numeric" value="${preR}" placeholder="0"><button data-step="${i}|r|1">+</button></div></div>
    </div>
    <div class="rir-label"><span>¿Cómo se sintió?</span></div>
    <div class="eff-row">${EFFORT.map(([v, l, sub]) => `<button data-rir="${i}|${v}" class="${v === eff ? 'on' : ''}"><b>${l}</b><small>${sub}</small></button>`).join('')}</div>
    <button class="block save-set" data-log="${i}" id="save-${i}">${saveLabel(preW, preR, u, 1)}</button>
    <p class="g-rest">${ico('timer', 14)}<span>Al guardar empieza tu descanso de ${mmss(rest || 90)}. Cuando suene, haz la siguiente serie.</span></p>
    <div class="ex-tools"><button class="secondary small-btn" data-swap="${i}">⇄ Máquina ocupada</button><button class="secondary small-btn" data-pain="${i}">Me duele</button>${done.length ? `<button class="secondary small-btn" data-undo="${i}">↶ Borrar última serie</button>` : ''}</div>
  </div></div>`;
}

/* ------------------------------------------------------------------ *
 *  Pantalla final: el logro, lo que mejoraste y el siguiente paso
 * ------------------------------------------------------------------ */
function openSessionSummary(s) {
  const sets = DB.lifts.filter(l => l.sid === s.id), exs = Array.from(new Set(sets.map(l => l.ex)));
  const prs = DB.achievements.filter(a => a.pr && sets.some(l => a.id.startsWith('pr-' + l.id)));
  const first = doneSessions() === 1, mins = Math.max(1, Math.round((s.end - s.start) / 60000)), planned = sessionExercises(s);
  const stories = exs.map(ex => { const e = planned.find(x => x[0] === ex); return exStory(ex, e ? e[2] : repsFor(ex)); }).filter(Boolean);
  let up = 0;
  const rows = stories.map(st => {
    const prev = st.h.length > 1 ? st.h[st.h.length - 2] : null, val = x => st.bw ? x.top.r : x.best;
    const d = prev && val(prev) ? (val(st.last) / val(prev) - 1) * 100 : null;
    if (d > 1) up++;
    const tag = !prev ? 'Inicio' : d > 1 ? (st.bw ? `+${st.last.top.r - prev.top.r} reps` : `+${Math.round(d)} %`) : d < -3 ? 'Día bajo' : 'Igual';
    return `<div class="rs-row"><span class="grow"><b>${esc(st.ex)}</b><small>${esc(setTxt(st.last.top, st.u))}${prev ? ' · antes ' + esc(setTxt(prev.top, st.u)) : ` · ${st.last.sets.length} series`}</small></span><span class="rs-tag ${!prev ? 'start' : d > 1 ? 'up' : d < -3 ? 'down' : ''}">${tag}</span></div>`;
  }).join('');
  const nx = nextWorkoutDay(false), goals = stories.filter(st => st.next).slice(0, 3);
  const ps = pathState(), stageDone = s.pathBefore != null && ps.doneN > s.pathBefore ? PATH[ps.doneN - 1] : null;
  const head = first ? 'Primer entreno completado' : prs.length ? 'Superaste tu marca' : up ? 'Mejoraste respecto a la última vez' : s.adjust ? 'Entrenaste con inteligencia' : 'Entreno completado';
  const sub = first ? `Ya tienes tu punto de partida en ${exs.length} ejercicio${exs.length > 1 ? 's' : ''}. Desde hoy, cada entreno se compara con este.`
    : prs.length ? `${prs.length} récord${prs.length > 1 ? 's' : ''} nuevo${prs.length > 1 ? 's' : ''}: tu fuerza está subiendo.`
      : up ? `Subiste en ${up} de ${stories.length} ejercicios.` : s.adjust ? 'Ajustaste por cansancio: recuperar también es progreso.' : 'Constancia: es lo que construye resultados.';
  const askFb = (DB.feedback || []).filter(f => f.q === 'claro').length < 3;
  const vol = sessionVolume(s.id);
  openModal(`<div class="rs">
    <div class="rs-head">${ico(prs.length || stageDone ? 'award' : 'check', 26)}<div><h3>${head}</h3><p>${esc(sub)}</p></div></div>
    <div class="rs-stats"><div><b>${mins}</b><small>min</small></div><div><b>${sets.length}</b><small>series</small></div><div><b>${exs.length}</b><small>ejercicios</small></div>${isBeginner() ? '' : `<div><b>${Math.round(vol).toLocaleString('es-MX')}</b><small>kg de volumen</small></div>`}</div>
    ${stageDone ? `<div class="rs-stage"><small>Etapa completada · ${esc(stageDone.t)}</small><b>${esc(stageDone.proof())}</b>${ps.cur ? `<span>Siguiente etapa: <b>${esc(ps.cur.t)}</b> · ${esc(stageGoal(ps.cur))}</span>` : '<span>Completaste las 4 etapas del camino.</span>'}</div>` : ''}
    <h4 class="rs-h">${first ? 'Esto hiciste' : 'Esto hiciste y esto cambió'}</h4>
    ${rows}
    <h4 class="rs-h">Tu siguiente objetivo</h4>
    ${nx ? `<div class="rs-when">${ico('calendar', 18)}<span><b>${esc(nx.label)} · ${esc(nx.name)}</b><small>${nx.n} ejercicios${nx.k === 1 ? ' · si llegas cansado, al empezar baja un poco el peso' : ''}</small></span></div>` : ''}
    ${goals.map(st => `<div class="rs-next"><span class="grow">${esc(st.ex)}</span><b>${esc(st.next.txt)}</b></div>`).join('')}
    ${goals.length ? '<p class="small muted" style="margin:6px 0 0">Ya ajusté estos objetivos con lo que registraste hoy. Los verás al empezar.</p>' : ''}
    ${askFb ? `<div class="rs-fb"><b>¿Supiste qué hacer en cada paso?</b><div class="seg">${[['si', 'Sí'], ['medio', 'Más o menos'], ['no', 'No']].map(([k, l]) => `<button data-fb="${k}">${l}</button>`).join('')}</div><div id="fb-more"></div></div>` : ''}
    ${!isBeginner() ? `<div class="small muted" style="font-weight:600;margin:12px 0 6px">¿Qué te ayudó a entrenar hoy?</div>
      <div class="chips">${Object.keys(HELPERS).map(k => `<button class="chip-btn" data-help="${k}">${HELPERS[k]}</button>`).join('')}</div>` : ''}
    <button class="block" id="sum-ok" style="margin-top:14px">Listo</button></div>`, m => {
      $$('[data-help]', m).forEach(b => b.onclick = () => { b.classList.toggle('on'); s.helped = $$('[data-help].on', m).map(x => x.dataset.help); saveData(); });
      $$('[data-fb]', m).forEach(b => b.onclick = () => {
        $$('[data-fb]', m).forEach(x => x.classList.toggle('on', x === b));
        DB.feedback = (DB.feedback || []).filter(f => !(f.q === 'claro' && f.sid === s.id));
        const f = { q: 'claro', a: b.dataset.fb, sid: s.id, n: doneSessions(), date: todayStr(), v: APP_VERSION };
        DB.feedback.push(f); track('feedback'); saveData();
        $('#fb-more', m).innerHTML = b.dataset.fb === 'si' ? '<p class="small muted" style="margin:6px 0 0">Gracias. Esto nos ayuda a mejorar la app.</p>'
          : '<textarea id="fb-note" rows="2" placeholder="¿Qué te confundió? (opcional)" style="margin-top:8px"></textarea>';
        const nt = $('#fb-note', m); if (nt) nt.oninput = () => { f.note = nt.value.slice(0, 300); saveData(); };
      });
      $('#sum-ok', m).onclick = () => { closeModal(); render(currentTab); };
    });
  if (prs.length) setTimeout(() => burst($('#modal')), 250);   // solo un récord real merece festejo
}

/* ------------------------------------------------------------------ *
 *  Validación con personas reales (todo se queda en el teléfono)
 * ------------------------------------------------------------------ */
/** Cuenta un evento de uso. No sale del teléfono salvo que la persona comparta su reporte. */
function track(ev) {
  const m = DB.metrics || (DB.metrics = { since: todayStr(), days: [], ev: {} }), t = todayStr();
  if (!m.days.includes(t)) { m.days.push(t); if (m.days.length > 180) m.days.shift(); }
  if (ev) { const e = m.ev[ev] || (m.ev[ev] = { n: 0, first: Date.now() }); e.n++; e.last = Date.now(); }
  saveData();
}
/** Reporte anónimo: sin nombre, peso, medidas, fotos ni ciclo. */
function usageReport() {
  const m = DB.metrics || { since: todayStr(), days: [], ev: {} }, p = DB.profile, ev = k => (m.ev[k] && m.ev[k].n) || 0;
  const since = m.since, back = n => m.days.some(d => d > since && daysBetween(since, d) <= n);
  const firstDone = m.ev.session_done && m.ev.session_done.first, onb = m.ev.onboarded && m.ev.onboarded.first;
  return {
    app: 'Mi Progreso', version: APP_VERSION, nivel: userLevel(), etapa: p.stage || null, dias_meta: p.weeklyTarget || null, minutos: p.minutes || null,
    desde: since, dias_con_uso: m.days.length, volvio_dia_1: back(1), volvio_semana_1: m.days.some(d => { const k = daysBetween(since, d); return k >= 2 && k <= 7; }),
    entrenos_empezados: ev('session_start'), entrenos_terminados: ev('session_done'), entrenos_cancelados: ev('session_exit'), descansos_hechos: ev('rest_done'),
    horas_hasta_primer_entreno: firstDone && onb ? Math.round((firstDone - onb) / 36e5 * 10) / 10 : null,
    etapa_del_camino: pathState().doneN,
    respuestas: (DB.feedback || []).map(f => ({ pregunta: f.q, respuesta: f.a, entreno: f.n, nota: f.note || '', version: f.v }))
  };
}
function feedbackCard() {
  const r = usageReport();
  return `<div class="card keep fb-card">
    <h2>Ayúdanos a mejorar</h2>
    <p class="small muted" style="margin-top:0">La app no envía nada por internet. Si quieres ayudar, comparte este reporte anónimo: no incluye tu nombre, peso, medidas, fotos ni ciclo.</p>
    <div class="fb-stats"><div><b>${r.dias_con_uso}</b><small>días de uso</small></div><div><b>${r.entrenos_terminados}/${r.entrenos_empezados}</b><small>entrenos terminados</small></div><div><b>${r.respuestas.length}</b><small>respuestas</small></div></div>
    <button class="secondary block" id="fb-share">${ico('file-text', 18, 'lead')}Compartir reporte anónimo</button>
  </div>`;
}
function bindFeedbackCard(root) {
  const b = $('#fb-share', root); if (!b) return;
  b.onclick = () => {
    const txt = JSON.stringify(usageReport(), null, 2), name = `miprogreso_reporte_${todayStr()}.json`;
    let uri = null;
    try { uri = saveBinary(name, 'application/json', new TextEncoder().encode(txt)); } catch (e) {}
    if (uri && bridge && bridge.shareFile) bridge.shareFile(uri, 'application/json', 'Reporte de uso de Mi Progreso');
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Reporte copiado: pégalo en un mensaje'), () => toast('Reporte descargado'));
  };
}

/* ------------------------------------------------------------------ *
 *  Ajustar la rutina a tu disponibilidad
 * ------------------------------------------------------------------ */
function openPlanTune() {
  const p = DB.profile, d = { days: String(p.weeklyTarget || 3), minutes: String(p.minutes || 45), recovery: p.recovery || 'normal' };
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-pt="${k}|${v}" class="${d[k] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const draw = m => {
    m.innerHTML = `<h3>Ajustar mi rutina</h3><p class="small muted" style="margin-top:0">La armo de nuevo con tu tiempo, tu objetivo, tu experiencia y cómo te recuperas.</p>
      <div class="rir-label"><span>Días por semana</span></div>${seg('days', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']])}
      <div class="rir-label"><span>Tiempo por sesión</span></div>${seg('minutes', [['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '60+ min']])}
      <div class="rir-label"><span>¿Cómo duermes y te recuperas?</span></div>${seg('recovery', RECOVERY_OPTS)}
      <button class="block" id="pt-ok" style="margin-top:14px">Rehacer mi rutina</button><button class="ghost block" id="pt-x" style="margin-top:6px">Cancelar</button>`;
    $$('[data-pt]', m).forEach(b => b.onclick = () => { const [k, v] = b.dataset.pt.split('|'); d[k] = v; draw(m); });
    $('#pt-x', m).onclick = closeModal;
    $('#pt-ok', m).onclick = () => {
      const old = { plan: DB.plan.slice(), workouts: DB.workouts.slice(), p: { weeklyTarget: p.weeklyTarget, trainDays: p.trainDays, minutes: p.minutes, recovery: p.recovery, routine: p.routine, planWhy: p.planWhy } };
      Object.assign(p, { weeklyTarget: Number(d.days), trainDays: DEFAULT_DAYS[Number(d.days)], minutes: Number(d.minutes), recovery: d.recovery });
      beginnerRoutine(true);
      saveData(); closeModal(); render(currentTab);
      snack('Rutina rehecha con tus datos', 'Deshacer', () => { DB.plan = old.plan; DB.workouts = old.workouts; Object.assign(p, old.p); saveData(); render(currentTab); });
    };
  };
  openModal('', draw);
}
const RECOVERY_OPTS = [['bien', 'Bien'], ['normal', 'Normal'], ['mal', 'Mal']];
