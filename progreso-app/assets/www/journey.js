/* Mi Progreso 8.0 · Tu camino: etapas, agenda flexible, modo mantenimiento, actividades,
   compromisos, lo que te funciona, misiones por ejercicio, dolor, entorno (gym/casa/hotel),
   niveles por trayectoria e historia personal. Todo local y sin castigar los descansos. */

/* ------------------------------------------------------------------ *
 *  Días activos y meta semanal (fuerza + cualquier actividad)
 * ------------------------------------------------------------------ */
const MIN_ACTIVE = 15;   // minutos de actividad para que un día cuente como activo
function isHardWeek(wk) { return (DB.hardWeeks || []).includes(wk); }
function weekTarget(wk) { const t = DB.profile.weeklyTarget || 3; return isHardWeek(wk || weekKey(todayStr())) ? Math.min(2, t) : t; }
function activeDates() {
  const set = new Set(DB.sessions.filter(s => s.end).map(s => s.date));
  (DB.activities || []).forEach(a => { if ((a.min || 0) >= MIN_ACTIVE) set.add(a.date); });
  (DB.runs || []).forEach(r => { if (r.dur >= MIN_ACTIVE * 60) set.add(r.date); });
  return set;
}
function activeDaysInWeek(wk) { const d = activeDates(); let n = 0; for (let i = 0; i < 7; i++) if (d.has(addDays(wk, i))) n++; return n; }
function activeMinutes(from, to) {
  const ses = DB.sessions.filter(s => s.end && s.date >= from && s.date <= to).reduce((a, s) => a + Math.min(180, (s.end - s.start) / 60000), 0);
  const runs = (DB.runs || []).filter(r => r.date >= from && r.date <= to).reduce((a, r) => a + r.dur / 60, 0);
  return Math.round(ses + runs + (DB.activities || []).filter(a => a.date >= from && a.date <= to).reduce((a, x) => a + (x.min || 0), 0));
}

/* ------------------------------------------------------------------ *
 *  Agenda de la semana: días planeados, mover, versión corta, semana complicada
 * ------------------------------------------------------------------ */
