'use strict';
/* =====================================================================
 *  36.0 · PERFIL: quién eres como atleta, tu nutrición y tus ajustes
 * ===================================================================== */
function perfilHeader() {
  const p = DB.profile, done = DB.sessions.filter(s => s.end).length, since = p.startDate ? Math.max(0, daysBetween(p.startDate, todayStr())) : null;
  const init = (p.name || 'A').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const goal = typeof todayGoal === 'function' ? todayGoal() : null;
  const tg = targets(), tot = dayTotals(todayStr());
  return `<div class="pf-head keep"><div class="pf-av">${esc(init)}</div><div class="grow"><b>${esc(p.name || 'Atleta')}</b>
      <small>${userLevel() === 'avanzado' ? 'Nivel avanzado' : 'Nivel principiante'}${p.age ? ' · ' + p.age + ' años' : ''}${since != null ? ' · día ' + (since + 1) : ''}</small></div></div>
    <div class="pf-stats"><div><b>${done}</b><small>entrenos</small></div><div><b>${trainingStreakWeeks()}</b><small>semanas de racha</small></div><div><b>${DB.achievements.filter(a => a.pr).length}</b><small>récords</small></div></div>
    <button class="pf-row" id="pf-sport">${ico(SPORTS[mainSport()].ico, 20)}<span class="grow"><b>Mi disciplina: ${esc(SPORTS[mainSport()].n)}</b><small>${DB.profile.sport ? 'Decide tus métricas, gráficas y lo que ves en Hoy' : 'Elige para qué te preparas'}</small></span>${ico('chevron-right', 16)}</button>
    ${goal ? `<button class="pf-row" id="pf-goal">${ico('target', 20)}<span class="grow"><b>Objetivo: ${esc(goal.tag)}</b><small>${esc(goal.title)}</small></span>${ico('chevron-right', 16)}</button>` : ''}
    ${isSimple() ? '' : `<button class="pf-row" id="pf-food">${ico('utensils', 20)}<span class="grow"><b>Nutrición</b><small>Hoy: ${tot.kcal.toLocaleString('es-MX')} de ${tg.kcal.toLocaleString('es-MX')} kcal · ${Math.round(tot.p)} g proteína</small></span>${ico('chevron-right', 16)}</button>`}
    ${gamify() ? `<button class="pf-row" id="pf-medals">${ico('medal', 20)}<span class="grow"><b>Logros, estadísticas y medallas</b><small>${typeof mdCatalog === 'function' ? Object.keys(mdState().got).length + ' de ' + mdCatalog().length.toLocaleString('es-MX') + ' medallas' : 'Tus récords'}</small></span>${ico('chevron-right', 16)}</button>` : ''}
    <button class="pf-row" id="pf-check">${ico('activity', 20)}<span class="grow"><b>Chequeo de hoy</b><small>${(() => { const r = typeof readiness === 'function' ? readiness() : null; return r ? `Listo para entrenar: ${r.score}/100` : 'Sueño, energía y cansancio antes de entrenar'; })()}</small></span>${ico('chevron-right', 16)}</button>
    <button class="pf-row" id="pf-retos">${ico('award', 20)}<span class="grow"><b>Retos de peso corporal</b><small>${(DB.retos || []).length ? (DB.retos || []).length + ' intentos registrados' : 'Rondas y escaleras contra el reloj'}</small></span>${ico('chevron-right', 16)}</button>
    <button class="pf-row" id="pf-health">${ico('heart-pulse', 20)}<span class="grow"><b>Salud y reloj</b><small>${DB.watch && DB.watch.hcOn ? 'Mi Fitness conectado' : 'Sueño, pulso y datos de Mi Fitness'}</small></span>${ico('chevron-right', 16)}</button>`;
}
function bindPerfil(root) {
  const on = (id, f) => { const b = $('#' + id, root); if (b) b.onclick = f; };
  on('pf-goal', () => todayGoal().go());
  on('pf-sport', () => openSportPicker(() => render(currentTab)));
  on('pf-food', () => showTab('food'));
  on('pf-health', () => openWatch());
  on('pf-medals', () => showTab('logros'));
  on('pf-check', () => openCheckin(() => render(currentTab)));
  on('pf-retos', () => openModal(`${retosCard()}<button class="ghost block" id="pr-x">← Volver</button>`, m => { bindRetos(m); $('#pr-x', m).onclick = () => closeModal(); }));
}
