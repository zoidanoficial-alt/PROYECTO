'use strict';
/* Mi Progreso 19.0 · Arquitectura de producto: un camino claro.
   Objetivo: que alguien abra la app por primera vez y entienda en cinco segundos qué puede hacer,
   qué debería hacer ahora y qué va a conseguir.
   - Nivel 1 (Hoy): una sola acción principal, tu objetivo y lo que consigues al hacerla.
   - Nivel 2 (Plan): tu rutina, tus ejercicios y el registro.
   - Nivel 3 (Explorar): nutrición, estadísticas, retos, running y ajustes.
   Dos experiencias: principiante (guiada, con funciones que se desbloquean al avanzar) y avanzado
   (todo visible y configurable). Se elige en la bienvenida y se cambia en Explorar. */

function userLevel() {
  const p = DB.profile;
  if (!p.level) {   // quien ya usaba la app conserva todo si ya entrena en serio
    const done = DB.sessions.filter(s => s.end).length;
    p.level = p.onboarded && (done >= 5 || (p.stage || 2) >= 3 || p.routine === 'custom') ? 'avanzado' : 'principiante';
  }
  return p.level;
}
const isBeginner = () => userLevel() === 'principiante';
function setLevel(l) {
  DB.profile.level = l; saveData();
  showTab(currentTab === 'food' && l === 'principiante' ? 'more' : currentTab);
  toast(l === 'avanzado' ? 'Modo avanzado: todas las herramientas a la vista' : 'Modo principiante: solo lo que necesitas');
}

/* ---------- Tu camino: hitos que explican qué consigues ---------- */
const doneSessions = () => DB.sessions.filter(s => s.end).length;
function weekCompletedEver() {
  const weeks = {}; activeDates().forEach(d => { const k = weekKey(d); weeks[k] = (weeks[k] || 0) + 1; });
  return Object.keys(weeks).some(k => weeks[k] >= weekTarget(k));
}
const MILESTONES = [
  { k: 'first', t: 'Primer entreno', reward: 'Conoces tu punto de partida', ok: () => doneSessions() >= 1, need: () => 1 - doneSessions() },
  { k: 'three', t: '3 entrenos', reward: 'Desbloqueas tus récords y tu progreso', ok: () => doneSessions() >= 3, need: () => 3 - doneSessions() },
  { k: 'week', t: 'Semana cumplida', reward: 'Desbloqueas tu progreso semanal', ok: weekCompletedEver, need: () => Math.max(1, weekTarget() - sessionsThisWeek()) },
  { k: 'pr', t: 'Primer récord', reward: 'La app empieza a subirte el peso sola', ok: () => DB.achievements.some(a => a.pr), need: () => 1 },
  { k: 'ten', t: '10 entrenos', reward: 'Listo para el modo avanzado', ok: () => doneSessions() >= 10, need: () => 10 - doneSessions() }
];
function nextMilestone() { return MILESTONES.find(m => !m.ok()) || null; }
const unlocked = k => { const m = MILESTONES.find(x => x.k === k); return !isBeginner() || (m && m.ok()); };

function pathCard() {
  const nx = nextMilestone(), doneN = MILESTONES.filter(m => m.ok()).length;
  if (!nx) return `<div class="card keep path-card"><div class="pc-head"><b>Tu camino</b><span>${doneN}/${MILESTONES.length}</span></div>
    <p class="small" style="margin:0 0 10px">Completaste el camino de inicio. El modo avanzado te deja personalizar rutinas, ver tendencias y ajustar cada variable.</p>
    <button class="block" id="pc-adv">Activar modo avanzado</button></div>`;
  const left = nx.need();
  return `<div class="card keep path-card">
    <div class="pc-head"><b>Tu camino</b><span>${doneN} de ${MILESTONES.length}</span></div>
    <div class="pc-steps">${MILESTONES.map(m => `<span class="pc-step ${m.ok() ? 'done' : m === nx ? 'now' : ''}"><i>${m.ok() ? ico('check', 14) : ''}</i><small>${esc(m.t)}</small></span>`).join('')}</div>
    <div class="pc-next">${ico('target', 18)}<div><b>Siguiente: ${esc(nx.t)}</b>${left > 0 && ['first', 'three', 'ten', 'week'].includes(nx.k) ? ` · te falta${left > 1 ? 'n' : ''} ${left}` : ''}<small>${esc(nx.reward)}</small></div></div>
  </div>`;
}
function bindPath(root) { const b = $('#pc-adv', root); if (b) b.onclick = () => setLevel('avanzado'); }

