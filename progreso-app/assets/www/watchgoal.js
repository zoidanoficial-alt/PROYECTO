'use strict';
/* =====================================================================
 *  37.0 · Mi Watch como herramienta para tu objetivo
 *  - Control universal: los botones de música del reloj manejan lo que estés haciendo:
 *      HYROX (temporizador) · Gimnasio (descanso) · Correr (pausa y ritmo hablado).
 *  - La pantalla de música del reloj muestra tu dato clave en cada caso.
 *  - Descanso guiado por pulso: te avisa cuando tu pulso bajó lo suficiente.
 *  - Panel "Tu reloj para tu objetivo": qué aporta cada conexión a tu disciplina.
 *  Nada se envía fuera del teléfono.
 * ===================================================================== */
const WG = { started: false, tick: null, lastPush: 0, readyBuzz: false };
const wgRemote = () => !!(DB.watch && DB.watch.remoteOk && DB.watch.remoteAll !== false && hasBridge('watchStart'));
const wgHrLive = () => WATCH.hr && Date.now() - WATCH.hr.at < 10000;
/** Pulso de "listo para la siguiente serie": 40 % de tu reserva cardiaca sobre el reposo (guía práctica). */
function restReadyBpm() {
  const rhr = (typeof trAvgRec === 'function' && trAvgRec(todayStr(), 'rhr')) || 60;
  return Math.round(rhr + 0.4 * (maxHr() - rhr));
}
function wgMode() {
  if ((typeof hxt === 'function' && hxt()) || (DB.hyrox && DB.hyrox.active)) return 'hyrox';
  if (typeof RUN !== 'undefined' && RUN.st) return 'run';
  if (typeof activeSession === 'function' && activeSession()) return 'gym';
  return null;
}
/** El ejercicio en curso: el primero al que le faltan series. */
function wgGymNow() {
  const s = activeSession(); if (!s) return null;
  const exs = sessionExercises(s);
  for (let i = 0; i < exs.length; i++) {
    const e = exs[i], done = DB.lifts.filter(l => l.sid === s.id && l.ex === e[0]).length;
    if (done < e[1]) return { name: e[0], set: done + 1, sets: e[1], rest: e[3] || 90, next: exs[i + 1] ? exs[i + 1][0] : null, i, n: exs.length };
  }
  return { name: 'Sesión completa', set: 0, sets: 0, rest: 90, next: null, done: true };
}

/* ---------- Comandos del reloj ---------- */
(() => {
  const prev = window.onWatchCmd;
  window.onWatchCmd = (c, at) => {
    const mode = WATCH.testing ? null : wgMode();
    if (mode === 'gym') return wgGymCmd(c);
    if (mode === 'run') return wgRunCmd(c);
    if (prev) prev(c, at);
  };
})();
function wgGymCmd(c) {
  const g = wgGymNow(); if (!g) return;
  const resting = REST.end > Date.now();
  if (c === 'next') { if (resting) stopRest(); vibrate(40); }
  else if (c === 'prev') { if (resting) { REST.end += 15000; REST.total += 15; saveRest(); scheduleRestAlarm(); tickRest(); } }
  else { if (resting) stopRest(); else startRest(g.rest, g.name + ' · descanso'); }
  wgPush(true);
}
function wgRunCmd(c) {
  if (c === 'next') { const st = RUN.st, km = st.dist / 1000, sec = runElapsed(); say(`${fmt(km, 2)} kilómetros. ${km > 0.05 ? 'Ritmo ' + mmss(sec / km) + ' por kilómetro.' : ''}${wgHrLive() ? ' Pulso ' + WATCH.hr.bpm + '.' : ''}`); }
  else if (c !== 'prev') pauseRun();
  wgPush(true);
}

