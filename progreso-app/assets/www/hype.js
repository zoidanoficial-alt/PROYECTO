'use strict';
/* =====================================================================
 *  41.0 · Reacciones a tus marcas
 *  - Récord roto → "LOGRO DESBLOQUEADO" (aviso tipo consola: insignia + nombre + sonido).
 *  - Intento sin récord → Apollo Creed: «¡Demonios, Rocky! ¿Qué te pasa?» y cuánto faltó.
 *  Aplica a: estaciones y pruebas HYROX (temporizador o a mano), ejercicios del gimnasio
 *  y carreras. En el gimnasio, Apollo aparece al terminar las series de un ejercicio
 *  sin récord (no en cada serie). Se puede apagar en Logros.
 * ===================================================================== */
const hypeOn = () => !(DB.profile && DB.profile.hype === false) && (typeof gamify !== 'function' || gamify());
const apolloOn = () => hypeOn() && DB.profile.apollo !== false;
let hypeAudio = null;
function hypeSound(kind) {
  try {
    hypeAudio = hypeAudio || new (window.AudioContext || window.webkitAudioContext)();
    const a = hypeAudio, t = a.currentTime;
    const notes = kind === 'win' ? [[523, 0], [784, 0.09], [1047, 0.18]] : [[392, 0], [294, 0.16]];
    notes.forEach(([f, d]) => { const o = a.createOscillator(), g = a.createGain(); o.type = kind === 'win' ? 'triangle' : 'sawtooth'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(kind === 'win' ? 0.18 : 0.06, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35); o.connect(g).connect(a.destination); o.start(t + d); o.stop(t + d + 0.4); });
  } catch (e) {}
}
const HYPE_Q = []; let hypeBusy = false;
function hypeShow(html, cls, ms) { HYPE_Q.push({ html, cls, ms }); if (!hypeBusy) hypeNext(); }
function hypeNext() {
  const x = HYPE_Q.shift(); if (!x) { hypeBusy = false; return; }
  hypeBusy = true;
  const el = document.createElement('div'); el.className = 'hype ' + x.cls; el.innerHTML = x.html; el.setAttribute('role', 'status');
  el.onclick = () => { el.classList.add('out'); };
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => el.classList.add('out'), x.ms);
  setTimeout(() => { el.remove(); hypeNext(); }, x.ms + 450);
}
/** LOGRO DESBLOQUEADO */
function achToast(title, sub) {
  if (!hypeOn()) return;
  hypeSound('win'); vibrate(120);
  hypeShow(`<span class="hy-badge">${ico('trophy', 26)}</span><span class="hy-txt"><small>LOGRO DESBLOQUEADO</small><b>${esc(title)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span>`, 'hy-win', 4600);
}
/** «¡Demonios, Rocky! ¿Qué te pasa?» */
function apolloToast(sub) {
  if (!apolloOn()) return;
  hypeSound('lose'); vibrate(60);
  hypeShow(`<span class="hy-glove">🥊</span><span class="hy-txt"><b class="hy-quote">«¡DEMONIOS, ROCKY! ¿QUÉ TE PASA?»</b><small>— Apollo Creed</small>${sub ? `<em>${esc(sub)}</em>` : ''}</span>`, 'hy-apollo', 5200);
}

/* ---------- HYROX: estación, 1 km, carrera bajo fatiga, simulación ---------- */
const HX_KIND_N = { run1k: '1 km fresco', comp: 'Km bajo fatiga', sim: 'Simulación HYROX' };
function hxRecReact(r) {
  if (!r || !r.sec || r.std === false && !r.pf) return;
  const list = r.pf && typeof hxResultsPF === 'function' && r.kind === 'st' ? hxResultsPF(r.st) : hx().results.filter(x => x.kind === r.kind && (r.kind !== 'st' || x.st === r.st) && !x.pf && x.std !== false);
  const prev = list.filter(x => x.id !== r.id).reduce((a, x) => !a || x.sec < a.sec ? x : a, null);
  const name = r.kind === 'st' ? (r.pf && typeof PF_SUB === 'object' && PF_SUB[r.st] ? PF_SUB[r.st].n : HX_ST[r.st].n) : HX_KIND_N[r.kind] || 'HYROX';
  if (r.kind === 'sim' && !r.pf && typeof fieldReact === 'function') { const o = typeof hxMyBest === 'function' ? [].concat(((DB.ev && DB.ev.results) || []).filter(x => x.sport === 'hyrox' && x.sec), hx().results.filter(x => x.kind === 'sim' && x.sec && !x.pf && x.id !== r.id)).reduce((a, x) => !a || x.sec < a ? x.sec : a, null) : null; setTimeout(() => fieldReact(o, r.sec), 5200); }
  if (!prev) return achToast(`Primera marca · ${name}`, `${hxT(r.sec)} · desde aquí empieza tu historia`);
  if (r.sec < prev.sec) return achToast(`Nuevo récord · ${name}`, `${hxT(r.sec)} · ${hxT(prev.sec - r.sec)} más rápido`);
  apolloToast(`${name}: ${hxT(r.sec)}. Tu récord sigue en ${hxT(prev.sec)} (te faltaron ${hxT(r.sec - prev.sec)}). Levántate y vuelve.`);
}

