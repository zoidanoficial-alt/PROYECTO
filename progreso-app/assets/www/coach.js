/* Mi Progreso 7.0 · Coach: chequeo de recuperación, plan de hoy, análisis de progreso,
   simulador de metas, retos semanales y resumen de sesión. Todo se calcula con tus
   datos guardados; cada recomendación dice qué datos la sustentan. */

/* ------------------------------------------------------------------ *
 *  Estadística básica
 * ------------------------------------------------------------------ */
/** Regresión lineal de puntos {x, y}: pendiente, error estándar de la pendiente y ruido. */
function linreg(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx, b = my - slope * mx;
  const res = pts.reduce((a, p) => a + (p.y - (b + slope * p.x)) ** 2, 0);
  const sd = n > 2 ? Math.sqrt(res / (n - 2)) : 0;
  return { slope, b, se: n > 2 ? sd / Math.sqrt(sxx) : Infinity, sd, n, mean: my };
}
const avgOfArr = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function lastDays(n) { const out = []; for (let k = 0; k < n; k++) out.push(addDays(todayStr(), -k)); return out; }

/** Historial de un ejercicio: mejor 1RM estimado por día de entreno. */
function exHistory(ex) {
  const by = {};
  DB.lifts.filter(l => l.ex === ex).forEach(l => {
    const v = e1rm(l.w, l.r);
    if (!by[l.date]) by[l.date] = { date: l.date, best: v, sets: [] };
    by[l.date].sets.push(l);
    if (v > by[l.date].best) by[l.date].best = v;
  });
  return Object.values(by).sort((a, b) => a.date < b.date ? -1 : 1);
}
/** Tendencia de fuerza en las últimas 8 semanas: mejora real, bajada real o fluctuación normal. */
function strengthTrend(ex) {
  const from = addDays(todayStr(), -56), h = exHistory(ex).filter(x => x.date >= from);
  if (h.length < 4 || daysBetween(h[0].date, h[h.length - 1].date) < 14) return { ex, kind: 'pocos', n: h.length };
  const r = linreg(h.map(x => ({ x: daysBetween(h[0].date, x.date), y: x.best })));
  if (!r) return { ex, kind: 'pocos', n: h.length };
  const perMonth = r.slope * 30, pct = perMonth / r.mean * 100;
  const kind = r.slope - 1.5 * r.se > 0 ? 'sube' : r.slope + 1.5 * r.se < 0 ? 'baja' : 'plano';
  return { ex, kind, perMonth, pct, r, h, last: h[h.length - 1].best };
}
/** Estancado: las 3 últimas sesiones no superan lo que ya habías hecho antes. */
function stalled(ex) {
  const h = exHistory(ex);
  if (h.length < 5) return false;
  const last3 = h.slice(-3), before = h.slice(0, -3);
  return Math.max(...last3.map(x => x.best)) <= Math.max(...before.map(x => x.best)) * 1.005 && daysBetween(last3[0].date, last3[2].date) >= 7;
}
function trainedExercises() { return Array.from(new Set(DB.lifts.map(l => l.ex))); }

/* ------------------------------------------------------------------ *
 *  Chequeo de recuperación (antes de entrenar)
 * ------------------------------------------------------------------ */
const PLAN_INFO = {
  mantener: { icon: '🟢', name: 'Mantener', text: 'Entrena como está planeado. Si te sientes fuerte, busca superar tu marca.' },
  reducir: { icon: '🟡', name: 'Reducir', text: 'Mismos ejercicios y pesos, una serie menos en cada uno, y deja 2–3 reps en reserva.' },
  modificar: { icon: '🔴', name: 'Descarga', text: 'Mismos ejercicios con ~10 % menos peso, la mitad de las series y 3–4 reps en reserva. Hoy sumas recuperación.' }
};
function adjSets(n, plan) { return plan === 'reducir' ? Math.max(2, n - 1) : plan === 'modificar' ? Math.max(1, Math.ceil(n / 2)) : n; }

/**
 * Recomendación de hoy a partir de lo que respondiste + tu reloj (si lo anotaste) + tu historial.
 * Devuelve el plan sugerido y la lista de razones con el dato que respalda cada una.
 */
