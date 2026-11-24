'use strict';
/* Mi Progreso 15.0 · Retos de peso corporal (benchmarks).
   Inspirados en lo que está documentado de la preparación de Tom Holland para Spider-Man
   (informe "El entrenamiento de Tom Holland para Spider-Man (2016–2026): qué está confirmado y
   qué no"): "Cindy" (AMRAP de 5 dominadas, 10 flexiones y 15 sentadillas) y la escalera de
   Duffy Gaver (1-2-3-4-5 subiendo hasta 10 y bajando: ~1,500 repeticiones). Siguiendo las
   recomendaciones del propio informe, la app empieza con versiones cortas (Cindy de 10–12 min,
   escalera hasta 5) y compara solo contra tus marcas. Sin afiliación con Marvel ni con el actor. */

const RETOS = {
  cindy: { ico: '⏱️', name: 'Cindy', kind: 'amrap', mins: [10, 12, 15, 20], def: 12,
    moves: [['Dominadas', 5], ['Flexiones', 10], ['Sentadillas', 15]],
    desc: 'Tantas rondas como puedas: 5 dominadas, 10 flexiones y 15 sentadillas. Solo cuentas rondas.',
    ref: 'Tom Holland dice que su récord es de 27 rondas en 20 min (atleta con preparación profesional). Tu meta es superar tu propia marca.' },
  escalera: { ico: '🪜', name: 'Escalera', kind: 'ladder', tops: [3, 5, 8, 10], def: 5,
    moves: [['Dominadas', 1], ['Fondos', 2], ['Flexiones', 3], ['Abdominales', 4], ['Sentadillas', 5]],
    desc: 'Ronda n: n dominadas, 2n fondos, 3n flexiones, 4n abdominales y 5n sentadillas. Subes hasta el tope y bajas hasta 1. Cuenta el tiempo.',
    ref: 'La versión completa (hasta 10) son ~1,500 repeticiones y le tomaba ~60 min. Empieza hasta 5 (375 repeticiones).' }
};
const RETO_VARIANTS = { estricta: 'Dominadas estrictas', asistida: 'Asistidas o con banda', remo: 'Remo invertido en lugar de dominadas' };
const ladderRounds = top => Array.from({ length: top }, (_, i) => i + 1).concat(Array.from({ length: top - 1 }, (_, i) => top - 1 - i));
const ladderReps = top => 15 * top * top;
/** Clave de comparación: solo se comparan marcas del mismo reto, duración/tope y variante. */
const retoKey = r => `${r.type}|${r.size}|${r.variant}`;
function retoBest(key, exceptId) {
  const list = (DB.retos || []).filter(r => retoKey(r) === key && r.id !== exceptId && r.complete !== false);
  if (!list.length) return null;
  return list.reduce((a, r) => (r.type === 'cindy' ? r.score > a.score : r.sec < a.sec) ? r : a);
}
const retoScoreTxt = r => r.type === 'cindy' ? `${r.rounds} rondas${r.reps ? ' + ' + r.reps : ''}` : r.complete === false ? `${r.roundsDone} de ${ladderRounds(r.size).length} rondas` : durStr(r.sec);

function retosCard() {
  const list = (DB.retos || []).slice().sort((a, b) => b.t - a.t);
  const last = list[0];
  return `<div class="card" data-fold-title="Retos de peso corporal" data-fold-sum="${last ? esc(RETOS[last.type].name + ': ' + retoScoreTxt(last)) : 'Cindy y escalera'}" data-fold-ico="🏅">
    <h2>Retos de peso corporal</h2>
    <p class="small muted" style="margin:0 0 10px">Pruebas que repites cada semana o dos para ver tu progreso, como las de Tom Holland para Spider-Man.</p>
    ${Object.keys(RETOS).map(k => { const R = RETOS[k], mine = list.filter(r => r.type === k), b = mine.length ? retoBest(retoKey(mine[0])) : null;
      return `<button class="pick-row reto-pick" data-reto="${k}"><span class="tm-ico">${R.ico}</span><span class="grow"><b>${R.name}</b><br><small>${b ? 'Tu mejor: ' + esc(retoScoreTxt(b)) + ' · ' + mine.length + ' intento' + (mine.length > 1 ? 's' : '') : esc(R.desc.split('.')[0])}</small></span><span aria-hidden="true">›</span></button>`; }).join('')}
    ${list.length ? `<details style="margin-top:6px"><summary class="small">Historial (${list.length})</summary><table><tbody>${list.slice(0, 12).map(r => `<tr><td>${shortDate(r.date)}</td><td>${RETOS[r.type].name} ${r.type === 'cindy' ? r.size + ' min' : 'hasta ' + r.size}</td><td class="num"><b>${esc(retoScoreTxt(r))}</b>${r.pr ? ' 🏅' : ''}</td></tr>`).join('')}</tbody></table></details>` : ''}
    <button class="ghost block" id="reto-info" style="margin-top:6px">🕷️ Cómo entrena Tom Holland: lo confirmado</button>
  </div>`;
}
function bindRetos(root) {
  $$('[data-reto]', root).forEach(b => b.onclick = () => openRetoSetup(b.dataset.reto));
  const i = $('#reto-info', root); if (i) i.onclick = openHollandInfo;
}

