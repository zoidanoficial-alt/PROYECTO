'use strict';
/* =====================================================================
 *  43.5 · Proyecto HYROX (sub-47 y otras metas)
 *  Basado en el método que compartió un atleta con experiencia en HYROX:
 *  "No se trata de ser el más fuerte ni el más rápido: se trata de ser el atleta que menos
 *   velocidad pierde cuando está fatigado."
 *  - Presupuesto de tu meta: running, estaciones y transiciones (con tus datos si los hay).
 *  - Plan km por km con su estrategia (control → ritmo → sostener → resistir → vaciar).
 *  - Pérdida de velocidad: tus 8 km reales, primer vs último km y running bajo fatiga.
 *  - Semana tipo con las sesiones clave listas para empezar (intervalos, umbral,
 *    compromised running, simulaciones parciales de 2, 4 y 6 bloques).
 * ===================================================================== */
const HP_TARGETS = [2819, 2999, 3299, 3599, 4199, 4799];   // 46:59, 49:59, 54:59, 59:59, 1:09:59, 1:19:59
const HP_EX = { total: 2819, run: 1785, st: 990, rox: 44 };  // ejemplo del método: 29:45 + 16:30 + 0:44
const HP_KM = [
  ['Control', 'No te dejes llevar por la adrenalina', 1.02], ['Control', 'Respira, entra en ritmo', 1.01],
  ['Ritmo competitivo', 'Respiración controlada', 1.0], ['Ritmo competitivo', 'Respiración controlada', 1.0],
  ['Sostener', 'Rendimiento bajo fatiga', 0.995], ['Sostener', 'Rendimiento bajo fatiga', 0.995],
  ['Resistir', 'No pierdas ritmo después de los lunges', 1.01], ['Vaciar el tanque', 'Ahora sí, todo', 0.97]
];
const HP_STATION = {
  ski: 'Potencia controlada, sin destruirte', push: 'Fuerza específica, técnica y pasos eficientes', pull: 'Posición, coordinación y ritmo continuo', bbj: 'Respiración sincronizada y avance eficiente',
  row: 'Potencia sostenible', farm: 'Agarre, postura y desplazamiento rápido', lunge: 'Resistencia muscular y estabilidad', wb: 'Mantener series sin colapsar'
};
const HP_AVOID = ['Descansos innecesarios', 'Soltar implementos', 'Romper series demasiado pronto', 'Movimientos técnicamente deficientes', 'Transiciones lentas', 'Quedarte mirando la estación antes de empezar'];
function hpState() { const h = hx(); if (!h.project) h.project = { target: 2819 }; return h.project; }

/** Presupuesto de la meta con el reparto del método; "hoy" sale de tu predicción para ver dónde está tu tiempo. */
function hpBudget(T) {
  const sc = T / HP_EX.total, el = HX_STATIONS.reduce((a, s) => a + HX_ANCHOR[s.k][1], 0), st = HP_EX.st * sc;
  const pr = typeof hxPredict === 'function' ? hxPredict() : null, now = pr && pr.ok ? { run: pr.runT, st: pr.stT, rox: pr.rox, total: pr.total } : null;
  return { run: HP_EX.run * sc, rox: HP_EX.rox * sc, st, now, parts: HX_STATIONS.map(s => ({ k: s.k, n: s.n, t: st * HX_ANCHOR[s.k][1] / el })) };
}
/** Ritmo de cada km según la estrategia (suma exacta = tiempo total de running). */
function hpKmPlan(runT) { const w = HP_KM.map(x => x[2]), sw = w.reduce((a, b) => a + b, 0); return w.map(x => runT * x / sw); }

/** Tus 8 km reales: la carrera o simulación más reciente con parciales. */
function hpDecay() {
  const rs = typeof plSplitRaces === 'function' ? plSplitRaces() : [];
  const r = rs[0]; if (!r) return null;
  const km = r.sp.filter((_, i) => i % 2 === 0);
  const first = (km[0] + km[1]) / 2, last = (km[5] + km[6] + km[7]) / 3;
  return { r, km, first, last, pct: (last / first - 1) * 100, diff: km[7] - km[0], worstAfter: km.slice(1).reduce((a, v, i) => v > a.v ? { v, i: i + 1 } : a, { v: 0, i: 1 }) };
}

