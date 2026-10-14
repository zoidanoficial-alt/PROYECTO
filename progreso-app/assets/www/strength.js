/* Mi Progreso 11.0 · Fuerza general, objetivo de series semanal, ficha de técnica y
   celebración de récords. Todo se calcula con tus series registradas. */

/* ------------------------------------------------------------------ *
 *  Categorías y referencias
 * ------------------------------------------------------------------ */
const STR_CATS = {
  empuje: { name: 'Músculos de empuje', ico: '🫸', groups: { pecho: 12, hombro: 10, triceps: 8 } },
  jalon: { name: 'Músculos de jalón', ico: '🫷', groups: { espalda: 16, biceps: 8 } },
  piernas: { name: 'Músculos de las piernas', ico: '🦵', groups: { pierna: 12, femoral: 8, gluteo: 6, pantorrilla: 4 } }
};
// 1RM ÷ peso corporal que equivale a 100 puntos (nivel élite) con barra, por grupo y tipo.
const STR_REF = {
  pecho: { c: 2.0, i: 0.9 }, hombro: { c: 1.3, i: 0.5 }, triceps: { c: 1.6, i: 0.8 }, espalda: { c: 1.8, i: 0.9 }, biceps: { c: 1.0, i: 0.9 },
  pierna: { c: 2.8, i: 1.6 }, femoral: { c: 2.5, i: 1.0 }, gluteo: { c: 2.8, i: 1.2 }, pantorrilla: { c: 2.2, i: 2.2 }
};
// Ajuste por equipo: con mancuernas se mide una sola; las máquinas permiten mover más.
const STR_EQUIP = { barra: 1, smith: 1.05, maq: 1.4, polea: 0.8, manc: 0.45, fija: 1.5 };

function bwAt(date) { const a = weekAvg(date); return (a && a.avg) || currentWeight() || DB.profile.startWeight || 80; }
/** Puntaje 0–100 de una serie según su 1RM estimado relativo a tu peso corporal. */
function setScore(l, bw) {
  const x = exInfo(l.ex), ref = STR_REF[x.g], eq = STR_EQUIP[x.e];
  if (!ref || !eq) return null;
  const load = x.e === 'fija' ? bw + l.w : l.w;
  if (!load) return null;
  const v = 100 * (e1rm(load, l.r) / bw) / (ref[x.t === 'c' ? 'c' : 'i'] * eq);
  return isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
}
/** Fuerza por músculo, categoría y general en una fecha (mejor marca de los 60 días previos). */
function strengthScores(asOf) {
  asOf = asOf || todayStr();
  const from = addDays(asOf, -60), bw = bwAt(asOf), best = {};
  DB.lifts.forEach(l => {
    if (l.date < from || l.date > asOf) return;
    const g = exInfo(l.ex).g, sc = setScore(l, bw);
    if (sc == null) return;
    if (!best[g] || sc > best[g].score) best[g] = { score: sc, ex: l.ex };
  });
  const cats = {};
  Object.keys(STR_CATS).forEach(k => {
    const ms = Object.keys(STR_CATS[k].groups).filter(g => best[g]);
    cats[k] = { score: ms.length ? Math.round(ms.reduce((a, g) => a + best[g].score, 0) / ms.length) : null, muscles: best };
  });
  const vals = Object.values(cats).map(c => c.score).filter(v => v != null);
  return { overall: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, cats, muscles: best };
}

/* ------------------------------------------------------------------ *
 *  Piezas visuales
 * ------------------------------------------------------------------ */