/** Elegir duración/tope y variante antes de empezar. */
function openRetoSetup(type) {
  const R = RETOS[type], o = { size: DB.profile['reto_' + type] || R.def, variant: DB.profile.retoVariant || 'estricta' };
  const draw = m => {
    const sizes = R.kind === 'amrap' ? R.mins : R.tops;
    const b = retoBest(retoKey({ type, size: o.size, variant: o.variant }));
    m.innerHTML = `<h3>${R.ico} ${R.name}</h3>
      <p class="small" style="margin-top:0">${esc(R.desc)}</p>
      <div class="rir-label"><span>${R.kind === 'amrap' ? 'Duración' : 'Subir hasta'}</span></div>
      <div class="seg">${sizes.map(s => `<button data-sz="${s}" class="${o.size === s ? 'on' : ''}">${R.kind === 'amrap' ? s + ' min' : s + (R.kind === 'ladder' ? ' · ' + ladderReps(s) : '')}</button>`).join('')}</div>
      <div class="rir-label"><span>Dominadas</span></div>
      <div class="chips" style="margin-bottom:10px">${Object.keys(RETO_VARIANTS).map(k => `<button class="chip-btn ${o.variant === k ? 'on' : ''}" data-var="${k}">${RETO_VARIANTS[k]}</button>`).join('')}</div>
      ${R.kind === 'ladder' ? `<p class="small muted" style="margin:0 0 8px">${ladderRounds(o.size).length} rondas · ${ladderReps(o.size)} repeticiones en total.</p>` : ''}
      <div class="adapt-note" style="margin:0 0 10px">${b ? `🏅 Tu mejor marca en esta versión: <b>${esc(retoScoreTxt(b))}</b> (${shortDate(b.date)}).` : '🎯 Primera vez en esta versión: lo que hagas hoy es tu marca.'} ${esc(R.ref)}</div>
      <p class="small muted" style="margin:0 0 10px">Buena técnica antes que velocidad. Si una repetición sale mal, pausa: el reloj no manda.</p>
      <button class="block" id="rt-go">▶ Empezar</button>`;
    $$('[data-sz]', m).forEach(x => x.onclick = () => { o.size = Number(x.dataset.sz); draw(m); });
    $$('[data-var]', m).forEach(x => x.onclick = () => { o.variant = x.dataset.var; draw(m); });
    $('#rt-go', m).onclick = () => { DB.profile['reto_' + type] = o.size; DB.profile.retoVariant = o.variant; saveData(); runReto(type, o.size, o.variant); };
  };
  openModal('', draw);
}

