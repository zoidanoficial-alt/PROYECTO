'use strict';
/* =====================================================================
 *  38.0 · NUTRICIÓN INTELIGENTE · interfaz
 *  Secciones: Hoy · Registro · Estrategia · Plan · Historial · Progreso · Ajustes
 *  Una sola fuente de datos: las comidas siguen en DB.days[fecha].meals (con horario y alimento).
 * ===================================================================== */
let nutTab = 'hoy';
const N_TABS = [['hoy', 'Hoy'], ['reg', 'Registro'], ['estr', 'Estrategia'], ['plan', 'Plan'], ['hist', 'Historial'], ['prog', 'Progreso'], ['aj', 'Ajustes']];
const SLOTS = { des: 'Desayuno', com: 'Comida', cen: 'Cena', sna: 'Snack' };
function slotNow() { const h = new Date().getHours(); return h < 11 ? 'des' : h < 17 ? 'com' : h < 21 ? 'cen' : 'sna'; }
const nKcal = n => Math.round(n).toLocaleString('es-MX');

/* ---------- Pantalla ---------- */
window.addEventListener('load', () => {
  const classic = renderFood;
  renderFood = function () {
    const v = $('#view-food');
    const seg = `<div class="seg wrap scroll nu-tabs">${N_TABS.map(([k, n]) => `<button data-nut="${k}" class="${nutTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (nutTab === 'hoy') {
      classic();
      v.insertAdjacentHTML('afterbegin', seg + nuHoyTop());
      const old = v.querySelector('[data-fold="f-tu-objetivo-diario"]'); if (old && nOn()) old.remove();
      if (nOn()) { const hc = v.querySelector('.card.keep .macros'); if (hc) { const prev = hc.previousElementSibling; hc.remove(); if (prev && prev.classList.contains('row')) prev.remove(); } }
      const add = $('#fd-add'); if (add) add.onclick = () => openFoodLog(todayStr(), slotNow());
      nuBindTop(v);
    } else {
      v.innerHTML = seg + '<div id="nu-body"></div>';
      ({ reg: nuRegistro, estr: nuEstrategia, plan: nuPlan, hist: nuHistorial, prog: nuProgreso, aj: nuAjustes })[nutTab]($('#nu-body'));
    }
    $$('[data-nut]', v).forEach(b => b.onclick = () => { nutTab = b.dataset.nut; redrawChart = () => {}; renderFood(); window.scrollTo(0, 0); });
  };
});

/* ---------- Hoy ---------- */
function nuHoyTop() {
  if (!nOn()) return `<button class="nu-cta" id="nu-start">${ico('target', 22)}<span><small>MI ESTRATEGIA</small><b>Elige tu estrategia nutricional</b><em>Volumen, definición, recomposición, mantenimiento o rendimiento. La app calcula y ajusta contigo.</em></span>${ico('chevron-right', 18)}</button>`;
  const tg = targets(), t = todayStr(), tot = dayTotals(t), s = nState(), left = tg.kcal - tot.kcal, foc = nTodayFocus(), adv = nAdvice(), rev = nPhaseReview();
  const meals = (DB.days[t] && DB.days[t].meals) || [];
  const slotK = k => meals.filter(m => m.slot === k).reduce((a, m) => a + (m.kcal != null ? m.kcal : m.p * 4 + m.c * 4 + m.f * 9), 0);
  const pct = Math.min(100, tot.kcal / tg.kcal * 100);
  const mac = (n, v, g, cls) => `<div class="nu-mac ${cls}"><div><b>${Math.round(v)}</b><small>/ ${g} g</small></div><span class="td-bar"><i style="--w:${Math.min(100, v / Math.max(1, g) * 100)}%"></i></span><small>${n}</small></div>`;
  return `<div class="nu-dash">
      <div class="nu-dash-top"><div><small>${esc(NUTRI_MODES[s.mode].n.toUpperCase())}${nPhase() ? ' · SEMANA ' + (Math.floor(daysBetween(nPhase().start, t) / 7) + 1) : ''}</small>
        <b class="${left < 0 ? 'over' : ''}">${nKcal(Math.abs(left))}</b><span>${left >= 0 ? 'kcal disponibles' : 'kcal por encima'} · objetivo ${nKcal(tg.kcal)}</span></div>
        <div class="nu-ring" style="--p:${pct}"><b>${Math.round(pct)}%</b></div></div>
      <div class="nu-macs">${mac('Proteína', tot.p, tg.protein, 'p')}${mac('Carbohidratos', tot.c, tg.carbs, 'c')}${mac('Grasa', tot.f, tg.fat, 'f')}</div>
      <div class="nu-slots">${Object.keys(SLOTS).map(k => `<button data-slot="${k}"><small>${SLOTS[k]}</small><b>${slotK(k) ? nKcal(slotK(k)) : '＋'}</b></button>`).join('')}</div>
    </div>
    ${adv && (adv.st === 'adjust' || adv.st === 'check') ? `<button class="nu-alert ${adv.st}" id="nu-adv">${ico(adv.st === 'adjust' ? 'sliders-horizontal' : 'info', 18)}<span><b>${esc(adv.title)}</b><small>${esc(adv.text)}</small></span>${ico('chevron-right', 16)}</button>` : ''}
    ${rev && rev.due ? `<button class="nu-alert check" id="nu-rev">${ico('calendar', 18)}<span><b>Revisa tu fase</b><small>${esc(rev.sig[0])}</small></span>${ico('chevron-right', 16)}</button>` : ''}
    <div class="nu-focus ${foc.k}"><small>${esc(foc.t.toUpperCase())}</small><p>${esc(foc.txt)}</p><em>${esc(foc.src)}</em></div>`;
}
function nuBindTop(v) {
  const st = $('#nu-start', v); if (st) st.onclick = () => openStrategyPicker();
  $$('[data-slot]', v).forEach(b => b.onclick = () => openFoodLog(todayStr(), b.dataset.slot));
  const a = $('#nu-adv', v); if (a) a.onclick = () => { nutTab = 'estr'; renderFood(); };
  const r = $('#nu-rev', v); if (r) r.onclick = () => { nutTab = 'estr'; renderFood(); };
}