function readiness() {
  const t = todayStr(), d = DB.days[t] || {}, rec = d.rec;
  if (!rec) return null;
  let score = 80;
  const why = [], used = new Set();
  const add = (pts, icon, text, src) => { score += pts; why.push({ pts, icon, text }); used.add(src); };
  if (rec.sleepH != null) {
    if (rec.sleepH < 5) add(-25, '😴', `Dormiste ${fmt(rec.sleepH)} h (menos de 5 h baja fuerza y concentración)`, 'tu respuesta');
    else if (rec.sleepH < 6) add(-15, '😴', `Dormiste ${fmt(rec.sleepH)} h (lo ideal son 7–9 h)`, 'tu respuesta');
    else if (rec.sleepH < 7) add(-5, '😴', `Dormiste ${fmt(rec.sleepH)} h, un poco corto`, 'tu respuesta');
    else if (rec.sleepH >= 8) add(3, '😴', `Dormiste ${fmt(rec.sleepH)} h`, 'tu respuesta');
  }
  if (rec.sleepQ != null && rec.sleepQ !== 3) add((rec.sleepQ - 3) * 5, '🛏️', `Calidad del sueño ${rec.sleepQ}/5`, 'tu respuesta');
  if (rec.energy != null && rec.energy !== 3) add((rec.energy - 3) * 8, '⚡', `Energía ${rec.energy}/5`, 'tu respuesta');
  if (rec.soreness != null && rec.soreness > 2) add(-(rec.soreness - 2) * 7, '🦵', `Dolor muscular ${rec.soreness}/5`, 'tu respuesta');
  if (rec.stress != null && rec.stress > 3) add(-(rec.stress - 3) * 5, '🧠', `Estrés ${rec.stress}/5`, 'tu respuesta');
  // Reloj: comparado con tu propia media de 7 días, no con un número genérico.
  const base = k => { const v = []; for (let i = 1; i <= 7; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r && r[k]) v.push(r[k]); } return v.length >= 3 ? avgOfArr(v) : null; };
  const hb = base('hrv'), rb = base('rhr');
  if (rec.hrv && hb) {
    const diff = (rec.hrv / hb - 1) * 100;
    if (diff < -10) add(-15, '⌚', `HRV ${rec.hrv} ms, ${Math.round(-diff)} % bajo tu media (${Math.round(hb)} ms)`, 'tu reloj');
    else if (diff > 5) add(3, '⌚', `HRV ${rec.hrv} ms, arriba de tu media (${Math.round(hb)} ms)`, 'tu reloj');
  }
  if (rec.rhr && rb && rec.rhr - rb >= 5) add(-10, '❤️', `Pulso en reposo ${rec.rhr}, ${Math.round(rec.rhr - rb)} lpm arriba de tu media`, 'tu reloj');
  // Historial de entrenos
  const done = DB.sessions.filter(s => s.end).sort((a, b) => b.start - a.start);
  if (done.length) {
    const last = done[0], gap = daysBetween(last.date, t);
    const exs = Array.from(new Set(DB.lifts.filter(l => l.sid === last.id).map(l => l.ex)));
    let drops = 0, cmp = 0;
    exs.forEach(ex => {
      const h = exHistory(ex), i = h.findIndex(x => x.date === last.date);
      if (i > 0) { cmp++; if (h[i].best < h[i - 1].best * 0.95) drops++; }
    });
    if (cmp >= 2 && drops / cmp >= 0.5) add(-10, '📉', `En tu último entreno bajó la fuerza en ${drops} de ${cmp} ejercicios`, 'tu historial');
    const recent = done.filter(s => daysBetween(s.date, t) <= 3 && s.date !== t).length;
    if (recent >= 3) add(-8, '📆', `${recent} entrenos en los últimos 3 días`, 'tu historial');
    else if (gap >= 4) add(5, '🔋', `Vienes de ${gap} días sin entrenar`, 'tu historial');
  }
  const over = Object.keys(weekVolume().groups).filter(g => WEEKLY_TARGET[g] && weekVolume().groups[g] / WEEKLY_TARGET[g] > OVERREACH);
  if (over.length) add(-5, '🔥', `Volumen alto esta semana en ${over.map(g => GROUPS[g] || g).join(', ')}`, 'tu historial');
  const { r1 } = weeklyRates();
  if (DB.profile.phase === 'definicion' && r1 != null && r1 < -1) add(-5, '⚖️', `Bajaste ${fmt(-r1)} kg esta semana: el déficit también cansa`, 'tu peso');
  score = Math.max(0, Math.min(100, Math.round(score)));
  const rec0 = score >= 70 ? 'mantener' : score >= 45 ? 'reducir' : 'modificar';
  return { score, why, used: Array.from(used), recommended: rec0, plan: d.plan || rec0, manual: !!d.plan, joint: !!rec.joint };
}