const DEFAULT_DAYS = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
function plannedDays() { return DB.profile.trainDays || DEFAULT_DAYS[DB.profile.weeklyTarget || 3] || [0, 2, 4]; }
/** Días de esta semana con su estado; los cambios de agenda se guardan por semana. */
function weekAgenda() {
  const wk = weekKey(todayStr()), moves = (DB.moves && DB.moves[wk]) || {}, act = activeDates(), t = todayStr();
  let days = plannedDays().map(k => (moves[k] != null ? moves[k] : k));
  if (isHardWeek(wk)) days = days.slice(0, 2);
  return Array.from(new Set(days)).sort().map(k => {
    const date = addDays(wk, k), done = act.has(date);
    return { k, date, done, today: date === t, past: date < t, moved: Object.keys(moves).some(f => moves[f] === k && Number(f) !== k) };
  });
}
function agendaCard() {
  const wk = weekKey(todayStr()), ag = weekAgenda(), hard = isHardWeek(wk), t = todayStr();
  const done = activeDaysInWeek(wk), goal = weekTarget(wk);
  const names = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const rows = ag.map(a => {
    const state = a.done ? '<span class="pill good">✓ Hecho</span>' : a.today ? '<span class="pill">Hoy</span>' : a.past ? '<span class="pill gray">Pendiente</span>' : '<span class="pill gray">Planeado</span>';
    const acts = a.done ? '' : `<div class="ag-acts">
        ${a.today ? `<button class="small-btn" data-ag-go="${a.k}">▶ Entrenar</button><button class="secondary small-btn" data-ag-short="${a.k}">⏱️ Versión 15 min</button>` : ''}
        <button class="secondary small-btn" data-ag-move="${a.k}">📅 Mover</button></div>`;
    return `<div class="ag-row ${a.today ? 'today' : ''}"><b class="ag-day">${names[a.k]}<small>${shortDate(a.date)}</small></b><div class="grow">${state}${a.moved ? ' <span class="small muted">movido</span>' : ''}${a.past && !a.done ? '<div class="small muted">Sin problema: puedes moverlo a otro día de esta semana.</div>' : ''}${acts}</div></div>`;
  }).join('');
  return `<div class="card">
    <div class="row spread"><h2 style="margin:0">Mi agenda</h2><span class="pill ${done >= goal ? 'good' : 'gray'}">${done}/${goal} días activos</span></div>
    <p class="small muted" style="margin:4px 0 8px">${hard ? '🛟 <b>Modo mantenimiento:</b> esta semana basta con 2 sesiones cortas. Sostener el hábito vale más que el plan perfecto.' : 'Si surge algo, mueve la sesión o haz la versión corta. Cambiar de agenda no es fallar.'}</p>
    ${rows || '<div class="empty">Elige tus días en Más → Constancia.</div>'}
    <div class="row" style="margin-top:10px"><button class="secondary small-btn" id="ag-hard" style="flex:1">${hard ? '✓ Volver al plan normal' : '🛟 Semana complicada'}</button><button class="secondary small-btn" id="ag-act" style="flex:1">+ Otra actividad</button></div>
  </div>`;
}
/** ¿Conviene mover o sustituir? Si hay un día libre después y es sesión de fuerza, mover; si no, versión corta o caminar. */
function moveAdvice(k) {
  const wk = weekKey(todayStr()), taken = weekAgenda().map(a => a.k), t = weekdayIdx(todayStr());
  const free = [0, 1, 2, 3, 4, 5, 6].filter(x => x >= t && x !== k && !taken.includes(x));
  return { free, wk, text: free.length ? 'Te conviene moverla: aún hay días libres esta semana y así no pierdes el estímulo.' : 'Ya no quedan días libres: mejor haz la versión de 15 minutos o una caminata de 20. Mantener el hábito es lo importante.' };
}
function bindAgenda(root, rerender) {
  $$('[data-ag-go]', root).forEach(b => b.onclick = () => { if (!activeSession()) { const nd = nextDay(DB.profile.routine); if (nd && !nd.rest) startSession(DB.profile.routine, nd.id); else startSession('libre'); } showTab('train'); });
  $$('[data-ag-short]', root).forEach(b => b.onclick = () => {
    const nd = nextDay(DB.profile.routine);
    if (nd && !nd.rest) startSession(DB.profile.routine, nd.id); else startSession('libre');
    const s = activeSession(); if (s) { s.short = true; if (s.base) s.base = s.base.slice(0, 4); saveData(); }
    showTab('train'); toast('⏱️ Versión corta: 4 ejercicios, 2 series');
  });
  $$('[data-ag-move]', root).forEach(b => b.onclick = () => {
    const k = Number(b.dataset.agMove), adv = moveAdvice(k), names = WEEKDAYS;
    openModal(`<h3>Mover la sesión del ${names[k].toLowerCase()}</h3><p class="small">${adv.text}</p>
      ${adv.free.length ? `<div class="chips">${adv.free.map(x => `<button class="chip-btn" data-mv="${x}">${names[x]}</button>`).join('')}</div>` : ''}
      <button class="secondary block" id="mv-short" style="margin-top:12px">Mejor una caminata de 20 min</button>
      <button class="ghost block" id="mv-cancel">Cancelar</button>`, m => {
      $$('[data-mv]', m).forEach(x => x.onclick = () => {
        DB.moves = DB.moves || {}; DB.moves[adv.wk] = DB.moves[adv.wk] || {}; DB.moves[adv.wk][k] = Number(x.dataset.mv);
        saveData(); closeModal(); rerender(); toast('📅 Movida al ' + names[Number(x.dataset.mv)].toLowerCase());
      });
      $('#mv-short', m).onclick = () => openActivityForm('caminar', 20);
      $('#mv-cancel', m).onclick = closeModal;
    });
  });
  const h = $('#ag-hard', root); if (h) h.onclick = () => {
    const wk = weekKey(todayStr()); DB.hardWeeks = DB.hardWeeks || [];
    DB.hardWeeks = isHardWeek(wk) ? DB.hardWeeks.filter(x => x !== wk) : DB.hardWeeks.concat(wk);
    saveData(); rerender(); toast(isHardWeek(wk) ? '🛟 Modo mantenimiento activado para esta semana' : 'Plan normal');
  };
  const a = $('#ag-act', root); if (a) a.onclick = () => openActivityForm();
}

/* ------------------------------------------------------------------ *
 *  Otras actividades: correr, caminar, bici, natación, yoga, deporte...
 * ------------------------------------------------------------------ */