/** Pantalla del reto en curso (hoja bloqueada para no cerrarla por accidente). */
function runReto(type, size, variant) {
  const R = RETOS[type], st = { type, size, variant, start: Date.now(), rounds: 0, log: [], pausedMs: 0, pauseAt: null, step: 0 };
  const rounds = R.kind === 'ladder' ? ladderRounds(size) : null, total = R.kind === 'amrap' ? size * 60 : null;
  const elapsed = () => ((st.pauseAt || Date.now()) - st.start - st.pausedMs) / 1000;
  let timer = null, lastMin = -1;
  MODAL_LOCK = true; keepScreenOn(true);
  say(R.kind === 'amrap' ? `${R.name}, ${size} minutos. ¡Adelante!` : `Escalera hasta ${size}. Ronda 1.`);
  const end = finished => { clearInterval(timer); keepScreenOn(false); MODAL_LOCK = false; finishReto(st, R, finished); };
  const tick = m => {
    const el = elapsed();
    if (R.kind === 'amrap') {
      const left = Math.max(0, total - el), mn = Math.floor(left / 60);
      if (!st.pauseAt && mn !== lastMin) { if (lastMin !== -1 && mn === 0) say('Último minuto'); else if (lastMin !== -1 && mn * 2 === size) say('Mitad del tiempo'); lastMin = mn; }
      $('#rt-clock', m).textContent = mmss(left);
      if (left <= 0) { say('¡Tiempo!'); end(true); }
    } else $('#rt-clock', m).textContent = durStr(el);
  };
  const draw = m => {
    const n = rounds ? rounds[st.step] : null;
    m.innerHTML = `<div class="reto-live">
      <div class="small muted">${R.ico} ${R.name} · ${R.kind === 'amrap' ? size + ' min' : 'hasta ' + size} · ${RETO_VARIANTS[variant]}${st.pauseAt ? ' · en pausa' : ''}</div>
      <div class="run-time" id="rt-clock">${R.kind === 'amrap' ? mmss(total) : '0:00'}</div>
      ${R.kind === 'amrap' ? `
        <div class="reto-count"><b>${st.rounds}</b><small>rondas</small></div>
        <div class="reto-moves">${R.moves.map(([x, r]) => `<span><b>${r}</b> ${x.toLowerCase()}</span>`).join('')}</div>
        <button class="block reto-big" id="rt-plus">+1 ronda</button>
        <button class="ghost block" id="rt-undo" ${st.rounds ? '' : 'disabled'}>Deshacer última</button>` : `
        <div class="reto-count"><b>${st.step + 1}</b><small>de ${rounds.length} rondas · ronda de ${n}</small></div>
        <div class="reto-moves">${R.moves.map(([x, k]) => `<span><b>${k * n}</b> ${x.toLowerCase()}</span>`).join('')}</div>
        <div class="xp" style="margin:8px 0"><div class="xp-track"><div class="xp-fill" style="width:${st.step / rounds.length * 100}%"></div></div></div>
        <button class="block reto-big" id="rt-next">✓ Ronda lista</button>`}
      <div class="row" style="margin-top:10px"><button class="secondary" id="rt-pause" style="flex:1">${st.pauseAt ? '▶ Reanudar' : '⏸ Pausa'}</button><button class="secondary" id="rt-stop" style="flex:1">■ Terminar</button></div>
    </div>`;
    tick(m);
    const plus = $('#rt-plus', m); if (plus) plus.onclick = () => { st.rounds++; st.log.push(Math.round(elapsed())); vibrate(20); draw(m); };
    const undo = $('#rt-undo', m); if (undo) undo.onclick = () => { if (st.rounds) { st.rounds--; st.log.pop(); draw(m); } };
    const next = $('#rt-next', m); if (next) next.onclick = () => {
      st.log.push(Math.round(elapsed())); st.step++; vibrate(20);
      if (st.step >= rounds.length) { say('¡Escalera completa!'); end(true); return; }
      say(`Ronda de ${rounds[st.step]}`); draw(m);
    };
    $('#rt-pause', m).onclick = () => { if (st.pauseAt) { st.pausedMs += Date.now() - st.pauseAt; st.pauseAt = null; } else st.pauseAt = Date.now(); draw(m); };
    $('#rt-stop', m).onclick = () => { if (confirm(R.kind === 'amrap' ? '¿Terminar antes de tiempo? Se guarda lo que llevas.' : '¿Terminar sin completar la escalera? Se guarda como intento parcial.')) end(false); };
  };
  openModal('', m => { draw(m); timer = setInterval(() => { const mm = $('#modal'); if (mm && $('#rt-clock', mm)) tick(mm); }, 500); });
  return st;
}
/** Guarda el resultado: en Cindy preguntas las repeticiones extra de la última ronda incompleta. */
function finishReto(st, R, finished) {
  const sec = Math.round(((st.pauseAt || Date.now()) - st.start - st.pausedMs) / 1000);
  const save = extra => {
    const r = { id: uid(), type: st.type, size: st.size, variant: st.variant, date: todayStr(), t: Date.now(), sec: R.kind === 'amrap' ? Math.min(sec, st.size * 60) : sec };
    if (R.kind === 'amrap') { r.rounds = st.rounds; r.reps = extra || 0; r.score = st.rounds * 30 + (extra || 0); r.complete = finished; }
    else { r.roundsDone = st.step; r.complete = st.step >= ladderRounds(st.size).length; }
    const prev = retoBest(retoKey(r));
    r.pr = r.complete !== false && (!prev || (r.type === 'cindy' ? r.score > prev.score : r.sec < prev.sec));
    DB.retos = (DB.retos || []).concat(r);
    DB.activities = (DB.activities || []).concat({ id: uid(), date: r.date, type: 'reto', min: Math.max(1, Math.round(r.sec / 60)), rpe: 8, t: r.t, reto: r.id });
    if (r.pr) addEvent(r.date, 'retopr', `${prev ? 'Nueva marca' : 'Primera marca'} en ${R.name}: ${retoScoreTxt(r)}`, '🏅');
    saveData();
    openModal(`<h3>${r.pr ? '🏅 ¡Nueva marca!' : R.ico + ' Reto guardado'}</h3>
      <div class="reto-count"><b>${esc(retoScoreTxt(r))}</b><small>${R.name} · ${R.kind === 'amrap' ? st.size + ' min' : 'hasta ' + st.size} · ${durStr(r.sec)}</small></div>
      ${prev ? `<p class="small" style="text-align:center">Tu marca anterior: <b>${esc(retoScoreTxt(prev))}</b> (${shortDate(prev.date)}).</p>` : '<p class="small" style="text-align:center">Es tu primera marca en esta versión. La próxima vez compites contra ella.</p>'}
      <p class="small muted">Repite este reto en 1–2 semanas con la misma versión para comparar de verdad. Si te dolió algo (no cansancio, dolor), regístralo en Más → Molestias.</p>
      <button class="block" id="rr-ok">Listo</button>`, m => { $('#rr-ok', m).onclick = () => { closeModal(); render(currentTab); }; });
    if (r.pr) setTimeout(() => burst($('#modal')), 200);
  };
  if (R.kind === 'amrap') {
    openModal(`<h3>${R.ico} ${st.rounds} rondas completas</h3>
      <p class="small muted" style="margin-top:0">¿Cuántas repeticiones hiciste de la ronda que no terminaste? (máximo 29)</p>
      <label>Repeticiones extra<input id="rr-extra" inputmode="numeric" value="0"></label>
      <button class="block" id="rr-save">Guardar</button>`, m => { $('#rr-save', m).onclick = () => { const x = Math.max(0, Math.min(29, Math.round(num($('#rr-extra', m).value) || 0))); save(x); }; });
  } else save(0);
}

