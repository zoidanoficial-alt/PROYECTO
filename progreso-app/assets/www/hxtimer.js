'use strict';
/* =====================================================================
 *  28.0 · Temporizador HYROX integrado (sin escribir tiempos a mano)
 *  Modos: carrera completa (8 km + 8 estaciones), una estación, 1 km fresco, estación + 1 km.
 *  Se controla en pantalla o desde el reloj (▶/⏸ iniciar-pausar · ⏭ siguiente · ⏮ deshacer).
 *  Cada toque guarda su hora real; el estado vive en DB.hyrox.timer y sobrevive a cierres.
 *  Al terminar registra solo las pruebas en HYROX Lab, con el pulso de cada tramo.
 * ===================================================================== */

function hxtSegments(mode, st) {
  if (mode === 'race') { const out = []; HX_STATIONS.forEach((s, i) => { out.push({ k: 'run', n: `Run ${i + 1}`, d: '1 km' }); out.push({ k: s.k, n: pfStName(s.k), d: pfStDose(s.k) }); }); return out; }
  if (mode === 'station') return [{ k: st, n: pfStName(st), d: pfStDose(st) }];
  if (mode === 'run1k') return [{ k: 'run', n: '1 km fresco', d: 'a tope, bien calentado' }];
  if (mode === 'comp') return [{ k: st, n: pfStName(st), d: pfStDose(st) }, { k: 'run', n: '1 km bajo fatiga', d: 'sin descanso' }];
  return [];
}
const HXT_TITLE = { race: 'Simulación de carrera', station: 'Prueba de estación', run1k: '1 km fresco', comp: 'Running bajo fatiga' };
const hxt = () => (DB.hyrox && DB.hyrox.timer) || null;
/** 37.0 · Tu fantasma: tu mejor versión anterior del mismo tramo, en tiempo acumulado por segmento (s). */
function hxtGhost(mode, st) {
  const prev = (hx().runs || []).filter(r => r.mode === mode && (r.st || null) === (st || null) && r.segs && r.segs.length === hxtSegments(mode, st).length);
  const best = prev.reduce((b, r) => !b || r.total < b.total ? r : b, null);
  if (best) { let c = 0; return { src: 'tu mejor ' + (mode === 'race' ? 'simulación' : 'intento') + ' (' + shortDate(best.date) + ')', cum: best.segs.map(x => (c += x.sec)) }; }
  const one = mode === 'run1k' ? hxBest('run1k') : mode === 'station' ? hxBest('st', st) : null;
  return one ? { src: 'tu récord (' + shortDate(one.date) + ')', cum: [one.sec] } : null;
}
function hxtGhostTxt(t, short) {
  const g = t && t.ghost; if (!g || !t.t0) return '';
  const n = hxtNow(t), tot = n.total / 1000, i = Math.min(t.i, g.cum.length - 1), left = g.cum[i] - tot;
  if (short) return left >= 0 ? ` · récord en ${hxT(left)}` : ` · +${hxT(-left)} vs récord`;
  return left >= 0 ? `Te quedan <b>${hxT(left)}</b> para ganarle a tu fantasma en este tramo` : `Tu fantasma ya cerró este tramo: vas <b>+${hxT(-left)}</b>`;
}
let hxtTick = null, hxtLastPush = 0;

function hxtCreate(mode, st) {
  hx().timer = { id: 'ht' + Date.now(), mode, pf: typeof hxIsPF === 'function' && hxIsPF(), st: st || null, segs: hxtSegments(mode, st).map(s => ({ ...s, start: null, end: null, hrSum: 0, hrN: 0, hrMax: 0, rr: [] })), i: 0, t0: null, pauses: [], paused: null, hr: [], hrLive: false, ghost: hxtGhost(mode, st) };
  saveData();
  if (bridge && typeof bridge.watchStart === 'function') bridge.watchStart(hxt().segs[0].n, 'Toca ▶ en tu reloj para empezar');
  if (typeof hrAutoConnect === 'function') hrAutoConnect();
  openHxTimer();
}
/** Tiempo activo entre a y b (descuenta pausas). */
function hxtActive(t, a, b) {
  let ms = b - a;
  t.pauses.forEach(([p, q]) => { const s = Math.max(a, p), e = Math.min(b, q == null ? b : q); if (e > s) ms -= e - s; });
  if (t.paused != null) { const s = Math.max(a, t.paused); if (b > s) ms -= b - s; }
  return Math.max(0, ms);
}
function hxtNow(t, at) { at = at || Date.now(); const seg = t.segs[t.i]; return { seg: seg && seg.start ? hxtActive(t, seg.start, seg.end || at) : 0, total: t.t0 ? hxtActive(t, t.t0, at) : 0 }; }