function openActivityForm(type, min) {
  const enjoy = DB.profile.enjoy || [];
  const order = Object.keys(ACTIVITY_TYPES).filter(k => k !== 'fuerza').sort((a, b) => enjoy.includes(b) - enjoy.includes(a));
  const a = { type: type || order[0], min: min || 30, km: '', rpe: 5, date: todayStr() };
  const draw = m => {
    m.innerHTML = `<h3>Registrar actividad</h3>
      <div class="act-grid">${order.map(k => `<button class="${a.type === k ? 'on' : ''}" data-at="${k}"><span>${ACTIVITY_TYPES[k][0]}</span>${ACTIVITY_TYPES[k][1]}</button>`).join('')}</div>
      <div class="grid2" style="margin-top:12px">
        <label>Minutos<input id="ac-min" inputmode="numeric" value="${a.min}"></label>
        ${DISTANCE_TYPES.includes(a.type) ? `<label>Distancia (km)<input id="ac-km" inputmode="decimal" value="${a.km}" placeholder="opcional"></label>` : `<label>Fecha<input id="ac-date" type="date" value="${a.date}" max="${todayStr()}"></label>`}
      </div>
      <div class="small muted" style="font-weight:600;margin-bottom:6px">¿Qué tan intenso? <b id="ac-rpe-v">${a.rpe}</b>/10</div>
      <input type="range" id="ac-rpe" min="1" max="10" value="${a.rpe}">
      <p class="small muted" style="margin:2px 0 12px">1–3 suave (puedes platicar) · 4–6 moderado · 7–10 duro</p>
      <button class="block" id="ac-save">Guardar</button>`;
    $$('[data-at]', m).forEach(b => b.onclick = () => { a.min = num($('#ac-min', m).value) || a.min; a.type = b.dataset.at; draw(m); });
    $('#ac-rpe', m).oninput = e => { a.rpe = Number(e.target.value); $('#ac-rpe-v', m).textContent = a.rpe; };
    $('#ac-save', m).onclick = () => {
      const mins = num($('#ac-min', m).value);
      if (!mins || mins <= 0 || mins > 600) { toast('Revisa los minutos'); return; }
      const km = $('#ac-km', m) ? num($('#ac-km', m).value) : null, date = $('#ac-date', m) ? $('#ac-date', m).value || todayStr() : todayStr();
      const first = !(DB.activities || []).some(x => x.type === a.type);
      DB.activities = (DB.activities || []).concat({ id: uid(), date, type: a.type, min: Math.round(mins), km: km || null, rpe: a.rpe, t: Date.now() });
      if (first) addEvent(date, 'activity', 'Primera vez: ' + ACTIVITY_TYPES[a.type][1], ACTIVITY_TYPES[a.type][0]);
      saveData(); closeModal(); render(currentTab);
      const pace = km && a.type === 'correr' ? ' · ritmo ' + mmss(mins * 60 / km) + ' /km' : '';
      toast(`${ACTIVITY_TYPES[a.type][0]} ${Math.round(mins)} min guardados${pace}`);
    };
  };
  openModal('', draw);
}
function activitiesCard() {
  const list = (DB.activities || []).slice().sort((a, b) => b.t - a.t).slice(0, 5);
  if (!list.length) return '';
  return `<div class="card"><h2>Otras actividades</h2>${list.map(a => `<div class="list-row"><span style="font-size:22px">${ACTIVITY_TYPES[a.type][0]}</span><div class="grow"><b>${ACTIVITY_TYPES[a.type][1]}</b> · ${a.min} min${a.km ? ' · ' + fmt(a.km) + ' km' : ''}${a.km && a.type === 'correr' ? ' · ' + mmss(a.min * 60 / a.km) + ' /km' : ''}<br><small class="muted">${shortDate(a.date)} · esfuerzo ${a.rpe}/10</small></div><button class="ghost" data-act-del="${a.id}">✕</button></div>`).join('')}</div>`;
}
function bindActivities(root, rerender) {
  $$('[data-act-del]', root).forEach(b => b.onclick = () => { DB.activities = DB.activities.filter(a => a.id !== b.dataset.actDel); saveData(); rerender(); });
}

/* ------------------------------------------------------------------ *
 *  Compromisos: hábitos pequeños, medidos sin cadenas ni castigos
 * ------------------------------------------------------------------ */
function commitDone(c, d) { return !!(DB.days[d] && DB.days[d].commits && DB.days[d].commits[c.id]); }
function commitsCard() {
  const cs = DB.commits || [], t = todayStr(), last14 = Array.from({ length: 14 }, (_, i) => addDays(t, -i));
  return `<div class="card">
    <div class="row spread" style="margin-bottom:4px"><h2 style="margin:0">Mis compromisos</h2><button class="ghost" id="cm-add">+ Nuevo</button></div>
    ${cs.length ? cs.map(c => {
      const n = last14.filter(d => d >= c.created && commitDone(c, d)).length, possible = Math.min(14, daysBetween(c.created, t) + 1);
      const goal = Math.round(c.perWeek * possible / 7) || 1, pct = Math.min(100, n / goal * 100);
      return `<label class="habit"><input type="checkbox" data-cm="${c.id}" ${commitDone(c, t) ? 'checked' : ''}><span class="grow">${esc(c.title)}<br><small class="muted">${n} de los últimos ${possible} días · meta ${c.perWeek}/sem</small>
        <div class="xp"><div class="xp-track"><div class="xp-fill" style="width:${pct}%"></div></div></div></span><button class="ghost" data-cm-del="${c.id}">✕</button></label>`;
    }).join('') : '<p class="small muted" style="margin:0">Compromisos concretos y pequeños: "caminar después de comer", "5 min de movilidad al levantarme". Se mide tu consistencia, no rachas: un día perdido no borra nada.</p>'}
  </div>`;
}
function bindCommits(root, rerender) {
  const t = todayStr();
  $$('[data-cm]', root).forEach(cb => cb.onchange = () => { const e = day(t); e.commits = e.commits || {}; e.commits[cb.dataset.cm] = cb.checked; saveData(); vibrate(15); rerender(); });
  $$('[data-cm-del]', root).forEach(b => b.onclick = ev => { ev.preventDefault(); if (confirm('¿Quitar este compromiso?')) { DB.commits = DB.commits.filter(c => c.id !== b.dataset.cmDel); saveData(); rerender(); } });
  const add = $('#cm-add', root);
  if (add) add.onclick = () => openModal(`<h3>Nuevo compromiso</h3>
      <p class="small muted" style="margin-top:0">Elige uno pequeño y concreto. Mejor fácil y diario que perfecto y abandonado.</p>
      ${COMMIT_IDEAS.map(([x, n]) => `<button class="pick-row" data-ci="${esc(x)}|${n}"><span><b>${esc(x)}</b><br><small>${n} veces por semana</small></span></button>`).join('')}
      <label style="margin-top:8px">O escribe el tuyo<input id="ci-txt" placeholder="Ej. Estirar 5 min antes de dormir"></label>
      <label>Veces por semana<input id="ci-n" inputmode="numeric" value="5"></label>
      <button class="block" id="ci-save">Guardar</button>`, m => {
      const save = (title, n) => { DB.commits = (DB.commits || []).concat({ id: uid(), title, perWeek: Math.max(1, Math.min(7, n)), created: t }); saveData(); closeModal(); rerender(); toast('✓ Compromiso creado'); };
      $$('[data-ci]', m).forEach(b => b.onclick = () => { const [x, n] = b.dataset.ci.split('|'); save(x, Number(n)); });
      $('#ci-save', m).onclick = () => { const x = $('#ci-txt', m).value.trim(); if (!x) { toast('Escribe tu compromiso'); return; } save(x, num($('#ci-n', m).value) || 5); };
    });
}

