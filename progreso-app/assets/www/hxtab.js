'use strict';
/* =====================================================================
 *  31.0 · Pestaña HYROX Lab: todo lo de HYROX en un solo lugar
 * ===================================================================== */
function renderHyroxTab() {
  const root = $('#view-hyrox'); if (!root) return;
  if (!hxOn()) {
    root.innerHTML = `<div class="hxp-hero"><div class="hx-eyebrow">HYROX LAB · THE SCIENCE OF YOUR NEXT PR</div>
      <h2 class="hxp-big">Prepárate para tu HYROX</h2>
      <p class="small muted">Evaluación por partes, tu punto débil, predicción de tiempo, temporizador controlado desde tu reloj y el método de los campeones.</p>
      <button class="block" id="hxp-setup">Configurar mi carrera</button></div>
      ${champMethodCard()}
      <div class="kit-list">${hxpItem('events', 'calendar', 'Competiciones', 'Encuentra tu carrera y hazla tu objetivo')}${hxpItem('watch', 'heart-pulse', 'Mi reloj', 'Mi Fitness, pulso en vivo y control remoto')}${hxpItem('resist', 'dumbbell', 'Resistencia', '¿Más peso o más reps? Programa de 6 semanas')}</div>`;
    hxpBind(root); return;
  }
  const perf = hxPerformance(), bn = hxBottleneck(perf), pr = hxPredict(), p = hx().profile, ph = hxPhase();
  const days = p.date ? daysBetween(todayStr(), p.date) : null, doneN = perf.tested.length + (perf.run ? 1 : 0) + (perf.fat ? 1 : 0);
  const ev = typeof evById === 'function' && p.eventId ? evById(p.eventId) : null;
  root.innerHTML = `<div class="hxp-hero">
      <div class="hx-eyebrow">${esc(ph.n.toUpperCase())}${ev ? ' · ' + esc(ev.eventName.toUpperCase()) : ''}</div>
      ${days != null && days >= 0 ? `<div class="hx-count"><b class="t-display-l">${days}</b><span>días para<br>tu carrera</span></div>` : `<h2 class="hxp-big">Tu laboratorio</h2><button class="ghost" id="hxp-date">Elegir mi carrera →</button>`}
      <div class="hx-tele"><div><b>${perf.hpi != null ? perf.hpi : '—'}</b><small>HPI</small></div><div><b>${pr.ok ? hxT(pr.total) : '—'}</b><small>Predicción</small></div><div><b>${doneN}/10</b><small>Evaluación</small></div></div>
    </div>
    ${hyroxCard(true)}
    <div class="hxp-quick">
      <button data-hxp="timer">${ico('timer', 22)}<span>Temporizador</span></button>
      <button data-hxp="watch">${ico('heart-pulse', 22)}<span>Mi reloj</span></button>
      <button data-hxp="events">${ico('calendar', 22)}<span>Carreras</span></button>
      <button data-hxp="test">${ico('clipboard-list', 22)}<span>Resultado</span></button>
    </div>
    ${typeof pfHyroxCard === 'function' ? pfHyroxCard() : ''}
    ${champMethodCard()}
    ${bn && bn.main ? `<div class="hx-bn"><small>CUELLO DE BOTELLA PRINCIPAL</small><b>${esc(bn.main.n)}</b><p class="small">${esc(bn.main.why)}</p>${bn.second ? `<small>SECUNDARIO</small><b class="hx-b2">${esc(bn.second.n)}</b>` : ''}</div>` : perf.hpi == null ? `<div class="status info"><b>Evaluación incompleta</b>Completa tus pruebas con el temporizador: una por sesión es suficiente.</div>` : ''}
    <div class="kit-list">
      ${hxpItem('athlete', 'trophy', 'Proyecto Atleta', typeof athOn === 'function' && athOn() ? 'Bloque: ' + ATH_BLOCKS[athPlan().cur].n : 'Tu transformación hasta los 40')}
      ${hxpItem('resist', 'dumbbell', 'Resistencia', DB.resist && DB.resist.start ? `Semana ${resWeek()} · ${resPhase().n}` : '¿Más peso o más reps? Programa de 6 semanas')}
      ${hxpItem('ladder', 'trophy', 'Mi escalera', typeof ladderSummary === 'function' ? ladderSummary() : '')}
      ${hxpItem('st', 'layers', 'Las 8 estaciones', `${perf.tested.length} de 8 medidas · técnica y récords`)}
      ${hxpItem('perf', 'trending-up', 'Rendimiento (HPI)', perf.hpi != null ? `${perf.hpi}/100 · confianza ${perf.conf}` : 'Evaluación incompleta')}
      ${hxpItem('race', 'target', 'Predictor y "¿Y si…?"', pr.ok ? `${hxT(pr.lo)} – ${hxT(pr.hi)}` : 'Necesita 1 km y 6 estaciones')}
      ${hxpItem('strat', 'route', 'Estrategia de carrera', 'Ritmos, sets y transiciones con tus datos')}
      ${hxpItem('ranks', 'clipboard-list', 'Mis carreras', 'Resultados, parciales y resultados oficiales')}
      ${hxpItem('method', 'book-open', 'Metodología', 'Fases y sesiones: por qué entrenas lo que entrenas')}
      ${hxpItem('setup', 'sliders-horizontal', 'Mi carrera y perfil', `${HX_CATS[p.cat]} · ${p.sex === 'f' ? 'Mujeres' : 'Hombres'}${p.date ? ' · ' + shortDate(p.date) : ''}`)}
    </div>
    <p class="small muted" style="margin-top:10px">El HPI y las predicciones son modelos internos de la app, no métricas oficiales. Sin afiliación con HYROX ni con los atletas.</p>`;
  bindHyrox(root, renderHyroxTab);
  hxpBind(root);
}
function hxpItem(k, i, t, s) { return `<button class="kit-item" data-hxp="${k}">${ico(i, 22)}<span class="grow"><b>${t}</b><small>${esc(s)}</small></span>${ico('chevron-right', 16)}</button>`; }
function hxpBind(root) {
  const back = () => closeModal();
  const act = { timer: () => openHxTimerPicker(back), watch: () => openWatch(), events: () => openEvents(), test: () => openHxTestPicker(back), st: () => openHxStations(back), perf: () => openHxPerf(back), race: () => openHxPredict(back), strat: () => openHxStrategy(back), ranks: () => openHxRanks(back), ladder: () => openHxLadder(back), resist: () => openResist(back), athlete: () => openAthlete(), method: () => openHxMethod(back), setup: () => openHxSetup(() => { closeModal(); renderHyroxTab(); }) };
  $$('[data-hxp]', root).forEach(b => b.onclick = () => act[b.dataset.hxp]());
  const ch = $('#ch-open', root); if (ch) ch.onclick = () => openChamps();
  const pfb = $('#pf-open', root); if (pfb) pfb.onclick = () => openPfHyrox();
  const s = $('#hxp-setup', root); if (s) s.onclick = () => openHxSetup(() => { closeModal(); renderHyroxTab(); });
  const d = $('#hxp-date', root); if (d) d.onclick = () => openEvents();
}
