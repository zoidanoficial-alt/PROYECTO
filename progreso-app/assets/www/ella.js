'use strict';
/* Mi Progreso 13.0 · Modo Ella 🎀
   Dos ajustes independientes que el botón "Modo Ella" activa juntos:
   - look 'rosa': colores rosa y blanco, logo rosa, confeti de corazones y emojis en femenino.
   - sex 'f': textos en femenino, referencias de fuerza para mujer y perfil "mujer" al exportar.
   Se pueden cambiar por separado en Más → Apariencia. */

const fem = () => !!(typeof DB !== 'undefined' && DB && DB.profile && DB.profile.sex === 'f');
const girly = () => !!(typeof DB !== 'undefined' && DB && DB.profile && DB.profile.look === 'rosa');
/** Texto según el perfil: g('listo', 'lista'). */
const g = (m, f) => fem() ? f : m;

/* Frases fijas en masculino que se dirigen a la usuaria (también las de data.js). */
const FEM_TEXT = [
  [/\b([Ee])stás listo\b/g, '$1stás lista'], [/\b([Vv])as encendido\b/g, '$1as encendida'],
  [/\b([Dd])escansa tranquilo\b/g, '$1escansa tranquila'], [/\b([Ee])stás cansado\b/g, '$1stás cansada'],
  [/\b([Ll])lego cansado\b/g, '$1lego cansada'], [/\bAgotado\b/g, 'Agotada'], [/\bagotado\b/g, 'agotada'],
  [/\b([Ss])eguro que\b/g, '$1egura que'], [/\b([Bb])ienvenido\b/g, '$1ienvenida']
];
/* Personas: se usa la versión de mujer (ZWJ + ♀). Y algunos íconos más tiernos. */
const FEM_EMOJI = /(\u{1F3CB}|\u{1F3C3}|\u{1F6B6}|\u{1F9D8}|\u{1F6B4}|\u{1F3CA}|\u{1F938}|\u{1F9D7}|\u{1F64B}|\u{1F937}|\u{1F926}|\u{1F647})️?(?!‍|️?‍)/gu;
const CUTE_SWAP = [[/💪/gu, '💖'], [/🐻/gu, '🧸'], [/🚀/gu, '🌸'], [/🦾/gu, '💗'], [/🏆/gu, '👑'], [/🔥/gu, '✨']];

function femText(s) {
  if (fem()) for (const [re, to] of FEM_TEXT) s = s.replace(re, to);
  if (girly()) { s = s.replace(FEM_EMOJI, (_, c) => c + (c === '\u{1F3CB}' ? '\uFE0F' : '') + '\u200D\u2640\uFE0F'); for (const [re, to] of CUTE_SWAP) s = s.replace(re, to); }
  return s;
}
/** Recorre los textos nuevos de la pantalla y los pasa a femenino (no toca campos de texto). */
function femify(root) {
  if (!fem() && !girly()) return;
  root = root || document.body;
  if (root.nodeType === 3) { const v = femText(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1 || root.closest('input,textarea,script,style,[contenteditable]')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = w.nextNode(); n; n = w.nextNode()) { const v = femText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  // Las opciones de <select> y los placeholders también se leen
  root.querySelectorAll && root.querySelectorAll('[placeholder]').forEach(e => { const v = femText(e.placeholder); if (v !== e.placeholder) e.placeholder = v; });
}

/** Paleta actual para lienzos y SVG (lee las variables CSS del tema). */
function pal() {
  const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return { a: v('--cyan'), a2: v('--cyan-2'), b: v('--orange'), b2: v('--orange-2'), c: v('--blue'), low: v('--low') || '#4f6b7a' };
}

/** Activa o quita el Modo Ella (look rosa + perfil de mujer). */
function setElla(on) {
  const p = DB.profile;
  if (on) { if (p.look !== 'rosa') p.themeBeforeElla = p.theme; p.look = 'rosa'; p.sex = 'f'; p.theme = 'light'; }
  else { p.look = 'logo'; p.sex = 'm'; if (p.themeBeforeElla) { p.theme = p.themeBeforeElla; delete p.themeBeforeElla; } }
  saveData(); applyTheme();
}

/** Invitación suave al módulo del ciclo (solo perfil de mujer, si no lo usa y no la descartó). */
function cycleInviteCard() {
  if (!fem() || DB.profile.cycleOn || DB.profile.cycleInviteNo) return '';
  return `<div class="card ella-invite" data-fold-title="Tu ciclo" data-fold-sum="Opcional y privado" data-fold-ico="🌸">
    <h2>🌸 ¿Quieres conocer tu ciclo?</h2>
    <p class="small" style="margin:0 0 10px">Registra tu periodo y cómo te sientes. Con el tiempo verás tus patrones de energía, antojos y sueño. Es opcional, se queda en tu teléfono y nunca baja tu entreno solo por estar menstruando.</p>
    <div class="row"><button id="ci-yes" style="flex:2">Sí, quiero</button><button class="secondary" id="ci-no" style="flex:1">Ahora no</button></div>
  </div>`;
}
function bindCycleInvite(root, rerender) {
  const y = $('#ci-yes', root), n = $('#ci-no', root);
  if (y) y.onclick = () => openCycleConsent(rerender);
  if (n) n.onclick = () => { DB.profile.cycleInviteNo = true; saveData(); rerender(); };
}
