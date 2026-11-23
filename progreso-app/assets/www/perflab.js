'use strict';
/* =====================================================================
 *  42.0 · Laboratorio de rendimiento
 *  Dónde estás, contra quién y cuánto te falta para el siguiente récord.
 *  - HYROX: tu marca contra los rankings reales de CDMX y Guadalajara 2026 (top 100 de cada
 *    división + tamaño del campo), metas de podio/top 10/25/50/100, ritmos por segmento
 *    para la siguiente meta, radar de estaciones y "carrera contra tu récord".
 *  - Running, Gimnasio, Bici/Natación: la misma lectura contra TU propio historial
 *    (no hay rankings públicos con licencia para esas disciplinas; no inventamos campos).
 *  Gráficas en SVG propio, sin librerías.
 * ===================================================================== */

/* ---------- Campos reales (hxfields.js) ---------- */
const FIELD_TARGETS = [[3, 'Podio'], [10, 'Top 10'], [25, 'Top 25'], [50, 'Top 50'], [100, 'Top 100']];
function fieldOf(k) { return (typeof HX_FIELDS !== 'undefined' ? HX_FIELDS : []).find(f => f.k === k) || null; }
/** Lugar que tendría `sec` en el campo (empates cuentan a tu favor, como en la tabla). */
function fieldPlace(f, sec) {
  if (!f || !sec) return null;
  const cut = f.t[f.t.length - 1], inTop = sec <= cut, rank = f.t.filter(x => x < sec).length + 1;
  return { rank: inTop ? rank : null, n: f.n, pct: inTop ? rank / f.n * 100 : null, cutPct: f.t.length / f.n * 100, inTop, cut, gap: inTop ? 0 : sec - cut };
}
function fieldTargets(f, sec) { return FIELD_TARGETS.map(([r, n]) => ({ r, n, t: f.t[r - 1], gap: sec ? sec - f.t[r - 1] : null, done: !!sec && sec <= f.t[r - 1] })); }
function fieldName(f) { return `${f.city} ${f.div}`; }
/** Nombres del top 100 (solo en la versión personal: hxnames.js). */
function fieldNames(f) { return typeof HX_NAMES === 'object' && HX_NAMES && HX_NAMES[f.k] ? HX_NAMES[f.k] : null; }
function plRivalBtn(f, i) { const on = hxRivals && typeof hx === 'function' && DB.hyrox && hxRivals().some(r => r.rk === f.k + '|' + i); return `<button class="pl-add${on ? ' on' : ''}" data-plriv="${f.k}|${i}" aria-label="Agregar a mi escalera">${on ? ico('check', 14) : '+'}</button>`; }
/** Los atletas justo arriba y abajo de tu marca, y el top 100 completo. */
function plRivalsHtml(f, sec) {
  const N = fieldNames(f); if (!N) return '';
  const faster = sec ? f.t.filter(x => x < sec).length : 0, from = sec ? Math.max(0, Math.min(faster - 3, f.t.length - 5)) : 0, idx = [];
  for (let i = from; i < Math.min(f.t.length, from + 5); i++) idx.push(i);
  const row = (i, shift) => `<tr><td class="muted">${shift && sec && i >= faster ? i + 2 : i + 1}</td><td>${esc(N[i])}</td><td><b>${hxT(f.t[i])}</b></td><td class="${sec && f.t[i] < sec ? 'hx-lose' : 'hx-win'}">${sec ? (f.t[i] < sec ? '−' : '+') + hxT(Math.abs(sec - f.t[i])) : ''}</td><td>${plRivalBtn(f, i)}</td></tr>`;
  const me = `<tr class="pl-me"><td>${faster < 100 ? faster + 1 : '—'}</td><td><b>${esc(DB.profile.name || 'Tú')}</b></td><td><b>${hxT(sec)}</b></td><td></td><td></td></tr>`;
  let body = '';
  idx.forEach(i => { if (sec && i === faster) body += me; body += row(i, true); });
  if (sec && faster >= idx[idx.length - 1] + 1) body += me;
  return `<div class="pv-card"><div class="pv-head"><div><b>${sec ? 'Tus rivales de referencia' : 'Los más rápidos'}</b><small>${sec ? 'Quién está justo arriba y abajo de tu marca' : 'Agrega tu marca para ver a quién tienes cerca'} · toca + para llevarlo a tu escalera</small></div></div>
    <table class="small hx-tbl pl-riv"><tbody>${body}</tbody></table>
    <details class="pl-all"><summary>Ver el top 100 de ${esc(fieldName(f))}</summary><table class="small hx-tbl pl-riv"><tbody>${f.t.map((t, i) => row(i)).join('')}</tbody></table></details></div>`;
}
function plAddRival(key) {
  const [k, i] = key.split('|'), f = fieldOf(k), N = fieldNames(f); if (!f || !N) return;
  const id = k + '|' + i, R = hxRivals();
  if (R.some(r => r.rk === id)) { hx().rivals = R.filter(r => r.rk !== id); toast('Quitado de tu escalera'); }
  else { R.push({ id: 'rv' + Date.now(), rk: id, name: N[i], country: 'MX', cat: `${f.city} ${f.div} 2026 · #${Number(i) + 1}`, sec: f.t[i], splits: null, src: 'ranking' }); toast(`${N[i]} está en tu escalera`); }
  saveData();
}
function hxFieldDiv() { const p = (DB.hyrox && DB.hyrox.profile) || {}; return p.cat === 'pro' ? 'Pro' : 'Open'; }
let plField = null, plTab = null, plRun = null, plLift = null, plAct = null;
function plPct(p) { return p < 1 ? fmt(p, 1) : p < 10 ? fmt(p, 1) : Math.round(p); }
/** Tu tiempo de referencia: mejor carrera o simulación; si no, la predicción. */
function plMyHyrox() {
  const me = typeof hxMyBest === 'function' ? hxMyBest() : null;
  if (me) return { sec: me.sec, src: me.src, pred: false };
  const pr = typeof hxPredict === 'function' && DB.hyrox ? hxPredict() : null;
  return pr && pr.ok ? { sec: Math.round(pr.total), src: 'Predicción con tus pruebas', pred: true } : null;
}