/* ------------------------------------------------------------------ *
 *  Lo que te funciona: aprende de tus sesiones qué te ayuda a cumplir
 * ------------------------------------------------------------------ */
function whatWorks() {
  const ses = DB.sessions.filter(s => s.end);
  if (ses.length < 3) return null;
  const help = {};
  ses.forEach(s => (s.helped || []).forEach(h => { help[h] = (help[h] || 0) + 1; }));
  const slots = { manana: 0, tarde: 0, noche: 0 };
  ses.forEach(s => { const h = new Date(s.start).getHours(); slots[h < 12 ? 'manana' : h < 18 ? 'tarde' : 'noche']++; });
  const best = Object.keys(slots).sort((a, b) => slots[b] - slots[a])[0];
  return { help: Object.keys(help).sort((a, b) => help[b] - help[a]).slice(0, 3).map(k => [k, help[k]]), best, slots, n: ses.length };
}
function whatWorksCard() {
  const w = whatWorks(), bar = DB.profile.barriers || [];
  if (!w && !bar.length) return '';
  const slotName = { manana: 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' };
  return `<div class="card">
    <h2>Lo que te funciona</h2>
    ${w ? `<p class="small" style="margin-top:0">El ${Math.round(w.slots[w.best] / w.n * 100)} % de tus entrenos los haces <b>${slotName[w.best]}</b>: agenda ahí tus sesiones clave.</p>
      ${w.help.length ? `<div class="chips">${w.help.map(([k, n]) => `<span class="chip ok">${HELPERS[k]} · ${n}</span>`).join('')}</div><p class="small muted" style="margin:6px 0 0">Esto es lo que más te ha ayudado a cumplir. Repítelo a propósito.</p>` : '<p class="small muted" style="margin:0">Al terminar cada entreno dime qué te ayudó y aquí aprenderé tu fórmula.</p>'}` : ''}
    ${bar.length ? `<div class="small muted" style="font-weight:600;margin:10px 0 4px">Para lo que te frena</div>${bar.map(b => BARRIERS[b] ? `<div class="small" style="margin:4px 0">${BARRIERS[b][0]} <b>${BARRIERS[b][1]}:</b> ${esc(BARRIERS[b][2])}</div>` : '').join('')}` : ''}
  </div>`;
}

/* ------------------------------------------------------------------ *
 *  Etapas del camino
 * ------------------------------------------------------------------ */
function stage() { return DB.profile.stage || 2; }
/** ¿Ya cumple lo necesario para pasar a la siguiente etapa? (la app sugiere, tú decides). */
function stageReady() {
  const st = stage(), wk = weekKey(todayStr());
  const weeks = n => Array.from({ length: n }, (_, i) => addDays(wk, -7 * (i + 1)));
  if (st === 1) return weeks(2).every(w => activeDaysInWeek(w) >= 2);
  if (st === 2) return weeks(8).filter(w => activeDaysInWeek(w) >= weekTarget(w) || isHardWeek(w)).length >= 6;
  if (st === 3) return weeks(26).filter(w => activeDaysInWeek(w) >= Math.min(2, weekTarget(w))).length >= 22;
  return false;
}
function stageCard() {
  const st = stage(), S = STAGES[st], ready = stageReady();
  return `<div class="card stage-card ${ready ? 'open' : ''}" data-fold-title="Tu camino" data-fold-sum="Etapa ${st} de 4 · ${S.name}" data-fold-ico="${S.ico}" data-fold-badge="${ready ? '¡Listo para subir!' : ''}" data-fold-keep-head="1">
    <div class="stage-steps">${[1, 2, 3, 4].map(k => `<span class="${k < st ? 'past' : k === st ? 'on' : ''}">${STAGES[k].ico}</span>`).join('<i></i>')}</div>
    <div class="small muted" style="margin-top:8px">Etapa ${st} de 4</div>
    <h3 style="margin:0">${S.ico} ${S.name}</h3>
    <p class="small" style="margin:4px 0 0">${esc(S.goal)}</p>
    ${S.next ? `<p class="small muted" style="margin:6px 0 0">Siguiente paso: ${esc(S.next)}</p>` : ''}
    ${ready ? `<div class="status good"><b>¡Estás listo para la etapa ${st + 1}: ${STAGES[st + 1].name}!</b>Tus datos lo muestran. ¿Subimos?<div class="row" style="margin-top:8px"><button class="small-btn" id="st-up">Sí, subir</button><button class="secondary small-btn" id="st-stay">Todavía no</button></div></div>` : ''}
    ${st === 4 ? tryNewHtml() : ''}
  </div>`;
}
function tryNewHtml() {
  const recent = new Set((DB.activities || []).filter(a => a.date >= addDays(todayStr(), -30)).map(a => a.type));
  const opts = Object.keys(ACTIVITY_TYPES).filter(k => k !== 'fuerza' && !recent.has(k));
  if (!opts.length) return '';
  const k = opts[Math.floor(daysBetween('2026-01-01', todayStr()) / 7) % opts.length];
  return `<p class="small" style="margin:8px 0 0">🧭 Esta semana prueba algo distinto: <b>${ACTIVITY_TYPES[k][0]} ${ACTIVITY_TYPES[k][1]}</b>. Variar protege tus articulaciones y mantiene el gusto por moverte.</p>`;
}
function bindStage(root, rerender) {
  const up = $('#st-up', root);
  if (up) up.onclick = () => { const n = stage() + 1; DB.profile.stage = n; addEvent(todayStr(), 'stage', 'Subiste a la etapa ' + n + ': ' + STAGES[n].name, STAGES[n].ico); saveData(); rerender(); burst($('.stage-card', root)); };
  const stay = $('#st-stay', root); if (stay) stay.onclick = () => { DB.profile.stageSnooze = todayStr(); saveData(); rerender(); };
}
/** Etapa 1: una sola misión pequeña para hoy, en vez de un plan intimidante. */
function starterHero() {
  const ideas = [['🚶', 'Camina 10 minutos', 'caminar', 10], ['🧎', '5 minutos de movilidad', 'movilidad', 5], ['🏠', 'Tu rutina de 20 min en casa', null, 20]];
  const doneToday = activeDates().has(todayStr()) || (DB.activities || []).some(a => a.date === todayStr());
  const i = daysBetween('2026-01-01', todayStr()) % 3, x = ideas[i];
  return `<div class="hero"><div class="eyebrow">🌱 Tu misión de hoy</div><h3>${x[0]} ${x[1]}</h3>
    <p>${doneToday ? '¡Hecho! Cada día que te mueves es un voto por la persona que quieres ser.' : 'Pequeño a propósito: lo importante es empezar y sentirte bien.'}</p>
    ${doneToday ? '' : x[2] ? `<button id="st-mini" data-type="${x[2]}" data-min="${x[3]}">Lo hice ✓</button>` : '<button id="st-home">Empezar (20 min)</button>'}</div>`;
}
function bindStarter(root) {
  const b = $('#st-mini', root); if (b) b.onclick = () => { DB.activities = (DB.activities || []).concat({ id: uid(), date: todayStr(), type: b.dataset.type, min: Math.max(MIN_ACTIVE, Number(b.dataset.min)), rpe: 3, t: Date.now() }); saveData(); renderHome(); toast('🌱 ¡Bien! Un paso más'); };
  const h = $('#st-home', root); if (h) h.onclick = () => { const r = ROUTINES.inicio; startSession('inicio', (nextDay('inicio') || r.days[0]).id); showTab('train'); };
}

/* ------------------------------------------------------------------ *
 *  Entorno: gym, casa u hotel sin romper la continuidad del plan
 * ------------------------------------------------------------------ */
const ENVS = { gym: ['🏋️', 'Gym'], casa: ['🏠', 'Casa'], hotel: ['🧳', 'Hotel'] };
function envEquip(env) { return env === 'casa' ? GYM_PRESETS.casa.equip : env === 'hotel' ? GYM_PRESETS.nada.equip : null; }
/** Vuelve a adaptar los ejercicios de la sesión al entorno elegido. */
function setSessionEnv(s, env) {
  s.env = env === 'gym' ? null : env;
  // En un hotel casi no hay equipo: se usa una sesión completa con tu peso en vez de cambiar uno por uno.
  if (env === 'hotel') { s.origBase = s.origBase || s.base || []; s.base = HOTEL_SESSION.map(e => e.slice()); s.swaps = {}; s.adapt = {}; s.sets = {}; }
  else if (s.origBase) { s.base = s.origBase; delete s.origBase; s.swaps = {}; s.adapt = {}; s.sets = {}; }
  s.swaps = s.swaps || {}; s.adapt = s.adapt || {};
  const exs = (s.base || []).concat(s.extra || []);
  const used = exs.map(e => e[0]).filter(okForMe);
  exs.forEach((e, i) => {
    if (s.adapt[i]) { delete s.swaps[i]; delete s.adapt[i]; }
    if (s.swaps[i]) return;   // cambios hechos a mano se respetan
    const a = adaptFor(e[0], used);
    if (a && a.alt) { s.swaps[i] = a.alt; s.adapt[i] = 'En vez de ' + e[0] + ' (' + a.why + ')'; used.push(a.alt); }
  });
  saveData();
}

/* ------------------------------------------------------------------ *
 *  Misiones por ejercicio y botón de dolor
 * ------------------------------------------------------------------ */
function recentPain(ex, days) { return lastDays(days || 14).reduce((n, d) => n + ((DB.days[d] && DB.days[d].pain) || []).filter(p => p.ex === ex).length, 0); }
/** La siguiente misión lógica; solo propone progresar si es apropiado y seguro. */
function missionFor(s, i, name, sets, reps) {
  s.missions = s.missions || {};
  if (s.missions[i] && s.missions[i].ex === name) { const m0 = s.missions[i]; m0.sets = sets; m0.text = m0.text.replace(/^(🎯 (?:Misión|Consolida): )\d+/, '$1' + sets); return m0; }
  const c = coachFor(name, reps), m = { ex: name, sets };
  if (recentPain(name) || (s.pain && s.pain[i])) { m.kind = 'dolor'; m.text = '🩹 Hoy sin subir carga: técnica limpia y cero dolor.'; }
  else if (s.adjust === 'modificar' || isDeload()) { m.kind = 'descarga'; m.text = '🔋 Día de descarga: series cómodas, deja 3–4 reps en reserva.'; }
  else if (!c.sug) { m.kind = 'inicio'; m.text = '🎯 Encuentra tu peso de partida: llega al rango dejando 2–3 reps en reserva.'; }
  else if (c.kind === 'estancado') { m.kind = 'consolidar'; m.w = c.sug.last.top.w; m.r = c.sug.last.top.r; m.text = `🎯 Consolida: ${sets} series de ${m.r} con ${wFmt(m.w, c.u)} y técnica perfecta. ${DB.profile.phase === 'definicion' ? 'En definición, mantener ya es ganar.' : ''}`; }
  else { m.kind = 'progreso'; m.w = toKg(c.sug.a.w, c.u); m.r = c.sug.a.r; m.text = `🎯 Misión: ${sets} series de ${m.r} con ${c.sug.a.w ? c.sug.a.w + ' ' + c.u : 'tu peso'}, manteniendo la técnica.`; }
  s.missions[i] = m; saveData();
  return m;
}
/** ¿Se cumplió la misión? Se evalúa con las series registradas de ese ejercicio. */
function missionMet(s, m) {
  if (!m || m.w == null) return null;
  const done = DB.lifts.filter(l => l.sid === s.id && l.ex === m.ex);
  return done.filter(l => l.w >= m.w - 0.05 && l.r >= m.r).length >= m.sets;
}
function openPain(s, i, name, after) {
  const prev = recentPain(name, 14);
  openModal(`<h3>🩹 ¿Te duele?</h3>
    <p class="small" style="margin-top:0"><b>Para y no lo fuerces.</b> El ardor muscular es normal; el dolor punzante, en articulación o que cambia tu movimiento, no.</p>
    ${prev ? `<div class="status warn"><b>Es la ${prev + 1}.ª vez en 2 semanas con ${esc(name)}</b>Si el dolor se repite o dura más de unos días, consulta a un fisioterapeuta o médico.</div>` : ''}
    <button class="block" data-pn="swap" style="margin-top:10px">⇄ Cambiar por otro ejercicio</button>
    <button class="secondary block" data-pn="light" style="margin-top:8px">⬇️ Seguir con menos peso, sin dolor</button>
    <button class="secondary block" data-pn="skip" style="margin-top:8px">⏭️ Saltar este ejercicio hoy</button>
    <p class="small muted">Esta app no diagnostica. Si hay dolor fuerte, hinchazón o pérdida de fuerza, busca orientación profesional.</p>`, m => {
    $$('[data-pn]', m).forEach(b => b.onclick = () => {
      const t = todayStr(), e = day(t); e.pain = (e.pain || []).concat({ ex: name, t: Date.now() });
      s.pain = s.pain || {}; s.pain[i] = true; if (s.missions) delete s.missions[i];
      const k = b.dataset.pn;
      if (k === 'skip') { s.sets = s.sets || {}; s.sets[i] = Math.max(1, DB.lifts.filter(l => l.sid === s.id && l.ex === name).length) || 1; s.skip = s.skip || {}; s.skip[i] = true; }
      saveData(); closeModal();
      if (k === 'swap') openSwap(s, i); else after();
      toast(k === 'light' ? 'Baja el peso y escucha a tu cuerpo' : k === 'skip' ? 'Saltado. Bien hecho por cuidarte' : '');
    });
  });
}

/* ------------------------------------------------------------------ *
 *  Niveles por trayectoria (constancia, marcas, misiones, variedad, etapa)
 * ------------------------------------------------------------------ */
function trajectory() {
  const wk = weekKey(todayStr()), weeks = {};
  activeDates().forEach(d => { const k = weekKey(d); weeks[k] = (weeks[k] || 0) + 1; });
  const constancy = Object.keys(weeks).filter(k => k < wk && weeks[k] >= weekTarget(k)).length;
  const prs = DB.achievements.filter(a => a.pr).length;
  const missions = DB.sessions.reduce((n, s) => n + Object.keys(s.missionOk || {}).length, 0);
  const variety = new Set((DB.activities || []).map(a => a.type)).size + (DB.lifts.length ? 1 : 0);
  const commits = (DB.commits || []).length;
  const parts = [['🗓️', 'Semanas cumplidas', constancy, 30], ['🏆', 'Récords', prs, 8], ['🎯', 'Misiones cumplidas', missions, 5], ['🧭', 'Actividades distintas', variety, 15], ['🤝', 'Compromisos activos', commits, 10], ['🌱', 'Etapa alcanzada', stage(), 20]];
  const xp = parts.reduce((a, p) => a + p[2] * p[3], 0);
  const level = Math.floor(Math.sqrt(xp / 40)) + 1, base = 40 * (level - 1) ** 2, next = 40 * level ** 2;
  return { xp, level, name: LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, level - 1)], pct: (xp - base) / (next - base) * 100, toNext: next - xp, parts };
}

