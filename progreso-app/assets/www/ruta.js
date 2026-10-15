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

/* ---------- Tu camino (20.0): etapas que demuestran que mejoras ---------- */
const doneSessions = () => DB.sessions.filter(s => s.end).length;
function weekCompletedEver() {
  const weeks = {}; activeDates().forEach(d => { const k = weekKey(d); weeks[k] = (weeks[k] || 0) + 1; });
  return Object.keys(weeks).some(k => weeks[k] >= weekTarget(k));
}
/** Sesión completa: hiciste al menos el 80 % de las series planeadas. */
function sessionCompletion(s) {
  const plan = sessionExercises(s).reduce((a, e) => a + e[1], 0), n = DB.lifts.filter(l => l.sid === s.id).length;
  return plan ? Math.min(1, n / plan) : n ? 1 : 0;
}
const fullSessions = () => DB.sessions.filter(s => s.end && sessionCompletion(s) >= 0.8).length;
function masterTarget() {
  const r = getRoutine(DB.profile.routine), kinds = new Set((r.days || []).filter(d => !d.rest && d.ex.length).map(d => d.name.split('·').pop().trim()));
  return Math.min(6, Math.max(3, kinds.size * 2));
}
function completionPct() {
  const ss = DB.sessions.filter(s => s.end); if (!ss.length) return 0;
  return Math.round(ss.reduce((a, s) => a + sessionCompletion(s), 0) / ss.length * 100);
}
/** Cada etapa desbloquea la siguiente; la recompensa es la prueba, con tus números, de que mejoras. */
const PATH = [
  { k: 'start', t: 'Primer entreno', goal: 'Completa tu primera sesión guiada', prog: () => [Math.min(1, doneSessions()), 1],
    proof: () => `Punto de partida medido en ${new Set(DB.lifts.map(l => l.ex)).size} ejercicios` },
  { k: 'master', t: 'Dominar tu rutina', goal: () => `Completa ${masterTarget()} sesiones con al menos el 80 % de tus series`, prog: () => [Math.min(fullSessions(), masterTarget()), masterTarget()],
    proof: () => `${fullSessions()} sesiones completas · haces el ${completionPct()} % de tus series` },
  { k: 'record', t: 'Superar un récord', goal: 'Supera tu marca de inicio en cualquier ejercicio', prog: () => [bestImprovement() ? 1 : 0, 1],
    proof: () => { const b = bestImprovement(); return b ? b.txt : 'Superaste tu marca de inicio'; } },
  { k: 'consist', t: 'Construir consistencia', goal: () => `Cumple tu meta de ${weekTarget()} días por semana durante 4 semanas seguidas`, prog: () => [Math.min(4, trainingStreakWeeks()), 4], ok: () => bestStreakWeeks() >= 4,
    proof: () => `${bestStreakWeeks()} semanas seguidas cumpliendo tu plan` }
];
const stageGoal = st => typeof st.goal === 'function' ? st.goal() : st.goal;
function pathState() {
  let doneN = 0;
  for (const st of PATH) { const [a, b] = st.prog(); if (!(st.ok ? st.ok() : a >= b)) break; doneN++; }
  return { doneN, cur: PATH[doneN] || null };
}
/** Compatibilidad 19.0: el principiante ve récords y logros después de su primer entreno. */
const unlocked = () => !isBeginner() || doneSessions() >= 1;

function pathCard() {
  const { doneN, cur } = pathState();
  return `<div class="card keep path-card">
    <div class="pc-head"><b>Tu camino</b><span>${cur ? `Etapa ${doneN + 1} de ${PATH.length}` : 'Completado'}</span></div>
    <ol class="pc-stages">${PATH.map((st, i) => {
      if (i < doneN) return `<li class="done"><i>${ico('check', 14)}</i><div><b>${esc(st.t)}</b><small>${esc(st.proof())}</small></div></li>`;
      if (i === doneN) { const [a, b] = st.prog(); return `<li class="now"><i>${i + 1}</i><div><b>${esc(st.t)}</b><small>${esc(stageGoal(st))}</small>${b > 1 ? `<div class="pc-bar"><span style="width:${Math.round(a / b * 100)}%"></span></div><small class="pc-n">${a} de ${b}</small>` : ''}</div></li>`; }
      return `<li class="lock"><i>${i + 1}</i><div><b>${esc(st.t)}</b></div></li>`;
    }).join('')}</ol>
    ${cur ? '' : `<p class="small" style="margin:10px 0">Ya entrenas con constancia y mejoras con datos. El modo avanzado te deja personalizar rutinas, ver tendencias y ajustar cada variable.</p><button class="secondary block" id="pc-adv">Pasar a modo avanzado</button>`}
  </div>`;
}
function bindPath(root) { const b = $('#pc-adv', root); if (b) b.onclick = () => setLevel('avanzado'); }

