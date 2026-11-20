'use strict';
/* =====================================================================
 *  32.0 · Mi escalera HYROX: tu ranking personal (solo en tu teléfono)
 *  No se extraen datos de sitios de terceros: HYROX envió cartas de cese y desista a sitios de
 *  resultados (incluido HYRESULT) por el uso de datos sin licencia ni consentimiento de los atletas.
 *  Aquí los rivales los agregas tú (amigos, compañeros o atletas que sigues) y nunca salen del teléfono.
 * ===================================================================== */

const LADDER_GOALS = [3600, 4200, 4800, 5400, 6300, 7200];   // metas: sub 1:00 … sub 2:00
let ladderScope = 'all';

function hxRivals() {
  const h = hx();
  if (!h.rivals) {   // migra los "atletas de referencia" de la 27.0
    h.rivals = (h.refs || []).filter(r => r.sec).map((r, i) => ({ id: 'rv' + Date.now() + i, name: r.name, country: '', cat: '', sec: r.sec, splits: r.splits || null, src: '' }));
  }
  return h.rivals;
}
/** Tu mejor tiempo real: carreras oficiales registradas y simulaciones completas. */
function hxMyBest() {
  const races = ((DB.ev && DB.ev.results) || []).filter(r => r.sport === 'hyrox' && r.sec).map(r => ({ sec: r.sec, src: 'Carrera · ' + r.name, date: r.date, splits: r.splits }));
  const sims = ((DB.hyrox && DB.hyrox.results) || []).filter(r => r.kind === 'sim' && r.sec && !r.pf).map(r => ({ sec: r.sec, src: r.fromWatch ? 'Simulación (reloj)' : 'Simulación', date: r.date }));
  return races.concat(sims).sort((a, b) => a.sec - b.sec)[0] || null;
}
function hxLadder(scope) {
  const me = hxMyBest(), pr = me ? null : (typeof hxPredict === 'function' ? hxPredict() : null);
  const myName = DB.profile.name || 'Tú';
  const rows = hxRivals().filter(r => scope === 'mx' ? r.country === 'MX' : scope === 'world' ? r.country !== 'MX' : true).map(r => ({ k: 'rival', id: r.id, name: r.name, sub: [r.cat, r.country === 'MX' ? 'México' : r.countryName || ''].filter(Boolean).join(' · '), sec: r.sec, splits: r.splits }));
  LADDER_GOALS.forEach(g => rows.push({ k: 'goal', name: `Meta sub ${hxT(g)}`, sub: 'meta de la app', sec: g }));
  if (me) rows.push({ k: 'me', name: myName, sub: me.src, sec: me.sec, splits: me.splits });
  else if (pr && pr.ok) rows.push({ k: 'me', name: myName, sub: 'predicción (aún sin carrera ni simulación)', sec: Math.round(pr.total), predicted: true });
  rows.sort((a, b) => a.sec - b.sec || (a.k === 'me' ? -1 : 1));
  const i = rows.findIndex(r => r.k === 'me'), rivals = rows.filter(r => r.k !== 'goal');
  const next = i > 0 ? rows.slice(0, i).reverse().find(r => r.k !== 'me') : null;
  return { rows, me: rows[i] || null, rank: rivals.findIndex(r => r.k === 'me') + 1, of: rivals.length, next };
}
/** Llamar con tu mejor marca ANTES de guardar la nueva: devuelve a quién superaste. */
function hxLadderBeaten(prevSec, newSec) {
  if (!newSec) return [];
  return hxRivals().filter(r => newSec < r.sec && (prevSec == null || prevSec >= r.sec))
    .concat(LADDER_GOALS.filter(g => newSec < g && (prevSec == null || prevSec >= g)).map(g => ({ name: `la meta sub ${hxT(g)}`, sec: g, goal: true })))
    .sort((a, b) => a.sec - b.sec);
}
function hxLadderCelebrateHtml(beaten) {
  if (!beaten.length) return '';
  const people = beaten.filter(b => !b.goal), goals = beaten.filter(b => b.goal);
  return `<div class="ld-win"><small>MI ESCALERA</small><b>${people.length ? `¡Superaste a ${esc(people.map(p => p.name).join(', '))}!` : `¡Rompiste ${esc(goals[0].name)}!`}</b>${people.length && goals.length ? `<span>Y rompiste ${esc(goals.map(g => g.name).join(', '))}.</span>` : ''}<span>Tu nombre sube en tu ranking.</span></div>`;
}
function hxLadderBurst(modal) { const w = $('.ld-win', modal); if (w && typeof burst === 'function') setTimeout(() => burst(w), 250); }