/* ---------- Gimnasio ---------- */
const HYPE_DONE = new Set();   // ejercicio+sesión ya evaluados
function gymReact(set, out) {
  if (!set || !set.ex) return;
  const u = typeof unitFor === 'function' ? unitFor(set.ex) : 'kg';
  if (out && out.length) {
    const k = out.includes('peso') ? 'peso' : out.includes('reps') ? 'reps' : '1rm';
    achToast({ peso: `Récord de peso · ${set.ex}`, reps: `Récord de reps · ${set.ex}`, '1rm': `Récord de fuerza · ${set.ex}` }[k], `${wFmt(set.w, u)} × ${set.r}`);
    HYPE_DONE.add(set.sid + '|' + set.ex);
    return;
  }
  const s = DB.sessions.find(x => x.id === set.sid); if (!s || HYPE_DONE.has(set.sid + '|' + set.ex)) return;
  const plan = (sessionExercises(s).find(e => e[0] === set.ex) || [])[1];
  const mine = DB.lifts.filter(l => l.sid === set.sid && l.ex === set.ex);
  if (!plan || mine.length < plan) return;
  HYPE_DONE.add(set.sid + '|' + set.ex);
  const prevL = DB.lifts.filter(l => l.ex === set.ex && l.sid !== set.sid);
  if (!prevL.length) return;   // primera vez: no hay récord que romper
  const hadPR = DB.achievements.some(a => a.pr && mine.some(l => a.id.startsWith('pr-' + l.id + '-')));
  if (hadPR) return;
  const best = prevL.reduce((a, l) => !a || e1rm(l.w, l.r) > e1rm(a.w, a.r) ? l : a, null), today = mine.reduce((a, l) => !a || e1rm(l.w, l.r) > e1rm(a.w, a.r) ? l : a, null);
  apolloToast(`${set.ex}: hoy ${wFmt(today.w, u)} × ${today.r}. Tu marca: ${wFmt(best.w, u)} × ${best.r}. La próxima: una rep más o un poco más de peso.`);
}

/* ---------- Carreras ---------- */
function runRecReact(run, prs, longPR, prev) {
  const N = { 1: '1 km', 5: '5 km', 10: '10 km', 21.0975: 'Medio maratón', 42.195: 'Maratón' };
  if (prs && prs.length) { const k = Math.max(...prs); const old = prev.rec[k]; return achToast(`Récord · ${N[k] || k + ' km'}`, `${hxT(run.best[k])}${old ? ' · ' + hxT(old.t - run.best[k]) + ' más rápido' : ' · primera marca'}`); }
  if (longPR) return achToast('Récord · tu carrera más larga', `${fmt(run.km, 2)} km`);
  const ks = Object.keys(run.best || {}).filter(k => prev.rec[k]);
  if (!ks.length) return;
  const k = ks.map(Number).sort((a, b) => b - a)[0];
  apolloToast(`${N[k] || k + ' km'}: ${hxT(run.best[k])}. Tu récord: ${hxT(prev.rec[k].t)}. Hoy sumaste kilómetros; el récord cae otro día.`);
}

window.addEventListener('load', () => {
  const c0 = checkSetRecords;
  checkSetRecords = function (set) { const out = c0(set); setTimeout(() => { try { gymReact(set, out); } catch (e) { console.error(e); } }, 250); return out; };
});

/* Ajustes en la pestaña Logros */
window.addEventListener('load', () => {
  if (typeof renderLogrosTab !== 'function') return;
  const base = renderLogrosTab;
  renderLogrosTab = function () {
    base();
    if (typeof lgView !== 'undefined' && lgView !== 'shelf') return;
    const body = document.getElementById('lg-body'); if (!body) return;
    body.insertAdjacentHTML('beforeend', `<div class="ds-h">Reacciones</div><div class="hy-set">
      <label class="habit"><input type="checkbox" id="hy-on" ${DB.profile.hype !== false ? 'checked' : ''}> "Logro desbloqueado" al romper un récord</label>
      <label class="habit"><input type="checkbox" id="hy-ap" ${DB.profile.apollo !== false ? 'checked' : ''}> Frase de Apollo Creed cuando no rompes tu récord</label>
      <button class="ghost" id="hy-test">Probar las dos</button></div>`);
    $('#hy-on').onchange = e => { DB.profile.hype = e.target.checked; saveData(); };
    $('#hy-ap').onchange = e => { DB.profile.apollo = e.target.checked; saveData(); };
    $('#hy-test').onclick = () => { achToast('Nuevo récord · Sentadilla con barra', '140 kg × 1'); apolloToast('Así se ve cuando no superas tu marca. Levántate y vuelve.'); };
  };
});