function openCheckin(after) {
  const t = todayStr(), prev = (DB.days[t] && DB.days[t].rec) || {};
  const lastSleep = (() => { for (let i = 1; i <= 7; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r && r.sleepH) return r.sleepH; } return 7; })();
  const a = Object.assign({ sleepH: lastSleep, sleepQ: 3, energy: 3, soreness: 2, stress: 2, joint: false }, prev);
  const scale = (k, labels) => `<div class="ck-scale">${labels.map((l, i) => `<button data-ck="${k}|${i + 1}" class="${a[k] === i + 1 ? 'on' : ''}"><span>${l[0]}</span><small>${l[1]}</small></button>`).join('')}</div>`;
  let step = 0;
  const draw = m => {
    if (step === 0) {
      m.innerHTML = `<h3>¿Cómo llegas hoy?</h3>
        <p class="small muted" style="margin-top:0">30 segundos. Con esto y tu historial te digo si mantener, reducir o descargar, y por qué.</p>
        <div class="ck-row"><b>Horas de sueño</b><span class="mini-step"><button data-sl="-0.5">−</button><b id="ck-sleep">${fmt(a.sleepH, a.sleepH % 1 ? 1 : 0)} h</b><button data-sl="0.5">+</button></span></div>
        <div class="ck-q">¿Qué tal dormiste?</div>${scale('sleepQ', [['😫', 'Pésimo'], ['😕', 'Mal'], ['😐', 'Normal'], ['🙂', 'Bien'], ['😴', 'Excelente']])}
        <div class="ck-q">¿Cuánta energía tienes?</div>${scale('energy', [['🪫', 'Agotado'], ['😮‍💨', 'Poca'], ['😐', 'Normal'], ['💪', 'Buena'], ['⚡', 'A tope']])}
        <div class="ck-q">¿Dolor muscular de entrenos anteriores?</div>${scale('soreness', [['😌', 'Nada'], ['🙂', 'Poco'], ['😐', 'Medio'], ['😣', 'Alto'], ['🥵', 'Mucho']])}
        <div class="ck-q">¿Estrés?</div>${scale('stress', [['🧘', 'Nada'], ['🙂', 'Poco'], ['😐', 'Normal'], ['😤', 'Alto'], ['🤯', 'Mucho']])}
        <label class="check" style="margin-top:12px"><input type="checkbox" id="ck-joint" ${a.joint ? 'checked' : ''}> <span>Tengo una molestia en articulación o tendón</span></label>
        <details><summary class="small">⌚ Datos de tu reloj (opcional)</summary>
          <div class="grid2"><label>HRV (ms)<input id="ck-hrv" inputmode="numeric" value="${a.hrv || ''}"></label><label>Pulso en reposo<input id="ck-rhr" inputmode="numeric" value="${a.rhr || ''}"></label></div></details>
        <button class="block" id="ck-next" style="margin-top:12px">Ver recomendación</button>`;
      $$('[data-sl]', m).forEach(b => b.onclick = () => { a.sleepH = Math.max(0, Math.min(14, a.sleepH + Number(b.dataset.sl))); $('#ck-sleep', m).textContent = fmt(a.sleepH, a.sleepH % 1 ? 1 : 0) + ' h'; });
      $$('[data-ck]', m).forEach(b => b.onclick = () => { const [k, v] = b.dataset.ck.split('|'); a[k] = Number(v); $$(`[data-ck^="${k}|"]`, m).forEach(x => x.classList.toggle('on', x === b)); });
      $('#ck-next', m).onclick = () => {
        a.joint = $('#ck-joint', m).checked;
        const hrv = num($('#ck-hrv', m).value), rhr = num($('#ck-rhr', m).value);
        if (hrv) a.hrv = hrv; else delete a.hrv;
        if (rhr) a.rhr = rhr; else delete a.rhr;
        const d = day(t); d.rec = Object.assign({}, a); d.sleep = a.sleepH; delete d.plan; delete d.deload;
        saveData(); step = 1; draw(m);
      };
    } else {
      const r = readiness(), P = PLAN_INFO[r.recommended];
      m.innerHTML = `<h3>${P.icon} Hoy te recomiendo: ${P.name}</h3>
        <div class="ready-score"><div class="xp big"><div class="xp-track"><div class="xp-fill" style="width:${r.score}%"></div></div><b class="xp-num">${r.score}</b></div><span class="small muted">disposición para entrenar (de 100)</span></div>
        <p class="small">${P.text}</p>
        <div class="small muted" style="font-weight:600;margin:10px 0 4px">Por qué</div>
        ${r.why.length ? r.why.map(w => `<div class="why-row"><span>${w.icon}</span><span>${esc(w.text)}</span><b class="${w.pts < 0 ? 'neg' : 'pos'}">${w.pts > 0 ? '+' : ''}${w.pts}</b></div>`).join('') : '<p class="small">Todo en tu rango normal.</p>'}
        <p class="small muted" style="margin:8px 0">Datos usados: ${r.used.length ? r.used.join(', ') : 'tus respuestas'}. Es una guía, no un diagnóstico: tú decides.</p>
        ${r.joint ? '<div class="status warn"><b>Molestia articular</b>No entrenes con dolor. Usa ⇄ para cambiar los ejercicios que la provoquen, o márcala en Más → Molestias para que la app los adapte sola.</div>' : ''}
        <div class="small muted" style="font-weight:600;margin:12px 0 6px">Elige cómo entrenar hoy</div>
        <div class="plan-pick">${Object.keys(PLAN_INFO).map(k => `<button data-plan-pick="${k}" class="${k === r.recommended ? 'on' : ''}">${PLAN_INFO[k].icon}<b>${PLAN_INFO[k].name}</b></button>`).join('')}</div>`;
      $$('[data-plan-pick]', m).forEach(b => b.onclick = () => {
        const k = b.dataset.planPick, d = day(t);
        if (k !== r.recommended) d.plan = k; else delete d.plan;
        saveData();
        const s = activeSession();
        if (s) { s.adjust = k === 'mantener' ? null : k; s.adjustDone = true; saveData(); }
        closeModal(); toast(PLAN_INFO[k].icon + ' Plan de hoy: ' + PLAN_INFO[k].name);
        if (after) after(); else render(currentTab);
      });
    }
  };
  openModal('', draw);
}

/** Tarjeta de recuperación (pestaña Entreno). */
function readinessCard() {
  const r = readiness();
  if (!r) return `<div class="card">
      <h2>Chequeo de hoy</h2>
      <p class="small muted" style="margin-top:0">Antes de entrenar: cómo dormiste, tu energía y tu cansancio. Lo combino con tu historial (y tu reloj, si lo anotas) para decirte si mantener, reducir o descargar.</p>
      <button class="block" id="ck-open">¿Cómo llegas hoy?</button></div>`;
  const P = PLAN_INFO[r.plan];
  return `<div class="card">
      <div class="row spread"><h2 style="margin:0">Chequeo de hoy</h2><span class="pill ${r.score >= 70 ? 'good' : r.score >= 45 ? 'warn' : ''}">${r.score}/100</span></div>
      <p style="margin:8px 0 4px;font-weight:700">${P.icon} ${P.name}${r.manual ? ' <span class="small muted">(elegido por ti)</span>' : ''}</p>
      <p class="small muted" style="margin:0 0 8px">${P.text}</p>
      ${r.why.length ? `<div class="small">${r.why.slice(0, 3).map(w => `${w.icon} ${esc(w.text)}`).join('<br>')}</div>` : ''}
      <button class="secondary block" id="ck-open" style="margin-top:10px">Cambiar respuestas o plan</button></div>`;
}

/* ------------------------------------------------------------------ *
 *  Coach: qué hacer hoy en cada ejercicio
 * ------------------------------------------------------------------ */
/** Decisión para un ejercicio: subir carga, sumar reps, consolidar, bajar o romper un estancamiento. */
function coachFor(ex, repsText) {
  const sug = suggestion(ex, repsText, null);
  if (!sug) return { kind: 'nuevo', label: '🆕 Primera vez', text: 'Elige un peso con el que llegues al rango dejando 2–3 reps en reserva.' };
  const u = sug.u, [lo, hi] = repRange(repsText), last = sug.last;
  const lastTop = fromKg(last.top.w, u);
  let kind = sug.a.w > lastTop + 0.01 ? 'subir' : sug.a.w < lastTop - 0.01 ? 'bajar' : 'reps';
  let label = kind === 'subir' ? '⬆️ Sube carga' : kind === 'bajar' ? '⬇️ Baja un poco' : '➕ Suma reps';
  let text = sug.why;
  if (stalled(ex)) {
    kind = 'estancado'; label = '🔁 Estancado';
    const avgRir = avgOfArr(exHistory(ex).slice(-3).flatMap(x => x.sets).filter(s => s.rir != null).map(s => s.rir));
    text = avgRir != null && avgRir >= 3 ? `3 sesiones sin superar tu marca y con RIR medio ${fmt(avgRir)}: acércate más al fallo (RIR 1–2).`
      : `3 sesiones sin superar tu marca: cambia el estímulo. Baja ~10 % y trabaja en ${hi + 2}–${hi + 4} reps dos semanas, o cámbialo con ⇄ por una variante.`;
  }
  return { kind, label, text, sug, lo, hi, u };
}