/** Qué vas a conseguir con la misión de hoy (una línea concreta). */
function missionOutcome() {
  const n = sessionsThisWeek(), g = weekTarget(), nx = nextMilestone(), d = doneSessions();
  if (nx && nx.k === 'first') return 'Al terminar: conoces tu punto de partida y la app ajusta tus pesos.';
  if (nx && nx.k === 'three' && d === 2) return 'Al terminar: completas 3 entrenos y desbloqueas tus récords.';
  if (n + 1 >= g && n < g) return `Al terminar: cumples tu semana (${g} de ${g}).`;
  if (nx && nx.k === 'ten' && d === 9) return 'Al terminar: llegas a 10 entrenos y puedes pasar a modo avanzado.';
  return `Al terminar: sesión ${Math.min(n + 1, g)} de ${g} esta semana${DB.lifts.length ? ' y la app ajusta tu siguiente peso' : ''}.`;
}
/** Tu objetivo en una línea (lo que persigues con todo esto). */
function goalLine() {
  const p = DB.profile, cur = currentWeight();
  if (p.trainMode === 'running' && DB.runPlan && typeof RUN_PLANS === 'object') return `Objetivo: ${RUN_PLANS[DB.runPlan.type].name}`;
  if (!cur || !p.goalWeight) return 'Objetivo: entrenar con constancia';
  const diff = Math.round((cur - p.goalWeight) * 10) / 10;
  if (p.phase === 'definicion' && diff > 0.2) return `Objetivo: bajar a ${fmt(p.goalWeight)} kg · te faltan ${fmt(diff)} kg`;
  if (p.phase === 'volumen' && diff < -0.2) return `Objetivo: subir a ${fmt(p.goalWeight)} kg · te faltan ${fmt(-diff)} kg`;
  return `Objetivo: mantenerte en ${fmt(p.goalWeight)} kg y ganar fuerza`;
}

/* ---------- Explorar (nivel 3) ---------- */
function levelCard() {
  const l = userLevel();
  return `<div class="card keep level-card">
    <h2>Tu experiencia</h2>
    <div class="lv-opts">
      <button class="lv-opt ${l === 'principiante' ? 'on' : ''}" data-level="principiante">${ico('sprout', 22)}<b>Principiante</b><small>Te guía paso a paso. Solo ves lo que necesitas hoy.</small></button>
      <button class="lv-opt ${l === 'avanzado' ? 'on' : ''}" data-level="avanzado">${ico('sliders-horizontal', 22)}<b>Avanzado</b><small>Personaliza rutinas, tendencias, récords y cada variable.</small></button>
    </div>
  </div>`;
}
function explorarCard() {
  const items = [
    ['food', 'utensils', 'Nutrición', 'Calorías, proteína, agua y comidas'],
    ['stats', 'trending-up', 'Estadísticas', isBeginner() ? 'Tendencias y fuerza por músculo (avanzado)' : 'Tendencias, fuerza y balance'],
    ['run', 'footprints', 'Running', 'Planes, GPS y caminadora'],
    ['retos', 'trophy', 'Retos', 'Pruebas de peso corporal'],
    ['ex', 'book-open', 'Ejercicios', 'Técnica de cada ejercicio'],
    ['act', 'activity', 'Otra actividad', 'Caminar, yoga, bici…']
  ];
  return `<div class="card keep explore-card"><h2>Explorar</h2>
    <div class="ex-grid">${items.map(([k, i, t, s]) => `<button class="ex-item" data-explore="${k}">${ico(i, 22)}<b>${t}</b><small>${s}</small></button>`).join('')}</div></div>`;
}
function bindExplore(root) {
  $$('[data-level]', root).forEach(b => b.onclick = () => { if (userLevel() !== b.dataset.level) setLevel(b.dataset.level); });
  $$('[data-explore]', root).forEach(b => b.onclick = () => {
    const k = b.dataset.explore;
    if (k === 'food') showTab('food');
    else if (k === 'run') { DB.profile.trainMode = 'running'; saveData(); showTab('train'); }
    else if (k === 'ex') openExercisePicker(null);
    else if (k === 'act') openActivityForm();
    else if (k === 'retos') openModal(retosCard().replace('class="card"', 'class="retos-sheet"') + '<button class="ghost block" id="rs-x">Cerrar</button>', m => { bindRetos(m); $('#rs-x', m).onclick = closeModal; });
    else if (k === 'stats') openStatsGate();
  });
}
function openStatsGate() {
      if (!isBeginner()) { progMode = 'analysis'; showTab('progress'); return; }
      openModal(`<h3>Estadísticas completas</h3><p class="small muted" style="margin-top:0">Tendencias, fuerza por músculo, series por semana y balance están en el modo avanzado. Puedes cambiar cuando quieras.</p>
        <button class="block" id="st-adv">Activar modo avanzado</button><button class="ghost block" id="st-x" style="margin-top:6px">Ahora no</button>`, m => {
        $('#st-adv', m).onclick = () => { closeModal(); setLevel('avanzado'); progMode = 'analysis'; showTab('progress'); };
        $('#st-x', m).onclick = closeModal;
      });
}