/** Un comando con su hora real: del reloj, de la notificación o de la pantalla. */
function hxtCommand(c, at) {
  const t = hxt();
  if (!t) { if (DB.hyrox && DB.hyrox.active && typeof hxSessionCommand === 'function') hxSessionCommand(c, at); return; }
  if (c === 'play' || (c === 'toggle' && (t.paused != null || !t.t0))) {
    if (!t.t0) { t.t0 = at; t.segs[0].start = at; }
    else if (t.paused != null) { t.pauses.push([t.paused, at]); t.paused = null; }
  } else if (c === 'pause' || c === 'toggle') {
    if (t.t0 && t.paused == null) t.paused = at;
  } else if (c === 'next') {
    if (!t.t0) { hxtCommand('play', at); return; }
    if (t.paused != null) { t.pauses.push([t.paused, at]); t.paused = null; }
    const seg = t.segs[t.i]; seg.end = at;
    if (t.i < t.segs.length - 1) { t.i++; t.segs[t.i].start = at; if (navigator.vibrate) navigator.vibrate(60); }
    else { saveData(); hxtFinish(); return; }
  } else if (c === 'prev') {
    if (t.i > 0) { const cur = t.segs[t.i]; cur.start = null; cur.end = null; cur.hrSum = 0; cur.hrN = 0; cur.hrMax = 0; cur.rr = []; t.i--; t.segs[t.i].end = null; }
    else if (t.t0 && hxtNow(t, at).seg < 15000) { t.t0 = null; t.segs[0].start = null; t.pauses = []; t.paused = null; }
  }
  saveData(); hxtPush(true); hxtPaint();
}
/** Pulso en vivo: se acumula en el tramo actual (y una serie cada 5 s para la gráfica). */
function hxtOnHr(bpm, rr, at) {
  const t = hxt(); if (!t || !t.t0 || t.paused != null) return;
  const seg = t.segs[t.i]; if (!seg || !seg.start) return;
  seg.hrSum += bpm; seg.hrN++; seg.hrMax = Math.max(seg.hrMax, bpm); if (rr.length) seg.rr.push(...rr.slice(0, 4));
  t.hrLive = true;
  const last = t.hr[t.hr.length - 1];
  if (!last || at - last[0] >= 5000) { t.hr.push([at, bpm]); if (t.hr.length % 6 === 0) saveData(); }
}
/** Estado para la pantalla de música del reloj y la notificación. */
function hxtPush(force) {
  const t = hxt(); if (!t || !bridge || typeof bridge.watchUpdate !== 'function') return;
  const now = Date.now(); if (!force && now - hxtLastPush < 5000) return; hxtLastPush = now;
  const seg = t.segs[t.i], n = hxtNow(t), hr = WATCH.hr && now - WATCH.hr.at < 10000 ? ` · ${WATCH.hr.bpm} lpm` : '';
  const title = t.t0 ? `${seg.n} · ${hxT(n.seg / 1000)}` : `${seg.n} · listo`;
  const sub = t.t0 ? `Total ${hxT(n.total / 1000)}${hr}${hxtGhostTxt(t, true)}${t.paused != null ? ' · en pausa' : ''}` : 'Toca ▶ para empezar';
  bridge.watchUpdate(title, sub, !!t.t0 && t.paused == null, Math.round(n.seg));
}