/* ---------- Pantallas ---------- */
function ladderSummary() {
  const L = hxLadder('all');
  if (!L.me) return 'Agrega rivales y registra tu primera simulación';
  return `#${L.rank} de ${L.of}${L.me.predicted ? ' (predicción)' : ''}${L.next ? ` · siguiente: ${L.next.name}` : ' · vas arriba'}`;
}
function openHxLadder(back) {
  const L = hxLadder(ladderScope), mine = hxMyBest();
  const gap = L.me && L.next ? L.me.sec - L.next.sec : null;
  const myRace = ((DB.ev && DB.ev.results) || []).filter(r => r.sport === 'hyrox' && r.splits).sort((a, b) => a.sec - b.sec)[0];
  openModal(`<div class="hx-eyebrow">MI ESCALERA · RANKING DE LA APP</div>
    <h3 style="margin-top:4px">${L.me ? `#${L.rank} <span class="muted" style="font-weight:600">de ${L.of}</span>` : 'Tu ranking'}</h3>
    ${L.me && L.next ? `<div class="ld-next"><small>SIGUIENTE OBJETIVO</small><b>${esc(L.next.name)}</b><span>Te faltan <b class="t-metric">${hxT(gap)}</b> para ${L.next.k === 'goal' ? 'romperla' : 'superarlo'}${L.me.sec ? ` · ${(gap / L.me.sec * 100).toFixed(1)} % de tu tiempo` : ''}.</span></div>` : L.me ? '<div class="ld-next"><small>ARRIBA DE TODOS</small><b>Vas primero en tu escalera</b><span>Agrega a alguien más rápido para tener un nuevo objetivo.</span></div>' : ''}
    ${!mine ? '<div class="status info"><b>Aún sin tiempo real</b>Haz una simulación con el temporizador o registra una carrera: con eso entras a la escalera con tu tiempo real.</div>' : ''}
    <div class="seg ev-views">${[['all', 'Todos'], ['mx', 'México'], ['world', 'Mundo']].map(([k, n]) => `<button data-ls="${k}" class="${ladderScope === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="ld-list">${L.rows.map((r, i) => {
      const pos = L.rows.slice(0, i + 1).filter(x => x.k !== 'goal').length;
      return r.k === 'goal' ? `<div class="ld-goal"><span>${esc(r.name)}</span></div>`
        : `<button class="ld-row ${r.k}"${r.k === 'rival' ? ` data-rv="${r.id}"` : ''}><span class="ld-pos">${pos}</span><span class="grow"><b>${esc(r.name)}</b><small>${esc(r.sub || '')}</small></span><span class="ld-t">${hxT(r.sec)}</span></button>`;
    }).join('')}</div>
    ${L.next && L.next.splits && myRace && typeof hxCompareHtml === 'function' ? `<div class="rir-label"><span>Dónde le ganas o pierdes</span></div>${hxCompareHtml(myRace, { name: L.next.name, sec: L.next.sec, splits: L.next.splits })}` : ''}
    <button class="block" id="ld-add">＋ Agregar rival</button>
    <p class="small muted">Tus rivales y tu escalera viven solo en tu teléfono. Agrega a amigos o atletas que sigues; no descargamos datos de sitios de resultados: HYROX no lo autoriza.</p>
    <button class="ghost block" id="ld-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => {
    $$('[data-ls]', m).forEach(b => b.onclick = () => { ladderScope = b.dataset.ls; openHxLadder(back); });
    $$('[data-rv]', m).forEach(b => b.onclick = () => openRivalForm(b.dataset.rv, () => openHxLadder(back)));
    $('#ld-add', m).onclick = () => openRivalForm(null, () => openHxLadder(back));
    $('#ld-x', m).onclick = () => back ? back() : closeModal();
  });
}
function openRivalForm(id, back) {
  const r = id ? hxRivals().find(x => x.id === id) : { country: 'MX', cat: '', name: '', sec: null, splits: null, src: '' };
  const SPL = typeof HX_SPLITS !== 'undefined' ? HX_SPLITS : [];
  openModal(`<h3>${id ? 'Editar rival' : 'Agregar rival'}</h3>
    <label>Nombre o alias<input id="rv-n" value="${esc(r.name)}" placeholder="Ej. Carlos del box"></label>
    <div class="row" style="gap:8px"><label style="flex:1">País<select id="rv-c"><option value="MX" ${r.country === 'MX' ? 'selected' : ''}>México</option><option value="XX" ${r.country !== 'MX' ? 'selected' : ''}>Otro país</option></select></label>
      <label style="flex:1">Categoría<input id="rv-cat" value="${esc(r.cat || '')}" placeholder="Men Open 30-34"></label></div>
    <label>Su mejor tiempo (h:mm:ss)<input id="rv-t" value="${r.sec ? hxT(r.sec) : ''}" placeholder="1:15:30"></label>
    <details ${r.splits ? 'open' : ''}><summary class="small"><b>Parciales (opcional)</b> · para ver en qué tramos le ganas</summary><div class="ev-splits">${SPL.map((n, i) => `<label>${n}<input data-rs="${i}" value="${r.splits && r.splits[i] ? hxT(r.splits[i]) : ''}" placeholder="m:ss"></label>`).join('')}</div></details>
    <div class="row" style="gap:8px">${id ? '<button class="ghost" id="rv-del" style="color:var(--bad)">Eliminar</button>' : ''}<span class="grow"></span><button class="secondary" id="rv-c2">Cancelar</button><button id="rv-s">Guardar</button></div>`, m => {
    $('#rv-c2', m).onclick = back;
    const d = $('#rv-del', m); if (d) d.onclick = () => { hx().rivals = hxRivals().filter(x => x.id !== id); saveData(); back(); };
    $('#rv-s', m).onclick = () => {
      const sec = hxParse($('#rv-t', m).value), name = $('#rv-n', m).value.trim();
      if (!name || !sec) { toast('Escribe nombre y tiempo'); return; }
      const sp = $$('[data-rs]', m).map(i => hxParse(i.value));
      const o = { id: id || 'rv' + Date.now(), name, country: $('#rv-c', m).value, cat: $('#rv-cat', m).value.trim(), sec, splits: sp.some(Boolean) ? sp : null };
      hx().rivals = hxRivals().filter(x => x.id !== o.id).concat(o); saveData(); back();
    };
  });
}