/* ---------- Progreso para principiantes ---------- */
function bestMarks(n) {
  const best = {};
  DB.lifts.forEach(l => { const v = e1rm(l.w, l.r); if (!best[l.ex] || v > best[l.ex].v) best[l.ex] = { v, l }; });
  return Object.keys(best).map(k => best[k]).sort((a, b) => b.l.t - a.l.t).slice(0, n || 5);
}
function renderBeginnerProgress(el) {
  const d = doneSessions(), cur = currentWeight(), p = DB.profile, wk = sessionsThisWeek(), g = weekTarget();
  const ch = cur && p.startWeight ? Math.round((cur - p.startWeight) * 10) / 10 : null;
  const marks = unlocked('three') ? bestMarks(5) : [];
  el.innerHTML = `
    <div class="card keep bp-sum">
      <div class="bp-row"><div><b>${d}</b><small>entrenos en total</small></div><div><b>${wk}/${g}</b><small>esta semana</small></div><div><b>${ch == null ? '—' : (ch > 0 ? '+' : '') + fmt(ch)}</b><small>kg desde el inicio</small></div></div>
    </div>
    <div class="card keep">
      <h2>Tus mejores marcas</h2>
      ${marks.length ? marks.map(({ l }) => `<div class="bp-mark"><span class="grow"><b>${esc(l.ex)}</b><small>${shortDate(l.date)}</small></span><b>${wFmt(l.w, unitFor(l.ex))} × ${l.r}</b></div>`).join('')
        : `<div class="bp-lock">${ico('shield', 22)}<div><b>Se desbloquean con 3 entrenos</b><small>Te faltan ${Math.max(0, 3 - d)}. Cada entreno guarda tus pesos y aquí verás cómo suben.</small></div></div>`}
    </div>
    <button class="ghost block" id="bp-adv">${ico('trending-up', 18, 'lead')}Ver estadísticas completas</button>`;
  $('#bp-adv', el).onclick = openStatsGate;
}

/** Rutina de inicio para principiantes con gimnasio: cuerpo completo (o torso/pierna con 4+ días),
    armada con su equipo y sus molestias, asignada a sus días. */
function beginnerRoutine() {
  const p = DB.profile, days = (p.trainDays || plannedDays()).slice().sort(), n = days.length;
  const focus = n <= 3 ? days.map(() => 'full') : days.map((_, i) => fem() ? ['gluteo', 'torso', 'pierna', 'torso', 'full', 'full', 'full'][i] : ['torso', 'pierna', 'torso', 'pierna', 'full', 'full', 'full'][i]);
  const plan = Array(7).fill(null), made = {};
  days.forEach((d, i) => {
    const f = focus[i], key = f + (made[f] ? '' : '');
    if (!made[f]) { const w = { id: uid(), name: FOCUS[f][1], ex: autoWorkout(f, p.minutes).map(e => [e[0], Math.min(3, e[1]), e[2], e[3]]) }; DB.workouts.push(w); made[f] = w.id; }
    plan[d] = made[key];
  });
  DB.plan = plan; p.routine = 'custom';
}
