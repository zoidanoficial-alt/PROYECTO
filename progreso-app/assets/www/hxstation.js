'use strict';
/* =====================================================================
 *  41.0 · Cada estación de HYROX como ejercicio individual
 *  Ilustración animada (competencia o Planet Fitness), récord, historial y
 *  "Entrenar esta estación sola" con el temporizador (también desde el reloj).
 * ===================================================================== */
const HXS_ORDER = ['run', 'ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb'];
let hxsPF = null;
function hxsDefPF() { return (typeof hxIsPF === 'function' && hxIsPF()) || (!hx().profile && typeof isPF === 'function' && isPF()); }
function hxsIsPF() { return hxsPF != null ? hxsPF : hxsDefPF(); }
function hxsInfo(k, pf) {
  if (k === 'run') return { n: '1 km', d: pf ? 'En cinta o pista, a tope y bien calentado' : '1 km a tope, bien calentado', tip: 'Ritmo constante: el primer minuto ligeramente controlado y aprieta los últimos 300 m. En HYROX se repite 8 veces, así que tu 1 km fresco es la base de todo.', err: ['Salir demasiado rápido', 'No calentar 10–15 min'], kind: 'run1k' };
  const s = HX_ST[k], sub = pf && typeof PF_SUB === 'object' ? PF_SUB[k] : null;
  return sub ? { n: sub.n, d: sub.d, tip: sub.how, why: sub.why, alt: sub.alt, comparable: sub.comparable, err: s.err, kind: 'st' } : { n: s.n, d: s.d, tip: s.tip, err: s.err, kind: 'st' };
}
function hxsBest(k, pf) {
  if (k === 'run') return hxBest('run1k');
  if (pf && typeof hxBestPF === 'function' && PF_SUB[k] && !PF_SUB[k].comparable) return hxBestPF(k);
  return hxBest('st', k);
}
function hxsList(k, pf) {
  if (k === 'run') return hxResults('run1k').slice().reverse();
  if (pf && typeof hxResultsPF === 'function' && PF_SUB[k] && !PF_SUB[k].comparable) return hxResultsPF(k).slice().reverse();
  return hxResults('st', k).slice().reverse();
}
/** Intentos que no cuentan por imposibles (para mostrarlos y poder borrarlos). */
function hxsBad(k) { return hx().results.filter(r => (k === 'run' ? r.kind === 'run1k' : r.kind === 'st' && r.st === k) && !r.pf && !hxResultOk(r)); }
/** Nueva ficha de estación (reemplaza la anterior). */
openHxStation = function (k, back) {
  const pf = hxsIsPF(), I = hxsInfo(k, pf), best = hxsBest(k, pf), rs = hxsList(k, pf), idx = HXS_ORDER.indexOf(k);
  const p = hx().profile || {}, ref = k !== 'run' && HX_ST[k].load && !pf ? HX_LOADS[p.cat === 'pro' ? 'pro' : 'open'][p.sex === 'f' ? 'f' : 'm'][k] : null;
  const score = k !== 'run' && best && !pf ? hxScore(k, (hxCurrent('st', k) || best).sec) : k === 'run' && best ? hxScore('run1k', best.sec) : null;
  openModal(`<div class="hxs">
    <div class="hx-eyebrow">${k === 'run' ? 'CARRERA · 1 KM' : 'ESTACIÓN ' + idx + ' DE 8'}</div>
      <div class="seg hxs-mode"><button data-hxsm="0" class="${!pf ? 'on' : ''}">Competencia</button><button data-hxsm="1" class="${pf ? 'on' : ''}">Planet Fitness</button></div>
    <div class="hxs-art">${hxArt(k, pf)}</div>
    <h3>${esc(I.n)}</h3><p class="hxs-dose">${esc(I.d)}${ref ? ` · carga: <b>${esc(ref)}</b>` : ''}</p>
    <div class="hx-kpis"><div><b>${best ? hxT(best.sec) : '—'}</b><small>Récord</small></div><div><b>${rs[0] ? hxT(rs[0].sec) : '—'}</b><small>Última</small></div><div><b>${rs.length}</b><small>Intentos</small></div>${score != null ? `<div><b>${score}</b><small>Puntaje</small></div>` : ''}</div>
    <button class="block" id="hxs-go">${ico('timer', 18, 'lead')}Entrenar ${k === 'run' ? 'el 1 km' : 'esta estación'} sola</button>
    <div class="row hxs-more">${k !== 'run' ? '<button class="secondary" id="hxs-comp">Estación + 1 km</button>' : ''}<button class="secondary" id="hxs-man">Escribir un tiempo</button></div>
    ${pf && I.why ? `<div class="pg-rec"><b>Por qué funciona</b><small>${esc(I.why)}</small></div>` : ''}
    ${k !== 'run' && typeof HP_STATION === 'object' ? `<div class="pg-rec hp-key"><b>Lo que necesitas</b><small>${esc(HP_STATION[k])}. No intentes ganar la estación: no pierdas tiempo.</small></div>` : ''}
    <div class="pg-rec"><b>Técnica</b><small>${esc(I.tip)}</small></div>
    <div class="pg-rec"><b>Errores frecuentes</b><small>${esc(I.err.join(' · '))}</small></div>
    ${pf && I.alt ? `<div class="pg-rec"><b>Si no hay la máquina</b><small>${esc(I.alt)}</small></div>` : ''}
    ${pf && I.comparable === false ? '<p class="small muted">Esta adaptación no es igual a la estación de competencia: su récord se guarda aparte y no entra a tu predicción.</p>' : ''}
    ${hxsBad(k).length ? `<div class="hxs-bad">${ico('triangle-alert', 16)}<span><b>${hxsBad(k).length === 1 ? 'Un tiempo no cuenta' : hxsBad(k).length + ' tiempos no cuentan'}</b><small>${hxsBad(k).map(r => hxT(r.sec) + ' (' + shortDate(r.date) + ')').join(', ')} · parece un temporizador olvidado o un error al escribirlo.</small></span><button class="ghost" id="hxs-badx">Borrar</button></div>` : ''}
    ${rs.length ? `<div class="rir-label"><span>Historial</span></div><table class="small"><tbody>${rs.slice(0, 8).map(r => `<tr><td>${shortDate(r.date)}</td><td><b>${hxT(r.sec)}</b>${best && r.id === best.id ? ' 🏆' : ''}</td><td>${r.rpe ? 'RPE ' + r.rpe : ''}</td><td>${r.pf ? 'PF' : r.std === false ? 'no comparable' : r.load ? esc(r.load) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <button class="ghost block" id="hs1-x">← Volver</button></div>`, m => {
    $$('[data-hxsm]', m).forEach(b => b.onclick = () => { hxsPF = b.dataset.hxsm === '1'; openHxStation(k, back); });
    const go = mode => { closeModal(); mode === 'run1k' ? hxtCreate('run1k') : hxtCreate(mode, k); hxsApplyMode(pf); };
    $('#hxs-go', m).onclick = () => go(k === 'run' ? 'run1k' : 'station');
    const c = $('#hxs-comp', m); if (c) c.onclick = () => go('comp');
    $('#hxs-man', m).onclick = () => openHxTest(k === 'run' ? 'run1k' : k, null, () => openHxStation(k, back));
    $('#hs1-x', m).onclick = back || (() => closeModal());
    const bx = $('#hxs-badx', m); if (bx) bx.onclick = () => { if (!confirm('¿Borrar ' + (hxsBad(k).length === 1 ? 'ese tiempo' : 'esos tiempos') + '?')) return; const bad = new Set(hxsBad(k).map(r => r.id)); hx().results = hx().results.filter(r => !bad.has(r.id)); saveData(); openHxStation(k, back); render(currentTab); };
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) $$('svg', m).forEach(s => s.pauseAnimations && s.pauseAnimations());
  });
};
/** Rejilla de estaciones con ilustración (Competir). */
function hxsGrid(perf, bn) {
  const pf = hxsDefPF();
  return `<div class="hxs-grid">${HXS_ORDER.map((k, i) => { const b = hxsBest(k, pf), weak = bn && bn.main && bn.main.k === k;
    return `<button class="hxs-cell${b ? ' on' : ''}${weak ? ' weak' : ''}" data-cpst="${k}">${hxArt(k, pf)}<span><small>${k === 'run' ? 'RUN' : String(i).padStart(2, '0')}</small><b>${esc(hxsInfo(k, pf).n)}</b><em>${b ? '🏆 ' + hxT(b.sec) : 'sin medir'}</em></span></button>`; }).join('')}</div>`;
}

/** El temporizador usa la versión elegida en la ficha (competencia o Planet Fitness). */
function hxsApplyMode(pf) {
  const t = hxt(); if (!t || !!t.pf === !!pf) return;
  t.pf = !!pf;
  t.segs.forEach(sg => { if (sg.k !== 'run' && PF_SUB[sg.k]) { sg.n = pf ? PF_SUB[sg.k].n : HX_ST[sg.k].n; sg.d = pf ? PF_SUB[sg.k].d : HX_ST[sg.k].d; } });
  saveData(); openHxTimer();
}