function segBar(score) {
  const n = 12, full = (score || 0) / 100 * n;
  return `<div class="segbar">${Array.from({ length: n }, (_, i) => `<i style="--f:${Math.max(0, Math.min(1, full - i))}"></i>`).join('')}</div>`;
}
function sparkSvg(vals) {
  const v = vals.filter(x => x != null);
  if (v.length < 2) return '<svg class="spark-mini" viewBox="0 0 100 30"></svg>';
  const lo = Math.min(...v) - 2, hi = Math.max(...v) + 2, pts = vals.map((x, i) => x == null ? null : [i / (vals.length - 1) * 96 + 2, 28 - (x - lo) / (hi - lo || 1) * 26]).filter(Boolean);
  return `<svg class="spark-mini" viewBox="0 0 100 30"><line x1="0" y1="15" x2="100" y2="15" class="sm-base"/><polyline points="${pts.map(p => p.join(',')).join(' ')}"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.2"/>`).join('')}</svg>`;
}
const HEX_PATH = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z';
function hexRing(pct, size, label) {
  const id = 'hg' + Math.random().toString(36).slice(2, 7);
  return `<svg class="hex" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1ee3e0"/><stop offset=".55" stop-color="#8af5f0"/><stop offset="1" stop-color="#ff5f0a"/></linearGradient></defs>
    <path d="${HEX_PATH}" class="hex-track" pathLength="100"/>
    <path d="${HEX_PATH}" class="hex-fill" pathLength="100" stroke="url(#${id})" style="stroke-dasharray:100;stroke-dashoffset:${100 - Math.min(100, pct)}"/>
    ${label ? `<text x="50" y="52">${label}</text>` : ''}</svg>`;
}
function trendChip(now, past) {
  if (now == null || past == null) return '';
  const d = now - past;
  return d >= 2 ? '<span class="tchip up">↗</span>' : d <= -2 ? '<span class="tchip down">↘</span>' : '<span class="tchip flat">→</span>';
}

/* ------------------------------------------------------------------ *
 *  Fuerza general
 * ------------------------------------------------------------------ */
function strengthScoreCard() {
  const t = todayStr(), now = strengthScores(t), past = strengthScores(addDays(t, -28));
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(t, -7 * (5 - i)));
  const hist = weeks.map(d => strengthScores(d));
  if (now.overall == null) return `<div class="card str-card"><div class="small muted">Fuerza general</div><div class="str-big">—</div>${segBar(0)}<p class="small muted" style="margin:10px 0 0">Registra series con peso y aquí verás tu puntaje de fuerza de 0 a 100, por músculo.</p></div>`;
  const cats = Object.keys(STR_CATS).map(k => {
    const c = STR_CATS[k], sc = now.cats[k].score;
    const rows = Object.keys(c.groups).filter(g => now.muscles[g]).map(g => `<div class="str-m"><div><span>${GROUPS[g] || g}</span><b>${now.muscles[g].score}</b><small class="muted">${esc(now.muscles[g].ex)}</small></div>${sparkSvg(hist.map(h => h.muscles[g] ? h.muscles[g].score : null))}</div>`).join('');
    return `<details class="str-cat" ${k === 'empuje' ? 'open' : ''}><summary><div><span class="str-cn">${c.name} ${trendChip(sc, past.cats[k].score)}</span><span class="str-cv">${sc != null ? sc : '—'} <small>pts</small></span></div></summary>
      ${rows || '<p class="small muted">Sin series recientes de este grupo.</p>'}</details>`;
  }).join('');
  return `<div class="card str-card">
    <div class="row spread"><div class="small muted">Fuerza general</div><button class="info-btn" id="str-info">i</button></div>
    <div class="row" style="gap:14px;align-items:center"><div class="str-big">${now.overall}</div>${segBar(now.overall)}</div>
    <p class="small muted" style="margin:2px 0 10px">${trendChip(now.overall, past.overall)} ${past.overall != null ? `${signed(now.overall - past.overall, 0)} pts vs hace 4 semanas` : 'Tu punto de partida'}</p>
    ${cats}
  </div>`;
}
function explainScore() {
  openModal(`<h3>¿Cómo se calcula?</h3>
    <p class="small">Para cada músculo tomo tu mejor serie de los últimos 60 días, calculo el 1RM estimado (peso × (1 + reps/30)) y lo comparo con tu peso corporal.</p>
    <p class="small"><b>100 puntos</b> equivalen a un nivel élite (por ejemplo, press banca de 2 veces tu peso). 50 puntos es la mitad. Las mancuernas y máquinas se ajustan porque no se comparan igual que la barra.</p>
    <p class="small muted">Es una estimación para seguir tu progreso contra ti mismo, no una medición de laboratorio.</p>
    <button class="block" id="si-ok">Entendido</button>`, m => { $('#si-ok', m).onclick = closeModal; });
}

/* ------------------------------------------------------------------ *
 *  Objetivo de series semanal
 * ------------------------------------------------------------------ */
function weeklySets() {
  const wk = weekKey(todayStr()), scale = (typeof stage === 'function' && stage() === 1) || (typeof isHardWeek === 'function' && isHardWeek(wk)) ? 0.5 : 1;
  const by = {};
  DB.lifts.forEach(l => { if (weekKey(l.date) === wk && (l.rir == null || l.rir <= 3)) { const g = exInfo(l.ex).g; by[g] = (by[g] || 0) + 1; } });
  const cats = {}; let done = 0, goal = 0;
  Object.keys(STR_CATS).forEach(k => {
    const gs = STR_CATS[k].groups, muscles = {};
    let d = 0, t = 0;
    Object.keys(gs).forEach(g => { const tg = Math.round(gs[g] * scale), n = by[g] || 0; muscles[g] = { n, tg }; d += Math.min(n, tg); t += tg; });
    cats[k] = { done: d, goal: t, muscles }; done += d; goal += t;
  });
  return { wk, cats, done, goal, pct: goal ? Math.round(done / goal * 100) : 0, scale };
}
function weeklySetsCard() {
  const w = weeklySets(), end = addDays(w.wk, 6);
  return `<div class="card sets-card" data-fold-title="Objetivo de series semanal" data-fold-sum="${w.done} de ${w.goal} series efectivas" data-fold-badge="${w.pct}%" data-fold-ico="⬡">
    <div class="small muted">${shortDate(w.wk)} – ${shortDate(end)}</div>
    <h2 style="margin:0 0 4px">Objetivo de series semanal</h2>
    <div class="hex-wrap">${hexRing(w.pct, 170, w.pct + '%')}</div>
    ${Object.keys(STR_CATS).map(k => {
      const c = w.cats[k], left = Math.max(0, c.goal - c.done);
      return `<details class="set-cat"><summary>${hexRing(c.goal ? c.done / c.goal * 100 : 0, 40)}<div class="grow"><b>${STR_CATS[k].name}</b><small>${c.done} / ${c.goal} series</small></div><div class="left"><b>${left}</b><small>${left ? 'por hacer' : '✓ listo'}</small></div></summary>
        ${Object.keys(c.muscles).map(g => { const m = c.muscles[g]; return `<div class="set-m"><span>${GROUPS[g] || g}</span><div class="bar"><div style="width:${m.tg ? Math.min(100, m.n / m.tg * 100) : 0}%"></div></div><small>${m.n}/${m.tg}</small></div>`; }).join('')}
      </details>`;
    }).join('')}
    <p class="small muted" style="margin:8px 0 0">Cuentan las series efectivas (RIR 3 o menos) de esta semana, de lunes a domingo.${w.scale < 1 ? ' Meta reducida a la mitad por tu etapa o semana de mantenimiento.' : ''}</p>
  </div>`;
}

/* ------------------------------------------------------------------ *
 *  Ficha de técnica: imagen animada con velocidad, pestañas y equipo
 * ------------------------------------------------------------------ */
function techniqueSheet(name, back) {
  const id = EX_PHOTO[name], x = exInfo(name), h = HOWTO_EX[name] || HOWTO[x.p];
  const sets = DB.lifts.filter(l => l.ex === name), u = unitFor(name);
  const top = sets.length ? sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a) : null;
  const speeds = [1, 0.5, 2];
  let tab = 'ins', spd = 0, frame = null;
  const parts = (MUSCLES[x.p] || GROUPS[x.g] || '').split(' · también ');
  const groupsHit = {}; groupsHit[x.g] = WEEKLY_TARGET[x.g] || 10;
  const draw = m => {
    const media = id ? `<div class="tq-media ${frame != null ? 'paused f' + frame : ''}" style="--spd:${2.4 / speeds[spd]}s">
        <img src="img/ex/${id}-0.jpg" alt="Inicio"><img src="img/ex/${id}-1.jpg" alt="Final" class="b">
        <div class="tq-thumbs"><button data-frame="0" class="${frame === 0 ? 'on' : ''}"><img src="img/ex/${id}-0.jpg" alt=""></button><button data-frame="1" class="${frame === 1 ? 'on' : ''}"><img src="img/ex/${id}-1.jpg" alt=""></button></div>
        <button class="tq-speed" id="tq-spd">${speeds[spd].toFixed(1)}×</button>
        <button class="tq-back" id="tq-back">←</button></div>`
      : `<div class="ex-hero">${exIcon(name, 140)}<button class="tq-back" id="tq-back">←</button></div>`;
    const body = tab === 'ins'
      ? (h ? `<ol class="howto-steps">${h[0].map(t => `<li>${esc(t)}</li>`).join('')}</ol><div class="status warn" style="margin-top:10px"><b>Error común</b>${esc(h[1])}</div>` : '<p class="small muted">Sin instrucciones para este ejercicio.</p>')
      : tab === 'obj'
        ? `<p class="small" style="margin-top:0"><b>Principal:</b> ${esc(parts[0])}</p>${parts[1] ? `<p class="small"><b>También trabaja:</b> ${esc(parts[1])}</p>` : ''}
           <div class="body-maps">${bodySvg(BODY_FRONT, groupsHit, 'Frente')}${bodySvg(BODY_BACK, groupsHit, 'Espalda')}</div>
           <p class="small muted">${x.t === 'c' ? 'Ejercicio compuesto: mueve varias articulaciones y permite cargar más peso.' : 'Ejercicio de aislamiento: enfoca un músculo; ideal al final de la sesión.'}</p>`
        : `<div class="tq-eq"><span>${EQUIP[x.e] || 'Equipo'}</span>${x.pf ? '<span class="pill" style="background:rgba(124,58,237,.15);color:var(--violet)">Planet Fitness</span>' : ''}</div>
           ${top ? `<p class="small">Tu mejor serie: <b>${wFmt(top.w, u)} × ${top.r}</b> · fuerza estimada <b>${wFmt(e1rm(top.w, top.r), u)}</b> en 1 rep</p>` : '<p class="small muted">Aún no lo has registrado.</p>'}
           <div class="small muted" style="font-weight:600;margin:10px 0 6px">Si está ocupado, alternativas:</div>
           <div class="chips">${smartSubs(name).slice(0, 8).map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
           <p class="small muted">La foto muestra el movimiento; tu máquina puede verse distinta según el gimnasio.</p>`;
    m.innerHTML = `<div class="tq">${media}<h3 class="tq-title">${esc(name)}</h3>
      <div class="seg"><button data-tq="ins" class="${tab === 'ins' ? 'on' : ''}">Instrucciones</button><button data-tq="obj" class="${tab === 'obj' ? 'on' : ''}">Objetivos</button><button data-tq="eq" class="${tab === 'eq' ? 'on' : ''}">Equipo</button></div>
      <div class="tq-body">${body}</div></div>`;
    $$('[data-tq]', m).forEach(b => b.onclick = () => { tab = b.dataset.tq; draw(m); });
    const sp = $('#tq-spd', m); if (sp) sp.onclick = () => { spd = (spd + 1) % speeds.length; frame = null; draw(m); };
    $$('[data-frame]', m).forEach(b => b.onclick = () => { const f = Number(b.dataset.frame); frame = frame === f ? null : f; draw(m); });
    $('#tq-back', m).onclick = () => back ? back() : closeModal();
  };
  openModal('', draw);
}

/* ------------------------------------------------------------------ *
 *  Celebración de récord
 * ------------------------------------------------------------------ */
function openPRCelebration(ex) {
  const h = exHistory(ex), u = unitFor(ex), id = EX_PHOTO[ex];
  if (!h.length) return;
  const best = Math.max(...h.map(x => x.best));
  // Mejor marca por mes (o por sesión si hay pocos meses)
  const byM = {};
  h.forEach(x => { const k = x.date.slice(0, 7); byM[k] = Math.max(byM[k] || 0, x.best); });
  const months = Object.keys(byM).sort().slice(-12);
  const pts = months.length >= 3 ? months.map(k => ({ date: k + '-15', y: fromKg(byM[k], u) })) : h.slice(-12).map(x => ({ date: x.date, y: fromKg(x.best, u) }));
  openModal(`<div class="pr-cel">
    <div class="pr-rays"></div>
    <div class="pr-badge"><svg viewBox="0 0 100 100" width="104" height="104"><defs><linearGradient id="prg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs><path d="${HEX_PATH}" fill="url(#prg)" stroke="#10202a" stroke-width="5"/><text x="50" y="62">🏆</text></svg></div>
    <h3>¡Nuevo récord de fuerza!</h3>
    <div class="pr-box" ${id ? `style="--bg:url(img/ex/${id}-1.jpg)"` : ''}>
      <div class="pr-ex">${esc(ex.toUpperCase())}</div><div class="small" style="opacity:.85">Fuerza estimada</div>
      <div class="pr-val"><b>${fmt(fromKg(best, u), fromKg(best, u) % 1 ? 1 : 0)}</b><span>${u} en 1 rep</span></div>
      <canvas class="chart" id="pr-chart" style="height:150px"></canvas>
    </div>
    <button class="block" id="pr-ok" style="margin-top:14px">¡Vamos! 💪</button></div>`, m => {
    $('#pr-ok', m).onclick = closeModal;
    setTimeout(() => { const c = $('#pr-chart', m); if (c) drawChart(c, { series: [{ points: pts, color: '#ff5f0a', dots: true, r: 4, width: 3 }], yDec: 1, minPad: 2 }); burst($('#modal')); }, 80);
  });
  vibrate(200);
}
