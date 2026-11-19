'use strict';
/* =====================================================================
 *  28.0 · Mi reloj: Mi Fitness → Health Connect, pulso en vivo y control remoto
 *  Xiaomi no deja instalar apps en el Mi Watch ni dentro de Mi Fitness. Mi Progreso se conecta así:
 *   1) Health Connect: Mi Fitness escribe pulso, sueño, pulso en reposo, HRV, pasos y entrenos;
 *      la app los lee (Android 14+), sin internet y sin cuentas.
 *   2) Control remoto: el reloj controla la música del teléfono; Mi Progreso se presenta como
 *      reproductor y play/pausa/siguiente manejan el temporizador HYROX.
 *   3) Pulso en vivo: perfil Bluetooth estándar (bandas de pecho y relojes que lo transmiten).
 * ===================================================================== */

const WATCH = { hr: null, rr: [], devices: [], hrStatus: 'idle', hcReq: {}, testing: false };
function wst() {
  if (!DB.watch) DB.watch = { hrDev: null, hcOn: false, hcSync: null, hcOrigins: [], remoteOk: false, maxHr: null };
  return DB.watch;
}
const hasBridge = k => !!(bridge && typeof bridge[k] === 'function');
function maxHr() { const w = wst(); return w.maxHr || Math.round(208 - 0.7 * (Number(DB.profile.age) || 30)); }   // Tanaka (estimado)
function hrZone(bpm) { if (!bpm) return 0; const p = bpm / maxHr(); return p < 0.6 ? 1 : p < 0.7 ? 2 : p < 0.8 ? 3 : p < 0.9 ? 4 : 5; }
const ZONE_N = ['', 'Z1 suave', 'Z2 aeróbica', 'Z3 tempo', 'Z4 umbral', 'Z5 máximo'];

/* ---------- Pulso en vivo ---------- */
window.onHr = (bpm, rr, contact, at) => {
  if (!bpm || bpm < 25 || bpm > 240) return;
  WATCH.hr = { bpm, at: at || Date.now(), contact: contact !== false };
  if (rr && rr.length) { WATCH.rr.push(...rr); if (WATCH.rr.length > 600) WATCH.rr.splice(0, WATCH.rr.length - 600); }
  if (typeof hxtOnHr === 'function') hxtOnHr(bpm, rr || [], WATCH.hr.at);
  $$('.live-hr').forEach(el => { el.textContent = bpm; el.dataset.z = hrZone(bpm); });
  $$('.live-zone').forEach(el => { el.textContent = ZONE_N[hrZone(bpm)]; el.dataset.z = hrZone(bpm); });
};
window.onHrDevice = d => { if (!WATCH.devices.some(x => x.id === d.id)) { WATCH.devices.push(d); const l = $('#wt-devs'); if (l) l.innerHTML = wtDevicesHtml(); wtBindDevices(); } };
window.onHrStatus = s => {
  WATCH.hrStatus = s;
  const el = $('#wt-hrst'); if (el) el.textContent = HR_STATUS[s] || s;
  if (s === 'streaming' && typeof toast === 'function' && wst().hrDev) toast('Pulso en vivo: ' + wst().hrDev.name);
};
const HR_STATUS = { idle: 'Sin sensor', scanning: 'Buscando sensores… (15 s)', scan_done: 'Búsqueda terminada', connecting: 'Conectando…', connected: 'Conectado, leyendo…', streaming: 'Recibiendo pulso en vivo', disconnected: 'Desconectado (reintenta solo)', off: 'Activa el Bluetooth', denied: 'Sin permiso de Bluetooth', unsupported: 'Este teléfono no tiene Bluetooth LE', no_hr_service: 'Ese dispositivo no transmite pulso', scan_failed: 'No se pudo buscar; reintenta' };
function hrAutoConnect() { const d = wst().hrDev; if (d && hasBridge('hrConnect') && WATCH.hrStatus !== 'streaming') bridge.hrConnect(d.id); }