function openHxProject(back) {
  const P = hpState(), T = P.target, B = hpBudget(T), kms = hpKmPlan(B.run), D = hpDecay(), fat = typeof hxFatigue === 'function' ? hxFatigue() : null;
  const me = typeof hxMyBest === 'function' ? hxMyBest() : null, today = (new Date(todayStr() + 'T12:00:00').getDay() + 6) % 7;
  const pace = v => hxT(Math.round(v)) + '/km';
  const decayTxt = D ? (D.pct <= 5 ? 'Pierdes muy poca velocidad: así se corre un sub-47.' : D.pct <= 10 ? 'Pierdes algo de velocidad al final: ahí hay tiempo por ganar.' : 'Aquí está tu mayor oportunidad: tus últimos km se caen mucho.') : '';
  const week = [
    ['Lunes', 'Fuerza de piernas + sled', 'Entrenar sled push', 'push'], ['Martes', 'Intervalos 6 × 1 km', 'Empezar', 'hx1'], ['Miércoles', 'Aeróbico zona 2 + recuperación', 'Empezar', 'cd1'],
    ['Jueves', 'Fuerza de torso + estaciones', 'Elegir estación', 'st'], ['Viernes', 'Umbral 3 × 2 km', 'Empezar', 'hx2'], ['Sábado', 'Compromised running o simulación parcial', 'Elegir', 'sat'], ['Domingo', 'Descanso', '', '']
  ];
  openModal(`<div class="hp">
    <div class="hx-eyebrow">PROYECTO HYROX ${esc(hxT(T))}</div>
    <h3 class="hp-q">«Sé el atleta que menos velocidad pierde cuando está fatigado.»</h3>
    <div class="seg wrap hp-tg">${HP_TARGETS.map(t => `<button data-hpt="${t}" class="${t === T ? 'on' : ''}">${hxT(t)}</button>`).join('')}</div>
    ${me ? `<p class="small muted hp-me">Tu mejor marca: <b>${hxT(me.sec)}</b>${me.sec > T ? ` · te faltan <b>${hxT(me.sec - T)}</b>` : ' · ya la tienes: sube la meta'}</p>` : ''}

    <div class="pv-card"><div class="pv-head"><div><b>Tu presupuesto <span>${hxT(T)}</span></b><small>Reparto del método${B.now ? ' · comparado con tu predicción de hoy' : ''}</small></div></div>
      <div class="hp-bud">${[['Running · 8 km', B.run, 'run'], ['Estaciones', B.st, 'st'], ['Transiciones', B.rox, 'rox']].map(([n, v, k]) => `<div class="hp-b ${k}" style="flex:${Math.max(4, Math.round(v))}"><i></i><small>${n}</small><b>${hxT(Math.round(v))}</b></div>`).join('')}</div>
      ${B.now ? `<div class="pl-plan"><div class="pl-ph"><span></span><small>Hoy</small><small>Meta</small></div>${[['Running', B.now.run, B.run], ['Estaciones', B.now.st, B.st], ['Transiciones', B.now.rox, B.rox]].map(([n, h, g]) => `<div class="pl-pr"><span>${n}${h > g ? ` <em class="hp-gap">−${hxT(Math.round(h - g))}</em>` : ''}</span><small>${hxT(Math.round(h))}</small><b>${hxT(Math.round(g))}</b></div>`).join('')}</div>
        <p class="pv-foot">${(() => { const gaps = [['el running', B.now.run - B.run], ['las estaciones', B.now.st - B.st], ['las transiciones', B.now.rox - B.rox]].sort((a, c) => c[1] - a[1]); return gaps[0][1] > 0 ? `Donde más tiempo tienes que ganar: <b>${gaps[0][0]}</b> (${hxT(Math.round(gaps[0][1]))}).` : '¡Tu predicción ya está en la meta!'; })()}</p>` : ''}
      <p class="pv-foot">El Roxzone completo (entrar y salir de cada estación) suele llevar más de lo que marca el ejemplo del método.</p></div>

    <div class="pv-card"><div class="pv-head"><div><b>Tu carrera km por km</b><small>Promedio ${pace(B.run / 8)} · el primero no es el mejor, el último no es supervivencia</small></div></div>
      <div class="hp-kms">${kms.map((v, i) => `<div class="hp-km${i === 7 ? ' last' : ''}"><span class="hp-kn">${i + 1}</span><span class="hp-kt"><b>${esc(HP_KM[i][0])}</b><small>${esc(HP_KM[i][1])}</small></span><b class="hp-kp">${hxT(Math.round(v))}</b></div>`).join('')}</div></div>

    <div class="pv-card"><div class="pv-head"><div><b>Pérdida de velocidad</b><small>${D ? `${esc(D.r.name)} · ${shortDate(D.r.date)}` : 'Lo que de verdad decide un sub-47'}</small></div>${D ? `<em class="pv-badge${D.pct > 10 ? ' bad' : ''}">${D.pct >= 0 ? '+' : ''}${fmt(D.pct, 1)} %</em>` : ''}</div>
      ${D ? `${typeof pvBars === 'function' ? pvBars(D.km, { lower: true, fmt: v => hxT(Math.round(v)), dates: D.km.map((_, i) => 'km ' + (i + 1)) }) : ''}
        <div class="hp-dec"><div><small>Km 1–2</small><b>${pace(D.first)}</b></div><div><small>Km 6–8</small><b>${pace(D.last)}</b></div><div><small>1º vs 8º</small><b>${D.diff >= 0 ? '+' : '−'}${hxT(Math.abs(Math.round(D.diff)))}</b></div></div>
        <p class="pv-foot">Barra más alta = km más rápido. ${esc(decayTxt)} Tu km más lento fue el ${D.worstAfter.i + 1}.</p>`
      : '<p class="pv-foot">Haz una simulación completa (o registra una carrera con parciales) y aquí verás tus 8 km, tu primer contra tu último km y cuánto ritmo pierdes.</p>'}
      ${fat ? `<p class="pv-foot">Running bajo fatiga: tu km después de una estación es <b>${fmt(fat.rdi, 1)} %</b> más lento que tu km fresco.</p>` : ''}</div>

    <div class="ds-h">Semana tipo</div>
    <div class="hp-week">${week.map(([d, w, btn, k], i) => `<div class="hp-day${i === today ? ' today' : ''}"><span><small>${d}</small><b>${esc(w)}</b></span>${btn ? `<button class="secondary" data-hpgo="${k}">${btn}</button>` : ''}</div>`).join('')}</div>

    <details class="pn-more"><summary>Estaciones: no ganarlas, no perder tiempo</summary>
      <div class="hp-st">${HX_STATIONS.map(s => `<div><b>${esc(s.n)}</b><small>${esc(HP_STATION[s.k])}</small></div>`).join('')}</div>
      <p class="small muted" style="margin:10px 0 4px">Evita:</p><ul class="hp-avoid">${HP_AVOID.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>
    <details class="pn-more"><summary>Fuerza: suficiente para que HYROX no te destruya</summary>
      <div class="hp-st"><div><b>Fuerza máxima</b><small>Sentadilla, peso muerto, presses y movimientos base</small></div><div><b>Fuerza-resistencia</b><small>Repetir esfuerzos sin que la potencia se desplome</small></div><div><b>Resistencia muscular</b><small>Lunges, wall balls, burpees y cargas</small></div><div><b>Economía</b><small>El mismo resultado con menos energía</small></div></div>
      <p class="pv-foot">La pregunta no es cuánto levantas: es cuánto trabajo puedes hacer sin comprometer tu siguiente kilómetro.</p></details>
    <div class="hp-quote">No entrenes para demostrar que eres capaz de sufrir. Entrena para que el sufrimiento no pueda alterar tu estrategia.</div>
    <button class="ghost block" id="hp-x">← Volver</button></div>`, m => {
    $$('[data-hpt]', m).forEach(b => b.onclick = () => { hpState().target = Number(b.dataset.hpt); saveData(); openHxProject(back); });
    $$('[data-hpgo]', m).forEach(b => b.onclick = () => {
      const k = b.dataset.hpgo, again = () => openHxProject(back);
      if (k === 'push') openHxStation('push', again);
      else if (k === 'st') hxtPickStation('station', again);
      else if (k === 'sat') hpSaturday(again);
      else { closeModal(true); startWod(k); }
    });
    $('#hp-x', m).onclick = back || (() => closeModal());
  });
}
function hpSaturday(back) {
  openModal(`<h3>Sábado: correr con el cuerpo alterado</h3><p class="small muted" style="margin-top:0">No hagas un HYROX completo cada semana: alterna 2, 4 y 6 bloques controlando la intensidad.</p>
    <div class="kit-list">
      <button class="kit-item" data-hps="hx3">${ico('activity', 22)}<span class="grow"><b>Compromised running</b><small>1 km · sled push · 1 km · sled pull · 1 km · burpee broad jumps</small></span>${ico('chevron-right', 16)}</button>
      ${[2, 4, 6].map(n => `<button class="kit-item" data-hpp="${n}">${ico('timer', 22)}<span class="grow"><b>Simulación de ${n} bloques</b><small>Km 1 → ${esc(HX_STATIONS[0].n)} … Km ${n} → ${esc(HX_STATIONS[n - 1].n)}</small></span>${ico('chevron-right', 16)}</button>`).join('')}
      <button class="kit-item" data-hpp="8">${ico('trophy', 22)}<span class="grow"><b>Simulación completa</b><small>Solo de vez en cuando: cuesta recuperarse</small></span>${ico('chevron-right', 16)}</button>
    </div><button class="ghost block" id="hps-x">← Volver</button>`, m => {
    $('[data-hps]', m).onclick = () => { closeModal(true); startWod('hx3'); };
    $$('[data-hpp]', m).forEach(b => b.onclick = () => { const n = Number(b.dataset.hpp); n === 8 ? hxtCreate('race') : hxtCreate('part', n); });
    $('#hps-x', m).onclick = back;
  });
}