/* ---------- Registro rápido ---------- */
let FL = null;
function nuRecent() { return nState().recents.map(r => ({ ...r, f: NF_BY[r.id] })).filter(r => r.f); }
function openFoodLog(date, slot) {
  FL = { date, slot: slot || slotNow(), q: '', list: nState().recents.length ? 'rec' : 'all', basket: [], sel: null };
  openModal('<div id="fl-root"></div>', flRender);
}
function flUnits(f) { return Object.assign({ 'g': 1 }, Object.fromEntries(Object.entries(f[8] || {}).map(([k, g]) => [k, g]))); }
function flRender() {
  const root = $('#fl-root'); if (!root) return;
  const s = nState(), tg = targets(), tot = dayTotals(FL.date);
  let rows;
  if (FL.q) rows = nfSearch(FL.q).map(f => ({ f }));
  else if (FL.list === 'rec') rows = nuRecent().slice(0, 15);
  else if (FL.list === 'fav') rows = s.favs.map(id => ({ f: NF_BY[id] })).filter(r => r.f);
  else if (FL.list === 'saved') rows = null;
  else rows = NF.map(f => ({ f }));
  const btot = FL.basket.reduce((a, b) => ({ kcal: a.kcal + b.m.kcal, p: a.p + b.m.p, c: a.c + b.m.c, f: a.f + b.m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const row = r => { const m = r.g ? nfMacros(r.f, r.g) : null; return `<div class="fl-row"><button class="fl-pick" data-fid="${r.f[0]}"><b>${esc(nfName(r.f))}</b><small>${m ? `${r.u && r.u !== 'g' ? r.n + ' ' + r.u : r.g + ' g'} · ${m.kcal} kcal · P ${m.p}` : `100 g · ${r.f[2]} kcal · P ${r.f[3]} · C ${r.f[4]} · G ${r.f[5]}`}</small></button>${r.g ? `<button class="fl-quick" data-qadd="${r.f[0]}" aria-label="Agregar igual">＋</button>` : ''}</div>`; };
  root.innerHTML = `<h3 style="margin:0 0 8px">Registrar comida</h3>
    <div class="seg nu-slotseg">${Object.keys(SLOTS).map(k => `<button data-fls="${k}" class="${FL.slot === k ? 'on' : ''}">${SLOTS[k]}</button>`).join('')}</div>
    <input id="fl-q" class="fl-q" placeholder="Busca: pollo, tortilla, arroz cocido…" value="${esc(FL.q)}" autocomplete="off">
    ${FL.q ? '' : `<div class="chips fl-lists">${[['rec', 'Recientes'], ['fav', 'Favoritos'], ['saved', 'Comidas guardadas'], ['all', 'Todos']].map(([k, n]) => `<button class="chip-btn ${FL.list === k ? 'on' : ''}" data-fll="${k}">${n}</button>`).join('')}</div>`}
    ${FL.sel ? flEditor() : ''}
    <div class="fl-list">${rows === null ? (s.saved.length ? s.saved.map((sv, i) => `<div class="fl-row"><button class="fl-pick" data-saved="${i}"><b>${esc(sv.name)}</b><small>${sv.items.length} ingredientes · ${nKcal(sv.items.reduce((a, it) => a + nfMacros(it.id, it.g).kcal, 0))} kcal</small></button><button class="fl-quick" data-savedel="${i}" aria-label="Borrar">✕</button></div>`).join('') : '<p class="small muted">Arma un plato con varios ingredientes y toca "Guardar como comida frecuente".</p>')
      : rows.length ? rows.map(row).join('') : '<p class="small muted">Sin resultados. Puedes escribir los macros a mano abajo.</p>'}</div>
    ${FL.basket.length ? `<div class="fl-basket"><div class="row spread"><b>Tu plato · ${SLOTS[FL.slot]}</b><span>${nKcal(btot.kcal)} kcal · P ${Math.round(btot.p)} · C ${Math.round(btot.c)} · G ${Math.round(btot.f)}</span></div>
      ${FL.basket.map((b, i) => `<div class="fl-bi"><span>${esc(b.label)}</span><small>${b.m.kcal} kcal</small><button data-bdel="${i}" aria-label="Quitar">✕</button></div>`).join('')}
      <button class="block" id="fl-save">Guardar en ${SLOTS[FL.slot].toLowerCase()}</button>
      ${FL.basket.length > 1 ? '<button class="ghost block" id="fl-keep">Guardar como comida frecuente</button>' : ''}</div>` : ''}
    <p class="small muted" style="margin:10px 0 4px">Hoy llevas ${nKcal(tot.kcal)} de ${nKcal(tg.kcal)} kcal. Valores USDA/SMAE por 100 g: si tienes la etiqueta, úsala.</p>
    <button class="ghost block" id="fl-manual">Escribir macros a mano o restaurante</button>`;
  const q = $('#fl-q', root); q.oninput = () => { FL.q = q.value; const pos = q.selectionStart; flRender(); const n = $('#fl-q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-fls]', root).forEach(b => b.onclick = () => { FL.slot = b.dataset.fls; flRender(); });
  $$('[data-fll]', root).forEach(b => b.onclick = () => { FL.list = b.dataset.fll; flRender(); });
  $$('[data-fid]', root).forEach(b => b.onclick = () => { const r = nuRecent().find(x => x.id === b.dataset.fid); FL.sel = { id: b.dataset.fid, u: r ? r.u : 'g', n: r ? r.n : 100 }; flRender(); });
  $$('[data-qadd]', root).forEach(b => b.onclick = () => { const r = nuRecent().find(x => x.id === b.dataset.qadd); flAdd(r.id, r.u, r.n); flRender(); });
  $$('[data-saved]', root).forEach(b => b.onclick = () => { const sv = s.saved[+b.dataset.saved]; sv.items.forEach(it => flAdd(it.id, 'g', it.g)); flRender(); });
  $$('[data-savedel]', root).forEach(b => b.onclick = () => { s.saved.splice(+b.dataset.savedel, 1); saveData(); flRender(); });
  $$('[data-bdel]', root).forEach(b => b.onclick = () => { FL.basket.splice(+b.dataset.bdel, 1); flRender(); });
  const sv = $('#fl-save', root); if (sv) sv.onclick = () => { flCommit(); };
  const kp = $('#fl-keep', root); if (kp) kp.onclick = () => { const name = prompt('Nombre de la comida (ej. "Desayuno de siempre")'); if (!name) return; s.saved.push({ name: name.trim().slice(0, 40), items: FL.basket.map(b => ({ id: b.id, g: b.g })) }); saveData(); toast('Comida guardada'); };
  $('#fl-manual', root).onclick = () => { closeModal(); openMealForm(FL.date); };
  flBindEditor(root);
}
function flEditor() {
  const f = NF_BY[FL.sel.id], U = flUnits(f), g = (U[FL.sel.u] || 1) * FL.sel.n, m = nfMacros(f, g), fav = nState().favs.includes(f[0]);
  return `<div class="fl-ed"><div class="row spread"><b>${esc(nfName(f))}</b><button class="ghost fl-fav ${fav ? 'on' : ''}" id="fl-fav" aria-label="Favorito">${fav ? '★' : '☆'}</button></div>
    <div class="fl-qty"><button id="fl-m">−</button><input id="fl-n" inputmode="decimal" value="${FL.sel.n}"><button id="fl-p">+</button>
      <select id="fl-u">${Object.keys(U).map(u => `<option value="${esc(u)}" ${u === FL.sel.u ? 'selected' : ''}>${esc(u)}${u !== 'g' ? ` (${U[u]} g)` : ''}</option>`).join('')}</select></div>
    <div class="fl-prev">${Math.round(g)} g · <b>${m.kcal} kcal</b> · P ${m.p} · C ${m.c} · G ${m.f}</div>
    <button class="block" id="fl-add">Agregar al plato</button></div>`;
}
function flBindEditor(root) {
  if (!FL.sel) return;
  const step = () => FL.sel.u === 'g' ? 10 : /pieza|rebanada|scoop|lata|cuadro|filete|bistec|vaso|botella|cucharad/.test(FL.sel.u) ? 1 : 0.5;
  $('#fl-m', root).onclick = () => { FL.sel.n = Math.max(step(), Math.round((FL.sel.n - step()) * 10) / 10); flRender(); };
  $('#fl-p', root).onclick = () => { FL.sel.n = Math.round((FL.sel.n + step()) * 10) / 10; flRender(); };
  $('#fl-n', root).onchange = e => { const v = num(e.target.value); if (v > 0 && v < 5000) FL.sel.n = v; flRender(); };
  $('#fl-u', root).onchange = e => { FL.sel.u = e.target.value; FL.sel.n = FL.sel.u === 'g' ? 100 : 1; flRender(); };
  $('#fl-fav', root).onclick = () => { const s = nState(), i = s.favs.indexOf(FL.sel.id); if (i >= 0) s.favs.splice(i, 1); else s.favs.unshift(FL.sel.id); saveData(); flRender(); };
  $('#fl-add', root).onclick = () => { flAdd(FL.sel.id, FL.sel.u, FL.sel.n); FL.sel = null; FL.q = ''; flRender(); };
}
function flAdd(id, u, n) {
  const f = NF_BY[id]; if (!f) return; const U = flUnits(f), g = Math.round((U[u] || 1) * n);
  FL.basket.push({ id, g, u, n, m: nfMacros(f, g), label: `${nfName(f)} · ${nuQty(u, n, g)}` });
}
/** "2 piezas", "1 taza", "1.5 × ½ taza", "150 g". */
function nuQty(u, n, g) {
  if (u === 'g') return g + ' g';
  if (/^[½⅓¼]/.test(u)) return n === 1 ? u : `${n} × ${u}`;
  if (n === 1) return '1 ' + u;
  const pl = u.split(' ').map((w, i) => i === 0 && !/[a-z]s$/.test(w) && /[a-záéíóú]$/.test(w) ? w + (/[aeiouáéíóú]$/.test(w) ? 's' : 'es') : w).join(' ');
  return `${n} ${pl}`;
}
function flCommit() {
  const s = nState(), e = day(FL.date); e.meals = e.meals || [];
  FL.basket.forEach(b => {
    e.meals.push({ name: b.label, p: b.m.p, c: b.m.c, f: b.m.f, s: 0, kcal: b.m.kcal, slot: FL.slot, fid: b.id, g: b.g, t: Date.now() });
    s.recents = [{ id: b.id, u: b.u, n: b.n, g: b.g }].concat(s.recents.filter(r => r.id !== b.id)).slice(0, 30);
  });
  saveData(); const n = FL.basket.length; closeModal(); toast(`✓ ${n} alimento${n > 1 ? 's' : ''} en ${SLOTS[FL.slot].toLowerCase()}`); render(currentTab);
}

function nuRegistro(el) {
  const t = todayStr(), meals = (DB.days[t] && DB.days[t].meals) || [], tot = dayTotals(t), tg = targets();
  const groups = Object.keys(SLOTS).concat(['otro']);
  el.innerHTML = `<div class="nu-sum"><b>${nKcal(tot.kcal)}</b> / ${nKcal(tg.kcal)} kcal · P ${Math.round(tot.p)}/${tg.protein} · C ${Math.round(tot.c)}/${tg.carbs} · G ${Math.round(tot.f)}/${tg.fat}</div>
    ${groups.map(k => { const ms = meals.map((m, i) => ({ m, i })).filter(x => (x.m.slot || 'otro') === k); if (k === 'otro' && !ms.length) return ''; const kc = ms.reduce((a, x) => a + (x.m.kcal || 0), 0);
      return `<section class="nu-slot"><div class="row spread"><h2>${k === 'otro' ? 'Sin horario' : SLOTS[k]}</h2><span class="small muted">${kc ? nKcal(kc) + ' kcal' : ''}</span></div>
        ${ms.map(x => `<div class="nu-meal"><span><b>${esc(x.m.name)}</b><small>${x.m.kcal != null ? x.m.kcal + ' kcal · ' : ''}P ${Math.round(x.m.p)} · C ${Math.round(x.m.c)} · G ${Math.round(x.m.f)}</small></span><button data-mdel="${x.i}" aria-label="Quitar">✕</button></div>`).join('')}
        ${k !== 'otro' ? `<button class="secondary block nu-addslot" data-addslot="${k}">＋ Agregar a ${SLOTS[k].toLowerCase()}</button>` : ''}</section>`; }).join('')}`;
  $$('[data-addslot]', el).forEach(b => b.onclick = () => openFoodLog(t, b.dataset.addslot));
  $$('[data-mdel]', el).forEach(b => b.onclick = () => { const m = DB.days[t].meals.splice(+b.dataset.mdel, 1)[0]; saveData(); renderFood(); snack('Quitada: ' + m.name, 'Deshacer', () => { DB.days[t].meals.push(m); saveData(); renderFood(); }); });
}

/* ---------- Estrategia ---------- */
function openStrategyPicker() {
  const cur = nState().mode;
  openModal(`<h3>Mi estrategia</h3><p class="small muted" style="margin-top:0">Elige qué quieres lograr ahora. Puedes cambiar de fase cuando tus resultados lo indiquen: la app nunca cambia sola.</p>
    <div class="nu-modes">${Object.keys(NUTRI_MODES).map(k => `<button class="nu-mode ${k === cur ? 'on' : ''}" data-mode="${k}">${ico(NUTRI_MODES[k].ico, 22)}<span><b>${NUTRI_MODES[k].n}</b><small>${NUTRI_MODES[k].d}</small>${NUTRI_MODES[k].ref ? `<em>${esc(NUTRI_MODES[k].ref)}</em>` : ''}</span></button>`).join('')}</div>
    <div class="status info" style="margin-top:10px"><b>¿Vas a competir en culturismo?</b>La preparación de tarima (semana pico, manejo de agua y sodio) es una categoría especializada: hazla con un coach y supervisión médica. La app no da esos protocolos.</div>`, m => {
    $$('[data-mode]', m).forEach(b => b.onclick = () => { const k = b.dataset.mode; if (k === cur) { closeModal(); return; } nStartPhase(k, 'Elegida por ti'); closeModal(); nutTab = 'estr'; showTab('food'); toast('Estrategia: ' + NUTRI_MODES[k].n); });
  });
}
function nuEstrategia(el) {
  if (!nOn()) { el.innerHTML = `<div class="cp-diag empty"><b>Aún no eliges estrategia</b><p>La app calcula tu mantenimiento, tus macros y te propone ajustes con tus datos reales.</p></div><button class="block" id="ns-pick">Elegir mi estrategia</button>`; $('#ns-pick', el).onclick = openStrategyPicker; return; }
  const s = nState(), n = nTargets(), M = NUTRI_MODES[s.mode], ph = nPhase(), P = N_PHASE[s.mode], adv = nAdvice(), rev = nPhaseReview(), kg = currentWeight(), obs = nObserved();
  const wk = ph ? Math.floor(daysBetween(ph.start, todayStr()) / 7) + 1 : 1;
  el.innerHTML = `<div class="nu-strat"><div class="hx-eyebrow">MI ESTRATEGIA</div><div class="row spread"><b>${esc(M.n)}</b><button class="ghost" id="ns-change">Cambiar</button></div><p>${esc(M.d)}</p>${M.ref ? `<em>${esc(M.ref)}</em>` : ''}</div>
    ${adv ? `<div class="evo-keep ${adv.st === 'ok' ? 'ok' : adv.st === 'adjust' ? 'warn' : ''}"><div class="hx-eyebrow">MOTOR DE ADAPTACIÓN</div><b>${esc(adv.title)}</b><p>${esc(adv.text)}</p>
      ${adv.why.length ? `<ul class="nu-why">${adv.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      ${adv.delta ? `<div class="row" style="gap:8px;margin-top:8px"><button id="ns-apply" style="flex:2">${adv.delta > 0 ? 'Subir' : 'Bajar'} ${Math.abs(adv.delta)} kcal</button><button class="secondary" id="ns-skip" style="flex:1">Ahora no</button></div>` : ''}</div>` : ''}
    <div class="ds-h">Tus objetivos <em class="ds-est">estimación</em></div>
    <div class="nu-calc">
      <div class="nu-big"><b>${nKcal(n.kcal)}</b><span>kcal al día</span></div>
      <div class="nu-row3"><div><b>${n.protein} g</b><small>Proteína · ${fmt(n.protein / kg, 1)} g/kg<br>rango ${n.pRange[0]}–${n.pRange[1]} g</small></div><div><b>${n.carbs} g</b><small>Carbohidratos · ${fmt(n.carbs / kg, 1)} g/kg</small></div><div><b>${n.fat} g</b><small>Grasa · ${Math.round(n.fat * 9 / n.kcal * 100)} %</small></div></div>
      <dl class="nu-dl"><dt>Metabolismo basal</dt><dd>${nKcal(n.bmr)} kcal (Mifflin-St Jeor)</dd>
        <dt>Gasto estimado</dt><dd>${nKcal(n.tdeeEq)} kcal (× ${n.af} · ${esc(NAF[s.af || nSuggestAf()][1].toLowerCase())})</dd>
        <dt>Calibrado con tus datos</dt><dd>${n.calib ? `${nKcal(n.tdee)} kcal (tus registros indican ${nKcal(n.calib.obs)})` : `aún no: ${obs.logged}/10 días registrados · ${obs.weighs}/6 pesajes en 3 semanas`}</dd>
        <dt>${n.delta > 0 ? 'Superávit' : n.delta < 0 ? 'Déficit' : 'Ajuste de estrategia'}</dt><dd>${n.delta ? (n.delta > 0 ? '+' : '') + nKcal(n.delta) + ' kcal' : 'ninguno: cerca del mantenimiento'}${n.rate ? ` (≈ ${n.rate} % del peso por semana)` : ''}</dd>
        ${n.adj ? `<dt>Ajustes aceptados</dt><dd>${n.adj > 0 ? '+' : ''}${n.adj} kcal</dd>` : ''}
        <dt>Proteína por comida</dt><dd>≈ ${n.perMeal} g en 3–4 comidas</dd></dl>
      ${n.notes.map(x => `<p class="small muted" style="margin:6px 0 0">${esc(x)}</p>`).join('')}
    </div>
    <div class="ds-h">Fase actual</div>
    <div class="nu-phase"><div class="row spread"><b>${esc(M.short)} · semana ${wk}</b><span class="small muted">desde ${ph ? shortDate(ph.start) : '—'} · ${P.weeks[0]}–${P.weeks[1]} sem.</span></div>
      <dl class="nu-dl"><dt>Objetivo</dt><dd>${esc(P.goal)}</dd><dt>Indicadores</dt><dd>${esc(P.ind)}</dd><dt>Para avanzar</dt><dd>${esc(P.adv)}</dd><dt>Detener o ajustar</dt><dd>${esc(P.stop)}</dd></dl>
      ${rev && rev.due ? `<div class="adapt-note" style="margin-top:8px">${esc(rev.sig.join(' '))} ${rev.next ? `<button class="ghost" id="ns-next">Pasar a ${esc(NUTRI_MODES[rev.next].short.toLowerCase())}</button>` : ''}</div>` : `<p class="small muted" style="margin:8px 0 0">La fase no termina por fecha: se evalúa con tus resultados.</p>`}</div>
    <div class="ds-h">Periodización sugerida</div>
    <div class="nu-per">${['volumen', 'mantener', 'definicion', 'mantener'].map((k, i) => `<div class="${s.mode === k && (i < 3 || s.mode !== 'mantener') ? 'now' : ''}"><small>FASE ${i + 1}</small><b>${i === 3 ? 'Mantenimiento post' : NUTRI_MODES[k].short}</b><span>${N_PHASE[k].weeks[0]}–${N_PHASE[k].weeks[1]} sem.</span></div>`).join('')}</div>
    ${s.phases.length > 1 ? `<div class="ds-h">Historial de fases</div><div class="nu-hist">${s.phases.slice().reverse().map(p => `<div><b>${esc(NUTRI_MODES[p.mode].short)}</b><span>${shortDate(p.start)} – ${p.end ? shortDate(p.end) : 'hoy'}</span></div>`).join('')}</div>` : ''}
    ${s.log.length ? `<div class="ds-h">Ajustes</div><div class="nu-hist">${s.log.slice().reverse().slice(0, 8).map(l => `<div><b>${l.delta > 0 ? '+' : ''}${l.delta} kcal</b><span>${shortDate(l.date)} · ${esc(l.why)}</span></div>`).join('')}</div>` : ''}`;
  $('#ns-change', el).onclick = openStrategyPicker;
  const ap = $('#ns-apply', el); if (ap) ap.onclick = () => { const k = nApply(adv.delta, adv.title); toast('Nuevo objetivo: ' + nKcal(k) + ' kcal'); renderFood(); };
  const sk = $('#ns-skip', el); if (sk) sk.onclick = () => { nState().log.push({ date: todayStr(), delta: 0, why: 'Propuesta rechazada: ' + adv.title, applied: false }); saveData(); renderFood(); };
  const nx = $('#ns-next', el); if (nx) nx.onclick = () => { nStartPhase(rev.next, 'Revisión de fase'); renderFood(); };
}

/* ---------- Plan de alimentación ---------- */
const PLAN_ROLES = {
  des: { P: ['huevo', 'griego', 'clara', 'panela', 'whey'], C: ['avena', 'tortilla', 'pan_i', 'platano'], V: ['fresa', 'papaya', 'platano', 'manzana'], F: ['crema_cac', 'almendra', 'aguacate'] },
  com: { P: ['pollo', 'res_m', 'bistec', 'tilapia', 'cerdo', 'arrachera', 'tofu'], C: ['arroz', 'tortilla', 'papa', 'pasta', 'camote', 'frijol_n'], V: ['brocoli', 'calabacita', 'nopal', 'ejote', 'lechuga'], F: ['aguacate', 'aceite'] },
  cen: { P: ['atun', 'pollo', 'huevo', 'panela', 'tilapia', 'tofu'], C: ['tortilla', 'frijol_n', 'pan_i', 'arroz'], V: ['nopal', 'jitomate', 'espinaca', 'calabacita'], F: ['aguacate', 'aceite'] },
  sna: { P: ['griego', 'cottage', 'whey', 'panela'], C: ['manzana', 'platano', 'fresa', 'granola'], F: ['almendra', 'cacahuate', 'nuez'] }
};
const PLAN_CHEAP = new Set(['huevo', 'pollo', 'atun', 'frijol_n', 'tortilla', 'avena', 'arroz', 'platano', 'res_m', 'papa', 'nopal', 'jitomate', 'aceite', 'cacahuate', 'manzana', 'panela', 'calabacita', 'yogur', 'leche']);
const PLAN_MEAT = new Set(['pollo', 'res_m', 'bistec', 'tilapia', 'cerdo', 'arrachera', 'atun', 'salmon', 'camaron', 'muslo']);
const PLAN_DAIRY = new Set(['griego', 'cottage', 'panela', 'whey', 'yogur', 'leche', 'oaxaca', 'mantequilla']);
function planSlots(n) { return n <= 3 ? ['des', 'com', 'cen'] : n === 4 ? ['des', 'com', 'sna', 'cen'] : ['des', 'sna', 'com', 'sna', 'cen']; }
function planOptions(slot, role) {
  const pr = nState().plan, prefs = pr.prefs || [];
  let ops = ((PLAN_ROLES[slot] || {})[role] || []).filter(id => !(prefs.includes('veg') && PLAN_MEAT.has(id)) && !(prefs.includes('nolac') && PLAN_DAIRY.has(id)) && !(prefs.includes('nopork') && id === 'cerdo'));
  if (pr.budget === 'eco') { const c = ops.filter(id => PLAN_CHEAP.has(id)); if (c.length) ops = c; }
  if (role === 'P' && !ops.length) ops = ['huevo', 'frijol_n', 'tofu'].filter(id => !(prefs.includes('veg') && PLAN_MEAT.has(id)));
  return ops;
}
/** Resuelve gramos para acercarse a los macros de la comida (iterativo, redondeado a medidas prácticas). */
function planMeal(slot, idx, share, tg, date) {
  const ov = ((nState().planOv[date] || {})[idx]) || {}, seed = daysBetween('2026-01-05', date) + idx * 3;
  const pick = {}; ['P', 'C', 'V', 'F'].forEach((r, j) => { const ops = planOptions(slot, r); if (ops.length) pick[r] = ov[r] && ops.includes(ov[r]) ? ov[r] : ops[(seed + j) % ops.length]; });
  const T = { p: tg.protein * share, c: tg.carbs * share, f: tg.fat * share };
  const g = { P: 100, C: 100, V: pick.V ? (NF_BY[pick.V][6] === 'fru' ? 120 : 150) : 0, F: 10 };
  const per = (r, k) => pick[r] ? NF_BY[pick[r]][{ p: 3, c: 4, f: 5 }[k]] / 100 : 0;
  const from = (k, skip) => ['P', 'C', 'V', 'F'].filter(r => r !== skip).reduce((a, r) => a + per(r, k) * (g[r] || 0), 0);
  for (let i = 0; i < 6; i++) {
    if (pick.P && per('P', 'p') > 0) g.P = Math.max(0, (T.p - from('p', 'P')) / per('P', 'p'));
    if (pick.C && per('C', 'c') > 0) g.C = Math.max(0, (T.c - from('c', 'C')) / per('C', 'c'));
    if (pick.F && per('F', 'f') > 0) g.F = Math.max(0, (T.f - from('f', 'F')) / per('F', 'f'));
  }
  const items = ['P', 'C', 'V', 'F'].filter(r => pick[r]).map(r => {
    const f = NF_BY[pick[r]], u = Object.entries(f[8] || {}).find(([k]) => /pieza|rebanada|scoop/.test(k));
    let gg = ov['g' + r] != null ? ov['g' + r] : g[r], label;
    const cap = { P: 350, C: 450, V: 300, F: f[5] > 60 ? 30 : 80 }[r]; gg = Math.min(cap, gg);
    if (u && r !== 'V') { const n = Math.max(r === 'F' ? 0 : 1, Math.round(gg / u[1])); gg = n * u[1]; label = `${n} ${u[0]}${n > 1 ? 's' : ''}`; }
    else { gg = Math.round(gg / (f[5] > 60 ? 5 : 10)) * (f[5] > 60 ? 5 : 10); label = `${gg} g`; }
    return { r, id: f[0], g: gg, label, m: nfMacros(f, gg) };
  }).filter(x => x.g > 0);
  const tot = items.reduce((a, x) => ({ kcal: a.kcal + x.m.kcal, p: a.p + x.m.p, c: a.c + x.m.c, f: a.f + x.m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  return { slot, idx, items, tot };
}
const ROLE_N = { P: 'Proteína', C: 'Carbohidrato', V: 'Verdura o fruta', F: 'Grasa' };
function nuPlan(el, date) {
  date = date || todayStr();
  if (!nOn()) { el.innerHTML = '<div class="cp-diag empty"><b>Primero elige tu estrategia</b><p>El plan se arma con tus calorías y macros.</p></div><button class="block" id="np-s">Elegir estrategia</button>'; $('#np-s', el).onclick = openStrategyPicker; return; }
  const s = nState(), tg = targets(), slots = planSlots(s.plan.meals), W = { des: 0.25, com: 0.35, cen: 0.25, sna: 0.15 };
  const sum = slots.reduce((a, k) => a + W[k], 0), meals = slots.map((k, i) => planMeal(k, i, W[k] / sum, tg, date));
  const tot = meals.reduce((a, m) => ({ kcal: a.kcal + m.tot.kcal, p: a.p + m.tot.p, c: a.c + m.tot.c, f: a.f + m.tot.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  el.innerHTML = `<div class="nu-sum">Plan de hoy: <b>${nKcal(tot.kcal)}</b> / ${nKcal(tg.kcal)} kcal · P ${Math.round(tot.p)}/${tg.protein} · C ${Math.round(tot.c)}/${tg.carbs} · G ${Math.round(tot.f)}/${tg.fat}</div>
    <div class="row" style="gap:8px;margin-bottom:10px"><div class="seg" style="flex:1;margin:0">${[3, 4, 5].map(n => `<button data-pn="${n}" class="${s.plan.meals === n ? 'on' : ''}">${n} comidas</button>`).join('')}</div></div>
    <div class="chips" style="margin-bottom:12px">${[['eco', 'Económico'], ['veg', 'Vegetariano'], ['nolac', 'Sin lácteos'], ['nopork', 'Sin cerdo']].map(([k, n]) => `<button class="chip-btn ${(k === 'eco' ? s.plan.budget === 'eco' : (s.plan.prefs || []).includes(k)) ? 'on' : ''}" data-pp="${k}">${n}</button>`).join('')}</div>
    ${meals.map(m => `<section class="nu-pmeal"><div class="row spread"><h2>${SLOTS[m.slot]}</h2><span class="small muted">${nKcal(m.tot.kcal)} kcal · P ${Math.round(m.tot.p)}</span></div>
      ${m.items.map(it => `<div class="nu-pi"><button class="nu-swap" data-swap="${m.idx}|${it.r}|${m.slot}" aria-label="Cambiar ${ROLE_N[it.r]}">${ico('refresh-cw', 14)}</button><span><b>${esc(nfName(NF_BY[it.id]))}</b><small>${ROLE_N[it.r]} · ${it.m.kcal} kcal</small></span><span class="nu-g"><button data-gd="${m.idx}|${it.r}|${it.g}|-1">−</button><b>${esc(it.label)}</b><button data-gd="${m.idx}|${it.r}|${it.g}|1">+</button></span></div>`).join('')}
      <button class="secondary block nu-addslot" data-plog="${m.idx}">Registrar esta comida</button></section>`).join('')}
    <p class="small muted">Las cantidades se calculan para acercarse a tus macros; varía por día y puedes cambiar cualquier ingrediente. No tienes que comer lo mismo siempre.</p>`;
  const ov = (i) => { s.planOv[date] = s.planOv[date] || {}; return (s.planOv[date][i] = s.planOv[date][i] || {}); };
  $$('[data-pn]', el).forEach(b => b.onclick = () => { s.plan.meals = +b.dataset.pn; s.planOv[date] = {}; saveData(); nuPlan(el, date); });
  $$('[data-pp]', el).forEach(b => b.onclick = () => { const k = b.dataset.pp; if (k === 'eco') s.plan.budget = s.plan.budget === 'eco' ? 'normal' : 'eco'; else { s.plan.prefs = s.plan.prefs || []; const i = s.plan.prefs.indexOf(k); if (i >= 0) s.plan.prefs.splice(i, 1); else s.plan.prefs.push(k); } s.planOv[date] = {}; saveData(); nuPlan(el, date); });
  $$('[data-swap]', el).forEach(b => b.onclick = () => { const [i, r, slot] = b.dataset.swap.split('|'), ops = planOptions(slot, r), m = meals[+i], cur = m.items.find(x => x.r === r).id; const o = ov(i); o[r] = ops[(ops.indexOf(cur) + 1) % ops.length]; delete o['g' + r]; saveData(); nuPlan(el, date); });
  $$('[data-gd]', el).forEach(b => b.onclick = () => { const [i, r, g, d] = b.dataset.gd.split('|'), it = meals[+i].items.find(x => x.r === r), f = NF_BY[it.id], u = Object.entries(f[8] || {}).find(([k]) => /pieza|rebanada|scoop/.test(k)); const stepG = u && r !== 'V' ? u[1] : f[5] > 60 ? 5 : 20; ov(i)['g' + r] = Math.max(0, Number(g) + Number(d) * stepG); saveData(); nuPlan(el, date); });
  $$('[data-plog]', el).forEach(b => b.onclick = () => { const m = meals[+b.dataset.plog]; FL = { date, slot: m.slot, q: '', list: 'rec', basket: [], sel: null }; m.items.forEach(it => flAdd(it.id, 'g', it.g)); flCommit(); });
}

/* ---------- Historial ---------- */
function nuHistorial(el) {
  const t = todayStr(), tg = targets(), rows = [];
  for (let i = 0; i < 30; i++) { const d = addDays(t, -i), x = nIntake(d), w = DB.days[d] && DB.days[d].weight; if (x || w != null) rows.push({ d, x, w }); }
  const a = nAdherence(14);
  el.innerHTML = `<div class="nu-row3" style="margin-bottom:12px"><div><b>${a.pct} %</b><small>días registrados (14 d)</small></div><div><b>${a.onKcal} %</b><small>días en objetivo de kcal</small></div><div><b>${a.onProt} %</b><small>días con proteína cumplida</small></div></div>
    ${rows.length ? rows.map(r => `<details class="nu-day"><summary><span>${r.d === t ? 'Hoy' : shortDate(r.d)}</span><span>${r.x ? `${nKcal(r.x.kcal)} kcal · P ${Math.round(r.x.p)}` : 'sin comidas'}</span>${r.x ? `<i class="${Math.abs(r.x.kcal / tg.kcal - 1) <= 0.1 ? 'ok' : 'off'}"></i>` : '<i></i>'}</summary>
      ${r.w != null ? `<p class="small">Peso: ${fmt(r.w)} kg</p>` : ''}${((DB.days[r.d] || {}).meals || []).map(m => `<div class="small nu-hm">${m.slot ? `<b>${SLOTS[m.slot] || ''}</b> · ` : ''}${esc(m.name)} <span class="muted">${m.kcal != null ? m.kcal + ' kcal' : ''}</span></div>`).join('')}</details>`).join('')
      : '<p class="small muted">Aún no hay días registrados.</p>'}`;
}

/* ---------- Progreso ---------- */
function nuProgreso(el) {
  const t = todayStr(), tg = targets(), tr = nTrendOf(nWeights(21)), w = nWaist(), st = nStrength();
  const W = weightEntries().filter(e => e.date >= addDays(t, -90)), avg = movingAvg(W);
  const K = []; for (let i = 59; i >= 0; i--) { const d = addDays(t, -i), x = nIntake(d); if (x) K.push({ date: d, y: x.kcal }); }
  el.innerHTML = `<div class="nu-row3" style="margin-bottom:10px"><div><b>${tr ? (tr.pctWeek >= 0 ? '+' : '') + fmt(tr.pctWeek, 2) + ' %' : '—'}</b><small>peso por semana (3 sem.)</small></div><div><b>${w ? (w.delta >= 0 ? '+' : '') + w.delta + ' cm' : '—'}</b><small>cintura (4 sem.)</small></div><div><b>${st ? (st.d >= 0 ? '+' : '') + st.d : '—'}</b><small>fuerza (4 sem.)</small></div></div>
    <div class="evo-card"><div class="evo-top"><small>Peso · media de 7 días</small></div><canvas class="evo-canvas sm" id="np-w"></canvas>
      <p class="evo-read">El promedio de 7 días filtra el agua y la sal: es el dato que usa el motor, nunca un solo día.</p></div>
    <div class="evo-card"><div class="evo-top"><small>Calorías registradas vs objetivo</small></div><canvas class="evo-canvas sm" id="np-k"></canvas></div>
    ${w ? `<div class="evo-card"><div class="evo-top"><small>Cintura</small><b class="evo-sm">${w.now} cm</b></div><p class="evo-read">${w.n} medidas. Última: ${shortDate(w.date)}.</p></div>` : `<button class="secondary block" id="np-waist">Registrar cintura</button>`}
    <button class="ghost block" id="np-evo">Ver todas tus gráficas de evolución →</button>`;
  showChart(() => {
    drawChart($('#np-w'), { series: [{ points: W.map(e => ({ date: e.date, y: e.w })), color: getVar('--text-3'), line: false, dots: true, r: 2 }, { points: avg, color: getVar('--accent') }], hlines: DB.profile.goalWeight ? [{ y: DB.profile.goalWeight, color: getVar('--muted'), label: 'Meta' }] : [] });
    drawChart($('#np-k'), { series: [{ points: K, color: getVar('--accent'), dots: true, line: false, r: 3 }], hlines: [{ y: tg.kcal, color: getVar('--muted'), label: 'Objetivo' }], yDec: 0, minPad: 100 });
  });
  const wb = $('#np-waist', el); if (wb) wb.onclick = () => { if (typeof openMeasureForm === 'function') openMeasureForm(); else { progMode = 'measures'; showTab('progress'); } };
  $('#np-evo', el).onclick = () => { progMode = 'evol'; showTab('progress'); };
}

/* ---------- Ajustes y conocimiento ---------- */
function nuAjustes(el) {
  const s = nState(), af = s.af || nSuggestAf();
  el.innerHTML = `<div class="ds-h">Actividad diaria</div>
    <div class="nu-af">${Object.keys(NAF).map(k => `<button data-af="${k}" class="${af === k ? 'on' : ''}"><b>${NAF[k][1]}</b><small>${NAF[k][2]}</small></button>`).join('')}</div>
    <p class="small muted">${s.af ? '' : 'Sugerida por tus entrenos registrados (' + nMinWeek() + ' min/semana). '}Es un punto de partida: la calibración con tu peso real corrige el error.</p>
    <div class="ds-h">Experiencia entrenando</div>
    <div class="seg">${['principiante', 'intermedio', 'avanzado'].map(k => `<button data-exp="${k}" class="${nExp() === k ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
    <p class="small muted">En volumen define la velocidad: quien empieza puede ganar más rápido; un avanzado, más lento.</p>
    <div class="ds-h">Ritmo de definición</div>
    <div class="seg">${[0.5, 0.7, 1].map(r => `<button data-rate="${r}" class="${(s.rate || 0.7) === r ? 'on' : ''}">${r} %/sem</button>`).join('')}</div>
    <p class="small muted">Máximo 1 % por semana. La app no permite más rápido.</p>
    ${s.adj ? `<button class="secondary block" id="na-reset">Quitar ajustes aceptados (${s.adj > 0 ? '+' : ''}${s.adj} kcal)</button>` : ''}
    <div class="ds-h">Centro de conocimiento</div>
    <div class="nu-kb">${Object.keys(NKB_TOPIC).map(tp => { const items = NUTRI_KB.filter(k => k.t === tp); return items.length ? `<details><summary>${esc(NKB_TOPIC[tp])} <span>${items.length}</span></summary>${items.map(k => `<div class="nu-kbi ${k.ty}"><small>${esc(NKB_TYPE[k.ty])}</small><b>${esc(k.h)}</b><p>${esc(k.x)}</p><em>${esc(k.s)}</em></div>`).join('')}</details>` : ''; }).join('')}</div>
    <div class="ds-h">Seguridad</div>
    <ul class="comp-list nu-safe">${['Sin deshidratación, sauna ni restricción de agua para bajar de peso.', 'Sin dietas de hambre: nunca por debajo de tu metabolismo basal estimado.', 'Sin laxantes, diuréticos ni manipulación de sodio.', 'Sin cortes de peso de combate ni protocolos de tarima automáticos.', 'Sin sustancias dopantes.', 'Si tienes una condición médica, un trastorno de la conducta alimentaria, estás embarazada o tomas medicamentos, consulta a un profesional de la salud.'].map(x => `<li>${ico('shield', 16)}<span>${esc(x)}</span></li>`).join('')}</ul>`;
  $$('[data-af]', el).forEach(b => b.onclick = () => { s.af = b.dataset.af; saveData(); nuAjustes(el); });
  $$('[data-exp]', el).forEach(b => b.onclick = () => { s.exp = b.dataset.exp; saveData(); nuAjustes(el); });
  $$('[data-rate]', el).forEach(b => b.onclick = () => { s.rate = Number(b.dataset.rate); saveData(); nuAjustes(el); });
  const r = $('#na-reset', el); if (r) r.onclick = () => { s.log.push({ date: todayStr(), delta: -s.adj, why: 'Ajustes reiniciados', applied: true }); s.adj = 0; saveData(); nuAjustes(el); };
}