/* ---------- Health Connect ---------- */
function hcStatus() { try { return hasBridge('hcStatus') ? bridge.hcStatus() : 'web'; } catch (e) { return 'web'; } }
window.onHcStatus = s => { wst().hcOn = s === 'granted' || s === 'partial'; saveData(); if (wst().hcOn) hcSync(true); if ($('#wt-root')) wtRender(); };
window.onHcData = (id, data) => { const cb = WATCH.hcReq[id]; delete WATCH.hcReq[id]; if (cb) cb(data); };
function hcRead(fromMs, toMs) {
  return new Promise(res => {
    if (!hasBridge('hcRead')) return res(null);
    const id = 'r' + Date.now() + Math.random().toString(36).slice(2, 6);
    WATCH.hcReq[id] = res; bridge.hcRead(id, String(Math.round(fromMs)), String(Math.round(toMs)));
    setTimeout(() => { if (WATCH.hcReq[id]) { delete WATCH.hcReq[id]; res(null); } }, 20000);
  });
}
/**
 * Importa los últimos días: sueño, pulso en reposo y HRV van al chequeo de recuperación
 * (solo si tú no escribiste ese dato), y el pulso de cada sesión HYROX que aún no lo tenga.
 */
async function hcSync(manual) {
  const w = wst(); if (!w.hcOn) return null;
  const to = Date.now(), from = to - 3 * 864e5, data = await hcRead(from, to);
  if (!data || data.error) { if (manual) toast(data && data.error === 'unsupported' ? 'Health Connect requiere Android 14 o más' : 'No pude leer Health Connect'); return null; }
  const day = ms => dateStr(new Date(ms)), touched = new Set();
  const rec = d => { DB.days[d] = DB.days[d] || {}; DB.days[d].rec = DB.days[d].rec || {}; return DB.days[d].rec; };
  const fill = (d, k, v) => { const r = rec(d); if (r[k] == null || (r.src && r.src[k] === 'watch')) { r[k] = v; r.src = Object.assign(r.src || {}, { [k]: 'watch' }); touched.add(d); } };
  // Sueño: se asigna al día en que despiertas.
  const sleepBy = {}; (data.sleep || []).forEach(([s, e]) => { const d = day(e); sleepBy[d] = (sleepBy[d] || 0) + (e - s) / 36e5; });
  Object.entries(sleepBy).forEach(([d, h]) => { fill(d, 'sleepH', Math.round(h * 10) / 10); DB.days[d].sleep = DB.days[d].rec.sleepH; });
  const lastBy = arr => { const o = {}; (arr || []).forEach(([t, v]) => { o[day(t)] = Math.round(v); }); return o; };
  Object.entries(lastBy(data.rhr)).forEach(([d, v]) => fill(d, 'rhr', v));
  Object.entries(lastBy(data.hrv)).forEach(([d, v]) => fill(d, 'hrv', v));
  const steps = {}; (data.steps || []).forEach(([s, e, n]) => { const d = day(s); steps[d] = (steps[d] || 0) + n; });
  Object.entries(steps).forEach(([d, n]) => { DB.days[d] = DB.days[d] || {}; DB.days[d].steps = n; });
  // Pulso de las sesiones del temporizador que se hicieron sin sensor en vivo.
  let sessionsFilled = 0;
  ((DB.hyrox && DB.hyrox.runs) || []).filter(r => !r.hrLive && !r.hrFromWatch && r.t0 >= from).forEach(r => {
    const pts = (data.hr || []).filter(([t]) => t >= r.t0 && t <= r.t1);
    if (pts.length < 3) return;
    r.segs.forEach(sg => { const p = pts.filter(([t]) => t >= sg.start && t <= sg.end); if (p.length) { sg.hrAvg = Math.round(p.reduce((a, x) => a + x[1], 0) / p.length); sg.hrMax = Math.max(...p.map(x => x[1])); } });
    r.hrAvg = Math.round(pts.reduce((a, x) => a + x[1], 0) / pts.length); r.hrMax = Math.max(...pts.map(x => x[1])); r.hrFromWatch = true; sessionsFilled++;
  });
  w.hcSync = Date.now(); w.hcOrigins = data.origins || []; saveData();
  const res = { days: touched.size, steps: Object.keys(steps).length, hr: (data.hr || []).length, sessionsFilled, origins: w.hcOrigins };
  if (manual) toast(res.hr || touched.size ? `Sincronizado: ${touched.size} día(s) de recuperación${sessionsFilled ? ` · pulso en ${sessionsFilled} sesión(es)` : ''}` : 'Health Connect no tiene datos nuevos. Abre Mi Fitness para que sincronice tu reloj.');
  return res;
}
const fromMiFitness = () => (wst().hcOrigins || []).some(p => /com\.mi\.health|com\.xiaomi\.wearable|xiaomi/i.test(p));

