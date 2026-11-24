'use strict';
/* =====================================================================
 *  VERSIÓN PERSONAL · Logotipos de HYROX (marca registrada de terceros)
 *  Solo para el uso del dueño de la app. ANTES DE DISTRIBUIR LA APP, BORRA LA CARPETA
 *  "personal/" y su <script> en index.html: la app vuelve al icono de cronómetro y al texto.
 * ===================================================================== */
(function () {
  const MARK = '<img class="pz-mark" src="personal/hyrox-mark.png" alt="" aria-hidden="true">';
  const WORD = '<img class="pz-word" src="personal/hyrox-word.png" alt="HYROX">';
  function brandNav() {
    const b = document.querySelector('#tabs [data-tab=hyrox]'); if (!b || b.dataset.pz) return;
    const svg = b.querySelector('svg'); if (svg) svg.outerHTML = MARK;
    const tl = b.querySelector('.tl'); if (tl) tl.innerHTML = WORD;
    b.dataset.pz = '1'; b.setAttribute('aria-label', 'HYROX');
  }
  function brandTitle() {
    const ht = document.getElementById('hdr-title');
    if (ht && typeof currentTab !== 'undefined' && currentTab === 'hyrox') ht.innerHTML = `<span class="pz-title">${WORD}</span>`;
    document.querySelectorAll('.pn-head b').forEach(b => { if (b.textContent.trim() !== 'HYROX') return; b.innerHTML = `<span class="pz-inline">${WORD}</span>`; const ic = b.closest('.pn-head').querySelector(':scope > svg'); if (ic) ic.outerHTML = MARK.replace('pz-mark', 'pz-mark pz-head'); });
  }
  window.addEventListener('load', () => {
    brandNav();
    const st = showTab;
    showTab = function (tab) { const r = st.apply(this, arguments); brandTitle(); return r; };
    const rt = renderTrain;
    renderTrain = function () { const r = rt.apply(this, arguments); brandTitle(); return r; };
    brandTitle();
  });
})();