/* ------------------------------------------------------------------ *
 *  Historia: línea de tiempo y tú vs tú
 * ------------------------------------------------------------------ */
function addEvent(date, type, text, ico) { DB.events = (DB.events || []).concat({ date, type, text, ico, t: Date.now() }); }
function timelineEvents() {
  const ev = (DB.events || []).slice();
  const ses = DB.sessions.filter(s => s.end).sort((a, b) => a.start - b.start);
  if (ses.length) ev.push({ date: ses[0].date, ico: '🏁', text: 'Tu primer entrenamiento: ' + ses[0].dayName });
  [10, 25, 50, 100, 200, 365].forEach(n => { if (ses[n - 1]) ev.push({ date: ses[n - 1].date, ico: '🎖️', text: n + ' entrenamientos completados' }); });
  // Marcas iniciales de tus ejercicios principales
  const main = trainedExercises().map(ex => ({ ex, n: exHistory(ex).length })).sort((a, b) => b.n - a.n).slice(0, 4);
  main.forEach(({ ex }) => { const h = exHistory(ex)[0], top = h.sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a); ev.push({ date: h.date, ico: '📍', text: `Marca inicial en ${ex}: ${wFmt(top.w, unitFor(ex))} × ${top.r}` }); });
  // Récords (el último por ejercicio) y estancamientos superados
  const seen = {};
  DB.achievements.filter(a => a.pr && a.id.endsWith('-1rm')).sort((a, b) => b.t - a.t).forEach(a => { const ex = a.title.split(' · ')[1]; if (!seen[ex]) { seen[ex] = 1; ev.push({ date: a.date, ico: '🏆', text: a.title.replace('Récord de 1RM estimado', 'Récord') + ' (' + a.detail + ')' }); } });
  trainedExercises().forEach(ex => {
    const h = exHistory(ex);
    for (let i = 4; i < h.length; i++) {
      const prev = h.slice(i - 3, i), before = h.slice(0, i - 3);
      if (!before.length) continue;
      const bestBefore = Math.max(...before.map(x => x.best)), flat = Math.max(...prev.map(x => x.best)) <= bestBefore * 1.005;
      if (flat && h[i].best > bestBefore * 1.01) { ev.push({ date: h[i].date, ico: '🔓', text: 'Rompiste el estancamiento en ' + ex }); break; }
    }
  });
  DB.achievements.filter(a => a.id.startsWith('reto-')).slice(0, 10).forEach(a => ev.push({ date: a.date, ico: '✅', text: a.title }));
  return ev.sort((a, b) => a.date < b.date ? 1 : -1);
}
function snapshotAt(date) {
  const from = addDays(date, -29);
  const sesN = DB.sessions.filter(s => s.end && s.date >= from && s.date <= date).length;
  const mins = activeMinutes(from, date);
  const w = weekAvg(date);
  const ms = DB.measures.filter(m => m.date <= date && m.waist != null).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const main = trainedExercises().map(ex => ({ ex, n: exHistory(ex).length })).sort((a, b) => b.n - a.n)[0];
  const lift = main ? Math.max(0, ...exHistory(main.ex).filter(x => x.date <= date).map(x => x.best)) : 0;
  return { sesN, mins, w: w ? w.avg : null, waist: ms ? ms.waist : null, lift, liftEx: main ? main.ex : null };
}
function renderHistory(el) {
  const tr = trajectory(), t = todayStr(), ev = timelineEvents();
  const cols = [['Hoy', t], ['Hace 1 mes', addDays(t, -30)], ['Hace 3 meses', addDays(t, -91)], ['Hace 1 año', addDays(t, -365)]];
  const snaps = cols.map(([n, d]) => [n, snapshotAt(d)]);
  const start = ev.length ? ev[ev.length - 1].date : t;
  const show = snaps.filter(([, s], i) => i === 0 || addDays(t, -[0, 30, 91, 365][i]) >= addDays(start, -1));
  const liftEx = snaps[0][1].liftEx, u = liftEx ? unitFor(liftEx) : 'kg';
  const row = (label, f) => `<tr><td>${label}</td>${show.map(([, s]) => `<td class="num">${f(s)}</td>`).join('')}</tr>`;
  el.innerHTML = `
    <div class="card level-card">
      <div class="row spread"><div><div class="small muted">Nivel ${tr.level}</div><h3 style="margin:0">${esc(tr.name)}</h3></div><div class="lvl-badge">${tr.level}</div></div>
      <div class="xp" style="margin-top:8px"><div class="xp-track"><div class="xp-fill" style="width:${tr.pct}%"></div></div><b class="xp-num">${Math.round(tr.pct)}%</b></div>
      <p class="small muted" style="margin:4px 0 8px">Tu nivel es tu trayectoria, no los días que llevas con la app. Faltan ${Math.max(0, tr.toNext)} puntos para el siguiente.</p>
      ${tr.parts.map(([ico, n, v, w]) => `<div class="why-row"><span>${ico}</span><span>${n}: <b>${v}</b></span><b class="pos">+${v * w}</b></div>`).join('')}
    </div>
    <div class="card">
      <h2>Tú vs tú</h2>
      ${show.length > 1 ? `<table><thead><tr><th></th>${show.map(([n]) => `<th class="num">${n}</th>`).join('')}</tr></thead><tbody>
        ${row('Entrenos (30 días)', s => s.sesN)}
        ${row('Minutos activos (30 d)', s => s.mins)}
        ${row('Peso (media 7 d)', s => s.w ? fmt(s.w) : '—')}
        ${row('Cintura (cm)', s => s.waist ? fmt(s.waist) : '—')}
        ${liftEx ? row(esc(liftEx.split(' ').slice(0, 2).join(' ')) + ' (1RM)', s => s.lift ? wFmt(s.lift, u) : '—') : ''}
      </tbody></table>` : '<p class="small muted" style="margin:0">En un mes podrás compararte con tu yo de hoy. La única comparación que importa.</p>'}
    </div>
    <div class="card">
      <h2>Tu historia</h2>
      ${ev.length ? `<div class="timeline">${ev.slice(0, 40).map(e => `<div class="tl-item"><span class="tl-ico">${e.ico}</span><div><b>${esc(e.text)}</b><br><small class="muted">${longDate(e.date)}</small></div></div>`).join('')}</div>` : '<div class="empty">Tu primer entrenamiento será el primer capítulo.</div>'}
    </div>`;
}