/* ---------- Control remoto desde el reloj ---------- */
window.onWatchCmd = (c, at) => {
  if (WATCH.testing) { WATCH.testing = false; wst().remoteOk = true; saveData(); toast('¡Tu reloj controla Mi Progreso!'); if (hasBridge('watchStop')) bridge.watchStop(); if ($('#wt-root')) wtRender(); return; }
  if (typeof hxtCommand === 'function') hxtCommand(c, at || Date.now());
};
/** Toques que llegaron mientras la página estaba cerrada (con su hora real). */
function watchDrain() {
  if (!hasBridge('watchDrain')) return;
  try { JSON.parse(bridge.watchDrain() || '[]').forEach(x => window.onWatchCmd(x.c, x.at)); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  watchDrain();
  const w = DB && DB.watch;
  if (w && w.hcOn && (!w.hcSync || Date.now() - w.hcSync > 30 * 60e3)) hcSync(false);
});
// Privacidad: Health Connect abre la app para mostrar cómo usamos los datos.
(() => { const prev = window.onNotifOpen; window.onNotifOpen = tab => { if (tab === 'hcprivacy') { openWatchPrivacy(); return; } if (prev) prev(tab); }; })();

/* ---------- Pantalla "Mi reloj" ---------- */
function openWatch() { openModal('<div id="wt-root"></div>', () => { wtRender(); if (wst().hcOn && (!wst().hcSync || Date.now() - wst().hcSync > 10 * 60e3)) hcSync(false).then(() => $('#wt-root') && wtRender()); }); }
function wtDevicesHtml() { return WATCH.devices.length ? WATCH.devices.map(d => `<button class="kit-item" data-hrd="${esc(d.id)}">${ico('heart-pulse', 20)}<span class="grow"><b>${esc(d.name)}</b><small>señal ${d.rssi} dBm</small></span>${ico('chevron-right', 16)}</button>`).join('') : ''; }
function wtBindDevices() { $$('[data-hrd]').forEach(b => b.onclick = () => { const d = WATCH.devices.find(x => x.id === b.dataset.hrd); wst().hrDev = { id: d.id, name: d.name }; saveData(); bridge.hrConnect(d.id); }); }
function wtRender() {
  const root = $('#wt-root'); if (!root) return;
  const w = wst(), st = hcStatus(), native = !!bridge, live = WATCH.hr && Date.now() - WATCH.hr.at < 10000;
  const hcBlock = st === 'web' ? '<p class="small muted">Disponible en la app de Android.</p>'
    : st === 'unsupported' ? '<div class="status warn"><b>Requiere Android 14 o superior</b>Health Connect viene integrado desde Android 14. En versiones anteriores llegará en una actualización.</div>'
    : st === 'unavailable' ? '<div class="status warn"><b>Health Connect no está disponible</b>Actualiza Android o instala Health Connect desde Google Play.</div>'
    : `<ol class="wt-steps">
        <li class="${fromMiFitness() ? 'ok' : ''}"><b>En Mi Fitness:</b> Perfil → Health Connect (o “Compartir datos”) → activa pulso, sueño y entrenos.<button class="secondary" id="wt-mif">Abrir Mi Fitness</button></li>
        <li class="${st === 'granted' ? 'ok' : ''}"><b>En Mi Progreso:</b> permite leer esos datos.${st === 'granted' ? ' <span class="ev-ver ok"><i></i>Permitido</span>' : `<button id="wt-hcp">${st === 'partial' ? 'Completar permisos' : 'Dar permiso'}</button>`}</li>
      </ol>
      ${w.hcOn ? `<p class="small">${w.hcSync ? 'Última sincronización: ' + new Date(w.hcSync).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Aún sin sincronizar'}${w.hcOrigins.length ? ' · fuentes: ' + esc(w.hcOrigins.map(p => /mi\.health|xiaomi/.test(p) ? 'Mi Fitness' : p).join(', ')) : ''}</p>
        ${w.hcOn && w.hcSync && !fromMiFitness() ? '<p class="small muted">Aún no veo datos de Mi Fitness. Abre Mi Fitness y espera a que sincronice tu reloj.</p>' : ''}
        <div class="row" style="gap:8px"><button class="secondary" id="wt-sync" style="flex:1">Sincronizar ahora</button><button class="ghost" id="wt-hcs">Ajustes de Health Connect</button></div>` : ''}`;
  root.innerHTML = `<div class="hx-eyebrow">MI RELOJ</div><h3 style="margin-top:4px">Conecta tu reloj</h3>
    <p class="small muted" style="margin-top:0">Xiaomi no permite instalar apps en el Mi Watch, así que Mi Progreso se conecta por tres vías. Todo se queda en tu teléfono.</p>
    <div class="wt-sec"><div class="wt-h">${ico('activity', 20)}<b>1 · Datos de Mi Fitness</b></div>
      <p class="small">Sueño, pulso en reposo y HRV alimentan tu recuperación; el pulso de cada sesión HYROX se agrega cuando el reloj sincroniza (minutos después).</p>${hcBlock}</div>
    <div class="wt-sec"><div class="wt-h">${ico('play', 20)}<b>2 · Controlar el temporizador desde el reloj</b>${w.remoteOk ? '<span class="ev-ver ok"><i></i>Probado</span>' : ''}</div>
      <p class="small">Usa el control de <b>música</b> de tu reloj: <b>▶/⏸</b> inicia o pausa, <b>⏭</b> marca la siguiente estación y <b>⏮</b> deshace. En la pantalla de música del reloj verás la estación y el tiempo.</p>
      ${native ? `<button class="${WATCH.testing ? 'secondary' : ''} block" id="wt-test">${WATCH.testing ? 'Esperando… toca ▶ o ⏭ en tu reloj' : 'Probar con mi reloj'}</button>` : '<p class="small muted">Disponible en la app de Android.</p>'}
      <p class="small muted">Si escuchas música con otra app, el control del reloj manejará la última que empezó a sonar: abre el temporizador después de poner tu música.</p></div>
    <div class="wt-sec"><div class="wt-h">${ico('heart-pulse', 20)}<b>3 · Pulso en vivo</b></div>
      <p class="small">Durante el temporizador ves tu pulso y tu zona en tiempo real. Funciona con bandas de pecho (Polar, Garmin, Coospo…) y con relojes que transmiten el pulso por Bluetooth.</p>
      <div class="wt-live"><b class="live-hr t-metric" data-z="${live ? hrZone(WATCH.hr.bpm) : 0}">${live ? WATCH.hr.bpm : '—'}</b><span><small class="live-zone">${live ? ZONE_N[hrZone(WATCH.hr.bpm)] : 'lpm'}</small><small id="wt-hrst">${HR_STATUS[WATCH.hrStatus] || ''}</small></span></div>
      ${w.hrDev ? `<p class="small">Sensor guardado: <b>${esc(w.hrDev.name)}</b> · se conecta solo al iniciar el temporizador.</p>` : ''}
      ${native ? `<div class="row" style="gap:8px"><button class="secondary" id="wt-scan" style="flex:1">Buscar sensores</button>${w.hrDev ? '<button class="ghost" id="wt-forget">Olvidar</button>' : ''}</div><div id="wt-devs">${wtDevicesHtml()}</div>` : '<p class="small muted">Disponible en la app de Android.</p>'}
      <p class="small muted">¿Tu Mi Watch aparece al buscar? Si en el reloj existe “Transmitir frecuencia cardiaca”, actívala primero. Si no aparece, tu modelo no transmite el pulso; usa una banda de pecho y el reloj para el control remoto.</p>
      <label>Pulso máximo (lpm)<input id="wt-max" inputmode="numeric" value="${w.maxHr || ''}" placeholder="${maxHr()} (estimado por edad)"></label></div>
    <button class="ghost block" id="wt-priv">Cómo usamos tus datos de salud</button><button class="ghost block" id="wt-x">Cerrar</button>`;
  const on = (id, f) => { const b = $('#' + id, root); if (b) b.onclick = f; };
  on('wt-mif', () => bridge.openMiFitness());
  on('wt-hcp', () => bridge.hcRequest());
  on('wt-hcs', () => bridge.hcOpenSettings());
  on('wt-sync', () => hcSync(true).then(() => wtRender()));
  on('wt-test', () => { if (WATCH.testing) { WATCH.testing = false; bridge.watchStop(); } else { WATCH.testing = true; bridge.watchStart('Toca ▶ en tu reloj', 'Prueba de Mi Progreso'); } wtRender(); });
  on('wt-scan', () => { WATCH.devices = []; bridge.hrScan(); wtRender(); });
  on('wt-forget', () => { wst().hrDev = null; saveData(); if (hasBridge('hrDisconnect')) bridge.hrDisconnect(); wtRender(); });
  on('wt-priv', openWatchPrivacy);
  on('wt-x', () => { if (WATCH.testing) { WATCH.testing = false; bridge.watchStop(); } closeModal(); });
  const mx = $('#wt-max', root); if (mx) mx.onchange = () => { const v = num(mx.value); wst().maxHr = v && v > 120 && v < 230 ? Math.round(v) : null; saveData(); };
  wtBindDevices();
}
function openWatchPrivacy() {
  openModal(`<h3>Tus datos de salud</h3>
    <ul class="comp-list">
      <li>${ico('check', 16)}<span>Mi Progreso <b>solo lee</b> de Health Connect: pulso, pulso en reposo, HRV, sueño, pasos y entrenos. No escribe ni borra nada.</span></li>
      <li>${ico('check', 16)}<span>Se usan para tu recuperación diaria, el pulso de tus sesiones HYROX y tus decisiones de entrenamiento.</span></li>
      <li>${ico('check', 16)}<span>Todo se guarda en tu teléfono. No se envía a ningún servidor ni se comparte; no hay cuentas.</span></li>
      <li>${ico('check', 16)}<span>Si escribes un dato a mano, el del reloj no lo reemplaza.</span></li>
      <li>${ico('check', 16)}<span>Puedes quitar el permiso cuando quieras en los ajustes de Health Connect; lo ya importado se queda solo en esta app.</span></li>
    </ul><button class="block" id="pv-x">Entendido</button>`, m => { $('#pv-x', m).onclick = closeModal; });
}

// Al abrir la app: aplica toques del reloj pendientes y trae datos nuevos de Mi Fitness.
window.addEventListener('load', () => setTimeout(() => { try { watchDrain(); if (DB.watch && DB.watch.hcOn) hcSync(false); } catch (e) {} }, 800));