/** Tarjeta "Tu plan de hoy" con la recomendación de cada ejercicio del día que toca. */
function coachPlanCard() {
  const p = DB.profile, nd = nextDay(p.routine);
  if (!nd || nd.rest || !nd.ex.length) return '';
  const r = readiness(), plan = r ? r.plan : 'mantener';
  const rows = nd.ex.map(e => {
    const c = coachFor(e[0], e[2]), sets = adjSets(e[1], plan);
    const target = c.sug ? (plan === 'modificar' ? `${roundTo(c.sug.a.w * 0.9, stepFor(e[0], c.u))} ${c.u} × ${Math.min(c.sug.a.r, c.hi)}` : c.sug.a.w ? `${c.sug.a.w} ${c.u} × ${c.sug.a.r}` : `${c.sug.a.r} reps`) : e[2] + ' reps';
    return `<div class="coach-row"><div class="grow"><b>${esc(e[0])}</b><br><small class="muted">${sets} × ${esc(target)}</small></div><span class="coach-tag ${c.kind}" data-coach="${esc(e[0])}|${esc(e[2])}">${c.label}</span></div>`;
  }).join('');
  return `<div class="card">
    <div class="row spread"><h2 style="margin:0">Tu plan de hoy</h2><span class="pill">${esc(nd.name.split('·').pop().trim())}</span></div>
    <p class="small muted" style="margin:4px 0 8px">Calculado con tus últimas sesiones${r ? ' y tu chequeo de hoy (' + PLAN_INFO[plan].name.toLowerCase() + ')' : ''}. Toca una etiqueta para ver por qué.</p>
    ${rows}
  </div>`;
}
function bindCoach(root) {
  $$('[data-coach]', root).forEach(b => b.onclick = () => {
    const [ex, reps] = b.dataset.coach.split('|'), c = coachFor(ex, reps), h = exHistory(ex).slice(-4);
    openModal(`<h3>${c.label} · ${esc(ex)}</h3>
      <p>${esc(c.text)}</p>
      ${c.sug ? `<p class="small"><b>Objetivo:</b> ${c.sug.a.w ? c.sug.a.w + ' ' + c.u + ' × ' + c.sug.a.r : c.sug.a.r + ' reps'}${c.sug.b ? ` · o ${c.sug.b.w} ${c.u} × ${c.sug.b.r}` : ''}</p>` : ''}
      ${h.length ? `<div class="small muted" style="font-weight:600;margin:10px 0 4px">Tus últimas sesiones (mejor serie)</div>
        <table><tbody>${h.reverse().map(x => { const top = x.sets.reduce((a, b) => e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a); return `<tr><td>${shortDate(x.date)}</td><td>${wFmt(top.w, unitFor(ex))} × ${top.r}${top.rir != null ? ' · RIR ' + top.rir : ''}</td><td class="num">1RM ${wFmt(x.best, unitFor(ex))}</td></tr>`; }).join('')}</tbody></table>` : ''}
      <p class="small muted">Regla: cuando llegas al tope del rango (${c.hi || 12} reps) dejando 1–2 en reserva, subes un escalón de peso y vuelves al mínimo del rango (${c.lo || 8}).</p>
      <button class="block" id="co-ok">Entendido</button>`, m => { $('#co-ok', m).onclick = closeModal; });
  });
}

/* ------------------------------------------------------------------ *
 *  Análisis de progreso y simulador de metas (pestaña Progreso)
 * ------------------------------------------------------------------ */
