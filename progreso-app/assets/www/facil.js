'use strict';
/* Mi Progreso 17.0.1 · "Fácil de usar".
   Respuesta al primer feedback de usuarios ("es un laberinto", "no motiva"):
   - Modo Ella a un toque desde la cabecera de Inicio.
   - Una sola tarjeta "Tu rutina" en Entreno: ves tus días, empiezas, cambias o editas sin buscar.
   - Galería de rutinas con vista previa y "Crear mi rutina en 3 pasos" (días → enfoque de cada día → lista).
   - Selector de ejercicios con chips de músculo y selección múltiple.
   - Puntos de la semana en la tarjeta principal y una guía de 3 pasos la primera vez. */

/* ---------- Modo Ella desde la cabecera ---------- */
function updateEllaHeader() {
  const b = $('#hdr-ella'); if (!b) return;
  const on = girly() && fem();
  b.hidden = currentTab !== 'home' || !DB.profile.onboarded;
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = ico('award', 18) + (on ? ' <span>Ella</span>' : ' <span>Modo Ella</span>');
}
function toggleEllaFromHeader() {
  const on = !(girly() && fem());
  setElla(on);
  if (on && DB.profile.routine === 'pro' && !DB.sessions.some(s => s.end)) DB.profile.routine = 'gluteo';
  saveData(); render(currentTab); updateEllaHeader();
  toast(on ? '🎀 Modo Ella activado' : 'Modo clásico');
}