/* ---------- Gráficas ---------- */
let plUid = 0;
/** Curva de distribución con tu marca. vals: números; mine: tu valor; lower: menor es mejor. */
function pvDist(vals, mine, o) {
  o = o || {};
  const W = 320, H = 118, P = 8, B = 22, id = 'pvg' + (++plUid);
  const xs = vals.concat(mine != null ? [mine] : []), lo0 = Math.min(...xs), hi0 = Math.max(...xs), pad = (hi0 - lo0) * 0.06 || 1, lo = lo0 - pad, hi = hi0 + pad;
  const n = vals.length, mean = vals.reduce((a, v) => a + v, 0) / n, sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, n - 1)) || (hi - lo) / 6;
  const h = 1.06 * sd * Math.pow(n, -0.2) || 1, dens = x => vals.reduce((a, v) => a + Math.exp(-0.5 * ((x - v) / h) ** 2), 0);
  const N = 64, pts = []; let mx = 0;
  for (let i = 0; i <= N; i++) { const x = lo + (hi - lo) * i / N, y = dens(x); pts.push([x, y]); mx = Math.max(mx, y); }
  const X = x => P + (W - 2 * P) * (x - lo) / (hi - lo), Y = y => H - B - (H - B - 10) * y / mx;
  const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join(' ');
  const area = line + ` L${X(hi).toFixed(1)} ${H - B} L${X(lo).toFixed(1)} ${H - B} Z`;
  const ticks = [0, 1, 2, 3, 4].map(i => lo + (hi - lo) * (0.08 + 0.84 * i / 4));
  const my = mine != null ? Y(dens(mine)) : null;
  return `<svg class="pv-dist" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Distribución')}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".42"/><stop offset="1" stop-color="currentColor" stop-opacity=".02"/></linearGradient></defs>
    <path d="${area}" fill="url(#${id})" class="pv-area"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="1.6" class="pv-line"/>
    ${o.cutX != null ? `<line x1="${X(o.cutX).toFixed(1)}" x2="${X(o.cutX).toFixed(1)}" y1="8" y2="${H - B}" class="pv-cut"/>` : ''}
    ${mine != null ? `<line x1="${X(mine).toFixed(1)}" x2="${X(mine).toFixed(1)}" y1="${my.toFixed(1)}" y2="${H - B}" class="pv-me-l"/><circle cx="${X(mine).toFixed(1)}" cy="${my.toFixed(1)}" r="4.5" class="pv-me"/>` : ''}
    ${ticks.map(t => `<text x="${X(t).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="pv-tick">${esc(o.fmt ? o.fmt(t) : fmt(t, 0))}</text>`).join('')}
  </svg>`;
}
/** Tus intentos en orden de fecha: barras (más alta = mejor), el récord y el último resaltados. */
function pvBars(vals, o) {
  o = o || {};
  const W = 320, H = 118, B = 22, T = 12, n = vals.length, lower = !!o.lower;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || Math.max(1, hi * 0.05);
  const score = v => 0.25 + 0.75 * (lower ? (hi - v) / span : (v - lo) / span);
  const bw = Math.min(34, (W - 16) / n * 0.62), gap = (W - 16) / n, rec = lower ? lo : hi;
  return `<svg class="pv-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Tus intentos')}">
    ${vals.map((v, i) => { const h = (H - B - T) * (hi === lo ? 1 : score(v)), x = 8 + gap * i + (gap - bw) / 2, y = H - B - h, cls = i === n - 1 ? 'pv-bar last' : v === rec ? 'pv-bar rec' : 'pv-bar';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5" class="${cls}"/>${n <= 10 || i === n - 1 || v === rec ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="pv-tick${v === rec ? ' b' : ''}">${esc(o.fmt ? o.fmt(v) : fmt(v, 0))}</text>` : ''}`; }).join('')}
    ${o.dates ? o.dates.map((d, i) => n <= 8 || i === 0 || i === n - 1 ? `<text x="${(8 + gap * i + gap / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="pv-tick">${esc(d)}</text>` : '').join('') : ''}
  </svg>`;
}
/** Curva si hay suficientes intentos; si no, barras por fecha. */
function pvOwn(vals, mine, o) { return vals.length >= 8 ? pvDist(vals, mine, o) : pvBars(vals, o); }
/** Radar: axes [{n, v (0–100), p (antes, opcional)}]. */
function pvRadar(axes, o) {
  o = o || {};
  const W = 320, H = 270, cx = W / 2, cy = 136, R = 92, k = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + 2 * Math.PI * i / k; return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100]; };
  const poly = key => axes.map((x, i) => pt(i, Math.max(3, x[key] || 0)).map(n => n.toFixed(1)).join(',')).join(' ');
  const rings = [25, 50, 75, 100].map(r => `<polygon points="${axes.map((x, i) => pt(i, r).map(n => n.toFixed(1)).join(',')).join(' ')}" class="pv-ring"/>`).join('');
  const spokes = axes.map((x, i) => { const [a, b] = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${a.toFixed(1)}" y2="${b.toFixed(1)}" class="pv-ring"/>`; }).join('');
  const labels = axes.map((x, i) => { const [a, b] = pt(i, 118), anc = Math.abs(a - cx) < 8 ? 'middle' : a > cx ? 'start' : 'end'; return `<text x="${a.toFixed(1)}" y="${(b + 4).toFixed(1)}" text-anchor="${anc}" class="pv-lab${x.v == null ? ' off' : ''}">${esc(x.n)}</text>`; }).join('');
  const hasP = axes.some(x => x.p != null);
  return `<svg class="pv-radar" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Radar de rendimiento')}">${rings}${spokes}
    ${hasP ? `<polygon points="${poly('p')}" class="pv-prev"/>` : ''}<polygon points="${poly('v')}" class="pv-now"/>
    ${axes.map((x, i) => x.v != null ? `<circle cx="${pt(i, Math.max(3, x.v))[0].toFixed(1)}" cy="${pt(i, Math.max(3, x.v))[1].toFixed(1)}" r="3" class="pv-dot"/>` : '').join('')}${labels}</svg>`;
}
/** Línea de diferencia acumulada (s): positivo = vas adelante. */
function pvRace(rows, o) {
  o = o || {};
  const W = 320, H = 150, L = 38, Rr = 10, T = 12, B = 24, n = rows.length;
  const mx = Math.max(10, ...rows.map(r => Math.abs(r.d))) * 1.15;
  const X = i => L + (W - L - Rr) * i / Math.max(1, n - 1), Y = d => T + (H - T - B) * (1 - (d + mx) / (2 * mx));
  const path = rows.map((r, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(r.d).toFixed(1)).join(' ');
  const yl = [mx / 1.15, 0, -mx / 1.15].map(v => `<text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="pv-tick">${v > 0 ? '+' : v < 0 ? '−' : ''}${v ? hxT(Math.abs(Math.round(v))) : '0'}</text>`).join('');
  return `<svg class="pv-race" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Diferencia acumulada')}">
    <line x1="${L}" x2="${W - Rr}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" class="pv-zero"/>${yl}
    ${rows.map((r, i) => r.st ? `<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${T}" y2="${H - B}" class="pv-grid"/><text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="pv-tick">${r.st}</text>` : '').join('')}
    <path d="${path}" fill="none" stroke="currentColor" stroke-width="2" class="pv-line"/>
    ${rows.map((r, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(r.d).toFixed(1)}" r="${i === n - 1 ? 4.5 : 2.6}" class="${r.d >= 0 ? 'pv-ahead' : 'pv-behind'}"/>`).join('')}
  </svg>`;
}
/** Tarjeta estilo "Total time · #2 de 405 · mejor 5.4%". */
function pvCard(title, val, sub, badge, chart, foot) {
  return `<div class="pv-card"><div class="pv-head"><div><b>${esc(title)} <span>${esc(val)}</span></b><small>${sub}</small></div>${badge ? `<em class="pv-badge">${badge}</em>` : ''}</div>${chart}${foot ? `<p class="pv-foot">${foot}</p>` : ''}</div>`;
}
/** Lugar dentro de tus propios intentos. */
function ownPlace(vals, mine, lower) {
  const better = vals.filter(v => lower ? v < mine : v > mine).length;
  return { rank: better + 1, n: vals.length, pct: (better + 1) / vals.length * 100 };
}

/* ---------- HYROX ---------- */
const HX_SEG_N = ['Run 1', 'SkiErg', 'Run 2', 'Sled push', 'Run 3', 'Sled pull', 'Run 4', 'Burpees', 'Run 5', 'Row', 'Run 6', 'Farmers', 'Run 7', 'Lunges', 'Run 8', 'Wall balls'];
/** Carreras o simulaciones con los 16 parciales, de la más reciente a la más vieja. */
function plSplitRaces() {
  const out = [];
  ((DB.ev && DB.ev.results) || []).filter(r => r.sport === 'hyrox' && r.splits && r.splits.filter(Boolean).length === 16).forEach(r => out.push({ name: r.name, date: r.date, sec: r.sec, sp: r.splits.slice() }));
  ((DB.hyrox && DB.hyrox.runs) || []).filter(r => r.mode === 'race' && r.segs && r.segs.length === 16).forEach(r => out.push({ name: 'Simulación', date: r.date, sec: r.total, sp: r.segs.map(s => s.sec) }));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
function plHyroxRadar() {
  if (!DB.hyrox) return null;
  const cut = addDays(todayStr(), -56);
  const at = (kind, st, before) => { const rs = hx().results.filter(r => r.kind === kind && (!st || r.st === st) && !r.pf && r.std !== false && (!before || r.date <= before)); return rs.length ? rs.reduce((a, r) => r.sec < a.sec ? r : a) : null; };
  const axes = [{ k: 'run1k', n: 'Running' }].concat(HX_STATIONS.map(s => ({ k: s.k, n: s.n.replace('Burpee broad jumps', 'Burpees').replace('Sandbag lunges', 'Lunges').replace('Farmers carry', 'Farmers') })));
  axes.forEach(a => {
    const cur = a.k === 'run1k' ? hxCurrent('run1k') : hxCurrent('st', a.k), old = a.k === 'run1k' ? at('run1k', null, cut) : at('st', a.k, cut);
    a.v = cur ? hxScore(a.k, cur.sec) : null; a.p = old ? hxScore(a.k, old.sec) : null; a.sec = cur ? cur.sec : null;
  });
  return axes.filter(a => a.v != null).length >= 3 ? axes : null;
}
function plHyrox() {
  const me = plMyHyrox(), div = hxFieldDiv(), fem = DB.hyrox && DB.hyrox.profile && DB.hyrox.profile.sex === 'f';
  if (!plField || !fieldOf(plField)) plField = 'cdmx-' + div.toLowerCase();
  const f = fieldOf(plField), pl = me ? fieldPlace(f, me.sec) : null;
  const sec = me ? me.sec : null, T = fieldTargets(f, sec), next = T.slice().reverse().find(x => !x.done);
  let h = me ? `<div class="pl-hero"><small>${esc(me.src)}${me.pred ? ' <em class="ds-est">estimado</em>' : ''}</small><b>${hxT(sec)}</b>
      <div class="pl-chips">${HX_FIELDS.filter(x => x.div === f.div).map(x => { const p = fieldPlace(x, sec); return `<span>${p.inTop ? `#${p.rank} de ${p.n.toLocaleString('es-MX')}` : `fuera del top 100`} · ${esc(x.city)} ${x.div}</span>`; }).join('')}</div></div>`
    : `<div class="cp-diag empty"><b>Ubica tu marca en los rankings reales</b><p>Registra una carrera, una simulación cronometrada o mide 1 km fresco y 6 estaciones para tener tu predicción. Mientras, aquí están las metas de cada campo.</p></div>`;
  h += `<div class="seg pl-fields g2">${HX_FIELDS.map(x => `<button data-plf="${x.k}" class="${x.k === f.k ? 'on' : ''}">${esc(fieldName(x))}</button>`).join('')}</div>`;
  const badge = pl ? (pl.inTop ? `top ${plPct(pl.pct)} %` : `+${hxT(pl.gap)}`) : '';
  const sub = pl ? (pl.inTop ? `Quedarías <b>#${pl.rank}</b> de ${f.n.toLocaleString('es-MX')}` : `Fuera del top 100 de ${f.n.toLocaleString('es-MX')} · te faltan <b>${hxT(pl.gap)}</b>`) : `${f.n.toLocaleString('es-MX')} atletas · ${esc(f.ev)}`;
  h += pvCard('Tiempo total', me ? hxT(sec) : '', sub, badge, pvDist(f.t, sec, { fmt: v => hxT(Math.round(v / 60) * 60), cutX: f.t[f.t.length - 1], aria: 'Distribución del top 100 de ' + fieldName(f) }),
    `Curva: los 100 más rápidos de ${f.n.toLocaleString('es-MX')} (${esc(f.ev)}, ${esc(f.div)} varonil). La línea marca el lugar 100.`);
  h += plRivalsHtml(f, sec);
  // Metas
  h += `<div class="ds-h">Récords por romper <span class="ds-h-r">${esc(fieldName(f))}</span></div><div class="pl-goals">${T.map(x => `<div class="pl-goal${x.done ? ' done' : ''}${next && x.r === next.r ? ' next' : ''}"><span>${x.done ? ico('check', 16) : ''}${esc(x.n)}</span><b>${hxT(x.t)}</b><small>${sec ? x.done ? 'lo tienes' : '−' + hxT(x.gap) : ''}</small></div>`).join('')}</div>`;
  if (next && sec) {
    const pr = typeof hxPredict === 'function' ? hxPredict() : null;
    if (pr && pr.ok) {
      const sc = next.t / pr.total, runK = pr.runT / 8;
      h += `<div class="pv-card"><div class="pv-head"><div><b>Cómo llegar al ${esc(next.n)} <span>${hxT(next.t)}</span></b><small>Repartido como hoy repartes tu carrera (${Math.round((1 - sc) * 100)} % más rápido en cada parte)</small></div></div>
        <table class="small hx-tbl pl-plan"><tbody><tr><td>Cada 1 km (×8)</td><td class="muted">${hxT(runK)}</td><td><b>${hxT(runK * sc)}</b></td></tr>${pr.parts.map(p => `<tr><td>${esc(p.n)}</td><td class="muted">${hxT(p.t)}</td><td><b>${hxT(p.t * sc)}</b></td></tr>`).join('')}<tr><td>Roxzone</td><td class="muted">${hxT(pr.rox)}</td><td><b>${hxT(pr.rox * sc)}</b></td></tr></tbody></table></div>`;
    }
  }
  // Radar
  const ax = plHyroxRadar();
  if (ax) {
    const m = ax.filter(a => a.v != null), best = m.reduce((a, x) => x.v > a.v ? x : a), worst = m.reduce((a, x) => x.v < a.v ? x : a);
    h += pvCard('Perfil de rendimiento', '', `Fuerte: <b>${esc(best.n)}</b> · por mejorar: <b>${esc(worst.n)}</b>`, `${best.v}/100`, pvRadar(ax),
      `${ax.some(a => a.p != null) ? 'Contorno punteado: hace 8 semanas. ' : ''}Puntaje 0–100 entre nivel principiante y élite (modelo de la app).`);
  } else h += `<div class="cp-diag empty"><b>Radar de estaciones</b><p>Mide al menos 3 partes (1 km fresco o estaciones) para ver tu perfil.</p></div>`;
  // Carrera contra tu récord
  const rs = plSplitRaces();
  if (rs.length >= 2) {
    const last = rs[0], best = rs.slice(1).reduce((a, r) => r.sec < a.sec ? r : a);
    let ca = 0, cb = 0; const rows = last.sp.map((s, i) => { ca += s; cb += best.sp[i]; return { d: cb - ca, st: i % 2 ? String((i + 1) / 2) : '' }; });
    const end = rows[rows.length - 1].d;
    h += pvCard('Carrera contra tu récord', '', `${esc(last.name)} (${shortDate(last.date)}) vs ${esc(best.name)} (${shortDate(best.date)})`, end >= 0 ? `+${hxT(end)}` : `−${hxT(-end)}`, pvRace(rows),
      'Arriba de la línea vas adelante de tu récord. Los números son las 8 estaciones.');
  }
  h += `<p class="pv-src">Rankings: páginas públicas de resultados de 2026 (hyresult.com) que guardaste en PDF${fieldNames(f) ? '; versión personal con nombres, solo para tu uso' : '; solo tiempos, sin nombres'}. ${fem ? 'Por ahora solo hay divisiones varoniles: en tu caso es una referencia. ' : ''}Sin afiliación con HYROX.</p>`;
  return h;
}

/* ---------- Running ---------- */
const PL_RUN = [[1, '1 km'], [5, '5 km'], [10, '10 km'], [21.0975, '21 km'], [42.195, '42 km']];
function plRunScore(km, sec) { const v = vdot(km * 1000, sec); return Math.max(0, Math.min(100, Math.round((v - 30) / 40 * 100))); }
function plRunning() {
  const runs = (DB.runs || []).filter(r => r.best);
  const eff = k => runs.filter(r => r.best[k]).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ sec: r.best[k], date: r.date }));
  const have = PL_RUN.filter(([k]) => eff(k).length);
  if (!have.length) return `<div class="cp-diag empty"><b>Tus gráficas de running aparecen con tu primera carrera con GPS</b><p>La app detecta tus mejores 1, 5, 10, 21 y 42 km dentro de cada carrera y aquí verás tu lugar entre todos tus intentos y tu perfil por distancia.</p></div>`;
  if (!plRun || !have.some(([k]) => k === plRun)) plRun = (have.find(([k]) => k === (typeof runGoalKm === 'function' ? runGoalKm() : 5)) || have[0])[0];
  const lbl = PL_RUN.find(([k]) => k === plRun)[1], E = eff(plRun), vals = E.map(e => e.sec), last = E[E.length - 1], rec = Math.min(...vals);
  const op = ownPlace(vals, last.sec, true);
  let h = `<div class="pl-hero"><small>Tu récord · ${esc(lbl)}</small><b>${hxT(rec)}</b><div class="pl-chips"><span>VDOT ${fmt(vdot(plRun * 1000, rec), 1)}</span><span>${E.length} intento${E.length > 1 ? 's' : ''}</span></div></div>`;
  h += `<div class="seg wrap scroll pl-fields">${have.map(([k, n]) => `<button data-plr="${k}" class="${k === plRun ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;
  h += E.length >= 2 ? pvCard(`Tus ${lbl}`, hxT(last.sec), `Última (${shortDate(last.date)}): <b>#${op.rank}</b> de ${op.n} intentos`, last.sec === rec ? 'récord' : `top ${Math.round(op.pct)} %`, pvOwn(vals, last.sec, { fmt: v => hxT(Math.round(v)), lower: true, dates: E.map(e => shortDate(e.date)), aria: 'Tus intentos' }),
    last.sec === rec ? '¡La última es tu récord! Sostenlo: 1 sesión de calidad y 1 larga por semana.' : `Para romper tu récord necesitas ${hxT(last.sec - rec)} menos que la última vez (${hxT((rec - 1) / plRun)}/km).`)
    : `<div class="cp-diag empty"><b>Un ${esc(lbl)} registrado</b><p>Con 2 o más intentos verás tu curva y tu lugar entre ellos.</p></div>`;
  const ax = PL_RUN.map(([k, n]) => { const e = eff(k), cut = addDays(todayStr(), -90), cur = e.filter(x => x.date > cut), old = e.filter(x => x.date <= cut); return { n, v: cur.length ? plRunScore(k, Math.min(...cur.map(x => x.sec))) : null, p: old.length ? plRunScore(k, Math.min(...old.map(x => x.sec))) : null }; });
  if (ax.filter(a => a.v != null).length >= 3) h += pvCard('Perfil por distancia', '', 'Puntaje por VDOT (30 = 0, 70 = 100), últimos 90 días', '', pvRadar(ax), ax.some(a => a.p != null) ? 'Contorno punteado: antes de esos 90 días.' : '');
  return h + `<p class="pv-src">Comparado contra tu propio historial. VDOT: fórmula de Jack Daniels.</p>`;
}

/* ---------- Gimnasio ---------- */
const PL_LIFTS = [
  { n: 'Sentadilla', re: /sentadilla (con barra|trasera|frontal)|back squat|^sentadilla$/i, a: [0.75, 2.25] },
  { n: 'Banca', re: /press (de )?banca|bench/i, a: [0.5, 1.6] },
  { n: 'Peso muerto', re: /peso muerto(?! rumano)|deadlift/i, a: [1, 2.6] },
  { n: 'Press militar', re: /press (militar|de hombro con barra)|overhead press/i, a: [0.35, 1.05] },
  { n: 'Remo', re: /remo con barra|remo pendlay|barbell row/i, a: [0.5, 1.4] },
  { n: 'Hip thrust', re: /hip thrust/i, a: [0.75, 2.5] }
];
function plSessBest(ex) {
  const by = {};
  DB.lifts.filter(l => l.ex === ex && l.w > 0 && l.r > 0 && l.r <= 15).forEach(l => { const v = e1rm(l.w, l.r), k = l.sid || l.date; if (!by[k] || v > by[k].v) by[k] = { v, w: l.w, r: l.r, date: l.date, t: l.t || 0 }; });
  return Object.values(by).sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
}
function plGym() {
  const cnt = {}; DB.lifts.forEach(l => { if (l.w > 0) cnt[l.ex] = (cnt[l.ex] || 0) + 1; });
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 6);
  if (!top.length) return `<div class="cp-diag empty"><b>Tus gráficas de fuerza aparecen con tus primeras series</b><p>Cada serie que registras alimenta tu 1RM estimado, tus récords y tu perfil de fuerza.</p></div>`;
  if (!plLift || !top.includes(plLift)) plLift = top[0];
  const S = plSessBest(plLift), u = unitFor(plLift), last = S[S.length - 1], rec = S.reduce((a, s) => s.v > a.v ? s : a), vals = S.map(s => s.v), op = ownPlace(vals, last.v, false);
  const step = u === 'lb' ? 5 : 2.5, kg = v => wFmt(v, u);
  let h = `<div class="pl-hero"><small>1RM estimado · ${esc(plLift)}</small><b>${kg(rec.v)}</b><div class="pl-chips"><span>${kg(rec.w)} × ${rec.r} · ${shortDate(rec.date)}</span><span>${S.length} sesiones</span></div></div>`;
  h += `<div class="seg wrap scroll pl-fields">${top.map(x => `<button data-pll="${esc(x)}" class="${x === plLift ? 'on' : ''}">${esc(x.replace(/ (con (barra|mancuernas?)|convencional)$/i, ''))}</button>`).join('')}</div>`;
  // Qué necesitas para romper el récord
  const reps = Math.max(1, Math.floor(30 * (rec.v / last.w - 1)) + 1), wNeed = (Math.floor(fromKg(rec.v / (1 + last.r / 30), u) / step) + 1) * step;
  h += S.length >= 2 ? pvCard('Fuerza por sesión', kg(last.v), `Última (${shortDate(last.date)}): <b>#${op.rank}</b> de ${op.n} sesiones`, last.v >= rec.v ? 'récord' : `top ${Math.round(op.pct)} %`, pvOwn(vals, last.v, { fmt: v => fmt(fromKg(v, u), 0), dates: S.map(s => shortDate(s.date)), aria: 'Tus sesiones' }),
    `Para romper tu récord: <b>${kg(last.w)} × ${reps}</b> o <b>${wFmt(toKg(wNeed, u), u)} × ${last.r}</b>.`)
    : `<div class="cp-diag empty"><b>Una sesión registrada</b><p>Con 2 o más sesiones de ${esc(plLift)} verás tu curva.</p></div>`;
  const bw = currentWeight(), fem = DB.profile.sex === 'f';
  if (bw) {
    const cut = addDays(todayStr(), -56);
    const ax = PL_LIFTS.map(L => {
      const ls = DB.lifts.filter(l => L.re.test(l.ex) && l.w > 0 && l.r > 0 && l.r <= 12), f = fem ? 0.7 : 1, sc = v => Math.max(0, Math.min(100, Math.round((v / bw - L.a[0] * f) / ((L.a[1] - L.a[0]) * f) * 100)));
      const b = arr => arr.reduce((a, l) => Math.max(a, e1rm(l.w, l.r)), 0), cur = b(ls.filter(l => l.date > cut)), old = b(ls.filter(l => l.date <= cut));
      return { n: L.n, v: cur ? sc(cur) : null, p: old ? sc(old) : null };
    });
    if (ax.filter(a => a.v != null).length >= 3) h += pvCard('Perfil de fuerza', '', 'Fuerza relativa a tu peso, últimas 8 semanas', '', pvRadar(ax), 'Escala orientativa 0–100 (principiante → avanzado). Contorno punteado: antes.');
  }
  return h + `<p class="pv-src">1RM estimado con la fórmula de Epley. Comparado contra tu propio historial.</p>`;
}

/* ---------- Bici, natación y otros con distancia ---------- */
const PL_ACT = { bici: { n: 'Bici', v: a => a.km / (a.min / 60), f: v => fmt(v, 1) + ' km/h', hi: true }, nadar: { n: 'Natación', v: a => a.min * 60 / (a.km * 10), f: v => hxT(Math.round(v)) + '/100 m', hi: false }, remo: { n: 'Remo', v: a => a.min * 60 / (a.km * 2), f: v => hxT(Math.round(v)) + '/500 m', hi: false } };
function plActs(t) { return (DB.activities || []).filter(a => a.type === t && a.km > 0 && a.min > 0).sort((a, b) => a.date.localeCompare(b.date)); }
function plOther() {
  const have = Object.keys(PL_ACT).filter(t => plActs(t).length);
  if (!have.length) return `<div class="cp-diag empty"><b>Bici, natación y remo</b><p>Registra actividades con distancia y minutos (Registrar → Actividad) y aquí verás tu velocidad, tu récord y tu lugar entre tus intentos.</p></div>`;
  if (!plAct || !have.includes(plAct)) plAct = have[0];
  const D = PL_ACT[plAct], A = plActs(plAct), vals = A.map(D.v), last = vals[vals.length - 1], rec = D.hi ? Math.max(...vals) : Math.min(...vals), op = ownPlace(vals, last, !D.hi);
  let h = `<div class="pl-hero"><small>Tu mejor ritmo · ${esc(D.n)}</small><b>${D.f(rec)}</b><div class="pl-chips"><span>${A.length} sesiones</span><span>${fmt(A.reduce((a, x) => a + x.km, 0), 0)} km en total</span></div></div>`;
  h += `<div class="seg wrap scroll pl-fields">${have.map(t => `<button data-pla="${t}" class="${t === plAct ? 'on' : ''}">${PL_ACT[t].n}</button>`).join('')}</div>`;
  h += vals.length >= 2 ? pvCard(D.n, D.f(last), `Última: <b>#${op.rank}</b> de ${op.n}`, last === rec ? 'récord' : `top ${Math.round(op.pct)} %`, pvOwn(vals, last, { fmt: v => D.hi ? fmt(v, 1) : hxT(Math.round(v)), lower: !D.hi, dates: A.map(a => shortDate(a.date)), aria: 'Tus sesiones' })) : '';
  return h + `<p class="pv-src">Velocidad media de cada sesión registrada. Comparado contra tu propio historial.</p>`;
}

/* ---------- Pantalla ---------- */
const PL_TABS = { hyrox: ['HYROX', plHyrox], run: ['Running', plRunning], gym: ['Gimnasio', plGym], other: ['Bici · Nado', plOther] };
function plDefTab() { const s = typeof mainSport === 'function' ? mainSport() : ''; return { hyrox: 'hyrox', run: 'run', tri: 'run', spartan: 'run', bici: 'other', fisico: 'gym', fuerza: 'gym' }[s] || 'hyrox'; }
function openPerfLab(tab, back) {
  plTab = tab || plTab || plDefTab();
  openModal(`<div class="pl"><div class="hx-eyebrow">LABORATORIO DE RENDIMIENTO</div><h3 style="margin:4px 0 10px">Vamos por tus récords</h3>
    <div class="seg pl-tabs">${Object.keys(PL_TABS).map(k => `<button data-plt="${k}" class="${k === plTab ? 'on' : ''}">${PL_TABS[k][0]}</button>`).join('')}</div>
    <div id="pl-body">${PL_TABS[plTab][1]()}</div><button class="ghost block" id="pl-x">← Volver</button></div>`, m => {
    $$('[data-plt]', m).forEach(b => b.onclick = () => openPerfLab(b.dataset.plt, back));
    $$('[data-plf]', m).forEach(b => b.onclick = () => { plField = b.dataset.plf; openPerfLab(plTab, back); });
    $$('[data-plriv]', m).forEach(b => b.onclick = () => { plAddRival(b.dataset.plriv); const y = m.scrollTop; openPerfLab(plTab, back); $('#modal').scrollTop = y; });
    $$('[data-plr]', m).forEach(b => b.onclick = () => { plRun = Number(b.dataset.plr); openPerfLab(plTab, back); });
    $$('[data-pll]', m).forEach(b => b.onclick = () => { plLift = b.dataset.pll; openPerfLab(plTab, back); });
    $$('[data-pla]', m).forEach(b => b.onclick = () => { plAct = b.dataset.pla; openPerfLab(plTab, back); });
    $('#pl-x', m).onclick = back || (() => closeModal());
  });
}
/** Resumen corto para Competir / Progreso. */
function plSummary() {
  const me = plMyHyrox(); if (!me) return 'Tu lugar en CDMX y Guadalajara 2026, radar y récords';
  const f = fieldOf('cdmx-' + hxFieldDiv().toLowerCase()), p = fieldPlace(f, me.sec);
  return p.inTop ? `Quedarías #${p.rank} de ${p.n.toLocaleString('es-MX')} en CDMX ${f.div}` : `A ${hxT(p.gap)} del top 100 de CDMX ${f.div}`;
}

/* ---------- Romper récords: aviso al entrar a un top ---------- */
function fieldReact(prevSec, newSec) {
  if (!newSec || typeof achToast !== 'function' || typeof HX_FIELDS === 'undefined') return;
  const div = hxFieldDiv(); let best = null;
  HX_FIELDS.filter(f => f.div === div).forEach(f => {
    const t = FIELD_TARGETS.find(([r]) => newSec <= f.t[r - 1] && !(prevSec && prevSec <= f.t[r - 1]));
    if (t && (!best || t[0] < best.t[0])) best = { f, t, p: fieldPlace(f, newSec) };
  });
  if (best) { const N = fieldNames(best.f), r = best.p.rank; achToast(`Entraste al ${best.t[1]} · ${best.f.ev.replace('HYROX ', '')} ${best.f.div}`, `${hxT(newSec)} · quedarías #${r} de ${best.f.n.toLocaleString('es-MX')}${N && N[r - 1] ? ' · superaste a ' + N[r - 1] : ''}`); }
}