const VERDICT = {
  sube: ['good', '📈 Mejora real'], baja: ['bad', '📉 Bajando'], plano: ['gray', '〰️ Fluctuación normal'], pocos: ['gray', '⏳ Faltan datos']
};
function weekBuckets(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const end = addDays(todayStr(), -7 * i), start = addDays(end, -6); out.push({ start, end }); }
  return out;
}
function miniBars(vals, goal, labelFn) {
  const max = Math.max(goal || 0, ...vals, 1);
  return `<div class="mini-bars">${vals.map((v, i) => `<div class="mb"><i style="height:${Math.max(3, v / max * 100)}%" class="${goal && v >= goal ? 'ok' : ''}"></i><small>${labelFn ? labelFn(v, i) : ''}</small></div>`).join('')}${goal ? `<span class="mb-goal" style="bottom:${goal / max * 100}%"></span>` : ''}</div>`;
}
/** Explica con datos por qué la meta de peso va lenta. */
function weightDelayReasons() {
  const p = DB.profile, tg = targets(), out = [];
  const days = lastDays(14).slice(1), logged = days.filter(d => DB.days[d] && (DB.days[d].meals || []).length);
  if (logged.length < 7) out.push(`Registraste comida solo ${logged.length} de 14 días: el déficit real es incierto. Anotar todo (aunque sea aproximado) te da la respuesta.`);
  else {
    const kc = avgOfArr(logged.map(d => dayTotals(d).kcal));
    if (p.phase === 'definicion' && kc > tg.kcal + 100) out.push(`Comiste en promedio ${Math.round(kc).toLocaleString('es-MX')} kcal vs tu meta de ${tg.kcal.toLocaleString('es-MX')}.`);
  }
  const steps = days.map(d => DB.days[d] && DB.days[d].steps).filter(Boolean);
  if (steps.length >= 5 && avgOfArr(steps) < p.steps * 0.8) out.push(`Promedio de ${Math.round(avgOfArr(steps)).toLocaleString('es-MX')} pasos vs tu meta de ${p.steps.toLocaleString('es-MX')}.`);
  const sleep = days.map(d => DB.days[d] && (DB.days[d].sleep || (DB.days[d].rec && DB.days[d].rec.sleepH))).filter(Boolean);
  if (sleep.length >= 5 && avgOfArr(sleep) < 7) out.push(`Duermes ${fmt(avgOfArr(sleep))} h en promedio: dormir poco sube el hambre y retiene líquidos.`);
  const ses = DB.sessions.filter(s => s.end && s.date >= addDays(todayStr(), -14)).length;
  if (ses < (p.weeklyTarget || 3) * 2 * 0.75) out.push(`${ses} entrenos en 2 semanas (tu meta: ${(p.weeklyTarget || 3) * 2}).`);
  return out;
}
/** Explica con datos por qué un ejercicio no avanza. */
function strengthDelayReasons(ex) {
  const out = [], h = exHistory(ex).slice(-3), sets = h.flatMap(x => x.sets);
  const rir = avgOfArr(sets.filter(s => s.rir != null).map(s => s.rir));
  if (rir != null && rir >= 3) out.push(`RIR medio ${fmt(rir)}: te quedas lejos del fallo.`);
  const g = exInfo(ex).g, vol = weekVolume().groups[g] || 0;
  if (WEEKLY_TARGET[g] && vol < WEEKLY_TARGET[g] * 0.6) out.push(`${GROUPS[g] || g}: ${vol} series efectivas esta semana (óptimo ~${WEEKLY_TARGET[g]}).`);
  const ws = new Set(sets.map(s => Math.round(s.w))), rs = h.map(x => Math.max(...x.sets.map(s => s.r)));
  if (ws.size === 1 && rs.length === 3 && rs[2] <= rs[0]) out.push('Mismo peso y mismas reps 3 sesiones: aplica doble progresión (+1 rep por sesión hasta el tope del rango).');
  const sleep = lastDays(14).map(d => DB.days[d] && (DB.days[d].sleep || (DB.days[d].rec && DB.days[d].rec.sleepH))).filter(Boolean);
  if (sleep.length >= 5 && avgOfArr(sleep) < 7) out.push(`Sueño promedio ${fmt(avgOfArr(sleep))} h.`);
  if (DB.profile.phase === 'definicion') out.push('Estás en definición: mantener la fuerza en déficit ya es una buena señal (no estás perdiendo músculo).');
  return out;
}
/** Fecha estimada con rango: pendiente ± 1.5 errores estándar. */
function etaRange(remaining, slopePerDay, se) {
  if (!slopePerDay || Math.sign(slopePerDay) !== Math.sign(remaining)) return null;
  const fast = Math.abs(slopePerDay) + 1.5 * (isFinite(se) ? se : 0), slow = Math.abs(slopePerDay) - 1.5 * (isFinite(se) ? se : 0);
  const mid = Math.abs(remaining / slopePerDay);
  return { mid: addDays(todayStr(), Math.round(mid)), early: addDays(todayStr(), Math.round(Math.abs(remaining) / fast)), late: slow > 0 ? addDays(todayStr(), Math.round(Math.abs(remaining) / slow)) : null, weeks: mid / 7 };
}