/* ---------- Pantalla del temporizador ---------- */
function openHxTimer() {
  const t = hxt(); if (!t) return;
  watchDrain && watchDrain();
  const seg = t.segs[t.i], nextSeg = t.segs[t.i + 1];
  openModal(`<div class="hxt">
    <div class="row spread"><div class="hx-eyebrow">${esc(HXT_TITLE[t.mode].toUpperCase())}</div><span class="hxt-chips">${bridge && WatchService_running() ? '<span class="ev-ver ok"><i></i>Reloj</span>' : ''}<span class="ev-ver ${WATCH.hr ? 'ok' : ''}" id="hxt-hrchip"><i></i>${WATCH.hr ? 'Pulso en vivo' : 'Sin pulso en vivo'}</span></span></div>
    <div class="hxt-seg"><small id="hxt-idx"></small><b id="hxt-name">${esc(seg.n)}</b><span>${esc(seg.d)}</span></div>
    <div class="hxt-clock t-display-l" id="hxt-seg">0:00</div>
    <div class="hxt-row"><div><small>TOTAL</small><b id="hxt-total">0:00</b></div><div><small>PULSO</small><b class="live-hr" data-z="0">—</b><small class="live-zone"></small></div><div><small>MEDIA TRAMO</small><b id="hxt-avg">—</b></div></div>
    <div class="hxt-ctl">
      <button class="icon-btn hxt-b" id="hxt-prev" aria-label="Deshacer">⏮</button>
      <button class="hxt-play" id="hxt-play" aria-label="Iniciar o pausar"></button>
      <button class="icon-btn hxt-b" id="hxt-next" aria-label="Siguiente">⏭</button>
    </div>
    <p class="small muted hxt-next" id="hxt-nexttxt"></p>
    <div class="hxt-ghost" id="hxt-ghost" hidden></div>
    <div id="hxt-splits"></div>
    <p class="small muted">Desde el reloj: control de música ▶/⏸ inicia o pausa, ⏭ siguiente, ⏮ deshace. Puedes bloquear el teléfono: los tiempos usan la hora real de cada toque.</p>
    <div class="row" style="gap:8px"><button class="ghost" id="hxt-min">Minimizar</button><span class="grow"></span><button class="ghost" id="hxt-del" style="color:var(--bad)">Descartar</button></div>
  </div>`, m => {
    $('#hxt-play', m).onclick = () => hxtCommand('toggle', Date.now());
    $('#hxt-next', m).onclick = () => hxtCommand('next', Date.now());
    $('#hxt-prev', m).onclick = () => hxtCommand('prev', Date.now());
    $('#hxt-min', m).onclick = () => { clearInterval(hxtTick); closeModal(); if (typeof render === 'function') render(currentTab); };
    $('#hxt-del', m).onclick = () => { if (!confirm('¿Descartar este temporizador? No se guardará nada.')) return; clearInterval(hxtTick); hx().timer = null; saveData(); if (bridge && bridge.watchStop) bridge.watchStop(); closeModal(); if (typeof render === 'function') render(currentTab); };
    clearInterval(hxtTick);
    hxtTick = setInterval(() => { if (!document.getElementById('hxt-seg') || !hxt()) return clearInterval(hxtTick); hxtPaint(); hxtPush(false); }, 250);
    hxtPaint(); hxtPush(true);
  });
}
function WatchService_running() { try { return bridge && typeof bridge.watchRunning === 'function' && bridge.watchRunning(); } catch (e) { return false; } }
function hxtPaint() {
  const t = hxt(), el = id => document.getElementById(id); if (!t || !el('hxt-seg')) return;
  const n = hxtNow(t), seg = t.segs[t.i], nx = t.segs[t.i + 1];
  el('hxt-seg').textContent = hxT(n.seg / 1000); el('hxt-total').textContent = hxT(n.total / 1000);
  el('hxt-name').textContent = seg.n;
  el('hxt-idx').textContent = t.segs.length > 1 ? `${t.i + 1} / ${t.segs.length}` : '';
  el('hxt-avg').textContent = seg.hrN ? Math.round(seg.hrSum / seg.hrN) : '—';
  const play = el('hxt-play'); play.className = 'hxt-play' + (t.t0 && t.paused == null ? ' on' : ''); play.textContent = !t.t0 ? '▶' : t.paused != null ? '▶' : '⏸';
  el('hxt-nexttxt').textContent = !t.t0 ? 'Toca ▶ (o play en tu reloj) para empezar' : t.paused != null ? 'En pausa' : nx ? `Siguiente: ${nx.n}` : 'Toca ⏭ al terminar para guardar';
  const chip = el('hxt-hrchip'), live = WATCH.hr && Date.now() - WATCH.hr.at < 10000;
  if (chip) { chip.className = 'ev-ver ' + (live ? 'ok' : ''); chip.lastChild.textContent = live ? 'Pulso en vivo' : (DB.watch && DB.watch.hcOn ? 'Pulso: llega de Mi Fitness al terminar' : 'Sin pulso en vivo'); }
  if (!live) $$('.live-hr').forEach(e => { e.textContent = '—'; });
  const gh = el('hxt-ghost');
  if (gh) { const tx = hxtGhostTxt(t); gh.hidden = !t.ghost; gh.className = 'hxt-ghost' + (tx.includes('+') ? ' behind' : ''); gh.innerHTML = t.ghost ? `<small>👻 CONTRA ${esc(t.ghost.src.toUpperCase())}</small><span>${tx || 'Empieza y compites contra tu mejor versión'}</span>` : ''; }
  const done = t.segs.filter(s => s.end);
  el('hxt-splits').innerHTML = done.length ? `<table class="small hx-tbl"><tbody>${done.slice().reverse().map(s => `<tr><td>${esc(s.n)}</td><td>${s.hrN ? Math.round(s.hrSum / s.hrN) + ' lpm' : ''}</td><td><b>${hxT(hxtActive(t, s.start, s.end) / 1000)}</b></td></tr>`).join('')}</tbody></table>` : '';
}

