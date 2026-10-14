/* Mi Progreso 12.0 · Running: GPS con parciales, guía por voz, récords, historial,
   GPX (importar/exportar) y la pantalla de carrera. Los datos de cada carrera van en DB.runs;
   la ruta completa en IndexedDB para no llenar el almacenamiento principal. */

const RUN_KEY = 'miprogreso.run';
const RECORD_DIST = [[1, '1 km'], [5, '5 km'], [10, '10 km'], [21.0975, 'Medio maratón'], [42.195, 'Maratón']];
const GPS_MAX_ACC = 25;     // m: puntos con más error se descartan
const GPS_MAX_SPEED = 12;   // m/s: saltos más rápidos que esto son errores del GPS

/* ---------- utilidades ---------- */
function haversine(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b[0] - a[0]), dLon = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function paceStr(secPerKm) { if (!secPerKm || !isFinite(secPerKm) || secPerKm > 3600) return '–:––'; return mmss(secPerKm); }
function durStr(sec) { sec = Math.round(sec); const h = Math.floor(sec / 3600); return h ? h + ':' + String(Math.floor(sec % 3600 / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0') : mmss(sec); }
function paceWords(secPerKm) { const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60); return `${m} minutos ${s ? s : ''}`.trim() + ' por kilómetro'; }
/** Voz: motor nativo de Android; en navegador, speechSynthesis si existe. */
function say(text) {
  if (DB.profile.runVoice === false) return;
  try { if (bridge && bridge.speak && bridge.speak(text)) return; } catch (e) {}
  try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-MX'; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch (e) {}
}

/* ---------- rutas en IndexedDB ---------- */
const trackStore = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('miprogreso-rutas', 1); r.onupgradeneeded = () => r.result.createObjectStore('tracks'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('tracks', mode), st = t.objectStore('tracks'), q = fn(st); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return { put: (id, pts) => tx('readwrite', st => st.put(pts, id)), get: id => tx('readonly', st => st.get(id)), del: id => tx('readwrite', st => st.delete(id)) };
})();

/* ---------- motor de seguimiento ---------- */
const RUN = { st: null, watch: null, timer: null };
function runState() { return RUN.st; }
function saveRunState() { try { if (RUN.st) localStorage.setItem(RUN_KEY, JSON.stringify(RUN.st)); else localStorage.removeItem(RUN_KEY); } catch (e) {} }
function movingSec(st, now) { st = st || RUN.st; now = now || Date.now(); return Math.max(0, (now - st.start - st.pausedMs - (st.pauseAt ? now - st.pauseAt : 0)) / 1000); }
/** Tiempo en movimiento mostrado y guardado: nunca menor que la hora del último punto GPS. */
function runElapsed(st) { st = st || RUN.st; const lp = st.pts[st.pts.length - 1]; return Math.max(movingSec(st), lp ? lp[2] : 0); }

/** Empieza una carrera (libre o guiada por segmentos). */
function startRun(opts) {
  opts = opts || {};
  RUN.st = { id: uid(), start: Date.now(), pausedMs: 0, pauseAt: null, pts: [], dist: 0, splits: [], weak: 0, title: opts.title || 'Carrera libre', segs: opts.segs || null, seg: 0, segStart: 0, planRef: opts.planRef || null, target: opts.target || null };
  saveRunState(); attachGps(); keepScreenOn(true);
  say(opts.segs ? 'Comienza tu sesión. ' + segText(opts.segs[0]) : 'Carrera iniciada. ¡A disfrutar!');
  showTab('train');
}
function attachGps() {
  clearInterval(RUN.timer);
  RUN.timer = setInterval(runTick, 1000);
  if (navigator.geolocation && RUN.watch == null) {
    RUN.watch = navigator.geolocation.watchPosition(
      p => ingestPoint({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: p.timestamp || Date.now() }),
      e => { RUN.gpsError = e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en Ajustes → Apps → Mi Progreso → Permisos.' : 'Buscando señal GPS…'; renderRunLive(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
}
/**
 * Procesa un punto de ruta (en vivo o de un GPX) con el mismo filtro: descarta saltos imposibles,
 * suaviza el zigzag del GPS y suma distancia y parciales por km. Devuelve los km cerrados.
 */
function trackStep(st, p, tMove) {
  const last = st.pts[st.pts.length - 1], closed = [];
  if (last) { const raw = haversine([last[0], last[1]], [p.lat, p.lon]), rdt = tMove - last[2]; if (rdt <= 0 || raw / rdt > GPS_MAX_SPEED * 1.5) return closed; }
  st.sm = st.sm ? [st.sm[0] + 0.35 * (p.lat - st.sm[0]), st.sm[1] + 0.35 * (p.lon - st.sm[1])] : [p.lat, p.lon];
  if (last) {
    const d = haversine([last[0], last[1]], st.sm), dt = tMove - last[2];
    if (dt <= 0 || d / dt > GPS_MAX_SPEED) return closed;
    if (d < Math.max(4, Math.min(p.acc || 0, 15) * 0.6)) return closed;   // quieto o pasos menores al error
    const before = st.dist; st.dist += d;
    for (let k = Math.floor(before / 1000) + 1; k <= Math.floor(st.dist / 1000); k++) {
      const tCross = last[2] + (k * 1000 - before) / d * dt, prev = st.splits.reduce((a, b) => a + b, 0);
      st.splits.push(Math.round(tCross - prev)); closed.push({ k, split: tCross - prev, avg: tCross / k });
    }
  }
  st.pts.push([Math.round(st.sm[0] * 1e6) / 1e6, Math.round(st.sm[1] * 1e6) / 1e6, Math.round(tMove * 10) / 10]);
  return closed;
}
/** Cada punto del GPS en vivo: filtra por precisión, procesa, anuncia los km y guarda el estado. */
function ingestPoint(p) {
  const st = RUN.st;
  if (!st) return;
  RUN.gpsError = null;
  st.acc = p.acc;
  if (st.pauseAt) return;
  if (p.acc > GPS_MAX_ACC) { st.weak++; renderRunLive(); return; }
  trackStep(st, p, movingSec(st, p.t)).forEach(c => say(`Kilómetro ${c.k}. Este kilómetro en ${paceWords(c.split)}. Ritmo medio ${paceWords(c.avg)}.`));
  saveRunState(); renderRunLive();
}
/** Segmentos de una sesión guiada: anuncia el siguiente al terminar el actual (por tiempo o distancia). */
function segText(s) { return s ? s.say || s.label : ''; }
function runTick() {
  const st = RUN.st;
  if (!st) return;
  if (st.segs && !st.pauseAt && st.seg < st.segs.length) {
    const s = st.segs[st.seg], el = movingSec(st) - st.segStart, dEl = st.dist - (st.segDist || 0);
    const done = s.sec ? el >= s.sec : s.m ? dEl >= s.m : false;
    if (s.sec && !done && s.sec - el <= 10.5 && s.sec - el > 9.5) say('10 segundos');
    if (done) {
      st.seg++; st.segStart = movingSec(st); st.segDist = st.dist;
      if (st.seg < st.segs.length) say(segText(st.segs[st.seg])); else say('¡Sesión completada! Puedes terminar o seguir a tu ritmo.');
      saveRunState();
    }
  }
  renderRunLive();
}
function pauseRun() { const st = RUN.st; if (!st) return; if (st.pauseAt) { st.pausedMs += Date.now() - st.pauseAt; st.pauseAt = null; say('Reanudado'); } else { st.pauseAt = Date.now(); say('Pausa'); } saveRunState(); renderRunLive(); }
function stopGps() { if (RUN.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(RUN.watch); RUN.watch = null; clearInterval(RUN.timer); RUN.timer = null; }
function discardRun() { stopGps(); RUN.st = null; saveRunState(); keepScreenOn(false); render(currentTab); }

/** Mejor tiempo para cubrir una distancia dentro de la ruta (ventana deslizante, interpolada). */
function bestEffort(pts, meters) {
  if (pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  if (cum[cum.length - 1] < meters) return null;
  let best = Infinity, j = 0;
  for (let i = 0; i < pts.length; i++) {
    while (j < pts.length && cum[j] - cum[i] < meters) j++;
    if (j >= pts.length) break;
    const over = cum[j] - cum[i] - meters, seg = cum[j] - cum[j - 1] || 1;
    const tEnd = pts[j][2] - (pts[j][2] - pts[j - 1][2]) * (over / seg);
    best = Math.min(best, tEnd - pts[i][2]);
  }
  return isFinite(best) ? Math.round(best) : null;
}
function computeBests(pts) { const b = {}; RECORD_DIST.forEach(([km]) => { const t = bestEffort(pts, km * 1000); if (t) b[km] = t; }); return b; }
function runRecords(excludeId) {
  const rec = {};
  (DB.runs || []).filter(r => r.id !== excludeId).forEach(r => Object.keys(r.best || {}).forEach(k => { if (!rec[k] || r.best[k] < rec[k].t) rec[k] = { t: r.best[k], date: r.date, id: r.id }; }));
  const longest = (DB.runs || []).filter(r => r.id !== excludeId).reduce((a, r) => r.km > (a ? a.km : 0) ? r : a, null);
  return { rec, longest };
}

/** Guarda la carrera (GPS o GPX), detecta récords y muestra el resumen. */
function saveRun(run, pts) {
  const prev = runRecords(run.id), prs = [];
  run.best = computeBests(pts);
  Object.keys(run.best).forEach(k => { if (!prev.rec[k] || run.best[k] < prev.rec[k].t) prs.push(Number(k)); });
  const longPR = prev.longest && run.km > prev.longest.km;
  DB.runs = (DB.runs || []).concat(run);
  const firstRun = DB.runs.length === 1;
  if (firstRun) addEvent(run.date, 'run', 'Tu primera carrera registrada: ' + fmt(run.km, 2) + ' km', '🏃');
  prs.forEach(k => { const lbl = RECORD_DIST.find(x => x[0] === k)[1]; if (prev.rec[k] || k >= 5) addEvent(run.date, 'runpr', `${prev.rec[k] ? 'Récord' : 'Primer'} ${lbl}: ${durStr(run.best[k])}`, '🏅'); });
  if (longPR) addEvent(run.date, 'runlong', 'Tu carrera más larga: ' + fmt(run.km, 2) + ' km', '🛣️');
  saveData();
  trackStore.put(run.id, pts).catch(() => {});
  return { prs, longPR, firstRun };
}
function finishRun() {
  const st = RUN.st;
  if (!st) return;
  if (st.dist < 50 && !confirm('Casi no hay distancia registrada. ¿Guardar de todos modos?')) { if (confirm('¿Descartar esta carrera?')) discardRun(); return; }
  stopGps(); if (st.pauseAt) { st.pausedMs += Date.now() - st.pauseAt; st.pauseAt = null; }
  const dur = runElapsed(st), km = st.dist / 1000;
  const run = { id: st.id, date: dateStr(new Date(st.start)), start: st.start, dur: Math.round(dur), km: Math.round(km * 1000) / 1000, splits: st.splits, title: st.title, source: 'gps', planRef: st.planRef, target: st.target };
  const res = saveRun(run, st.pts);
  RUN.st = null; saveRunState(); keepScreenOn(false);
  say(`Carrera terminada. ${fmt(km, 2)} kilómetros en ${Math.round(dur / 60)} minutos.`);
  openRunSummary(run, res);
}
function openRunSummary(run, res) {
  res = res || {};
  const pace = run.km ? run.dur / run.km : 0;
  openModal(`<h3>${res.prs && res.prs.length ? '🏅 ¡Nuevo récord!' : '🏃 Carrera guardada'}</h3>
    <div class="grid3" style="margin-bottom:10px">
      <div class="stat"><div class="label">Distancia</div><div class="value">${fmt(run.km, 2)}<small> km</small></div></div>
      <div class="stat"><div class="label">Tiempo</div><div class="value" style="font-size:18px">${durStr(run.dur)}</div></div>
      <div class="stat"><div class="label">Ritmo</div><div class="value" style="font-size:18px">${paceStr(pace)}<small>/km</small></div></div>
    </div>
    ${res.prs && res.prs.length ? `<div class="status good"><b>Récords</b>${res.prs.map(k => RECORD_DIST.find(x => x[0] === k)[1] + ' en ' + durStr(run.best[k])).join(' · ')}</div>` : ''}
    ${res.longPR ? '<div class="status good"><b>Tu carrera más larga</b>Nunca habías corrido tanto.</div>' : ''}
    ${run.splits && run.splits.length ? `<div class="small muted" style="font-weight:600;margin:10px 0 4px">Parciales</div>${splitsTable(run.splits)}` : ''}
    <div class="small muted" style="font-weight:600;margin:12px 0 6px">¿Qué tan dura se sintió? <b id="rs-v">5</b>/10</div>
    <input type="range" id="rs-rpe" min="1" max="10" value="5">
    <p class="small muted" style="margin:2px 0 10px">1–3 suave (podías platicar) · 4–6 moderada · 7–10 dura</p>
    <button class="block" id="rs-ok">Listo</button>`, m => {
    $('#rs-rpe', m).oninput = e => { $('#rs-v', m).textContent = e.target.value; };
    $('#rs-ok', m).onclick = () => { const r = DB.runs.find(x => x.id === run.id); if (r) { r.rpe = Number($('#rs-rpe', m).value); if (typeof evalRunMission === 'function') evalRunMission(r); saveData(); } closeModal(); render(currentTab); };
  });
  if (res.prs && res.prs.length) setTimeout(() => burst($('#modal')), 200);
}
function splitsTable(splits) {
  const best = Math.min(...splits);
  return `<div class="splits">${splits.map((s, i) => `<div class="sp-row"><span>Km ${i + 1}</span><div class="sp-bar"><i style="width:${Math.min(100, best / s * 100)}%"></i></div><b class="${s === best ? 'best' : ''}">${paceStr(s)}</b></div>`).join('')}</div>`;
}

/* ---------- GPX ---------- */
function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const pts = Array.from(doc.getElementsByTagName('trkpt')).map(n => ({ lat: Number(n.getAttribute('lat')), lon: Number(n.getAttribute('lon')), t: n.getElementsByTagName('time')[0] ? Date.parse(n.getElementsByTagName('time')[0].textContent) : null })).filter(p => isFinite(p.lat) && isFinite(p.lon) && p.t);
  const name = doc.getElementsByTagName('name')[0];
  return { pts, name: name ? name.textContent.trim() : '' };
}
/** Convierte un GPX en carrera usando el mismo filtro que el GPS en vivo. */
function runFromGpx(text) {
  const g = parseGpx(text);
  if (g.pts.length < 2) throw new Error('El archivo no trae puntos con hora.');
  const t0 = g.pts[0].t, st = { pts: [], dist: 0, splits: [] };
  g.pts.forEach(p => trackStep(st, Object.assign({ acc: 5 }, p), (p.t - t0) / 1000));
  const pts = st.pts, splits = st.splits, dist = st.dist;
  const run = { id: uid(), date: dateStr(new Date(t0)), start: t0, dur: Math.round(pts[pts.length - 1][2]), km: Math.round(dist) / 1000, splits, title: g.name || 'Carrera importada', source: 'gpx' };
  return { run, pts };
}
async function exportGpx(id) {
  const r = DB.runs.find(x => x.id === id), pts = await trackStore.get(id).catch(() => null);
  if (!r || !pts || !pts.length) { toast('Esta carrera no tiene ruta guardada'); return; }
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Mi Progreso" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(r.title)}</name><type>running</type><trkseg>${pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(r.start + p[2] * 1000).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const name = 'carrera-' + r.date + '.gpx';
  if (bridge && bridge.saveFile) { if (bridge.saveFile(name, gpx)) toast('GPX guardado en Descargas/MiProgreso'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function routeSvg(pts) {
  if (!pts || pts.length < 2) return '';
  const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
  const minLa = Math.min(...lats), maxLa = Math.max(...lats), minLo = Math.min(...lons), maxLo = Math.max(...lons);
  const k = Math.cos((minLa + maxLa) / 2 * Math.PI / 180), w = (maxLo - minLo) * k || 1e-6, h = maxLa - minLa || 1e-6, s = 90 / Math.max(w, h);
  const xy = pts.map(p => [5 + (p[1] - minLo) * k * s + (90 - w * s) / 2, 95 - (p[0] - minLa) * s - (90 - h * s) / 2]);
  return `<svg class="route" viewBox="0 0 100 100"><polyline points="${xy.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"/><circle cx="${xy[0][0]}" cy="${xy[0][1]}" r="3" class="r-start"/><circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="3" class="r-end"/></svg>`;
}

/* ---------- pantallas ---------- */
/** Carreras de todas las fuentes para el historial: GPS/GPX y las registradas a mano. */
function allRuns() {
  const manual = (DB.activities || []).filter(a => a.type === 'correr').map(a => ({ id: a.id, date: a.date, start: a.t, dur: a.min * 60, km: a.km || 0, title: 'Registro manual', source: 'manual', rpe: a.rpe }));
  return (DB.runs || []).concat(manual).sort((a, b) => b.start - a.start);
}
function renderRunLive() {
  const st = RUN.st, v = $('#view-train');
  if (!st || currentTab !== 'train' || !v) return;
  const el = runElapsed(st), km = st.dist / 1000, avg = km > 0.05 ? el / km : 0;
  // ritmo actual: últimos ~30 s de puntos
  let cur = 0; const p = st.pts, n = p.length;
  if (n > 2) { let i = n - 1; while (i > 0 && p[n - 1][2] - p[i][2] < 30) i--; let d = 0; for (let j = i + 1; j < n; j++) d += haversine(p[j - 1], p[j]); const dt = p[n - 1][2] - p[i][2]; if (d > 20) cur = dt / (d / 1000); }
  const seg = st.segs && st.seg < st.segs.length ? st.segs[st.seg] : null;
  const segLeft = seg ? (seg.sec ? Math.max(0, seg.sec - (el - st.segStart)) : null) : null;
  const html = `<div class="run-live ${st.pauseAt ? 'paused' : ''}">
    <div class="small muted">${esc(st.title)}${st.pauseAt ? ' · en pausa' : ''}</div>
    ${seg ? `<div class="run-seg ${seg.type}"><b>${esc(seg.label)}</b><span>${segLeft != null ? mmss(segLeft) : fmt(Math.max(0, (seg.m - (st.dist - (st.segDist || 0))) / 1000), 2) + ' km'}</span><small>${st.seg + 1} de ${st.segs.length}</small></div>` : ''}
    <div class="run-time">${durStr(el)}</div>
    <div class="run-grid"><div><b>${fmt(km, 2)}</b><small>km</small></div><div><b>${paceStr(avg)}</b><small>ritmo medio</small></div><div><b>${paceStr(cur)}</b><small>ritmo actual</small></div></div>
    <div class="run-gps ${st.acc && st.acc <= GPS_MAX_ACC ? 'ok' : 'weak'}">${RUN.gpsError ? esc(RUN.gpsError) : st.acc ? (st.acc <= GPS_MAX_ACC ? '📡 GPS ±' + Math.round(st.acc) + ' m' : '📡 Señal débil (±' + Math.round(st.acc) + ' m): esperando mejor señal') : '📡 Buscando GPS…'}</div>
    ${st.splits.length ? splitsTable(st.splits) : '<p class="small muted" style="text-align:center">Tus parciales por kilómetro aparecerán aquí.</p>'}
    <div class="row" style="margin-top:12px"><button class="secondary" id="rl-pause" style="flex:1">${st.pauseAt ? '▶ Reanudar' : '⏸ Pausa'}</button><button id="rl-stop" style="flex:1">■ Terminar</button></div>
    <label class="check" style="justify-content:center;margin-top:10px"><input type="checkbox" id="rl-voice" ${DB.profile.runVoice !== false ? 'checked' : ''}> <span>Guía por voz</span></label>
    <p class="small muted" style="text-align:center">Mantén la app abierta: la pantalla se queda encendida mientras corres.</p>
  </div>`;
  v.innerHTML = html;
  $('#rl-pause').onclick = pauseRun;
  $('#rl-stop').onclick = finishRun;
  $('#rl-voice').onchange = e => { DB.profile.runVoice = e.target.checked; saveData(); };
}
function runningView() {
  const runs = allRuns(), wb = weekBuckets(8);
  const kmW = wb.map(b => runs.filter(r => r.date >= b.start && r.date <= b.end).reduce((a, r) => a + (r.km || 0), 0));
  const { rec, longest } = runRecords();
  const month = todayStr().slice(0, 7), mRuns = runs.filter(r => r.date.slice(0, 7) === month);
  const withPace = runs.filter(r => r.km >= 1).slice(0, 10).reverse();
  const pr = withPace.length >= 4 ? linreg(withPace.map((r, i) => ({ x: i, y: r.dur / r.km }))) : null;
  return `
    ${typeof runPlanCard === 'function' ? runPlanCard() : ''}
    <div class="tool-row">
      <button id="rn-free"><span>▶</span>Correr</button>
      <button id="rn-manual"><span>✍️</span>Manual</button>
      <button id="rn-gpx"><span>📥</span>GPX</button>
      <button id="rn-plan"><span>🗓️</span>Plan</button>
    </div>
    <input type="file" id="rn-gpx-file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden>
    <div class="card" data-fold-title="Esta semana" data-fold-sum="${fmt(kmW[7], 1)} km · ${mRuns.length} carreras este mes" data-fold-ico="📅">
      ${miniBars(kmW, 0, v => v ? fmt(v, 0) : '')}
      <p class="small" style="margin:6px 0 0">Esta semana: <b>${fmt(kmW[7], 1)} km</b> · la pasada ${fmt(kmW[6], 1)} km. Este mes: ${mRuns.length} carreras, ${fmt(mRuns.reduce((a, r) => a + (r.km || 0), 0), 1)} km.</p>
      <p class="small muted" style="margin:4px 0 0">Para progresar sin lesionarte, sube como máximo ~10 % por semana.</p>
    </div>
    <div class="card" data-fold-title="Récords" data-fold-sum="${Object.keys(rec).length ? Object.keys(rec).length + ' distancias' : 'aún sin récords'}" data-fold-ico="🏅">
      ${Object.keys(rec).length || longest ? `<table><tbody>${RECORD_DIST.filter(([k]) => rec[k]).map(([k, l]) => `<tr><td>${l}</td><td class="num"><b>${durStr(rec[k].t)}</b></td><td class="num small muted">${paceStr(rec[k].t / k)}/km · ${shortDate(rec[k].date)}</td></tr>`).join('')}
        ${longest ? `<tr><td>Más larga</td><td class="num"><b>${fmt(longest.km, 2)} km</b></td><td class="num small muted">${shortDate(longest.date)}</td></tr>` : ''}</tbody></table>
        <p class="small muted" style="margin:6px 0 0">Se calculan con tu mejor tramo dentro de cada carrera con GPS o GPX.</p>` : '<p class="small muted" style="margin:0">Corre con GPS o importa un GPX y aquí aparecerán tus mejores tiempos en 1K, 5K, 10K, 21K y 42K.</p>'}
    </div>
    <div class="card" data-fold-title="Análisis" data-fold-sum="${pr ? (pr.slope < -1 ? 'tu ritmo mejora' : pr.slope > 1 ? 'ritmo más lento' : 'ritmo estable') : 'faltan carreras'}" data-fold-ico="📈">
      ${pr ? `<p class="small" style="margin-top:0">En tus últimas ${withPace.length} carreras tu ritmo medio ${pr.slope < -1 ? `<b style="color:var(--good)">mejora ~${Math.round(-pr.slope)} s/km por carrera</b>` : pr.slope > 1 ? `es <b>~${Math.round(pr.slope)} s/km más lento por carrera</b> (normal si estás metiendo carreras suaves o más largas)` : 'se mantiene estable'}.</p>` : '<p class="small muted" style="margin:0">Con 4 carreras de 1 km o más te muestro la tendencia de tu ritmo.</p>'}
      <p class="small muted" style="margin:6px 0 0">Recuerda: la mayoría de tus kilómetros deberían ser suaves (podrías platicar).</p>
    </div>
    <div class="card" data-fold-title="Historial" data-fold-sum="${runs.length} carreras" data-fold-ico="🕘">
      ${runs.length ? runs.slice(0, 20).map(r => `<button class="run-row" data-run="${r.id}" data-src="${r.source}"><span class="rr-ico">${r.source === 'gpx' ? '📥' : r.source === 'manual' ? '✍️' : '📡'}</span><span class="grow"><b>${fmt(r.km, 2)} km</b> · ${durStr(r.dur)} · ${r.km ? paceStr(r.dur / r.km) + '/km' : ''}<br><small class="muted">${shortDate(r.date)} · ${esc(r.title)}${r.rpe ? ' · esfuerzo ' + r.rpe + '/10' : ''}</small></span></button>`).join('')
        : '<div class="empty"><span class="emoji">🏃</span>Tu primera carrera te espera. Toca <b>Correr</b> para usar el GPS del teléfono.</div>'}
    </div>`;
}
function bindRunning(v) {
  $('#rn-free', v).onclick = () => startRun({ title: 'Carrera libre' });
  $('#rn-manual', v).onclick = () => openActivityForm('correr');
  $('#rn-gpx', v).onclick = () => $('#rn-gpx-file', v).click();
  $('#rn-plan', v).onclick = () => (typeof openRunPlanSetup === 'function' ? openRunPlanSetup() : toast('Pronto'));
  $('#rn-gpx-file', v).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const { run, pts } = runFromGpx(r.result); const res = saveRun(run, pts); openRunSummary(run, res); }
      catch (err) { toast('No pude leer el GPX: ' + err.message); }
    };
    r.readAsText(f); e.target.value = '';
  };
  $$('[data-run]', v).forEach(b => b.onclick = () => openRunDetail(b.dataset.run, b.dataset.src));
  if (typeof bindRunPlan === 'function') bindRunPlan(v);
}
async function openRunDetail(id, src) {
  const r = allRuns().find(x => x.id === id);
  if (!r) return;
  const pts = src === 'manual' ? null : await trackStore.get(id).catch(() => null);
  openModal(`<h3>${esc(r.title)}</h3><p class="small muted" style="margin-top:0">${longDate(r.date)}${r.source === 'gpx' ? ' · importada de GPX' : r.source === 'manual' ? ' · registro manual' : ' · GPS del teléfono'}</p>
    ${pts ? routeSvg(pts) : ''}
    <div class="grid3" style="margin:10px 0"><div class="stat"><div class="label">Distancia</div><div class="value">${fmt(r.km, 2)}<small> km</small></div></div><div class="stat"><div class="label">Tiempo</div><div class="value" style="font-size:18px">${durStr(r.dur)}</div></div><div class="stat"><div class="label">Ritmo</div><div class="value" style="font-size:18px">${r.km ? paceStr(r.dur / r.km) : '–'}</div></div></div>
    ${r.splits && r.splits.length ? splitsTable(r.splits) : ''}
    ${r.best && Object.keys(r.best).length ? `<p class="small">Mejores tramos: ${RECORD_DIST.filter(([k]) => r.best[k]).map(([k, l]) => l + ' ' + durStr(r.best[k])).join(' · ')}</p>` : ''}
    <div class="row" style="margin-top:10px">${src !== 'manual' ? '<button class="danger" id="rd-del">Borrar</button><button class="secondary" id="rd-gpx" style="flex:1">Exportar GPX</button>' : ''}<button id="rd-ok" style="flex:1">Cerrar</button></div>`, m => {
    $('#rd-ok', m).onclick = closeModal;
    const g = $('#rd-gpx', m); if (g) g.onclick = () => exportGpx(id);
    const d = $('#rd-del', m); if (d) d.onclick = () => { if (!confirm('¿Borrar esta carrera?')) return; DB.runs = DB.runs.filter(x => x.id !== id); trackStore.del(id).catch(() => {}); saveData(); closeModal(); render(currentTab); };
  });
}
/** Al abrir la app con una carrera en curso (se cerró o recargó), se recupera. */
function restoreRun() {
  try { const raw = localStorage.getItem(RUN_KEY); if (!raw) return; RUN.st = JSON.parse(raw); attachGps(); keepScreenOn(true); } catch (e) { RUN.st = null; }
}