function renderAnalysis(el) {
  const p = DB.profile, t = todayStr();
  // Peso: tendencia de 4 semanas vs ruido diario
  const wpts = lastDays(28).reverse().map(d => DB.days[d] && DB.days[d].weight != null ? { x: daysBetween(addDays(t, -27), d), y: DB.days[d].weight } : null).filter(Boolean);
  const wr = wpts.length >= 6 ? linreg(wpts) : null;
  let weightHtml = '<p class="small muted">Pésate al menos 6 días en 4 semanas para ver tu tendencia real.</p>';
  if (wr) {
    const wk = wr.slope * 7, cur = wr.b + wr.slope * 27, remaining = p.goalWeight - cur;
    const real = Math.abs(wr.slope) - 1.5 * wr.se > 0;
    const eta = etaRange(remaining, wr.slope, wr.se);
    const good = (p.phase === 'definicion' && wk < 0) || (p.phase === 'volumen' && wk > 0);
    weightHtml = `<div class="ana-big"><b>${signed(wk, 2)} kg/sem</b><span class="pill ${real ? (good ? 'good' : 'warn') : 'gray'}">${real ? (good ? '📈 Tendencia real' : '⚠️ Va al revés') : '〰️ Aún es ruido'}</span></div>
      <p class="small" style="margin:6px 0">Tu peso varía <b>±${fmt(wr.sd, 1)} kg</b> de un día a otro (agua, sal, comida en el estómago). ${real ? 'Aun así, la tendencia de 4 semanas es clara.' : 'Con esa variación todavía no se distingue una tendencia: sigue pesándote.'}</p>
      ${Math.abs(remaining) < 0.3 ? '<div class="status good"><b>¡Meta alcanzada! 🎉</b>Ponte una nueva en Más → Perfil.</div>'
        : eta ? `<div class="sim"><div class="small muted">Si sigues a este ritmo llegarías a ${fmt(p.goalWeight)} kg</div><b>entre ${shortDate(eta.early)} y ${eta.late ? shortDate(eta.late) : 'más adelante'}</b><div class="small muted">lo más probable: ${longDate(eta.mid)} (~${Math.round(eta.weeks)} semanas)</div></div>`
        : `<div class="status warn"><b>Tu meta se está retrasando</b>${(() => { const rs = weightDelayReasons(); return rs.length ? esc(rs.join(' ')) : 'Con tus datos no veo una causa clara: revisa porciones y fines de semana.'; })()}</div>`}`;
  }
  // Fuerza: tendencia por ejercicio
  const trends = trainedExercises().map(strengthTrend).sort((a, b) => (b.h ? b.h.length : b.n || 0) - (a.h ? a.h.length : a.n || 0));
  const withData = trends.filter(x => x.kind !== 'pocos');
  const stal = trainedExercises().filter(stalled);
  // Volumen y reps semanales, consistencia
  const wb = weekBuckets(8);
  const volW = wb.map(b => DB.lifts.filter(l => l.date >= b.start && l.date <= b.end).reduce((a, l) => a + l.w * l.r, 0));
  const repW = wb.map(b => DB.lifts.filter(l => l.date >= b.start && l.date <= b.end).reduce((a, l) => a + l.r, 0));
  const sesW = wb.map(b => DB.sessions.filter(s => s.end && s.date >= b.start && s.date <= b.end).length);
  const vr = linreg(volW.map((y, x) => ({ x, y })).filter((_, i) => volW.slice(0, i + 1).some(Boolean)));
  const goalW = p.weeklyTarget || 3, metW = sesW.filter(v => v >= goalW).length, activeW = sesW.filter(Boolean).length;
  // Medidas
  const MF = [['waist', 'Cintura', 1, -1], ['chest', 'Pecho', 1, 1], ['arm', 'Brazo', 0.5, 1], ['hip', 'Cadera', 1, -1]];
  const ms = DB.measures.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const mrows = MF.map(([k, n, thr, dir]) => {
    const v = ms.filter(m => m[k] != null);
    if (v.length < 2) return null;
    const d = v[v.length - 1][k] - v[0][k], noise = Math.abs(d) < thr;
    const better = p.phase === 'volumen' && k !== 'waist' ? d > 0 : dir < 0 ? d < 0 : d > 0;
    return `<tr><td>${n}</td><td class="num">${fmt(v[0][k])} → ${fmt(v[v.length - 1][k])}</td><td class="num"><b style="color:${noise ? 'var(--muted)' : better ? 'var(--good)' : 'var(--warn)'}">${signed(d)}</b></td><td class="small muted">${noise ? 'margen de medición' : better ? 'mejora' : 'revisar'}</td></tr>`;
  }).filter(Boolean);
  const goals = DB.goals || [];

  el.innerHTML = `
    <div class="card">
      <h2>Peso corporal <small>· tendencia de 4 semanas</small></h2>
      ${weightHtml}
    </div>

    <div class="card">
      <h2>Fuerza <small>· 1RM estimado, últimas 8 semanas</small></h2>
      ${withData.length ? withData.slice(0, 8).map(x => `<div class="tr-row"><div class="grow"><b>${esc(x.ex)}</b><br><small class="muted">${wFmt(x.last, unitFor(x.ex))} · ${signed(fromKg(x.perMonth, unitFor(x.ex)), 1)} ${unitFor(x.ex)}/mes (${signed(x.pct, 1)} %)</small></div><span class="pill ${VERDICT[x.kind][0]}">${VERDICT[x.kind][1]}</span></div>`).join('')
        : '<p class="small muted">Con 4 sesiones de un ejercicio en al menos 2 semanas te digo si la mejora es real o es fluctuación del día.</p>'}
      <p class="small muted" style="margin:8px 0 0">"Mejora real" = la tendencia sube incluso contando los días buenos y malos (pendiente mayor que 1.5 veces su error). Si no, es fluctuación normal.</p>
    </div>

    ${stal.length ? `<div class="card">
      <h2>Estancamientos detectados</h2>
      ${stal.map(ex => `<details><summary>🔁 ${esc(ex)}</summary><ul class="small">${strengthDelayReasons(ex).map(r => `<li>${esc(r)}</li>`).join('')}<li>Opción: 2 semanas en ${'12–15'} reps con ~10 % menos peso, o una variante con ⇄.</li></ul></details>`).join('')}
    </div>` : ''}

    <div class="card">
      <div class="row spread" style="margin-bottom:8px"><h2 style="margin:0">Simulador de metas de fuerza</h2><button class="ghost" id="goal-add">+ Meta</button></div>
      ${goals.length ? goals.map(g => {
        const tr = strengthTrend(g.ex), u = unitFor(g.ex), h = exHistory(g.ex), cur = h.length ? Math.max(...h.slice(-3).map(x => x.best)) : 0;
        const pct = Math.min(100, cur / g.target * 100);
        let txt;
        if (cur >= g.target) txt = '<b style="color:var(--good)">¡Lograda! 🏆</b>';
        else if (tr.kind === 'pocos') txt = 'Faltan datos: necesito 4 sesiones en 2 semanas.';
        else {
          const eta = etaRange(g.target - cur, tr.r.slope, tr.r.se);
          txt = eta ? `Llegarías entre <b>${shortDate(eta.early)}</b> y <b>${eta.late ? shortDate(eta.late) : 'más adelante'}</b>` : `<span style="color:var(--warn)">Ahora mismo no avanza.</span> ${esc(strengthDelayReasons(g.ex).slice(0, 2).join(' '))}`;
        }
        return `<div class="goal-row"><div class="row spread"><b>${esc(g.ex)}</b><button class="ghost" data-goal-del="${g.id}">✕</button></div>
          <div class="xp"><div class="xp-track"><div class="xp-fill" style="width:${pct}%"></div></div><b class="xp-num">${Math.round(pct)}%</b></div>
          <div class="small muted">${wFmt(cur, u)} de ${wFmt(g.target, u)} (1RM estimado)</div><div class="small" style="margin-top:4px">${txt}</div></div>`;
      }).join('') : '<p class="small muted" style="margin:0">Ponte una meta (por ejemplo press banca 150 kg de 1RM) y te digo cuándo podrías lograrla según tu ritmo real, con un rango, no una promesa.</p>'}
    </div>

    <div class="card">
      <h2>Volumen semanal <small>· kg × reps</small></h2>
      ${miniBars(volW, 0, v => v ? Math.round(v / 1000) + 'k' : '')}
      <p class="small" style="margin:6px 0 0">${vr && vr.n >= 3 ? (vr.slope - 1.5 * vr.se > 0 ? '📈 Tu volumen sube de forma consistente.' : vr.slope + 1.5 * vr.se < 0 ? '📉 Tu volumen baja. Si no es una descarga planeada, revisa sueño y constancia.' : '〰️ Volumen estable: bien para consolidar.') : 'Faltan semanas de datos.'} · La última barra es la semana en curso. Reps esta semana: <b>${repW[7].toLocaleString('es-MX')}</b> (sem. pasada ${repW[6].toLocaleString('es-MX')})</p>
    </div>

    <div class="card">
      <h2>Consistencia <small>· entrenos por semana</small></h2>
      ${miniBars(sesW, goalW, v => v || '')}
      <p class="small" style="margin:6px 0 0">${activeW ? `Cumpliste tu meta de ${goalW} en <b>${metW} de las últimas 8 semanas</b>${metW >= 6 ? ' 🔥 Eso es disciplina.' : metW >= 4 ? '. Vas construyendo el hábito.' : '. Empieza por una meta más chica en Más → Constancia.'}` : 'Aquí verás tus semanas de entreno.'}</p>
    </div>

    <div class="card">
      <h2>Medidas <small>· primera vs última</small></h2>
      ${mrows.length ? `<table><tbody>${mrows.join('')}</tbody></table><p class="small muted" style="margin:8px 0 0">Cambios menores a 1 cm (0.5 cm en brazo) están dentro del error de la cinta.</p>` : '<p class="small muted" style="margin:0">Registra medidas al menos 2 veces (cada 4 semanas) en la pestaña Medidas.</p>'}
    </div>`;

  $('#goal-add').onclick = () => {
    const used = trainedExercises();
    if (!used.length) { toast('Primero registra algún entreno'); return; }
    openModal(`<h3>Nueva meta de fuerza</h3>
      <label>Ejercicio<select id="g-ex">${used.map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
      <label>1RM meta (<span id="g-u">${unitFor(used[0])}</span>)<input id="g-t" inputmode="decimal" placeholder="ej. 150"></label>
      <p class="small muted">1RM estimado = peso × (1 + reps/30). Por ejemplo, 120 kg × 8 ≈ 152 kg.</p>
      <button class="block" id="g-save">Guardar meta</button>`, m => {
      $('#g-ex', m).onchange = e => { $('#g-u', m).textContent = unitFor(e.target.value); };
      $('#g-save', m).onclick = () => {
        const ex = $('#g-ex', m).value, v = num($('#g-t', m).value);
        if (!v || v <= 0) { toast('Escribe la meta'); return; }
        DB.goals = (DB.goals || []).concat({ id: uid(), ex, target: toKg(v, unitFor(ex)) });
        saveData(); closeModal(); renderProgress();
      };
    });
  };
  $$('[data-goal-del]').forEach(b => b.onclick = () => { DB.goals = DB.goals.filter(g => g.id !== b.dataset.goalDel); saveData(); renderProgress(); });
}

