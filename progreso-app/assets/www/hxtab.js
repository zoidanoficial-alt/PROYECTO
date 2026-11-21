'use strict';
/* =====================================================================
 *  36.0 · COMPETIR: HYROX, carreras y objetivos en una sola sección
 *  Orden: Preparación → Sesión de hoy → Diagnóstico → Predictor →
 *  Estaciones → Herramientas. Siempre se distingue medido / estimado / objetivo.
 * ===================================================================== */
const HX_FIX = {   // qué entrenar según tu punto débil (lo aplica hxMission al elegir la sesión)
  run: 'Intervalos de 1 km a ritmo de carrera y un rodaje largo suave por semana.',
  comp: 'Una sesión de carrera bajo fatiga por semana: 1 km justo después de cada estación.',
  st: 'Técnica y volumen específico de la estación, 2 veces por semana, al peso de competencia.'
};
function renderHyroxTab() {
  const root = $('#view-hyrox'); if (!root) return;
  if (!hxOn()) {
    root.innerHTML = `<div class="cp-hero"><div class="hx-eyebrow">TU CENTRO DE COMPETENCIA</div>
      <h2 class="cp-big">¿Para qué te preparas?</h2>
      <p class="cp-lead">Elige tu carrera y la app arma tu preparación: evaluación por partes, punto débil, predicción y sesiones específicas.</p>
      <button class="block" id="hxp-setup">${ico('timer', 18, 'lead')}Preparar un HYROX</button>
      <button class="secondary block" data-hxp="events" style="margin-top:8px">${ico('calendar', 18, 'lead')}Buscar una competencia</button></div>
      ${champMethodCard()}
      <div class="ds-h">Herramientas</div>
      <div class="kit-list">${hxpItem('watch', 'heart-pulse', 'Mi reloj', 'Mi Fitness, pulso en vivo y control remoto')}${hxpItem('resist', 'dumbbell', 'Resistencia', '¿Más peso o más reps? Programa de 6 semanas')}${hxpItem('athlete', 'trophy', 'Proyecto Atleta', 'Tu transformación hasta los 40')}</div>`;
    hxpBind(root); return;
  }
  const perf = hxPerformance(), bn = hxBottleneck(perf), pr = hxPredict(), p = hx().profile, ph = hxPhase();
  const days = p.date ? daysBetween(todayStr(), p.date) : null, doneN = perf.tested.length + (perf.run ? 1 : 0) + (perf.fat ? 1 : 0);
  const ev = typeof evById === 'function' && p.eventId ? evById(p.eventId) : null;

  // A · Preparación
  const prep = `<div class="cp-hero">
      <div class="hx-eyebrow">PREPARACIÓN · FASE ${esc(ph.n.toUpperCase())}</div>
      ${days != null && days >= 0 ? `<div class="cp-count"><b>${days}</b><span>días para<br>${ev ? esc(ev.eventName) : 'tu carrera'}</span></div>` : `<h2 class="cp-big">Elige tu carrera</h2><button class="ghost" id="hxp-date">Ver competencias →</button>`}
      <p class="cp-lead">${esc(ph.why)}</p>
      <div class="cp-meta"><span>${esc(HX_CATS[p.cat])} · ${p.sex === 'f' ? 'Mujeres' : 'Hombres'}</span>${p.date ? `<span>${esc(longDate(p.date))}</span>` : ''}<span>Evaluación ${doneN}/10</span></div>
    </div>`;

  // C · Diagnóstico (solo con datos reales)
  let diag;
  if (bn && bn.main) {
    const m = bn.main, fix = HX_FIX[m.k === 'run' || m.k === 'comp' ? m.k : 'st'];
    diag = `<section class="cp-sec"><div class="ds-h">Diagnóstico</div><div class="cp-diag">
      <small>TU PRINCIPAL ÁREA DE OPORTUNIDAD</small><b>${esc(m.n)}</b>
      <dl><dt>Evidencia</dt><dd>${esc(m.why)}</dd>
      <dt>Impacto</dt><dd>≈ ${hxT(Math.round(m.lost))} perdidos por carrera frente a tu nivel general.</dd>
      <dt>Recomendación</dt><dd>${esc(fix)}</dd></dl>
      ${bn.second ? `<p class="cp-second">Después: <b>${esc(bn.second.n)}</b></p>` : ''}</div></section>`;
  } else {
    const left = 10 - doneN;
    diag = `<section class="cp-sec"><div class="ds-h">Diagnóstico</div><div class="cp-diag empty"><b>Aún no hay diagnóstico</b>
      <p>Necesito al menos 4 pruebas para comparar tus partes entre sí. ${left > 0 ? `Te faltan ${left} de 10; una por sesión es suficiente.` : ''} No invento puntuaciones.</p>
      <span class="td-bar"><i style="--w:${doneN * 10}%"></i></span></div></section>`;
  }

  // E · Predictor
  const pred = pr.ok ? `<section class="cp-sec"><div class="ds-h">Predictor <em class="ds-est">estimación</em></div><button class="cp-pred" data-hxp="race">
      <div class="cp-pred-top"><b>${hxT(pr.total)}</b><span>rango ${hxT(pr.lo)} – ${hxT(pr.hi)}</span></div>
      <div class="cp-split">${[['Running', pr.runT], ['Estaciones', pr.stT], ['Roxzone', pr.rox]].map(([n, v]) => `<span style="flex:${Math.round(v)}"><i></i><small>${n}</small><b>${hxT(v)}</b></span>`).join('')}</div>
      ${pr.flags.length ? `<p class="cp-flag">${ico('info', 14)}${esc(pr.flags[0])}</p>` : ''}</button></section>`
    : `<section class="cp-sec"><div class="ds-h">Predictor</div><div class="cp-diag empty"><b>Sin predicción todavía</b><p>Necesita tu 1 km fresco${perf.run ? ' ✓' : ''} y ${hxIsPF && hxIsPF() ? 4 : 6} estaciones medidas (llevas ${perf.tested.length}).</p></div></section>`;

  // F · Estaciones
  const sts = `<section class="cp-sec"><div class="ds-h">Estaciones <span class="ds-h-r">${perf.tested.length} de 8 medidas</span></div>
    <div class="cp-st">${HX_STATIONS.map((s, i) => { const x = perf.st[s.k], weak = bn && bn.main && bn.main.k === s.k; return `<button class="${x ? 'on' : ''}${weak ? ' weak' : ''}" data-cpst="${s.k}"><small>${String(i + 1).padStart(2, '0')}</small><b>${esc(typeof pfStName === 'function' ? pfStName(s.k) : s.n)}</b><span>${x ? hxT(x.sec) : 'sin medir'}</span></button>`; }).join('')}</div></section>`;

  root.innerHTML = `${prep}
    <div class="ds-h">Sesión de hoy</div>
    ${hyroxCard(true)}
    <div class="hxp-quick">
      <button data-hxp="timer">${ico('timer', 22)}<span>Temporizador</span></button>
      <button data-hxp="watch">${ico('heart-pulse', 22)}<span>Mi reloj</span></button>
      <button data-hxp="events">${ico('calendar', 22)}<span>Carreras</span></button>
      <button data-hxp="test">${ico('clipboard-list', 22)}<span>Resultado</span></button>
    </div>
    ${diag}
    ${pred}
    ${sts}
    ${typeof pfHyroxCard === 'function' ? pfHyroxCard() : ''}
    ${champMethodCard()}
    <div class="ds-h">Herramientas</div>
    <div class="kit-list">
      ${hxpItem('perf', 'trending-up', 'Perfil de rendimiento', perf.hpi != null ? `HPI ${perf.hpi}/100 · confianza ${perf.conf}` : 'Running, fuerza, fatiga y estaciones')}
      ${hxpItem('strat', 'route', 'Estrategia de carrera', 'Ritmos, sets y transiciones con tus datos')}
      ${hxpItem('ladder', 'trophy', 'Mi escalera', typeof ladderSummary === 'function' ? ladderSummary() : '')}
      ${hxpItem('ranks', 'clipboard-list', 'Mis carreras', 'Resultados, parciales y comparaciones')}
      ${hxpItem('athlete', 'trophy', 'Proyecto Atleta', typeof athOn === 'function' && athOn() ? 'Bloque: ' + ATH_BLOCKS[athPlan().cur].n : 'Tu transformación hasta los 40')}
      ${hxpItem('resist', 'dumbbell', 'Resistencia', DB.resist && DB.resist.start ? `Semana ${resWeek()} · ${resPhase().n}` : '¿Más peso o más reps? Programa de 6 semanas')}
      ${hxpItem('method', 'book-open', 'Metodología', 'Por qué entrenas lo que entrenas')}
      ${hxpItem('setup', 'sliders-horizontal', 'Mi carrera y perfil', `${HX_CATS[p.cat]} · ${p.sex === 'f' ? 'Mujeres' : 'Hombres'}${p.date ? ' · ' + shortDate(p.date) : ''}`)}
    </div>
    <p class="small muted" style="margin-top:10px">El HPI y las predicciones son modelos internos de la app, no métricas oficiales. Sin afiliación con HYROX ni con los atletas.</p>`;
  bindHyrox(root, renderHyroxTab);
  hxpBind(root);
  $$('[data-cpst]', root).forEach(b => b.onclick = () => openHxStation(b.dataset.cpst, () => closeModal()));
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