/* ------------------------------------------------------------------ *
 *  Equipo y lugares (honesto: sin comisiones ni suplementos milagro)
 * ------------------------------------------------------------------ */
function gearCard() {
  const gym = DB.profile.gym, enjoy = DB.profile.enjoy || [];
  const rel = GEAR.filter(g => (g.need === 'Entrenar en casa' && (gym === 'casa' || gym === 'nada' || enjoy.includes('casa'))) || (g.need === 'Empezar a correr' && enjoy.includes('correr')) || (g.need === 'Gimnasio' && (gym === 'pf' || gym === 'completo')) || (g.need === 'Viajes' && (DB.profile.barriers || []).includes('viajes')));
  const list = rel.length ? rel : GEAR;
  return `<div class="card">
    <h2>Equipo que sí sirve</h2>
    <p class="small muted" style="margin-top:0">Según cómo entrenas. Sin enlaces de afiliado ni comisiones: nadie nos paga por recomendar.</p>
    ${list.map(g => `<details><summary>${esc(g.need)}</summary><ul class="small">${g.items.map(([n, w]) => `<li><b>${esc(n)}</b>: ${esc(w)}</li>`).join('')}</ul></details>`).join('')}
    <p class="small" style="margin:10px 0 0">💊 ${esc(SUPPLEMENT_HONEST)}</p>
  </div>
  <div class="card">
    <h2>Encuentra dónde moverte</h2>
    <p class="small muted" style="margin-top:0">Abre el mapa con lugares cerca de ti para comparar horarios y opiniones.</p>
    <div class="place-grid">${PLACES.map(([i, n, q]) => `<a class="place" href="https://www.google.com/maps/search/${encodeURIComponent(q + ' cerca de mí')}" target="_blank" rel="noopener"><span>${i}</span>${n}</a>`).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">Reservar o pagar desde la app requeriría acuerdos con cada lugar; por ahora te llevamos al mapa.</p>
  </div>`;
}