/* ------------------------------------------------------------------ *
 *  Retos semanales (alcanzables, sin castigo si no se cumplen)
 * ------------------------------------------------------------------ */
/** Reto de récord: el ejercicio que más vienes entrenando y que no está estancado. */
function prChallenge(wk) {
  const cand = trainedExercises().map(ex => ({ ex, n: exHistory(ex).filter(x => x.date >= addDays(wk, -28) && x.date < wk).length })).filter(x => x.n >= 2 && !stalled(x.ex)).sort((a, b) => b.n - a.n)[0];
  if (!cand) return null;
  const base = Math.max(...exHistory(cand.ex).filter(x => x.date < wk).map(x => x.best));
  return { id: 'pr', title: `Supera tu marca en ${cand.ex}`, ex: cand.ex, base, goal: 1, ico: '🏆' };
}
function weekChallenges() {
  const wk = weekKey(todayStr());
  if (DB.challenges && DB.challenges.week === wk) {
    // Si al empezar la semana aún no había historial, el reto de récord se suma en cuanto lo hay.
    if (!DB.challenges.list.some(c => c.id === 'pr')) { const pr = prChallenge(wk); if (pr) { DB.challenges.list.splice(1, 0, pr); saveData(); } }
    return DB.challenges;
  }
  const p = DB.profile, list = [];
  const lastWk = DB.sessions.filter(s => s.end && weekKey(s.date) === addDays(wk, -7)).length;
  list.push({ id: 'ses', title: `Muévete ${weekTarget(wk)} días (gym o cualquier actividad)`, goal: weekTarget(wk), ico: '🏋️' });
  const pr = prChallenge(wk);
  if (pr) list.push(pr);
  const mealDays = lastDays(7).filter(d => DB.days[d] && (DB.days[d].meals || []).length).length;
  if (mealDays >= 3) list.push({ id: 'prot', title: 'Llega a tu proteína 4 días', goal: 4, ico: '🥩' });
  else list.push({ id: 'weigh', title: 'Pésate 4 mañanas', goal: 4, ico: '⚖️' });
  DB.challenges = { week: wk, list, done: {}, lastWk };
  saveData();
  return DB.challenges;
}
function challengeProgress(c) {
  const wk = weekKey(todayStr()), days = Array.from({ length: 7 }, (_, i) => addDays(wk, i)).filter(d => d <= todayStr());
  if (c.id === 'ses') return sessionsThisWeek();
  if (c.id === 'pr') return DB.lifts.some(l => l.ex === c.ex && weekKey(l.date) === wk && e1rm(l.w, l.r) > c.base + 0.01) ? 1 : 0;
  if (c.id === 'prot') { const tg = targets(); return days.filter(d => dayTotals(d).p >= tg.protein * 0.9).length; }
  if (c.id === 'weigh') return days.filter(d => DB.days[d] && DB.days[d].weight != null).length;
  return 0;
}
function challengesCard() {
  if (isSimple()) return '';
  const ch = weekChallenges();
  let fresh = false;
  const rows = ch.list.map(c => {
    const v = Math.min(c.goal, challengeProgress(c)), done = v >= c.goal;
    if (done && !ch.done[c.id]) { ch.done[c.id] = true; fresh = true; unlock('reto-' + ch.week + '-' + c.id, 'Reto semanal: ' + c.title, 'Semana del ' + shortDate(ch.week)); }
    return `<div class="ch-row ${done ? 'done' : ''}"><span class="ch-ico">${done ? '✅' : c.ico}</span><div class="grow"><b>${esc(c.title)}</b>
      <div class="xp"><div class="xp-track"><div class="xp-fill" style="width:${v / c.goal * 100}%"></div></div><b class="xp-num">${v}/${c.goal}</b></div></div></div>`;
  }).join('');
  if (fresh) { saveData(); setTimeout(() => burst($('#ch-card')), 300); }
  const n = ch.list.filter(c => ch.done[c.id]).length;
  return `<div class="card" id="ch-card">
    <div class="row spread"><h2 style="margin:0">Retos de la semana</h2><span class="pill ${n === ch.list.length ? 'good' : ''}">${n}/${ch.list.length}</span></div>
    <p class="small muted" style="margin:4px 0 8px">${n === ch.list.length ? '🔥 ¡Semana completa! Así se construye la disciplina.' : 'Hechos a tu medida con tu historial. Se renuevan cada lunes; si no salen, no pasa nada.'}</p>
    ${rows}
  </div>`;
}