/* ---------- Al terminar: registrar solo ---------- */
function hxtFinish() {
  clearInterval(hxtTick);
  const t = hxt(); if (!t) return;
  const date = todayStr(), mk = s => ({ k: s.k, n: s.n, sec: Math.round(hxtActive(t, s.start, s.end) / 100) / 10, start: s.start, end: s.end, hrAvg: s.hrN ? Math.round(s.hrSum / s.hrN) : null, hrMax: s.hrMax || null, rmssd: hxtRmssd(s.rr) });
  const segs = t.segs.filter(s => s.start && s.end).map(mk), total = segs.reduce((a, s) => a + s.sec, 0);
  const run = { id: t.id, mode: t.mode, st: t.st, date, t0: t.t0, t1: segs.length ? segs[segs.length - 1].end : Date.now(), total, segs, hrLive: t.hrLive, hr: t.hr,
    hrAvg: t.hrLive ? Math.round(segs.filter(s => s.hrAvg).reduce((a, s) => a + s.hrAvg * s.sec, 0) / Math.max(1, segs.filter(s => s.hrAvg).reduce((a, s) => a + s.sec, 0))) : null, hrMax: t.hrLive ? Math.max(...segs.map(s => s.hrMax || 0)) : null };
  hx().runs = (hx().runs || []).concat(run);
  // Registro automático en HYROX Lab (mismas reglas que las pruebas escritas a mano)
  const ladderPrev = typeof hxMyBest === 'function' ? (hxMyBest() || {}).sec : null;
  const base = { date, t: Date.now(), rpe: null, auto: true, timerId: t.id };
  let prevBest = t.mode === 'station' || t.mode === 'comp' ? hxBest('st', t.st) : t.mode === 'run1k' ? hxBest('run1k') : null;
  let first = null;
  if (t.mode === 'race') {
    hx().results.push({ ...base, id: 'tm' + Date.now(), kind: 'sim', sec: total, note: 'Simulación cronometrada' });
    segs.filter(s => s.k !== 'run').forEach(s => hx().results.push({ ...base, id: 'tm' + s.k + Date.now(), kind: 'st', st: s.k, sec: Math.round(s.sec / 1.08), std: true, note: 'Parcial de simulación (÷1.08)' }));
  } else if (t.mode === 'station') { first = { ...base, id: 'tm' + Date.now(), kind: 'st', st: t.st, sec: segs[0].sec, std: true }; hx().results.push(first); }
  else if (t.mode === 'run1k') { first = { ...base, id: 'tm' + Date.now(), kind: 'run1k', sec: segs[0].sec }; hx().results.push(first); }
  else if (t.mode === 'comp') {
    first = { ...base, id: 'tm' + Date.now(), kind: 'st', st: t.st, sec: segs[0].sec, std: true }; hx().results.push(first);
    if (segs[1]) hx().results.push({ ...base, id: 'tmc' + Date.now(), kind: 'comp', sec: segs[1].sec, after: t.st });
  }
  hx().timer = null; saveData();
  if (bridge && bridge.watchStop) bridge.watchStop();
  if (t.pf) hx().results.filter(r => r.timerId === t.id).forEach(r => { if (r.kind === 'sim' || (r.kind === 'st' && PF_SUB[r.st] && !PF_SUB[r.st].comparable)) { r.pf = true; r.std = false; } });
  if (t.pf && first && first.pf) prevBest = hxBestPF(t.st) && hxResultsPF(t.st).length > 1 ? hxResultsPF(t.st).filter(r => r !== first).reduce((a, r) => !a || r.sec < a.sec ? r : a, null) : null;
  saveData();
  hxtSummary(run, first, prevBest, t.mode === 'race' && !t.pf && typeof hxLadderBeaten === 'function' ? hxLadderBeaten(ladderPrev, total) : []);
}
/** RMSSD de los intervalos R-R del tramo (solo con sensor que los envía). */
function hxtRmssd(rr) { if (!rr || rr.length < 10) return null; let s = 0, n = 0; for (let i = 1; i < rr.length; i++) { const d = rr[i] - rr[i - 1]; if (Math.abs(d) < 300) { s += d * d; n++; } } return n ? Math.round(Math.sqrt(s / n)) : null; }
function hxtSummary(run, first, prevBest, beaten) {
  const z = run.hrLive && run.hr.length ? (() => { const c = [0, 0, 0, 0, 0, 0]; run.hr.forEach(([, b]) => c[hrZone(b)]++); return c; })() : null;
  const L = [['Qué hiciste', `${HXT_TITLE[run.mode]} · ${hxT(run.total)}${run.hrAvg ? ` · pulso medio ${run.hrAvg} lpm (máx ${run.hrMax})` : ''}.`]];
  if (first && prevBest) L.push(['Qué mejoraste', first.sec < prevBest.sec ? `${hxT(prevBest.sec - first.sec)} más rápido que tu mejor marca (${hxT(prevBest.sec)}). Nuevo récord.` : `Tu mejor marca sigue siendo ${hxT(prevBest.sec)}. Cuenta el mejor de tus últimas 3 pruebas.`]);
  if (run.mode === 'comp' && run.segs[1]) { const fr = hxCurrent('run1k'); if (fr) L.push(['Qué aprendimos', `Tu km después de ${HX_ST[run.st].n} fue ${fmt(hxRDI(fr.sec, run.segs[1].sec), 1)} % más lento que tu 1 km fresco.`]); }
  if (run.mode === 'race') { const runs = run.segs.filter(s => s.k === 'run'); if (runs.length >= 4) { const a = runs[0].sec, b = runs.slice(-3).reduce((x, s) => x + s.sec, 0) / 3; L.push(['Qué aprendimos', `Tus últimos km fueron ${fmt((b / a - 1) * 100, 1)} % más lentos que el primero. Ya cuenta para tu predicción y tu cuello de botella.`]); } }
  if (!run.hrLive) L.push(['Pulso', DB.watch && DB.watch.hcOn ? 'Se agregará cuando tu reloj sincronice con Mi Fitness (abre la app en unos minutos).' : 'Conecta tu reloj o una banda en Mi reloj para medir el pulso de cada tramo.']);
  openModal(`<div class="hx-eyebrow">GUARDADO EN HYROX LAB</div><h3 style="margin-top:4px">${hxT(run.total)}</h3>
    ${beaten && beaten.length ? hxLadderCelebrateHtml(beaten) : ''}
    ${z ? `<div class="hxt-zones">${[1, 2, 3, 4, 5].map(k => `<i data-z="${k}" style="flex:${z[k] || 0.0001}"></i>`).join('')}</div><p class="small muted">Tiempo en zonas (pulso máx ${maxHr()} lpm${DB.watch && DB.watch.maxHr ? '' : ', estimado por edad'}).</p>` : ''}
    ${L.map(([a, b]) => `<div class="pg-rec"><b>${a}</b><small>${esc(b)}</small></div>`).join('')}
    ${run.segs.length > 1 ? `<table class="small hx-tbl"><tbody>${run.segs.map(s => `<tr><td>${esc(s.n)}</td><td>${s.hrAvg ? s.hrAvg + ' lpm' : ''}</td><td><b>${hxT(s.sec)}</b></td></tr>`).join('')}</tbody></table>` : ''}
    <p class="small muted">¿Qué tan duro fue? (opcional)</p><div class="hxt-rpe">${[6, 7, 8, 9, 10].map(r => `<button class="chip" data-rpe="${r}">${r}</button>`).join('')}</div>
    <button class="block" id="hts-ok">Listo</button>`, m => {
    if (beaten && beaten.length) hxLadderBurst(m);
    $$('[data-rpe]', m).forEach(b => b.onclick = () => { hx().results.filter(r => r.timerId === run.id).forEach(r => { r.rpe = Number(b.dataset.rpe); }); saveData(); $$('[data-rpe]', m).forEach(x => x.classList.toggle('on', x === b)); });
    $('#hts-ok', m).onclick = () => { closeModal(); if (typeof render === 'function') render(currentTab); };
  });
}