/* ---------- Pantalla del reloj (metadatos de música) ---------- */
function wgPush(force) {
  if (!WG.started || !hasBridge('watchUpdate')) return;
  const now = Date.now(); if (!force && now - WG.lastPush < 5000) return; WG.lastPush = now;
  const mode = wgMode(), hr = wgHrLive() ? ` · ${WATCH.hr.bpm} lpm` : '';
  if (mode === 'gym') {
    const g = wgGymNow(), left = Math.max(0, Math.ceil((REST.end - now) / 1000));
    if (left > 0) bridge.watchUpdate(`Descanso ${mmss(left)}`, `Sigue: ${g.name}${g.set ? ` · serie ${g.set}/${g.sets}` : ''}${hr}`, true, Math.round((REST.total - left) * 1000));
    else bridge.watchUpdate(g.done ? 'Sesión completa' : `${g.name} · serie ${g.set}/${g.sets}`, `▶ inicia descanso de ${mmss(g.rest)}${hr}`, false, 0);
  } else if (mode === 'run') {
    const st = RUN.st, km = st.dist / 1000, sec = runElapsed();
    bridge.watchUpdate(`${fmt(km, 2)} km · ${mmss(sec)}`, `${km > 0.05 ? mmss(sec / km) + '/km' : 'ritmo —'}${hr}${st.pauseAt ? ' · en pausa' : ''}`, !st.pauseAt, Math.round(sec * 1000));
  }
}
/** Enciende el control del reloj cuando hay algo que controlar y lo apaga al terminar (solo si lo encendimos nosotros). */
function wgLoop() {
  const mode = wgMode();
  if ((mode === 'gym' || mode === 'run') && wgRemote()) {
    if (!WG.started) { WG.started = true; bridge.watchStart(mode === 'gym' ? 'Gimnasio' : 'Carrera', 'Controla Mi Progreso desde tu reloj'); if (typeof hrAutoConnect === 'function') hrAutoConnect(); }
    wgPush(false);
  } else if (WG.started && mode !== 'hyrox') { WG.started = false; if (hasBridge('watchStop')) bridge.watchStop(); }
  wgRestHr();
}
/** Descanso guiado por pulso. */
function wgRestHr() {
  const lbl = document.getElementById('tb-label'); if (!lbl) return;
  const resting = REST.end > Date.now();
  if (!resting || !wgHrLive()) { WG.readyBuzz = false; const c = document.getElementById('tb-hr'); if (c) c.remove(); return; }
  let chip = document.getElementById('tb-hr');
  if (!chip) { chip = document.createElement('span'); chip.id = 'tb-hr'; chip.className = 'tb-hr'; lbl.after(chip); }
  const ready = WATCH.hr.bpm <= restReadyBpm();
  chip.textContent = `${WATCH.hr.bpm} lpm${ready ? ' · listo' : ''}`; chip.classList.toggle('ok', ready);
  if (ready && !WG.readyBuzz) { WG.readyBuzz = true; vibrate(150); }
}
setInterval(() => { try { if (typeof DB !== 'undefined' && DB) wgLoop(); } catch (e) {} }, 1000);

/* ---------- Panel: tu reloj para tu objetivo ---------- */
const WG_SPORT = {
  hyrox: 'Temporizador HYROX desde el reloj, pulso por estación y tu carga real para no llegar fundido a la carrera.',
  run: 'Pausa y ritmo hablado desde el reloj, zonas de pulso y tu VO₂máx y tiempo previsto subiendo semana a semana.',
  tri: 'Tus entrenos de bici, natación y carrera del modo Entrenamiento llegan con su pulso y suman a tu forma.',
  spartan: 'Correr + fuerza: el reloj controla descansos y carrera, y tu carga muestra si vas al punto justo.',
  bici: 'Tus rodadas del modo Entrenamiento llegan con su pulso y construyen tu gráfica de forma.',
  fisico: 'Descansos controlados desde el reloj y guiados por pulso, más tu sueño y recuperación para crecer.',
  fuerza: 'Descansos desde el reloj y guiados por tu pulso; sueño y HRV deciden cuándo apretar.'
};
function wgGoalHtml() {
  const w = wst(), sp = typeof mainSport === 'function' ? mainSport() : 'fuerza', hrOk = !!w.hrDev;
  const row = (ok, i, t, s) => `<div class="wg-row ${ok ? 'ok' : ''}">${ico(ok ? 'check' : i, 18)}<span><b>${t}</b><small>${s}</small></span></div>`;
  return `<div class="wg-goal"><div class="hx-eyebrow">TU RELOJ PARA TU OBJETIVO · ${esc(SPORTS[sp].n.toUpperCase())}</div>
    <p>${esc(WG_SPORT[sp])}</p>
    ${row(w.hcOn, 'moon', 'Recuperación automática', w.hcOn ? 'Sueño, pulso en reposo y HRV deciden tu chequeo de cada mañana' : 'Conecta Mi Fitness (paso 1) y tu chequeo se llena solo')}
    ${row(w.remoteOk, 'play', 'Control desde el reloj', w.remoteOk ? 'HYROX: estaciones · Gimnasio: ▶ descanso, ⏭ saltar, ⏮ +15 s · Correr: ▶ pausa, ⏭ ritmo hablado' : 'Pruébalo una vez (paso 2) y queda listo para gimnasio, carrera y HYROX')}
    ${row(hrOk, 'heart-pulse', 'Pulso en vivo', hrOk ? `Zonas en vivo y descanso guiado: listo cuando bajas de ${restReadyBpm()} lpm` : 'Activa “Transmitir frecuencia cardiaca” o usa una banda (paso 3)')}
    ${row((w.exInbox || []).length || (w.hcOrigins || []).length, 'activity', 'Entrenos del reloj', 'Lo que grabas en el modo Entrenamiento llega con pulso y suma a tu forma')}
    ${w.remoteOk ? `<label class="habit"><input type="checkbox" id="wg-all" ${w.remoteAll !== false ? 'checked' : ''}> Usar el reloj también en gimnasio y carrera</label>` : ''}</div>`;
}
(() => {
  const base = wtRender;
  wtRender = function () {
    base();
    const root = $('#wt-root'); if (!root) return;
    const h = root.querySelector('h3'); if (h) h.insertAdjacentHTML('afterend', wgGoalHtml());
    const c = $('#wg-all', root); if (c) c.onchange = () => { wst().remoteAll = c.checked; saveData(); };
  };
})();