/* ------------------------------------------------------------------ *
 *  Resumen al terminar la sesión: retroalimentación útil
 * ------------------------------------------------------------------ */
function openSessionSummary(s) {
  const sets = DB.lifts.filter(l => l.sid === s.id), exs = Array.from(new Set(sets.map(l => l.ex)));
  const prs = DB.achievements.filter(a => a.pr && sets.some(l => a.id.startsWith('pr-' + l.id)));
  let up = 0, same = 0, down = 0;
  const lines = exs.map(ex => {
    const today = Math.max(...sets.filter(l => l.ex === ex).map(l => e1rm(l.w, l.r)));
    const prev = lastTime(ex, s.id), u = unitFor(ex);
    if (!prev) return `<div class="sum-row"><span>🆕</span><span class="grow">${esc(ex)}</span><small class="muted">punto de partida</small></div>`;
    const d = (today / prev.best - 1) * 100;
    if (d > 1) up++; else if (d < -3) down++; else same++;
    return `<div class="sum-row"><span>${d > 1 ? '📈' : d < -3 ? '📉' : '➖'}</span><span class="grow">${esc(ex)}</span><b style="color:${d > 1 ? 'var(--good)' : d < -3 ? 'var(--warn)' : 'var(--muted)'}">${signed(d, 0)} %</b></div>`;
  }).join('');
  const prevSame = DB.sessions.filter(x => x.end && x.id !== s.id && x.dayName === s.dayName).sort((a, b) => b.start - a.start)[0];
  const vol = sessionVolume(s.id), pv = prevSame ? sessionVolume(prevSame.id) : null;
  const head = prs.length ? '🏆 ¡Sesión de récords!' : up > down ? '📈 Mejoraste respecto a la última vez' : s.adjust ? '🧠 Entrenaste inteligente' : down > up ? '💪 Día duro, pero cumpliste' : '✅ Sesión sólida';
  const sub = prs.length ? `${prs.length} récord${prs.length === 1 ? '' : 's'} nuevo${prs.length === 1 ? '' : 's'}.`
    : s.adjust ? 'Ajustaste por cansancio: recuperar también es progreso, y protege tus próximas sesiones.'
      : down > up ? 'Un mal día no borra tu tendencia. Revisa sueño y comida; la próxima vuelve el plan normal.' : 'La constancia es lo que construye el físico.';
  const next = exs.map(ex => { const e = sessionExercises(s).find(x => x[0] === ex); const c = e ? coachFor(ex, e[2]) : null; return c && c.sug && c.kind === 'subir' ? `${ex}: ${c.sug.a.w} ${c.u} × ${c.sug.a.r}` : null; }).filter(Boolean).slice(0, 3);
  openModal(`<h3>${head}</h3>
    <p class="small" style="margin-top:0">${sub}</p>
    <div class="grid3" style="margin-bottom:12px">
      <div class="stat"><div class="label">Tiempo</div><div class="value">${Math.round((s.end - s.start) / 60000)}<small> min</small></div></div>
      <div class="stat"><div class="label">Series</div><div class="value">${sets.length}</div></div>
      <div class="stat"><div class="label">Volumen</div><div class="value" style="font-size:17px">${Math.round(vol).toLocaleString('es-MX')}<small> kg</small></div>${pv ? `<div class="small" style="color:${vol >= pv ? 'var(--good)' : 'var(--muted)'}">${signed((vol / pv - 1) * 100, 0)} % vs anterior</div>` : ''}</div>
    </div>
    <div class="small muted" style="font-weight:600;margin-bottom:4px">Fuerza vs la última vez (1RM estimado)</div>
    ${lines}
    ${next.length ? `<div class="status good" style="margin-top:12px"><b>Para la próxima: sube carga</b>${esc(next.join(' · '))}</div>` : ''}
    <div class="small muted" style="font-weight:600;margin:12px 0 6px">¿Qué te ayudó a entrenar hoy? (aprendo tu fórmula)</div>
    <div class="chips">${Object.keys(HELPERS).map(k => `<button class="chip-btn" data-help="${k}">${HELPERS[k]}</button>`).join('')}</div>
    <p class="small muted">Arrancó tu ventana post-entreno de ${PWO_MINUTES} min.</p>
    <button class="block" id="sum-ok">¡Listo!</button>`, m => {
      $$('[data-help]', m).forEach(b => b.onclick = () => {
        b.classList.toggle('on'); s.helped = $$('[data-help].on', m).map(x => x.dataset.help); saveData();
      });
      $('#sum-ok', m).onclick = () => { closeModal(); render(currentTab); };
    });
  if (prs.length || up > down) setTimeout(() => burst($('#modal')), 250);
}
