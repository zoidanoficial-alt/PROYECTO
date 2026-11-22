'use strict';
/* =====================================================================
 *  37.0 · Fluidez: nunca te pierdes
 *  1) Barra "en curso": si tienes un entreno, carrera o temporizador abierto,
 *     siempre hay un botón para volver a él, estés donde estés.
 *  2) Atrás de Android sigue la jerarquía: si la pantalla tiene "← Volver", va ahí;
 *     si no, cierra. Ya no te saca de golpe de un menú profundo.
 *  3) Toda hoja tiene un ✕ visible arriba: no hay que bajar hasta el final para salir.
 * ===================================================================== */
function flowNow() {
  if (typeof hxt === 'function' && hxt()) { const t = hxt(); return { k: 'hxt', t: HXT_TITLE[t.mode], s: t.t0 ? hxT(hxtNow(t).total / 1000) + (t.paused != null ? ' · pausa' : '') : 'listo para empezar', go: () => openHxTimer() }; }
  if (DB.hyrox && DB.hyrox.active) { const a = DB.hyrox.active; return { k: 'hxs', t: a.n, s: Math.round((Date.now() - a.start) / 60000) + ' min', go: () => openHxSession() }; }
  if (typeof RUN !== 'undefined' && RUN.st) return { k: 'run', t: RUN.st.title, s: `${fmt(RUN.st.dist / 1000, 2)} km · ${mmss(runElapsed())}`, go: () => { closeModal(); showTab('train'); }, tab: 'train' };
  const s = activeSession();
  if (s) { const n = DB.lifts.filter(l => l.sid === s.id).length, r = REST.end > Date.now() ? ` · descanso ${mmss(Math.ceil((REST.end - Date.now()) / 1000))}` : ''; return { k: 'gym', t: s.dayName, s: `${n} series · ${Math.round((Date.now() - s.start) / 60000)} min${r}`, go: () => { closeModal(); showTab('train'); }, tab: 'train' }; }
  return null;
}
function flowPaint() {
  let bar = document.getElementById('live-bar');
  const f = flowNow(), modal = $('#modal-bg').classList.contains('open');
  const hide = !f || modal || (f.tab && currentTab === f.tab) || document.body.classList.contains('in-session');
  if (hide) { if (bar) bar.hidden = true; document.body.classList.remove('has-live'); return; }
  if (!bar) {
    bar = document.createElement('button'); bar.id = 'live-bar'; bar.className = 'live-bar';
    document.body.appendChild(bar);
    bar.onclick = () => { const x = flowNow(); if (x) x.go(); };
  }
  bar.hidden = false; document.body.classList.add('has-live');
  bar.innerHTML = `<i></i><span><b>${esc(f.t)}</b><small>${esc(f.s)}</small></span><em>Volver ›</em>`;
}
setInterval(() => { try { if (typeof DB !== 'undefined' && DB && document.getElementById('modal-bg')) flowPaint(); } catch (e) {} }, 1000);

/* Atrás de Android: primero "← Volver" de la hoja, si existe */
window.addEventListener('load', () => {   // app.js define el atrás base después de este archivo
  const prev = window.onAndroidBack;
  window.onAndroidBack = function () {
    if ($('#modal-bg').classList.contains('open')) {
      const back = Array.from($$('#modal button')).find(b => /^\s*(←|‹)/.test(b.textContent) || /^\s*Volver\b/i.test(b.textContent));
      if (back) { back.click(); return true; }
    }
    return prev ? prev() : false;
  };
});

/* ✕ fijo arriba en cada hoja */
new MutationObserver(() => {
  const m = document.getElementById('modal'); if (!m || !m.firstElementChild || m.querySelector(':scope > .modal-x')) return;
  if (m.querySelector('.hxt')) return;   // el temporizador tiene sus propios controles
  const x = document.createElement('button'); x.className = 'modal-x'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '✕';
  x.onclick = () => closeModal(); m.prepend(x);
}).observe(document.getElementById('modal') || document.body, { childList: true });