/** Ficha honesta: qué está confirmado de su entrenamiento y qué copiar (y qué no). */
function openHollandInfo() {
  openModal(`<h3>🕷️ Cómo entrena Tom Holland</h3>
    <p class="small muted" style="margin-top:0">Lo confirmado de su preparación para Spider-Man (2016–2026), según el informe que compartiste. Las rutinas "semana completa de Tom Holland" que circulan en internet son reconstrucciones.</p>
    <table class="small facts"><tbody>
      <tr><td><b>Base</b></td><td>Gimnasia, acrobacia y danza (Billy Elliot, 2008–2010).</td></tr>
      <tr><td><b>Homecoming</b></td><td>Un mes de stunts, boxeo diario y mucha flexibilidad.</td></tr>
      <tr><td><b>Far From Home</b></td><td>Hipertrofia con George Ashwell: +6 kg de músculo. Circuito de 5 rondas: peso muerto ×8, press inclinado ×10, elevaciones de piernas ×15 y fondos lastrados ×12.</td></tr>
      <tr><td><b>No Way Home</b></td><td>Duffy Gaver: HIIT y la "escalera" de ~1,500 repeticiones. Corte de 74 a 66–67 kg.</td></tr>
      <tr><td><b>Brand New Day</b></td><td>Peso corporal + chaleco lastrado + culturismo, "músculo real en vez de relleno". Cindy como entrenamiento corto.</td></tr>
    </tbody></table>
    <div class="pf-sec">Lo que sí puedes copiar</div>
    <ul class="small" style="margin:0;padding-left:18px">
      <li><b>La estructura, no el volumen:</b> circuito de fuerza 2–3 veces por semana + un reto de peso corporal semanal. Rutina lista en Entreno → Tu rutina → "Héroe ágil".</li>
      <li><b>No quites el cardio</b> aunque busques músculo: él mismo dijo que sin cardio quedó "increíblemente en baja forma".</li>
      <li><b>Porciones con la mano</b> (método de Ashwell): en cada comida, 2 puños de proteína, 2 de carbohidratos y 2 de verduras.</li>
      <li><b>Creatina y proteína:</b> él dice tomarlas; la creatina tiene buena evidencia.</li>
    </ul>
    <div class="pf-sec">Lo que no</div>
    <ul class="small" style="margin:0;padding-left:18px">
      <li><b>500 kcal al día y correr 16 km</b> (para la película Cherry): él mismo dijo que no lo repetiría por los riesgos.</li>
      <li><b>Mortales sin progresión ni entrenador:</b> su ventaja son 10+ años de gimnasia, y aun así se ha lesionado.</li>
      <li><b>Macros "de Tom Holland"</b> (2,500–2,900 kcal, 35 % proteína): no salen de él ni de sus entrenadores; son inventados.</li>
    </ul>
    <p class="small muted" style="margin:10px 0">Contenido informativo, sin afiliación con Marvel, Sony ni el actor.</p>
    <button class="block" id="hi-ok">Cerrar</button>`, m => { $('#hi-ok', m).onclick = closeModal; });
}
