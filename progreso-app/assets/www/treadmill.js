'use strict';
/* Mi Progreso 14.0 · Caminadora (sin GPS).
   Pensado para las caminadoras Matrix de Planet Fitness México: rango de 0.8–20 km/h y 0–15 % de
   inclinación (ficha de la Matrix Endurance, el modelo más probable; la marca está confirmada, el
   modelo no). La distancia se calcula con la velocidad que marcas × el tiempo; al terminar puedes
   corregirla con lo que diga la consola, que es la medida real de la banda. */

const TM = { min: 0.8, max: 20, incMax: 15, step: 0.1, incStep: 0.5 };
const tmClamp = (v, a, b) => Math.round(Math.max(a, Math.min(b, v)) * 10) / 10;
function runIndoor() { return DB.profile.runIndoor === true; }
/** Tu velocidad cómoda de trote: de tus carreras recientes si hay, si no la que guardaste (8 km/h). */
function tmEasy() {
  const z = typeof paceZones === 'function' ? paceZones() : null;
  if (z) return tmClamp(3600 / ((z.suave[0] + z.suave[1]) / 2), 5, 16);
  return DB.profile.tmEasy || 8;
}
/** Velocidad e inclinación sugeridas para un segmento de una sesión de running. */
function tmForSeg(s) {
  if (s.kmh) return { kmh: s.kmh, inc: s.inc || 1 };
  const e = tmEasy(), z = typeof paceZones === 'function' ? paceZones() : null;
  const fromZone = k => z && z[k] ? tmClamp(3600 / ((z[k][0] + z[k][1]) / 2), TM.min, TM.max) : null;
  const k = { warm: e * 0.9, cool: e * 0.85, walk: Math.min(e * 0.75, 6), easy: e, fast: null }[s.type];
  let kmh = k;
  if (s.type === 'fast') kmh = /tempo/i.test(s.label) ? fromZone('tempo') || e * 1.15 : fromZone('intervalos') || e * 1.3;
  return { kmh: tmClamp(kmh || e, TM.min, TM.max), inc: s.type === 'walk' ? 0 : 1 };
}
/** Entrenamientos de caminadora. Las velocidades se escalan con tu velocidad cómoda. */
function tmWorkouts() {
  const e = tmEasy(), w = Math.min(5.5, e * 0.7);
  const seg = (type, sec, kmh, inc, label) => ({ type, sec, kmh: tmClamp(kmh, TM.min, TM.max), inc, label, say: `${label}. Pon ${fmt(tmClamp(kmh, TM.min, TM.max), 1)} kilómetros por hora y ${fmt(inc, inc % 1 ? 1 : 0)} por ciento de inclinación.` });
  const rep = (n, a, b) => Array.from({ length: n }, (_, i) => i < n - 1 ? [a(i), b(i)] : [a(i)]).flat();
  return {
    incl: { ico: '⛰️', name: 'Caminata inclinada 12-3-30', who: 'Glúteos y cardio sin impacto', note: `30 min caminando a 4.8 km/h con 12 % de inclinación. Si es mucho, empieza con 6–8 % y sube 1 % por semana. Camina ${typeof g === 'function' ? g('erguido', 'erguida') : 'erguido'} sin colgarte del manubrio: si necesitas sostenerte, baja la inclinación.`,
      segs: [seg('warm', 180, 4.5, 3, 'Calienta caminando'), seg('easy', 1800, 4.8, 12, 'Caminata inclinada'), seg('cool', 180, 4, 0, 'Enfría caminando')] },
    walk: { ico: '🚶', name: 'Caminata activa 30 min', who: 'Para empezar o recuperar', note: 'Ritmo en el que puedes platicar. Ideal para días de descanso activo.',
      segs: [seg('warm', 180, w * 0.85, 1, 'Calienta caminando'), seg('easy', 1440, w, 2, 'Camina a buen ritmo'), seg('cool', 180, w * 0.8, 0, 'Enfría')] },
    int: { ico: '⚡', name: 'Intervalos 6 × 1 min', who: 'Velocidad sin salir del gym', note: `Rápido a ~${fmt(e * 1.3, 1)} km/h y recuperas a ${fmt(e * 0.8, 1)} km/h. Sube y baja la velocidad con los botones del manubrio derecho.`,
      segs: [seg('warm', 300, e * 0.85, 1, 'Calienta trotando'), ...rep(6, i => seg('fast', 60, e * 1.3, 1, `Rápido (${i + 1}/6)`), () => seg('walk', 120, e * 0.8, 1, 'Recupera suave')), seg('cool', 300, e * 0.8, 0, 'Enfría trotando')] },
    hill: { ico: '🏔️', name: 'Colinas 6 × 2 min', who: 'Fuerza en las piernas, menos impacto', note: `Mismo trote cómodo (${fmt(e, 1)} km/h); lo que cambia es la inclinación: 6 % en la subida y 1 % para recuperar. La inclinación está en el manubrio izquierdo.`,
      segs: [seg('warm', 300, e * 0.9, 1, 'Calienta trotando'), ...rep(6, i => seg('fast', 120, e * 0.95, 6, `Subida (${i + 1}/6)`), () => seg('walk', 120, e * 0.9, 1, 'Recupera en plano')), seg('cool', 300, e * 0.8, 0, 'Enfría')] },
    free: { ico: '▶', name: 'Caminadora libre', who: 'Tú marcas el ritmo', note: 'Empieza con tu velocidad cómoda y ajusta con + y − cada vez que cambies la caminadora.', segs: null }
  };
}
/** Hoja para elegir entrenamiento de caminadora. */
function openTreadmillPicker() {
  const W = tmWorkouts(), girlyOn = typeof girly === 'function' && girly();
  const order = girlyOn ? ['incl', 'walk', 'hill', 'int', 'free'] : ['free', 'int', 'hill', 'incl', 'walk'];
  openModal(`<h3>🏃 Caminadora</h3>
    <p class="small muted" style="margin-top:0">Sin GPS: la app guía la velocidad y la inclinación, y calcula la distancia. En Planet Fitness son Matrix (0.8–20 km/h, 0–15 %): la inclinación va en el manubrio izquierdo y la velocidad en el derecho.</p>
    ${order.map(k => `<button class="pick-row tm-pick" data-tm="${k}"><span class="tm-ico">${W[k].ico}</span><span class="grow"><b>${W[k].name}</b><br><small>${W[k].who}${W[k].segs ? ' · ' + Math.round(W[k].segs.reduce((a, s) => a + (s.sec || 0), 0) / 60) + ' min' : ''}</small></span></button>`).join('')}
    <div class="ck-row" style="margin-top:10px"><b>Tu trote cómodo</b><span class="mini-step"><button data-tme="-0.5">−</button><b id="tm-easy">${fmt(tmEasy(), 1)} km/h</b><button data-tme="0.5">+</button></span></div>
    <p class="small muted" style="margin:6px 0 0">${typeof paceZones === 'function' && paceZones() ? 'Calculado de tus carreras recientes.' : 'Ajústalo a un ritmo en el que puedas platicar; con tus carreras lo calculo solo.'} Tip: 1 % de inclinación se parece más al esfuerzo de correr en la calle.</p>`, m => {
    $$('[data-tme]', m).forEach(b => b.onclick = () => { DB.profile.tmEasy = tmClamp(tmEasy() + Number(b.dataset.tme), 4, 16); saveData(); $('#tm-easy', m).textContent = fmt(DB.profile.tmEasy, 1) + ' km/h'; });
    $$('[data-tm]', m).forEach(b => b.onclick = () => {
      const w = tmWorkouts()[b.dataset.tm]; closeModal();
      startRun({ title: w.name, segs: w.segs, cinta: true, note: w.segs ? w.note : null });
    });
  });
}
/** Estado inicial de una carrera en caminadora. */
function tmInit(st, opts) {
  st.cinta = true; st.lastT = Date.now(); st.climb = 0; st.kmSec = 0;
  const first = st.segs && st.segs[0] ? tmForSeg(st.segs[0]) : { kmh: tmEasy(), inc: 1 };
  st.kmh = first.kmh; st.inc = first.inc; st.note = opts.note || null;
}
/** Avanza la distancia con la velocidad marcada (se llama cada segundo). */
function tmTick(st) {
  const now = Date.now();
  if (st.pauseAt) { st.lastT = now; return; }
  const dt = Math.min(5, Math.max(0, (now - st.lastT) / 1000)); st.lastT = now;   // si la app estuvo cerrada, no inventa minutos
  const d = st.kmh / 3.6 * dt, before = st.dist;
  st.dist += d; st.climb += d * st.inc / 100;
  const k = Math.floor(st.dist / 1000);
  if (k > Math.floor(before / 1000)) {
    const t = movingSec(st), split = Math.round(t - st.kmSec); st.kmSec = t; st.splits.push(split);
    say(`Kilómetro ${k}. Este kilómetro en ${paceWords(split)}.`);
  }
}
/** Al cambiar de segmento, la app pasa a la velocidad e inclinación indicadas. */
function tmOnSeg(st, s) { const v = tmForSeg(s); st.kmh = v.kmh; st.inc = v.inc; }
function tmSet(dk, di) {
  const st = RUN.st; if (!st) return;
  tmTick(st);
  if (dk) st.kmh = tmClamp(st.kmh + dk, TM.min, TM.max);
  if (di) st.inc = tmClamp(st.inc + di, 0, TM.incMax);
  saveRunState(); renderRunLive();
}
function tmLiveHtml(st, el, seg, segLeft) {
  const km = st.dist / 1000, avg = km > 0.05 ? el / km : 0;
  return `<div class="run-live tm-live ${st.pauseAt ? 'paused' : ''}">
    <div class="small muted">🏃 ${esc(st.title)}${st.pauseAt ? ' · en pausa' : ''}</div>
    ${seg ? `<div class="run-seg ${seg.type}"><b>${esc(seg.label)}</b><span>${segLeft != null ? mmss(segLeft) : fmt(Math.max(0, (seg.m - (st.dist - (st.segDist || 0))) / 1000), 2) + ' km'}</span><small>${st.seg + 1} de ${st.segs.length} · pon ${fmt(tmForSeg(seg).kmh, 1)} km/h y ${fmt(tmForSeg(seg).inc, 1)} %</small></div>` : ''}
    <div class="run-time">${durStr(el)}</div>
    <div class="tm-ctl">
      <div><small>Velocidad (km/h)</small><div class="tm-row"><button data-tmk="-${TM.step * 5}" aria-label="Bajar velocidad">−</button><b>${fmt(st.kmh, 1)}</b><button data-tmk="${TM.step * 5}" aria-label="Subir velocidad">+</button></div><span class="small muted">${paceStr(3600 / st.kmh)}/km</span></div>
      <div><small>Inclinación (%)</small><div class="tm-row"><button data-tmi="-${TM.incStep}" aria-label="Bajar inclinación">−</button><b>${fmt(st.inc, 1)}</b><button data-tmi="${TM.incStep}" aria-label="Subir inclinación">+</button></div><span class="small muted">${st.inc >= 8 ? 'subida fuerte' : st.inc >= 3 ? 'subida' : 'plano'}</span></div>
    </div>
    <div class="run-grid"><div><b>${fmt(km, 2)}</b><small>km</small></div><div><b>${paceStr(avg)}</b><small>ritmo medio</small></div><div><b>${Math.round(st.climb)}</b><small>m subidos</small></div></div>
    ${st.note && el < 90 ? `<div class="adapt-note" style="margin:8px 0">💡 ${esc(st.note)}</div>` : ''}
    ${st.splits.length ? splitsTable(st.splits) : ''}
    <p class="small muted" style="text-align:center;margin:6px 0">Cuando cambies la caminadora, cámbiala aquí también: así la distancia sale bien.</p>
    <div class="row" style="margin-top:8px"><button class="secondary" id="rl-pause" style="flex:1">${st.pauseAt ? '▶ Reanudar' : '⏸ Pausa'}</button><button id="rl-stop" style="flex:1">■ Terminar</button></div>
    <label class="check" style="justify-content:center;margin-top:10px"><input type="checkbox" id="rl-voice" ${DB.profile.runVoice !== false ? 'checked' : ''}> <span>Guía por voz</span></label>
  </div>`;
}
function bindTmLive(v) {
  $$('[data-tmk]', v).forEach(b => b.onclick = () => tmSet(Number(b.dataset.tmk), 0));
  $$('[data-tmi]', v).forEach(b => b.onclick = () => tmSet(0, Number(b.dataset.tmi)));
}
/** Terminar: confirma la distancia con la consola antes de guardar. */
function tmFinish() {
  const st = RUN.st; if (!st) return;
  tmTick(st); stopGps();
  if (st.pauseAt) { st.pausedMs += Date.now() - st.pauseAt; st.pauseAt = null; }
  const dur = Math.round(movingSec(st)), est = Math.round(st.dist) / 1000;
  saveRunState();
  openModal(`<h3>🏃 ¿Qué marca la consola?</h3>
    <p class="small muted" style="margin-top:0">Calculé <b>${fmt(est, 2)} km</b> con las velocidades que marcaste. La consola de la caminadora mide la banda: si dice otra cosa, usa su número.</p>
    <div class="grid2"><label>Distancia (km)<input id="tf-km" inputmode="decimal" value="${fmt(est, 2).replace(',', '')}"></label><label>Minutos<input id="tf-min" inputmode="decimal" value="${fmt(dur / 60, 1).replace(',', '')}"></label></div>
    <div class="row" style="margin-top:6px"><button class="secondary" id="tf-back" style="flex:1">Seguir</button><button id="tf-ok" style="flex:2">Guardar</button></div>
    <button class="ghost block" id="tf-del" style="margin-top:6px">Descartar</button>`, m => {
    $('#tf-back', m).onclick = () => { st.lastT = Date.now(); attachGps(); closeModal(); renderRunLive(); };
    $('#tf-del', m).onclick = () => { if (confirm('¿Descartar esta sesión de caminadora?')) { closeModal(); discardRun(); } };
    $('#tf-ok', m).onclick = () => {
      const km = num($('#tf-km', m).value), mins = num($('#tf-min', m).value);
      if (!(km >= 0) || !(mins > 0) || km > 60 || mins > 400) { toast('Revisa la distancia y los minutos'); return; }
      const scale = est > 0 ? km / est : 1;
      const run = { id: st.id, date: dateStr(new Date(st.start)), start: st.start, dur: Math.round(mins * 60), km: Math.round(km * 1000) / 1000, splits: Math.abs(scale - 1) < 0.02 ? st.splits : [], title: st.title, source: 'cinta', climb: Math.round(st.climb * scale), planRef: st.planRef, target: st.target };
      const res = saveRun(run, []);
      RUN.st = null; saveRunState(); keepScreenOn(false); document.body.classList.remove('in-session');
      say(`Sesión terminada. ${fmt(km, 2)} kilómetros en ${Math.round(mins)} minutos.`);
      closeModal(); openRunSummary(run, res);
    };
  });
}
