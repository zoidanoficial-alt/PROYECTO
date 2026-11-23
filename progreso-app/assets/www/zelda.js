'use strict';
/* =====================================================================
 *  43.0 · "¡Conseguiste una medalla!" — escena de aventura
 *  Pantalla que se oscurece, un cofre que se abre, rayos de luz, la medalla sube y flota
 *  con destellos y un cuadro de diálogo con el texto letra por letra.
 *  Diseño y melodía originales (arpegio propio, sin música de terceros).
 *  Toca para continuar; "Ver medalla" abre su ficha. Respeta "reducir movimiento".
 * ===================================================================== */
function zeldaChime(tier) {
  try {
    hypeAudio = hypeAudio || new (window.AudioContext || window.webkitAudioContext)();
    const a = hypeAudio, t = a.currentTime;
    // Arpegio ascendente propio (sol mayor con séptima) y un brillo final
    const seq = [[392, 0], [494, 0.12], [587, 0.24], [740, 0.36], [784, 0.52], [988, 0.64], [1175, 0.76]].concat(tier >= 3 ? [[1568, 0.95], [1319, 1.05], [1568, 1.15]] : [[1568, 0.95]]);
    seq.forEach(([f, d], i) => {
      const o = a.createOscillator(), g = a.createGain(), last = i >= seq.length - 1;
      o.type = i < 4 ? 'square' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(i < 4 ? 0.05 : 0.12, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + (last ? 1.1 : 0.28));
      o.connect(g).connect(a.destination); o.start(t + d); o.stop(t + d + (last ? 1.2 : 0.3));
    });
  } catch (e) {}
}
const ZL_CHEST = `<svg class="zl-chest" viewBox="0 0 120 90" aria-hidden="true">
  <defs><linearGradient id="zlw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a2b"/><stop offset="1" stop-color="#4a2c12"/></linearGradient>
  <linearGradient id="zlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".5" stop-color="#e0b43a"/><stop offset="1" stop-color="#8f6a12"/></linearGradient></defs>
  <g class="zl-base"><rect x="10" y="44" width="100" height="42" rx="4" fill="url(#zlw)" stroke="#2a180a" stroke-width="2"/>
    <rect x="10" y="44" width="100" height="8" fill="url(#zlg)" stroke="#2a180a" stroke-width="1.5"/>
    <rect x="22" y="44" width="8" height="42" fill="url(#zlg)" opacity=".9"/><rect x="90" y="44" width="8" height="42" fill="url(#zlg)" opacity=".9"/>
    <rect x="52" y="52" width="16" height="16" rx="3" fill="url(#zlg)" stroke="#2a180a" stroke-width="1.5"/><circle cx="60" cy="59" r="2.6" fill="#2a180a"/></g>
  <g class="zl-lid"><path d="M10 44 V30 Q60 4 110 30 V44 Z" fill="url(#zlw)" stroke="#2a180a" stroke-width="2"/>
    <path d="M10 44 V38 H110 V44 Z" fill="url(#zlg)" stroke="#2a180a" stroke-width="1.5"/>
    <path d="M22 44 V24 Q26 21 30 20 V44 Z M90 44 V20 Q94 21 98 24 V44 Z" fill="url(#zlg)" opacity=".9"/></g>
</svg>`;
function zeldaScene(news) {
  news.sort((a, b) => b.tier - a.tier || b.score - a.score);
  const top = news[0], more = news.length - 1, T = MD_TIERS[top.tier], C = MD_CATS[top.cat];
  let el = document.getElementById('md-pop'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'md-pop'; el.className = 'zl t' + top.tier; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Medalla conseguida: ' + top.n);
  const line1 = '¡Conseguiste la medalla ', line2 = `Medalla ${T.n.toLowerCase()} · ${C ? C.n : ''}`;
  let k = 0; const chars = s => Array.from(s).map(c => `<i style="--d:${(k++) * 28}ms">${c === ' ' ? '&nbsp;' : esc(c)}</i>`).join('');
  el.innerHTML = `<div class="zl-bg"></div>
    <div class="zl-stage"><div class="zl-rays"></div>${ZL_CHEST}
      <div class="zl-medal">${mdSvg(top, true, 112)}</div>
      ${Array.from({ length: 10 }, (_, i) => `<span class="zl-spark" style="--a:${i * 36}deg;--dl:${1.3 + (i % 5) * 0.12}s"></span>`).join('')}</div>
    <div class="zl-box"><p class="zl-txt">${chars(line1)}<b>${chars(top.n)}</b>${chars('!')}</p><small class="zl-sub">${chars(line2)}${more ? chars(` · +${more} más`) : ''}</small>
      <div class="zl-act"><button class="zl-see" id="zl-see">Ver medalla</button><span class="zl-next">▼</span></div></div>`;
  document.body.appendChild(el);
  zeldaChime(top.tier); vibrate(top.tier >= 3 ? [60, 40, 60, 40, 180] : [60, 40, 120]);
  const close = () => { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 450); };
  el.onclick = e => { if (e.target.id === 'zl-see') { el.remove(); openMedal(top.id); return; } if (!el.classList.contains('typed')) { el.classList.add('typed'); return; } close(); };
  setTimeout(() => el.classList.add('typed'), 1700 + k * 28);
  setTimeout(close, 7500);
}
window.addEventListener('load', () => { if (typeof mdCelebrate === 'function') mdCelebrate = zeldaScene; });
