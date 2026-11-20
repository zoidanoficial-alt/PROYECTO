'use strict';
/* =====================================================================
 *  33.0 · Resistencia: ¿más peso o más repeticiones? Las dos, cada una para algo.
 *  - Resistencia muscular local: cargas ligeras-moderadas (≈40–60 % 1RM), 15–30 reps, descansos
 *    cortos. En Campos et al. 2002 el grupo de 20–28 RM mejoró 94 % las reps al 60 % de 1RM.
 *  - Fuerza pesada (3–6 reps) 1 vez por semana: sube tu máximo (el peso de competencia pasa a ser un
 *    % menor) y mejora la economía de carrera (Rønnestad y Mujika 2014).
 *  - Densidad: mismo trabajo en menos descanso para aguantar el esfuerzo continuo.
 *  Las sesiones corren en el motor de entrenos de la app (series, pesos, sugerencias y récords).
 *  Fuentes: docs/FUENTES-v33.md
 * ===================================================================== */

const RES_PHASES = [
  { w: [1, 2], k: 'base', n: 'Base', sets: 2, reps: '15–20', rest: 60, why: 'Aprender a sostener series largas con técnica limpia.' },
  { w: [3, 4], k: 'dev', n: 'Desarrollo', sets: 3, reps: '20–25', rest: 45, why: 'Más volumen: más reps por serie y una serie más.' },
  { w: [5], k: 'dens', n: 'Densidad', sets: 3, reps: '20–30', rest: 30, why: 'El mismo trabajo con menos descanso: así se siente una carrera.' },
  { w: [6], k: 'test', n: 'Prueba y descarga', sets: 2, reps: '15–20', rest: 60, why: 'Menos volumen para llegar fresco a repetir tus pruebas.' }
];
const RES_SES = {
  A: { n: 'Resistencia A · local', what: 'Cargas ligeras, muchas repeticiones', ex: ['Sentadilla goblet con mancuerna', 'Zancadas / split squat búlgaro', 'Lagartijas', 'Remo con mancuerna', 'Plancha'] },
  B: { n: 'Resistencia B · fuerza', what: 'Pesado y pocas repeticiones (1 vez por semana)', heavy: true, ex: [['Sentadilla con barra', 4, '4–6', 150], ['Peso muerto rumano', 3, '6', 120], ['Press militar con mancuernas', 3, '6', 120], ['Remo con barra', 3, '6', 120]] },
  C: { n: 'Resistencia C · densidad', what: 'Circuito con descansos cortos', ex: ['Prensa 45°', 'Remo sentado (máquina)', 'Zancadas / split squat búlgaro', 'Press militar con mancuernas', 'Abdominales completos (sit-ups)'] }
};
const RES_TESTS = {
  rep60: { n: 'Reps al 60 % de tu máximo', u: 'reps', how: 'Sentadilla (o prensa) con el 60 % de tu máximo estimado: todas las repeticiones posibles con buena técnica.' },
  pushups: { n: 'Lagartijas máximas', u: 'reps', how: 'Una sola serie, pecho casi al suelo y cuerpo recto, hasta no poder más.' },
  plank: { n: 'Plancha', u: 's', how: 'Antebrazos y puntas, cuerpo recto. Se para el tiempo cuando la cadera cae.' },
  wb: { n: 'Wall balls sin parar', u: 'reps', how: 'Balón de competencia (6 kg hombres / 4 kg mujeres) al blanco, sin soltarlo.' }
};
function resState() { if (!DB.resist) DB.resist = { start: null, tests: [], days: [] }; return DB.resist; }
function resWeek() { const s = resState(); return s.start ? Math.floor(daysBetween(s.start, todayStr()) / 7) + 1 : null; }
function resPhase(w) { w = w || resWeek() || 1; const c = ((w - 1) % 6) + 1; return Object.assign({ week: w, cycle: Math.ceil(w / 6) }, RES_PHASES.find(p => p.w.includes(c))); }
/** Carga sugerida: 60 % del máximo estimado del ejercicio (si hay historial). */
function resLoad60(ex) {
  const h = typeof exHistory === 'function' ? exHistory(ex) : [];
  const best = h && h.length ? Math.max(...h.map(x => x.best || 0)) : 0;
  return best ? Math.round(best * 0.6 / 2.5) * 2.5 : null;
}
/** Ejercicios de la sesión con las series, reps y descansos de la fase actual. */
function resSessionEx(k) {
  const S = RES_SES[k], ph = resPhase();
  if (S.heavy) return S.ex.map(e => e.slice(0, 4).map((v, i) => i === 1 && ph.k === 'test' ? Math.max(2, v - 1) : v));
  return S.ex.map(n => [n, ph.sets, n === 'Plancha' ? (ph.k === 'base' ? '30–45 s' : '45–90 s') : ph.reps, k === 'C' ? Math.max(20, ph.rest - 15) : ph.rest]);
}
function resNext() {
  const s = resState(); if (!s.start) return null;
  const from = (() => { const t = todayStr(), dow = (parseDate(t).getDay() + 6) % 7; return addDays(t, -dow); })();
  const done = DB.sessions.filter(x => x.end && x.date >= from && /^Resistencia [ABC]/.test(x.dayName || '')).map(x => x.dayName[12]);
  const order = ['A', 'B', 'C'].filter(k => !done.includes(k));
  return { k: order[0] || null, done: done.length };
}
function resBest(kind) { const t = resState().tests.filter(x => x.kind === kind); return t.length ? t : null; }