/** Lo que consigues con la misión de hoy: una decisión concreta basada en tu historial. */
function missionOutcome(nd) {
  const n = sessionsThisWeek(), g = weekTarget(), kt = keyTarget(nd);
  if (!doneSessions()) return 'Al terminar: conoces tu punto de partida y la app calcula tu siguiente objetivo en cada ejercicio.';
  if (kt) return `Objetivo clave: ${kt.ex} ${kt.st.next.txt} (la última vez ${setTxt(kt.st.last.top, kt.st.u)})`;
  if (n + 1 >= g && n < g) return `Al terminar: cumples tu semana (${g} de ${g}).`;
  return `Al terminar: sesión ${Math.min(n + 1, g)} de ${g} esta semana.`;
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

/* ---------- Progreso para principiantes: tus ejercicios con su siguiente objetivo ---------- */
function bestMarks(n) {
  const best = {};
  DB.lifts.forEach(l => { const v = e1rm(l.w, l.r); if (!best[l.ex] || v > best[l.ex].v) best[l.ex] = { v, l }; });
  return Object.keys(best).map(k => best[k]).sort((a, b) => b.l.t - a.l.t).slice(0, n || 5);
}
function renderBeginnerProgress(el) {
  const d = doneSessions(), cur = currentWeight(), p = DB.profile, wk = sessionsThisWeek(), g = weekTarget();
  const ch = cur && p.startWeight ? Math.round((cur - p.startWeight) * 10) / 10 : null;
  const recent = Array.from(new Set(DB.lifts.slice().sort((a, b) => b.t - a.t).map(l => l.ex))).slice(0, 8);
  const stories = recent.map(ex => exStory(ex)).filter(Boolean);
  el.innerHTML = `
    <div class="card keep bp-sum">
      <div class="bp-row"><div><b>${d}</b><small>entrenos en total</small></div><div><b>${wk}/${g}</b><small>esta semana</small></div><div><b>${ch == null ? '—' : (ch > 0 ? '+' : '') + fmt(ch)}</b><small>kg desde el inicio</small></div></div>
    </div>
    <div class="card keep">
      <h2>Tus ejercicios</h2>
      ${stories.length ? `<p class="small muted" style="margin-top:0">Esto hiciste, esto has mejorado y este es tu siguiente objetivo.</p>` + stories.map(st => `<details class="bp-ex"><summary><span class="grow"><b>${esc(st.ex)}</b><small>${st.next ? 'Siguiente: ' + esc(st.next.txt) : esc(st.did)}</small></span>${st.trend === 'up' ? `<span class="rs-tag up">${st.bw ? '+' + (st.last.top.r - st.first.top.r) + ' reps' : '+' + Math.round(st.pct) + ' %'}</span>` : st.trend === 'start' ? '<span class="rs-tag start">Inicio</span>' : ''}</summary>${storyHtml(st)}</details>`).join('')
        : `<div class="bp-lock">${ico('target', 22)}<div><b>Aquí verás cómo mejoras</b><small>Después de tu primer entreno cada ejercicio te dirá qué hiciste, cuánto mejoraste y tu siguiente objetivo.</small></div></div>`}
    </div>
    <button class="ghost block" id="bp-adv">${ico('trending-up', 18, 'lead')}Ver estadísticas completas</button>`;
  $('#bp-adv', el).onclick = openStatsGate;
}

/** 20.0 · Rutina de inicio armada con varias variables: días, tiempo, experiencia, objetivo,
    recuperación, equipo y molestias. Guarda el porqué para mostrarlo en Plan. */
function beginnerRoutine(rebuild) {
  const p = DB.profile, days = (p.trainDays || plannedDays()).slice().sort((a, b) => a - b), n = days.length;
  const mins = p.minutes || 45, exp = p.stage || 2, goal = p.phase || 'mantener', rec = p.recovery || 'normal';
  if (rebuild) {   // quita los entrenos que armó la app antes (los tuyos se quedan)
    const names = new Set(Object.values(FOCUS).map(f => f[1]));
    DB.workouts = DB.workouts.filter(w => !(w.auto || (DB.plan.includes(w.id) && names.has(w.name))));
  }
  const focus = n <= 3 ? days.map(() => 'full') : days.map((_, i) => fem() ? ['gluteo', 'torso', 'pierna', 'torso', 'full', 'full', 'full'][i] : ['torso', 'pierna', 'torso', 'pierna', 'full', 'full', 'full'][i]);
  const want = mins <= 15 ? 3 : mins <= 30 ? 4 : mins <= 45 ? 5 : 6;
  const R = { definicion: [['10–12', 90], ['12–15', 60]], volumen: [['8–12', 120], ['10–12', 75]], mantener: [['8–12', 90], ['12–15', 60]] }[goal] || [['8–12', 90], ['12–15', 60]];
  const setsFor = comp => Math.max(2, (comp ? 3 : exp >= 3 ? 3 : 2) - (rec === 'mal' ? 1 : 0));
  const est = ex => Math.round(5 + ex.reduce((a, e) => a + e[1] * (e[3] + 40), 0) / 60);
  const plan = Array(7).fill(null), made = {};
  let sample = null;
  days.forEach((d, i) => {
    const f = focus[i];
    if (!made[f]) {
      let ex = autoWorkout(f, 60).slice(0, want).map(e => { const comp = exInfo(e[0]).t === 'c'; return [e[0], setsFor(comp), comp ? R[0][0] : R[1][0], comp ? R[0][1] : R[1][1]]; });
      while (ex.length > 3 && est(ex) > mins + 5) ex = ex.slice(0, -1);
      const w = { id: uid(), name: FOCUS[f][1], ex, auto: true }; DB.workouts.push(w); made[f] = w.id; sample = sample || ex;
    }
    plan[d] = made[f];
  });
  DB.plan = plan; p.routine = 'custom';
  const consec = days.some((d, i) => i && d - days[i - 1] === 1);
  p.planWhy = [
    n <= 3 ? `${n} día${n > 1 ? 's' : ''} por semana → cuerpo completo: cada músculo se trabaja ${n} ${n > 1 ? 'veces' : 'vez'} por semana.` : `${n} días por semana → torso y pierna alternados: cada músculo 2 veces por semana sin sobrecargarte.`,
    `${mins >= 60 ? '60 min o más' : mins + ' min'} por sesión → ${sample ? sample.length : want} ejercicios (≈${sample ? est(sample) : mins} min con calentamiento).`,
    exp >= 3 ? 'Ya tienes experiencia → 3 series por ejercicio.' : 'Vas empezando → 3 series en los básicos y 2 en accesorios: primero la técnica.',
    goal === 'definicion' ? 'Perder grasa → 10–15 reps y descansos cortos (60–90 s).' : goal === 'volumen' ? 'Ganar músculo → 8–12 reps y descansos de 75–120 s.' : 'Mantenerte → 8–15 reps con descansos de 60–90 s.',
    rec === 'mal' ? 'Duermes o descansas poco → una serie menos por ejercicio. Súbela cuando duermas mejor.' : rec === 'bien' ? 'Te recuperas bien → volumen completo.' : 'Recuperación normal → si un día llegas cansado, la app te propone reducir.'
  ].concat((p.limits || []).length ? [`Cuidando: ${p.limits.map(k => LIMITS[k] ? LIMITS[k].name.toLowerCase() : k).join(', ')} → sin ejercicios que lo carguen.`] : [])
   .concat(consec && n <= 3 ? ['Tienes días seguidos: si el segundo día llegas cansado, baja un poco el peso.'] : []);
}