/* ---------- Motivación: tu semana en la tarjeta principal ---------- */
/** 18.0: los 7 días de la semana (relleno = entrenaste) y "3 de 5 sesiones esta semana". */
function weekDotsHtml() {
  if (typeof activeDates !== 'function') return '';
  const wk = weekKey(todayStr()), act = activeDates(), t = todayStr(), goal = weekTarget();
  const days = WEEKDAYS.map((n, k) => { const d = addDays(wk, k); return { n, d, done: act.has(d), today: d === t }; });
  const done = days.filter(x => x.done).length;
  return `<div class="week-dots-hero" aria-label="${done} de ${goal} sesiones esta semana">
    <span class="wd-dots">${days.map(x => `<span class="wd ${x.done ? 'done' : ''} ${x.today ? 'today' : ''}"><i></i><small>${x.n[0]}</small></span>`).join('')}</span>
    <span class="wd-msg"><b>${Math.min(done, 99)} de ${goal} sesiones</b><small>${done >= goal ? 'semana cumplida' : 'esta semana'}</small></span></div>`;
}
/** 18.0: tres indicadores — puntos, días activos y peso medio. */
function statsRow() {
  const lv = typeof activityLevels === 'function' ? activityLevels() : null;
  const pts = lv ? Math.round((lv.fuerza.xp || 0) + (lv.running.xp || 0)) : 0;
  const n = sessionsThisWeek(), g = weekTarget(), cur = currentWeight();
  const tile = (k, icon, v, l) => `<button class="stat-tile" data-stat="${k}">${ico(icon, 20)}<b>${v}</b><small>${l}</small></button>`;
  return `<div class="stats3">${tile('pts', 'star', pts, 'puntos')}${tile('wk', 'calendar', n + '/' + g, 'días activos')}${tile('wt', 'weight', cur ? fmt(cur) : '—', 'kg · peso medio')}</div>`;
}
function bindStats(root) {
  $$('[data-stat]', root).forEach(b => b.onclick = () => {
    const k = b.dataset.stat;
    if (k === 'pts') { progMode = 'logros'; showTab('progress'); }
    else if (k === 'wt') openWeightQuick();
    else { const g = $('#view-home .more-group'); if (g) g.open = true; const f = $('#view-home [data-fold^="f-mi-agenda"]') || $('#view-home [data-fold^="f-tu-semana"]'); if (f) { f.open = true; f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  });
}

/* ---------- Tarjeta "Tu rutina" (Entreno) ---------- */
const ROUTINE_ICO = { inicio: '🌱', pro: '🔥', tp4: '🔁', gluteo: '🍑', heroe: '🕸️', custom: '⭐' };
function routineMeta(key) {
  const r = getRoutine(key), work = r.days.filter(d => !d.rest);
  return { r, n: work.length, ico: ROUTINE_ICO[key] || '📋' };
}
function routineCard() {
  const p = DB.profile, key = p.routine, { r, n, ico: rIco } = routineMeta(key), nd = nextDay(key);
  let days;
  if (key === 'custom') {
    const today = weekdayIdx(todayStr());
    days = WEEKDAYS.map((name, k) => { const w = workoutById(DB.plan[k]); return `<button class="rd-chip ${w ? 'work' : 'rest'} ${k === today ? 'today' : ''}" data-rday="${k}"><b>${name.slice(0, 3)}</b><small>${w ? esc(w.name) : 'Descanso'}</small></button>`; }).join('');
  } else {
    days = r.days.map(d => `<button class="rd-chip ${d.rest ? 'rest' : 'work'} ${nd && d.id === nd.id ? 'today' : ''}" data-rday="${d.id}"><b>${esc(d.name.split('·')[0].trim())}</b><small>${esc(d.rest ? 'Descanso' : d.name.split('·').pop().trim())}</small></button>`).join('');
  }
  return `<div class="card keep routine-card">
    <div class="rc-head"><span class="rc-ico">${rIco}</span><div class="grow"><div class="small muted">Tu rutina</div><b class="rc-name">${esc(key === 'custom' ? 'Mi rutina' : r.name)}</b><div class="small muted">${n} día${n === 1 ? '' : 's'} de entreno${key === 'custom' ? ' por semana' : ' por ciclo'}</div></div></div>
    <div class="rd-strip" role="list">${days}</div>
    ${key === 'custom' && p.planWhy && p.planWhy.length ? `<details class="rc-why"><summary>${ico('lightbulb', 16)} Por qué esta rutina</summary><ul>${p.planWhy.map(t => `<li>${esc(t)}</li>`).join('')}</ul><button class="secondary block" id="rc-tune">Ajustar a mi tiempo y recuperación</button></details>` : ''}
    <div class="rc-actions"><button class="secondary" id="rc-change">🔄 Cambiar rutina</button><button class="secondary" id="rc-edit">✏️ ${key === 'custom' ? 'Editar' : 'Personalizar'}</button></div>
  </div>`;
}
function bindRoutineCard(v) {
  const c = $('#rc-change', v); if (!c) return;
  c.onclick = openRoutineGallery;
  const tu = $('#rc-tune', v); if (tu) tu.onclick = openPlanTune;
  $('#rc-edit', v).onclick = () => DB.profile.routine === 'custom' ? openWeekEditor() : personalizeRoutine(DB.profile.routine);
  $$('[data-rday]', v).forEach(b => b.onclick = () => openRoutineDay(b.dataset.rday));
}
/** Hoja con los ejercicios de un día: empezar o editar. */
function openRoutineDay(dayKey) {
  const key = DB.profile.routine, custom = key === 'custom';
  let d, wid = null, k = null;
  if (custom) { k = Number(dayKey); const w = workoutById(DB.plan[k]); wid = w && w.id; d = w ? { name: WEEKDAYS[k] + ' · ' + w.name, ex: w.ex } : null; }
  else d = getRoutine(key).days.find(x => x.id === dayKey);
  if (!d || d.rest || !d.ex.length) {
    openModal(`<h3>😴 ${custom ? WEEKDAYS[k] : esc(d ? d.name : '')}: descanso</h3><p class="small muted" style="margin-top:0">El músculo crece cuando descansas.</p>
      ${custom ? `<button class="block" id="rdy-add">＋ Poner un entreno este día</button>` : ''}<button class="ghost block" id="rdy-x" style="margin-top:6px">Cerrar</button>`, m => {
      $('#rdy-x', m).onclick = closeModal;
      const a = $('#rdy-add', m); if (a) a.onclick = () => openWeekEditor(k);
    });
    return;
  }
  openModal(`<h3>${esc(d.name)}</h3>
    <div class="rdy-list">${d.ex.map((e, i) => `<button class="pick-row" data-rdyh="${esc(e[0])}">${exIcon(e[0], 52)}<span class="grow"><b>${i + 1}. ${esc(e[0])}</b><br><small>${e[1]} series × ${esc(e[2])}</small></span><span aria-hidden="true">ⓘ</span></button>`).join('')}</div>
    <button class="block" id="rdy-go" style="margin-top:10px">▶ Empezar este entreno</button>
    <button class="secondary block" id="rdy-edit" style="margin-top:8px">✏️ ${custom ? 'Editar este entreno' : 'Personalizar la rutina'}</button>`, m => {
    $$('[data-rdyh]', m).forEach(b => b.onclick = () => techniqueSheet(b.dataset.rdyh, () => openRoutineDay(dayKey)));
    $('#rdy-go', m).onclick = () => { closeModal(); if (custom) startSession('custom', 'w' + k); else startSession(key, dayKey); showTab('train'); };
    $('#rdy-edit', m).onclick = () => custom ? openWorkoutEditor(wid) : personalizeRoutine(key);
  });
}

/* ---------- Galería de rutinas ---------- */
const ROUTINE_LEVEL = { inicio: 'Principiante', pro: 'Avanzado', tp4: 'Intermedio', gluteo: 'Principiante–intermedio', heroe: 'Intermedio' };
function openRoutineGallery() {
  const cur = DB.profile.routine;
  const keys = Object.keys(ROUTINES).filter(k => !ROUTINES[k].comp), comp = Object.keys(ROUTINES).filter(k => ROUTINES[k].comp);
  const card = k => { const { n, ico } = routineMeta(k); return `<button class="rg-card ${cur === k ? 'on' : ''}" data-rg="${k}"><span class="rg-ico">${ico}</span><span class="grow"><b>${esc(ROUTINES[k].name)}</b><small>${n} días · ${ROUTINE_LEVEL[k] || 'Todos los niveles'}${cur === k ? ' · <b>la que usas</b>' : ''}</small></span><span aria-hidden="true">›</span></button>`; };
  if (fem()) keys.sort((a, b) => (b === 'gluteo') - (a === 'gluteo'));
  openModal(`<h3>Elige tu rutina</h3>
    <button class="rg-card rg-make" id="rg-wizard"><span class="rg-ico">✨</span><span class="grow"><b>Crear mi rutina en 3 pasos</b><small>Eliges tus días y qué entrenas cada uno. La app pone los ejercicios.</small></span><span aria-hidden="true">›</span></button>
    ${keys.map(card).join('')}
    ${comp.length ? `<div class="rg-sec">Fisicoculturismo · para competir</div>${comp.map(card).join('')}` : ''}
    ${DB.workouts.length ? `<button class="rg-card ${cur === 'custom' ? 'on' : ''}" data-rg="custom"><span class="rg-ico">⭐</span><span class="grow"><b>Mi rutina</b><small>${DB.workouts.length} entreno${DB.workouts.length > 1 ? 's' : ''} armados por ti${cur === 'custom' ? ' · <b>la que usas</b>' : ''}</small></span><span aria-hidden="true">›</span></button>` : ''}
    <button class="ghost block" id="rg-x" style="margin-top:6px">Cerrar</button>`, m => {
    $('#rg-x', m).onclick = closeModal;
    $('#rg-wizard', m).onclick = () => openRoutineWizard();
    $$('[data-rg]', m).forEach(b => b.onclick = () => b.dataset.rg === 'custom' ? useRoutine('custom') : previewRoutine(b.dataset.rg));
  });
}
function previewRoutine(key) {
  const r = ROUTINES[key], { ico: rIco } = routineMeta(key);
  const alt = n => typeof adaptedName === 'function' ? adaptedName(n) : n, swaps = (r.comp || r.famous) && typeof routineAdaptCount === "function" ? routineAdaptCount(key) : 0;
  const first = r.days.find(d => !d.rest && d.ex.length);
  openModal(`<h3>${rIco} ${esc(r.name)}</h3><p class="small muted" style="margin-top:0">${esc(r.desc || '')}</p>
    ${r.comp ? `<p class="small rp-src"><b>Fuentes:</b> ${esc(COMP_ROUTINES[key].src)}. Sin afiliación; las cifras varían entre fuentes.</p>` : ''}
    ${swaps ? `<div class="adapt-note">${ico('sparkles', 16, 'lead')}<b>${swaps} cambio${swaps > 1 ? 's' : ''} para ${isPF() ? 'tu Planet Fitness' : 'tu equipo'}:</b> verás el ejercicio que harás y, debajo, el original.</div>` : ''}
    ${r.days.map(d => d.rest ? `<div class="rp-day rest">😴 ${esc(d.name)}</div>` : `<details class="rp-day"${d === first && r.comp ? ' open' : ''}><summary><b>${esc(d.name)}</b> <small class="muted">· ${d.ex.length} ejercicios</small></summary><ul>${(al => d.ex.map((e, i) => { const a = al[i]; return `<li>${esc(a)} <small class="muted">${e[1]} × ${esc(e[2])}</small>${a !== e[0] ? `<small class="rp-swap">en vez de ${esc(e[0])}</small>` : ''}</li>`; }).join(''))(typeof adaptList === 'function' ? adaptList(d.ex) : d.ex.map(e => e[0]))}</ul></details>`).join('')}
    ${(r.comp || r.famous) && first ? `<button class="block" id="rp-start" style="margin-top:12px">${ico('play', 18)} Empezar hoy: ${esc(first.name.split('·').pop().trim())}</button>` : ''}
    <button class="${r.comp || r.famous ? 'secondary ' : ''}block" id="rp-use" style="margin-top:${r.comp || r.famous ? 8 : 12}px">✓ Usar esta rutina tal cual</button>
    <button class="secondary block" id="rp-custom" style="margin-top:8px">${ico("pencil", 18, "lead")}Ponerla en mi semana y editarla</button>
    <button class="ghost block" id="rp-back" style="margin-top:6px">← Ver otras rutinas</button>`, m => {
    $('#rp-use', m).onclick = () => useRoutine(key);
    const st = $('#rp-start', m); if (st) st.onclick = () => { DB.profile.routine = key; saveData(); closeModal(); startSession(key, first.id); showTab('train'); window.scrollTo(0, 0); };
    $('#rp-custom', m).onclick = () => personalizeRoutine(key);
    $('#rp-back', m).onclick = openRoutineGallery;
  });
}
function useRoutine(key) {
  DB.profile.routine = key; saveData(); closeModal();
  if (currentTab === 'train') renderTrain(); else showTab('train');
  window.scrollTo(0, 0);
  toast('✓ Rutina: ' + (key === 'custom' ? 'Mi rutina' : ROUTINES[key].name));
}
/** Copia una rutina de la app a "Mi rutina" (entrenos editables asignados a tus días). */
function personalizeRoutine(key) {
  const r0 = ROUTINES[key];
  if (r0.days.length >= 7) {   // 22.0: rutinas de 7 u 8 días: se respeta su orden y sus descansos de lunes a domingo
    const plan = Array(7).fill(null), made = {};
    r0.days.slice(0, 7).forEach((d, i) => {
      if (d.rest || !d.ex.length) return;
      const nm = d.name.split('·').pop().trim();
      if (!made[nm]) { const w = { id: uid(), name: nm, ex: d.ex.map(e => e.slice()), from: key }; DB.workouts.push(w); made[nm] = w.id; }
      plan[i] = made[nm];
    });
    DB.plan = plan; DB.profile.routine = 'custom'; DB.profile.trainDays = plan.map((x, j) => x ? j : null).filter(x => x != null); DB.profile.weeklyTarget = DB.profile.trainDays.length;
    saveData(); closeModal(); if (currentTab === 'train') renderTrain(); else showTab('train'); window.scrollTo(0, 0);
    toast('✓ En tu semana de lunes a domingo: toca un día para editarlo'); return;
  }
  const r = ROUTINES[key], work = r.days.filter(d => !d.rest && d.ex.length);
  const days = (plannedDays().length === work.length ? plannedDays() : DEFAULT_DAYS[Math.min(7, work.length)] || plannedDays()).slice().sort();
  const plan = Array(7).fill(null), made = [];
  work.forEach((d, i) => {
    const w = { id: uid(), name: d.name.split('·').pop().trim(), ex: d.ex.map(e => e.slice()) };
    DB.workouts.push(w); made.push(w);
    if (days[i] != null) plan[days[i]] = w.id;
  });
  DB.plan = plan; DB.profile.routine = 'custom'; DB.profile.trainDays = days.slice(0, work.length); DB.profile.weeklyTarget = Math.min(7, work.length);
  saveData(); closeModal();
  if (currentTab === 'train') renderTrain(); else showTab('train');
  window.scrollTo(0, 0);
  toast('✓ Ahora es tuya: toca un día para editarlo');
}

/* ---------- Crear mi rutina en 3 pasos ---------- */
const FOCUS = {
  pecho: ['💪', 'Pecho y tríceps', ['empuje-h', 'empuje-inc', 'apertura', 'fondos', 'triceps']],
  espalda: ['🦅', 'Espalda y bíceps', ['jalon', 'remo', 'remo', 'deltoide-post', 'curl']],
  pierna: ['🦵', 'Pierna completa', ['sentadilla', 'bisagra', 'zancada', 'ext-cuad', 'curl-fem', 'pantorrilla']],
  gluteo: ['🍑', 'Glúteo', ['gluteo', 'bisagra', 'zancada', 'abductor', 'curl-fem']],
  hombro: ['🏔️', 'Hombro y abdomen', ['empuje-v', 'elev-lat', 'deltoide-post', 'elev-front', 'abdomen']],
  brazos: ['💥', 'Brazos', ['curl', 'triceps', 'curl', 'triceps-c', 'abdomen']],
  torso: ['🧱', 'Torso', ['empuje-h', 'remo', 'empuje-inc', 'jalon', 'elev-lat', 'triceps']],
  empuje: ['➡️', 'Empuje (pecho, hombro, tríceps)', ['empuje-h', 'empuje-inc', 'empuje-v', 'elev-lat', 'triceps']],
  jalon: ['⬅️', 'Jalón (espalda, bíceps)', ['jalon', 'remo', 'deltoide-post', 'curl', 'abdomen']],
  full: ['🔄', 'Cuerpo completo', ['sentadilla', 'empuje-h', 'remo', 'bisagra', 'empuje-v', 'abdomen']]
};
/** Reparto sugerido según cuántos días entrenas. */
function suggestFocus(n) {
  const f = fem();
  return ({ 1: ['full'], 2: ['full', 'full'], 3: f ? ['gluteo', 'torso', 'pierna'] : ['empuje', 'jalon', 'pierna'], 4: f ? ['gluteo', 'torso', 'pierna', 'torso'] : ['torso', 'pierna', 'torso', 'pierna'],
    5: f ? ['gluteo', 'espalda', 'pierna', 'hombro', 'gluteo'] : ['pecho', 'espalda', 'pierna', 'hombro', 'brazos'], 6: ['empuje', 'jalon', 'pierna', 'empuje', 'jalon', 'pierna'], 7: ['empuje', 'jalon', 'pierna', 'empuje', 'jalon', 'pierna', 'full'] })[n] || [];
}
/** Elige ejercicios para un enfoque: los que puedes hacer con tu equipo y sin molestias, con foto primero. */
function autoWorkout(focus, minutes) {
  const used = new Set(), out = [];
  const slots = FOCUS[focus][2].slice(0, minutes && minutes <= 30 ? 4 : 6);
  slots.forEach(pat => {
    const cands = Object.keys(EX).filter(n => EX[n].p === pat && !used.has(n) && okForMe(n) && !EX[n].custom && !(typeof EX_META === 'object' && EX_META[n] && EX_META[n].level === 'Avanzado'))
      .sort((a, b) => (!!EX_PHOTO[b] - !!EX_PHOTO[a]) || ((EX[b].t === 'c') - (EX[a].t === 'c')));
    const n = cands[0]; if (!n) return;
    used.add(n);
    const meta = typeof EX_META === 'object' && EX_META[n], comp = EX[n].t === 'c';
    out.push([n, comp ? 4 : 3, meta ? meta.reps.replace('-', '–') : comp ? '8–12' : '10–15', meta ? meta.rest : comp ? 120 : 75]);
  });
  return out;
}
function openRoutineWizard() {
  const w = { step: 0, days: plannedDays().slice().sort(), focus: {} };
  const fillFocus = () => { const s = suggestFocus(w.days.length); w.days.forEach((d, i) => { if (!w.focus[d]) w.focus[d] = s[i] || 'full'; }); };
  const draw = m => {
    const steps = `<div class="wz-steps">${['Días', 'Enfoque', 'Listo'].map((t, i) => `<span class="${i <= w.step ? 'on' : ''}">${i + 1}. ${t}</span>`).join('')}</div>`;
    if (w.step === 0) {
      m.innerHTML = `${steps}<h3>¿Qué días vas a entrenar?</h3><p class="small muted" style="margin-top:0">Toca los días. Con 3 o 4 a la semana ya progresas.</p>
        <div class="wz-days">${WEEKDAYS.map((n, k) => `<button class="${w.days.includes(k) ? 'on' : ''}" data-wzd="${k}">${n.slice(0, 3)}</button>`).join('')}</div>
        <p class="small" style="text-align:center;margin:10px 0">${w.days.length} día${w.days.length === 1 ? '' : 's'} por semana</p>
        <button class="block" id="wz-next" ${w.days.length ? '' : 'disabled'}>Siguiente</button><button class="ghost block" id="wz-x" style="margin-top:6px">Cancelar</button>`;
      $$('[data-wzd]', m).forEach(b => b.onclick = () => { const k = Number(b.dataset.wzd); w.days = w.days.includes(k) ? w.days.filter(x => x !== k) : w.days.concat(k).sort(); w.focus = {}; draw(m); });
      $('#wz-next', m).onclick = () => { fillFocus(); w.step = 1; draw(m); };
      $('#wz-x', m).onclick = closeModal;
    } else if (w.step === 1) {
      m.innerHTML = `${steps}<h3>¿Qué entrenas cada día?</h3><p class="small muted" style="margin-top:0">Ya te puse un reparto que funciona. Cámbialo si quieres.</p>
        ${w.days.map(d => `<div class="wz-day"><b>${WEEKDAYS[d]}</b><div class="wz-focus">${Object.keys(FOCUS).map(f => `<button class="${w.focus[d] === f ? 'on' : ''}" data-wzf="${d}|${f}">${FOCUS[f][0]} ${FOCUS[f][1].split(' (')[0]}</button>`).join('')}</div></div>`).join('')}
        <div class="row" style="margin-top:12px"><button class="secondary" id="wz-back" style="flex:1">Atrás</button><button id="wz-next" style="flex:2">Armar mi rutina</button></div>`;
      $$('[data-wzf]', m).forEach(b => b.onclick = () => { const [d, f] = b.dataset.wzf.split('|'); w.focus[d] = f; const y = m.scrollTop; draw(m); m.scrollTop = y; });
      $$('.wz-focus', m).forEach(row => { const on = row.querySelector('.on'); if (on) row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - 8); });
      $('#wz-back', m).onclick = () => { w.step = 0; draw(m); };
      $('#wz-next', m).onclick = () => { w.step = 2; w.built = w.days.map(d => ({ d, f: w.focus[d], ex: autoWorkout(w.focus[d], DB.profile.minutes) })); draw(m); };
    } else {
      m.innerHTML = `${steps}<h3>✨ Tu rutina está lista</h3><p class="small muted" style="margin-top:0">Ejercicios elegidos para tu equipo${(DB.profile.limits || []).length ? ' y tus molestias' : ''}. Podrás cambiar cualquiera después.</p>
        ${w.built.map(b => `<details class="rp-day" open><summary><b>${WEEKDAYS[b.d]} · ${FOCUS[b.f][0]} ${FOCUS[b.f][1]}</b> <small class="muted">· ${b.ex.length} ejercicios</small></summary><ul>${b.ex.map(e => `<li>${esc(e[0])} <small class="muted">${e[1]} × ${esc(e[2])}</small></li>`).join('')}</ul></details>`).join('')}
        <div class="row" style="margin-top:12px"><button class="secondary" id="wz-back" style="flex:1">Atrás</button><button id="wz-save" style="flex:2">✓ Usar esta rutina</button></div>`;
      $('#wz-back', m).onclick = () => { w.step = 1; draw(m); };
      $('#wz-save', m).onclick = () => {
        const plan = Array(7).fill(null);
        w.built.forEach(b => { const wo = { id: uid(), name: FOCUS[b.f][1], ex: b.ex }; DB.workouts.push(wo); plan[b.d] = wo.id; });
        DB.plan = plan; DB.profile.routine = 'custom'; DB.profile.trainDays = w.days.slice(); DB.profile.weeklyTarget = w.days.length;
        saveData(); closeModal();
        if (currentTab === 'train') renderTrain(); else showTab('train');
        window.scrollTo(0, 0); toast('✨ ¡Rutina creada! Toca un día para verlo o editarlo');
      };
    }
  };
  openModal('', draw);
}

/* ---------- Editor de la semana (Mi rutina) en una hoja ---------- */
function openWeekEditor(focusDay) {
  const short = n => n.slice(0, 3);
  const draw = m => {
    const fam = typeof FAMOUS_KEYS === 'object' ? FAMOUS_KEYS.filter(k => ROUTINES[k]) : [];
    m.innerHTML = `<h3>Mi rutina</h3>
      ${fam.length ? `<div class="we-fam"><div class="we-fh">¿Sin ganas de armarla? Entrena como…</div>
        <div class="we-fcards">${fam.map(k => { const { n, ico: ri } = routineMeta(k); return `<button class="we-fc" data-wef="${k}"><span class="we-fi">${ri}</span><b>${esc(FAMOUS_SHORT[k] || ROUTINES[k].name)}</b><small>${n} entrenos${ROUTINES[k].days.length !== 7 && ROUTINES[k].days.length > n ? ' · ciclo de ' + ROUTINES[k].days.length + ' días' : ' por semana'} · ${esc(ROUTINE_LEVEL[k] || '')}</small></button>`; }).join('')}</div>
        <p class="small muted" style="margin:6px 0 0">Vienen con sus ejercicios, series y orden. Tócala para verla y empezar hoy.</p></div>` : ''}
      <div class="we-fh" style="margin-top:14px">O arma tu semana</div>
      <p class="small muted" style="margin:0 0 4px">En cada día elige: tu propio entreno, entrenar como CBUM, Tom Holland o Arnold, o descanso. El lápiz cambia sus ejercicios.</p>
      ${WEEKDAYS.map((n, k) => { const w = workoutById(DB.plan[k]); return `<div class="we-row ${focusDay === k ? 'focus' : ''}"><b title="${n}">${short(n)}</b>
        <select data-wep="${k}" aria-label="Entreno del ${n}"><option value="">Descanso</option><option value="__new">＋ Crear mi propio entreno…</option>
          ${DB.workouts.some(x => !x.fam) ? `<optgroup label="Mis entrenos">${DB.workouts.filter(x => !x.fam).map(x => `<option value="${x.id}" ${w && w.id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>` : ''}
          ${typeof famousDayOptions === 'function' ? famousDayOptions(DB.plan[k]) : ''}</select>
        ${w ? `<button class="icon-btn" data-wee="${w.id}" aria-label="Editar ${esc(w.name)}">${ico('pencil', 18)}</button>` : '<span class="icon-btn-sp"></span>'}</div>`; }).join('')}
      <div class="row" style="margin-top:12px"><button class="secondary" id="we-wz" style="flex:1">${ico('sparkles', 18, 'lead')}Rehacer en 3 pasos</button><button id="we-ok" style="flex:1">Listo</button></div>`;
    $$('[data-wef]', m).forEach(b => b.onclick = () => previewRoutine(b.dataset.wef));
    $$('[data-wep]', m).forEach(s => s.onchange = () => {
      const k = Number(s.dataset.wep);
      if (s.value.startsWith('fam|')) { assignFamousDay(k, s.value.slice(4)); draw(m); if (currentTab === 'train') keepScroll(renderTrain); return; }
      if (s.value === '__new') { openWorkoutEditor(null, { id: uid(), isNew: true, name: '', ex: [], days: WEEKDAYS.map((_, j) => j === k) }); return; }
      DB.plan[k] = s.value || null;
      DB.profile.trainDays = DB.plan.map((x, j) => x ? j : null).filter(x => x != null); DB.profile.weeklyTarget = Math.max(1, DB.profile.trainDays.length);
      saveData(); draw(m); if (currentTab === 'train') keepScroll(renderTrain);
    });
    $$('[data-wee]', m).forEach(b => b.onclick = () => openWorkoutEditor(b.dataset.wee));
    $('#we-wz', m).onclick = openRoutineWizard;
    $('#we-ok', m).onclick = () => { closeModal(); if (currentTab === 'train') renderTrain(); };
  };
  openModal('', draw);
}

/* ---------- Selector de ejercicios con chips y selección múltiple ---------- */
let PK2 = { g: 'all', mine: true };
function openExercisePicker2(opts) {
  opts = opts || {};
  const sel = [];
  const draw = (m, q) => {
    const list = Object.keys(EX).filter(n => (PK2.g === 'all' || EX[n].g === PK2.g || (PK2.g === 'pecholibre' && EX_META[n])) && (!PK2.mine || hasEquip(n)) && (!q || n.toLowerCase().includes(q.toLowerCase()) || (EX_META[n] && EX_META[n].en.toLowerCase().includes(q.toLowerCase()))))
      .sort((a, b) => (okForMe(b) - okForMe(a)) || (!!EX_PHOTO[b] - !!EX_PHOTO[a]));
    $('#p2-list', m).innerHTML = list.length ? list.map(n => {
      const x = EX[n], meta = EX_META[n], on = sel.includes(n);
      return `<div class="p2-row ${on ? 'on' : ''}"><button class="p2-main" data-p2="${esc(n)}">${exIcon(n, 56)}<span class="grow"><b>${esc(n)}</b><small>${GROUPS[x.g] || x.g} · ${EQUIP[x.e] || ''}${meta ? ' · ' + esc(meta.level) : ''}</small></span><span class="p2-check" aria-hidden="true">${on ? '✓' : '＋'}</span></button><button class="p2-info icon-btn" data-p2i="${esc(n)}" aria-label="Ver técnica de ${esc(n)}">ⓘ</button></div>`;
    }).join('') : `<div class="empty">Sin resultados.${PK2.mine ? ' Prueba quitando "Mi equipo".' : ''}</div>`;
    $$('[data-p2]', m).forEach(b => b.onclick = () => {
      const n = b.dataset.p2;
      if (!opts.multi) { opts.onDone([n]); return; }
      const i = sel.indexOf(n); if (i >= 0) sel.splice(i, 1); else sel.push(n);
      const y = $('#p2-list', m).scrollTop; draw(m, $('#p2-q', m).value); $('#p2-list', m).scrollTop = y;
    });
    $$('[data-p2i]', m).forEach(b => b.onclick = () => techniqueSheet(b.dataset.p2i, () => openExercisePicker2(opts)));
    const done = $('#p2-done', m); if (done) { done.textContent = sel.length ? `Añadir ${sel.length} ejercicio${sel.length > 1 ? 's' : ''}` : 'Elige uno o varios'; done.disabled = !sel.length; }
  };
  const chips = [['all', 'Todos']].concat(Object.keys(GROUPS).filter(g => Object.values(EX).some(x => x.g === g)).map(g => [g, GROUPS[g]])).concat([['pecholibre', '🆕 Pecho peso libre']]);
  openModal(`<div class="p2">
    <div class="row spread"><h3 style="margin:0">${opts.title || 'Elige ejercicios'}</h3><button class="ghost" id="p2-x">Cerrar</button></div>
    <input id="p2-q" placeholder="Buscar: press, remo, sentadilla…" autocomplete="off">
    <div class="p2-chips">${chips.map(([k, t]) => `<button class="chip-btn ${PK2.g === k ? 'on' : ''}" data-p2g="${k}">${esc(t)}</button>`).join('')}<button class="chip-btn ${PK2.mine ? 'on' : ''}" id="p2-mine">🏋️ Mi equipo</button></div>
    <div id="p2-list" class="p2-list"></div>
    ${opts.multi ? '<button class="block" id="p2-done" disabled>Elige uno o varios</button>' : ''}
    <button class="ghost block" id="p2-new">＋ Crear un ejercicio que no está</button></div>`, m => {
    $('#p2-x', m).onclick = () => opts.onCancel ? opts.onCancel() : closeModal();
    $('#p2-q', m).oninput = e => draw(m, e.target.value);
    $$('[data-p2g]', m).forEach(b => b.onclick = () => { PK2.g = b.dataset.p2g; $$('[data-p2g]', m).forEach(x => x.classList.toggle('on', x === b)); draw(m, $('#p2-q', m).value); });
    $('#p2-mine', m).onclick = e => { PK2.mine = !PK2.mine; e.currentTarget.classList.toggle('on', PK2.mine); draw(m, $('#p2-q', m).value); };
    const done = $('#p2-done', m); if (done) done.onclick = () => opts.onDone(sel.slice());
    $('#p2-new', m).onclick = () => openCustomExercise(n => opts.onDone([n]), $('#p2-q', m).value);
    draw(m, '');
  });
}
/** Series/reps/descanso sugeridos para un ejercicio nuevo en un entreno. */
function exDefaults(name) {
  const meta = typeof EX_META === 'object' && EX_META[name], comp = exInfo(name).t === 'c';
  const sets = meta ? Number(String(meta.sets).split('-')[0]) + (String(meta.sets).includes('-') ? 1 : 0) : comp ? 4 : 3;
  return [name, Math.min(5, sets || 3), meta ? meta.reps.replace('-', '–') : comp ? '8–12' : '10–15', meta ? meta.rest : comp ? 120 : 75];
}

/* ---------- Guía de 3 pasos (una sola vez) ---------- */
function openGuide() {
  const S = [
    ['🎯', 'Hoy: una sola cosa', 'En <b>Hoy</b> ves tu objetivo y tu misión del día. Un toque en <b>Empezar entrenamiento</b> y la app te guía serie por serie.'],
    ['📈', 'Qué vas a conseguir', 'Cada misión te dice qué logras al terminarla. ' + (typeof isBeginner === 'function' && isBeginner() ? 'En <b>Tu camino</b> ves tu siguiente hito: al avanzar se desbloquean tus récords y estadísticas.' : 'Tus tendencias y récords están en <b>Progreso</b>.')],
    ['📋', 'Plan: tu rutina', 'En <b>Plan</b> está tu rutina. Toca un día para verlo, <b>Cambiar</b> para elegir otra o <b>Crear mi rutina en 3 pasos</b>.'],
    ['🧭', 'Explorar, cuando quieras', 'Nutrición, running, retos y ajustes viven en <b>Explorar</b>. Ahí también eliges <b>Principiante</b> o <b>Avanzado</b>, y el botón de arriba activa Modo Ella.']
  ];
  let i = 0;
  const draw = m => {
    const [ico, t, x] = S[i];
    m.innerHTML = `<div class="guide"><div class="g-ico">${ico}</div><h3>${t}</h3><p>${x}</p>
      <div class="g-dots">${S.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row"><button class="ghost" id="gd-skip" style="flex:1">${i === S.length - 1 ? '' : 'Saltar'}</button><button id="gd-next" style="flex:2">${i === S.length - 1 ? '¡A entrenar!' : 'Siguiente'}</button></div></div>`;
    const end = () => { DB.profile.guideSeen = true; saveData(); closeModal(); };
    $('#gd-skip', m).onclick = end;
    $('#gd-next', m).onclick = () => { if (i < S.length - 1) { i++; draw(m); } else end(); };
  };
  openModal('', draw);
}