/* ---------- La sesión del día también se controla desde el reloj ---------- */
function hxSessionCommand(c, at) {
  const a = hx().active; if (!a) return;
  if (c === 'play' || c === 'pause' || c === 'toggle') {
    if (a.paused) { a.pausedMs += at - a.paused; a.paused = null; } else if (c !== 'play') a.paused = at;
  } else if (c === 'next') { const b = a.blocks.find(x => !x.done && !x.skip); if (b) b.done = true; }
  else if (c === 'prev') { const b = a.blocks.slice().reverse().find(x => x.done); if (b) b.done = false; }
  saveData();
  if (document.getElementById('hx-clk')) openHxSession();
}

/* ---------- Elegir qué cronometrar ---------- */
function openHxTimerPicker(back) {
  if (hxt()) return openHxTimer();
  openModal(`<div class="hx-eyebrow">TEMPORIZADOR</div><h3 style="margin-top:4px">¿Qué vas a cronometrar?</h3>
    <p class="small muted" style="margin-top:0">Los tiempos se guardan solos en HYROX Lab. Contrólalo desde la pantalla o desde tu reloj.</p>
    <div class="kit-list">
      <button class="kit-item" data-tm="race">${ico('timer', 22)}<span class="grow"><b>Simulación de carrera</b><small>8 × (1 km + estación) · parcial de cada tramo</small></span>${ico('chevron-right', 16)}</button>
      <button class="kit-item" data-tm="run1k">${ico('footprints', 22)}<span class="grow"><b>1 km fresco</b><small>Tu ritmo base</small></span>${ico('chevron-right', 16)}</button>
      <button class="kit-item" data-tm="station">${ico('layers', 22)}<span class="grow"><b>Una estación</b><small>Prueba con distancia y carga de competencia</small></span>${ico('chevron-right', 16)}</button>
      <button class="kit-item" data-tm="comp">${ico('activity', 22)}<span class="grow"><b>Estación + 1 km</b><small>Mide cuánto cae tu ritmo bajo fatiga</small></span>${ico('chevron-right', 16)}</button>
    </div>
    <button class="secondary block" id="tm-watch">${ico('heart-pulse', 18, 'lead')}Mi reloj y pulso</button>
    <button class="ghost block" id="tm-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => {
    $$('[data-tm]', m).forEach(b => b.onclick = () => { const k = b.dataset.tm; if (k === 'station' || k === 'comp') hxtPickStation(k, () => openHxTimerPicker(back)); else hxtCreate(k); });
    $('#tm-watch', m).onclick = openWatch;
    $('#tm-x', m).onclick = () => back ? back() : closeModal();
  });
}
function hxtPickStation(mode, back) {
  const perf = hxPerformance();
  openModal(`<h3>${mode === 'comp' ? 'Estación antes del km' : '¿Qué estación?'}</h3><div class="kit-list">${HX_STATIONS.map((s, i) => `<button class="kit-item" data-ps="${s.k}"><span class="hx-n">${String(i + 1).padStart(2, '0')}</span><span class="grow"><b>${pfStName(s.k)} · ${pfStDose(s.k)}</b><small>${perf.st[s.k] ? 'Récord ' + hxT(hxBest('st', s.k).sec) : 'Sin medir'}</small></span>${ico('chevron-right', 16)}</button>`).join('')}</div><button class="ghost block" id="ps-x">← Volver</button>`, m => {
    $$('[data-ps]', m).forEach(b => b.onclick = () => hxtCreate(mode, b.dataset.ps));
    $('#ps-x', m).onclick = back;
  });
}