/* ---------- Pantallas ---------- */
function resCard() {
  const s = resState(); if (!s.start) return '';
  const ph = resPhase(), nx = resNext();
  return `<button class="card keep res-card" id="res-open"><div class="hx-eyebrow">RESISTENCIA · SEMANA ${ph.week} · ${esc(ph.n.toUpperCase())}</div>
    <b>${nx && nx.k ? `Hoy puede tocar: ${esc(RES_SES[nx.k].n)}` : 'Semana completa: 3 de 3'}</b>
    <small class="muted">${esc(ph.why)} ${ph.sets} × ${ph.reps} · ${ph.rest} s de descanso</small></button>`;
}
function bindResCard(root) { const b = $('#res-open', root); if (b) b.onclick = () => openResist(); }
function openResist(back) {
  const s = resState(), ph = resPhase(), nx = resNext();
  const sesBtn = k => { const S = RES_SES[k], exs = resSessionEx(k); return `<div class="res-ses${nx && nx.k === k ? ' now' : ''}"><div class="row spread"><div><b>${esc(S.n)}</b><small>${esc(S.what)}</small></div><button class="${nx && nx.k === k ? '' : 'secondary'}" data-rs="${k}">Empezar</button></div>
      <ul>${exs.map(e => `<li>${esc(e[0])} <span>${e[1]} × ${esc(e[2])} · ${e[3]} s${!S.heavy && resLoad60(e[0]) ? ` · ~${resLoad60(e[0])} kg` : ''}</span></li>`).join('')}</ul></div>`; };
  openModal(`<div class="hx-eyebrow">RESISTENCIA</div><h3 style="margin-top:4px">¿Más peso o más repeticiones?</h3>
    <div class="res-sci"><div><b>Más repeticiones</b><small>Cargas ligeras (40–60&nbsp;% de tu máximo), 15–30 reps y descansos cortos. Es lo que más sube la <b>resistencia muscular</b>: en un estudio, el grupo de 20–28 reps mejoró 94&nbsp;% sus repeticiones al 60&nbsp;%.</small></div>
      <div><b>Más peso</b><small>3–6 reps pesadas una vez por semana. Sube tu <b>fuerza máxima</b>: el peso de la carrera se vuelve un %&nbsp;menor de tu máximo y te cansas menos. Además mejora la economía al correr.</small></div></div>
    <p class="small"><b>La respuesta: las dos.</b> Este programa combina 2 sesiones de resistencia (A y C) y 1 de fuerza (B) por semana, y progresa en este orden: más repeticiones → menos descanso → una serie más → más peso.</p>
    ${s.start ? `<div class="ld-next"><small>SEMANA ${ph.week} DE 6 · ${esc(ph.n.toUpperCase())}</small><b>${ph.sets} × ${ph.reps} · ${ph.rest} s de descanso</b><span>${esc(ph.why)} Esta semana: ${nx.done} de 3 sesiones.</span></div>
      ${['A', 'B', 'C'].map(sesBtn).join('')}
      <button class="secondary block" id="res-week">Ponerlo en mi semana</button>`
    : `<button class="block" id="res-go">Empezar programa de 6 semanas</button><p class="small muted" style="text-align:center">Antes, haz tus pruebas: así medimos cuánto mejoras.</p>`}
    <div class="rir-label"><span>Tus pruebas de resistencia</span></div>
    <div class="res-tests">${Object.entries(RES_TESTS).filter(([k]) => k !== 'wb' || (typeof hxOn === 'function' && hxOn())).map(([k, t]) => { const h = resBest(k), first = h && h[0], last = h && h[h.length - 1]; return `<button class="res-test" data-rt="${k}"><b>${last ? last.value + ' ' + t.u : '—'}</b><span>${esc(t.n)}</span>${first && last && last !== first ? `<em class="${last.value >= first.value ? 'up' : 'down'}">${last.value >= first.value ? '+' : ''}${Math.round((last.value / first.value - 1) * 100)} %</em>` : '<em>sin medir</em>'}</button>`; }).join('')}</div>
    <p class="small muted">Repite las pruebas en la semana 6 de cada ciclo. Fuentes: Campos et al. 2002; ACSM 2009; Rønnestad y Mujika 2014.</p>
    <button class="ghost block" id="res-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => {
    $$('[data-rs]', m).forEach(b => b.onclick = () => { const k = b.dataset.rs; startNamedSession(RES_SES[k].n, resSessionEx(k)); });
    $$('[data-rt]', m).forEach(b => b.onclick = () => openResTest(b.dataset.rt, () => openResist(back)));
    const go = $('#res-go', m); if (go) go.onclick = () => { s.start = todayStr(); saveData(); toast('Programa de resistencia: semana 1'); openResist(back); };
    const wk = $('#res-week', m); if (wk) wk.onclick = () => openResWeek(() => openResist(back));
    $('#res-x', m).onclick = () => { closeModal(); if (typeof render === 'function') render(currentTab); };
  });
}
function openResTest(k, back) {
  const t = RES_TESTS[k], h = resState().tests.filter(x => x.kind === k), load = k === 'rep60' ? (resLoad60('Sentadilla con barra') || resLoad60('Prensa 45°')) : null;
  openModal(`<h3>${esc(t.n)}</h3><p class="small muted" style="margin-top:0">${esc(t.how)}</p>
    ${k === 'rep60' ? `<p class="small">${load ? `Tu carga: <b>${load} kg</b> (60 % de tu máximo estimado).` : 'Aún no hay historial de sentadilla o prensa: usa un peso con el que harías unas 20 reps y anótalo en la nota.'}</p>` : ''}
    ${k === 'plank' ? `<div class="hxt-clock" id="rt-clk">0:00</div><div class="row" style="justify-content:center;gap:8px"><button id="rt-go">Iniciar</button></div>` : ''}
    <label>Resultado (${t.u})<input id="rt-v" inputmode="numeric"></label>
    ${h.length ? `<table class="small hx-tbl"><tbody>${h.slice().reverse().slice(0, 6).map(x => `<tr><td>${shortDate(x.date)}</td><td><b>${x.value} ${t.u}</b></td></tr>`).join('')}</tbody></table>` : ''}
    <div class="row"><button class="secondary" id="rt-c" style="flex:1">← Volver</button><button id="rt-s" style="flex:1">Guardar</button></div>`, m => {
    let tick = null, t0 = null;
    const go = $('#rt-go', m);
    if (go) go.onclick = () => {
      if (!t0) { t0 = Date.now(); go.textContent = 'Parar'; tick = setInterval(() => { const c = $('#rt-clk'); if (!c) return clearInterval(tick); c.textContent = hxT((Date.now() - t0) / 1000); }, 250); }
      else { clearInterval(tick); $('#rt-v', m).value = Math.round((Date.now() - t0) / 1000); t0 = null; go.textContent = 'Iniciar'; }
    };
    $('#rt-c', m).onclick = () => { clearInterval(tick); back(); };
    $('#rt-s', m).onclick = () => {
      const v = num($('#rt-v', m).value); if (!v) { toast('Escribe tu resultado'); return; }
      clearInterval(tick);
      const prev = h.length ? Math.max(...h.map(x => x.value)) : null;
      resState().tests.push({ kind: k, value: Math.round(v), date: todayStr(), load }); saveData();
      toast(prev == null ? 'Primera marca guardada' : v > prev ? `¡Nuevo récord! +${Math.round(v - prev)} ${t.u}` : `Tu mejor marca sigue en ${prev} ${t.u}`);
      back();
    };
  });
}
/** Crea A, B y C en "Mis entrenos" y los pone en los días que elijas. */
function openResWeek(back) {
  const sel = (resState().days || []).slice();
  openModal(`<h3>Ponerlo en mi semana</h3><p class="small muted" style="margin-top:0">Elige 3 días no seguidos para A, B y C (en ese orden). Los días que ya tengan otro entreno se reemplazan.</p>
    <div class="res-days">${WEEKDAYS.map((n, k) => `<button class="chip${sel.includes(k) ? ' on' : ''}" data-d="${k}">${n.slice(0, 3)}</button>`).join('')}</div>
    <p class="small" id="rd-msg"></p>
    <div class="row"><button class="secondary" id="rd-c" style="flex:1">Cancelar</button><button id="rd-s" style="flex:1">Guardar</button></div>`, m => {
    const paint = () => { $$('[data-d]', m).forEach(b => b.classList.toggle('on', sel.includes(Number(b.dataset.d)))); const s = sel.slice().sort(); $('#rd-msg', m).textContent = s.length === 3 ? s.map((d, i) => `${['A', 'B', 'C'][i]}: ${WEEKDAYS[d]}`).join(' · ') : `Elige ${3 - s.length} día(s) más`; };
    $$('[data-d]', m).forEach(b => b.onclick = () => { const d = Number(b.dataset.d), i = sel.indexOf(d); if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(d); paint(); });
    $('#rd-c', m).onclick = back;
    $('#rd-s', m).onclick = () => {
      if (sel.length !== 3) { toast('Elige 3 días'); return; }
      sel.sort();
      ['A', 'B', 'C'].forEach((k, i) => {
        let w = DB.workouts.find(x => x.resist === k);
        if (!w) { w = { id: uid(), name: RES_SES[k].n, ex: [], resist: k }; DB.workouts.push(w); }
        w.ex = resSessionEx(k);
        DB.plan[sel[i]] = w.id;
      });
      DB.profile.routine = 'custom';
      DB.profile.trainDays = DB.plan.map((x, j) => x ? j : null).filter(x => x != null); DB.profile.weeklyTarget = Math.max(1, DB.profile.trainDays.length);
      resState().days = sel.slice(); saveData(); toast('A, B y C quedaron en tu semana'); back();
    };
    paint();
  });
}
/** Mantiene las series y reps de A/B/C de "Mis entrenos" al día con la fase actual. */
function resSyncWorkouts() { if (!DB.resist || !DB.resist.start) return; (DB.workouts || []).forEach(w => { if (w.resist) w.ex = resSessionEx(w.resist); }); }
