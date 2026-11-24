'use strict';
/* =====================================================================
 *  36.0 · HOY: entender tu día en menos de cinco segundos
 *  Orden fijo: objetivo → misión → recuperación → semana → rendimiento.
 *  Todo sale de datos registrados. Si falta un dato se muestra un estado
 *  vacío que dice cómo conseguirlo, nunca un número inventado.
 * ===================================================================== */

/** Objetivo principal del atleta con una barra de avance. */
function todayGoal() {
  const p = DB.profile, t = todayStr();
  const sp = typeof mainSport === 'function' ? mainSport() : 'fuerza';
  if (sp === 'hyrox' && typeof hxOn === 'function' && hxOn() && hx().profile.date && daysBetween(t, hx().profile.date) >= 0) {
    const hp = hx().profile, days = daysBetween(t, hp.date), ph = hxPhase();
    const ev = typeof evById === 'function' && hp.eventId ? evById(hp.eventId) : null;
    const span = 16 * 7, pct = Math.max(4, Math.min(100, (1 - days / span) * 100));
    return { k: 'hyrox', tag: 'Preparación HYROX', title: ev ? ev.eventName : 'Tu carrera HYROX', meta: `${days} días · fase ${ph.n.toLowerCase()}`, pct, go: () => showTab('hyrox') };
  }
  if (typeof athOn === 'function' && athOn()) {
    const P = athPlan(), B = ATH_BLOCKS[P.cur];
    return { k: 'ath', tag: 'Proyecto Atleta', title: B.n, meta: `Semana ${P.weekInBlock} de 6 del bloque · año ${P.yearIdx + 1} de ${P.years}`, pct: P.weekInBlock / 6 * 100, go: () => openAthlete() };
  }
  if (['run', 'tri', 'spartan', 'bici'].includes(sp)) {
    const ge = DB.ev && DB.ev.goal && typeof evById === 'function' ? evById(DB.ev.goal) : null, n = sessionsThisWeek(), g = weekTarget();
    if (ge && ge.startDate >= t) { const days = daysBetween(t, ge.startDate); return { k: sp, tag: SPORTS[sp].n, title: ge.eventName, meta: `${days} días para tu competencia`, pct: Math.max(4, Math.min(100, (1 - days / 112) * 100)), go: () => { progMode = 'evol'; showTab('progress'); } }; }
    const tt = sp === 'bici' ? 'Más forma sobre la bici' : sp === 'tri' ? 'Construir tu motor de triatleta' : `Tu mejor ${RUN_DIST[runGoalKm()] || runGoalKm() + ' km'}`;
    return { k: sp, tag: SPORTS[sp].n, title: tt, meta: `${n} de ${g} sesiones esta semana`, pct: Math.min(100, n / g * 100), go: () => { progMode = 'evol'; showTab('progress'); } };
  }
  if (p.trainMode === 'running' && DB.runPlan && typeof RUN_PLANS === 'object' && RUN_PLANS[DB.runPlan.type]) {
    const n = sessionsThisWeek(), g = weekTarget();
    return { k: 'run', tag: 'Running', title: RUN_PLANS[DB.runPlan.type].name, meta: `${n} de ${g} sesiones esta semana`, pct: Math.min(100, n / g * 100), go: () => showTab('train') };
  }
  const cur = currentWeight();
  if (cur && p.goalWeight && (p.phase === 'definicion' || p.phase === 'volumen')) {
    const total = p.startWeight - p.goalWeight, done = p.startWeight - cur, left = Math.abs(cur - p.goalWeight);
    const pct = total ? Math.max(0, Math.min(100, done / total * 100)) : 0;
    return { k: 'weight', tag: p.phase === 'definicion' ? 'Perder grasa' : 'Ganar músculo', title: `${p.phase === 'definicion' ? 'Bajar' : 'Subir'} a ${fmt(p.goalWeight)} kg`, meta: left < 0.3 ? '¡Estás en tu meta!' : `Te faltan ${fmt(left)} kg · vas en ${fmt(cur)} kg`, pct, go: () => { progMode = 'weight'; showTab('progress'); } };
  }
  const n = sessionsThisWeek(), g = weekTarget();
  if (!p.sport && typeof openSportPicker === 'function') return { k: 'consist', tag: 'Elige tu disciplina', title: 'Ganar fuerza semana a semana', meta: `${n} de ${g} sesiones · toca para elegir para qué te preparas`, pct: Math.min(100, n / g * 100), go: () => openSportPicker() };
  return { k: 'consist', tag: 'Construir constancia', title: 'Ganar fuerza semana a semana', meta: `${n} de ${g} sesiones esta semana`, pct: Math.min(100, n / g * 100), go: () => { progMode = 'fuerza'; showTab('progress'); } };
}
function todayGoalHtml() {
  const g = todayGoal(), live = typeof goalLive === 'function' ? goalLive() : null;
  return `<button class="td-goal keep" id="td-goal"><span class="td-goal-top"><small>${esc(g.tag)}</small>${ico('chevron-right', 16)}</span>
    <b>${esc(g.title)}</b>${live ? `<span class="td-live ${live.dir > 0 ? 'up' : live.dir < 0 ? 'down' : ''}"><small>${esc(live.label)}${live.est ? ' · estimado' : ''}</small><b>${esc(live.val)}</b><em>${esc(live.chg)}</em></span>` : ''}<span class="td-bar"><i style="--w:${Math.round(g.pct)}%"></i></span><span class="td-goal-meta">${esc(g.meta)}</span></button>`;
}

/** Recuperación: solo métricas que existen hoy. */
function todayRecoveryHtml() {
  const t = todayStr(), d = DB.days[t] || {}, r = d.rec || {}, rd = typeof readiness === 'function' ? readiness() : null;
  const en = typeof bodyEnergy === 'function' && DB.watch && DB.watch.hcOn ? bodyEnergy(t) : null;
  const tiles = [];
  if (rd) tiles.push(['ck', String(rd.score), 'Disposición', PLAN_INFO[rd.plan].name, rd.score >= 70 ? 'ok' : rd.score >= 50 ? 'mid' : 'low']);
  if (r.sleepH != null) tiles.push(['sleep', fmt(r.sleepH) + ' h', 'Sueño', r.sleepH >= 7 ? 'suficiente' : 'corto', r.sleepH >= 7 ? 'ok' : r.sleepH >= 6 ? 'mid' : 'low']);
  if (r.rhr != null) tiles.push(['hr', String(r.rhr), 'Pulso reposo', 'lpm', '']);
  if (r.hrv != null) tiles.push(['hr', String(r.hrv), 'HRV', 'ms', '']);
  if (en) tiles.push(['energy', String(en.v), 'Energía', 'estimada', '']);
  if (r.soreness != null && tiles.length < 4) tiles.push(['ck', r.soreness + '/5', 'Fatiga', r.soreness >= 4 ? 'alta' : 'normal', r.soreness >= 4 ? 'low' : '']);
  const head = `<div class="td-sec-h"><h2>Recuperación</h2>${tiles.length ? `<button class="ghost td-link" id="td-ck">Actualizar</button>` : ''}</div>`;
  if (!tiles.length) return `<section class="td-sec keep">${head}<button class="td-empty" id="td-ck">${ico('moon', 20)}<span><b>¿Cómo llegas hoy?</b><small>Registra tu sueño y tu energía para conocer tu recuperación. 20 segundos.</small></span>${ico('chevron-right', 16)}</button></section>`;
  return `<section class="td-sec keep">${head}<div class="td-tiles n${Math.min(4, tiles.length)}">${tiles.slice(0, 4).map(([k, v, l, s, c]) => `<button class="td-tile ${c}" data-td="${k}"><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(s)}</small></button>`).join('')}</div></section>`;
}

/** Semana: X de Y, puntos por día y la siguiente sesión. */
function todayWeekHtml() {
  const wk = weekKey(todayStr()), act = activeDates(), t = todayStr(), goal = weekTarget(), n = sessionsThisWeek();
  const nx = typeof nextWorkoutDay === 'function' ? nextWorkoutDay(false) : null;
  const dots = WEEKDAYS.map((w, k) => { const d = addDays(wk, k); return `<span class="${act.has(d) ? 'done' : ''} ${d === t ? 'today' : ''}"><i></i><small>${w[0]}</small></span>`; }).join('');
  const pct = Math.min(100, n / goal * 100);
  return `<section class="td-sec keep"><div class="td-sec-h"><h2>Tu semana</h2><span class="td-count"><b>${n}</b> de ${goal}</span></div>
    <div class="td-week"><div class="td-dots">${dots}</div><span class="td-bar"><i style="--w:${pct}%"></i></span>
    <p>${n >= goal ? 'Semana cumplida. Lo demás es extra.' : `${n} de ${goal} sesiones completadas.`}${nx ? ` Próxima: <b>${/^(Hoy|Mañana|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)$/.test(nx.label) ? esc(nx.label) + ' · ' : ''}${esc(nx.name)}</b>` : ''}</p></div></section>`;
}

/** Rendimiento: máximo tres indicadores, elegidos según el objetivo. Solo los que tienen dato. */
function todayKpis() {
  const g = todayGoal().k, out = [];
  const push = (v, l, s, go) => { if (v != null && out.length < 3) out.push({ v, l, s, go }); };
  if (g === 'hyrox' && typeof hxPerformance === 'function') {
    const perf = hxPerformance(), pr = hxPredict(), bn = hxBottleneck(perf);
    push(perf.hpi != null ? perf.hpi + '' : null, 'HPI', 'modelo interno', () => showTab('hyrox'));
    push(pr.ok ? hxT(pr.total) : null, 'Predicción', 'estimada', () => showTab('hyrox'));
    push(bn && bn.main ? bn.main.n : null, 'Punto débil', 'según tus pruebas', () => showTab('hyrox'));
    if (perf.run) push(hxT(perf.run.sec), '1 km fresco', 'medido', () => showTab('hyrox'));
  }
  if (g === 'ath' && typeof athCapacities === 'function') {
    const caps = athCapacities().filter(c => c.score != null).sort((a, b) => a.score - b.score);
    const m = athCapacities().filter(c => c.score != null);
    push(m.length ? Math.round(m.reduce((a, c) => a + c.score, 0) / m.length) + '' : null, 'Perfil atleta', `${m.length} de 9 medidas`, () => openAthlete());
    if (caps[0]) push(caps[0].show, caps[0].n, 'tu brecha mayor', () => openAthlete());
  }
  if (g === 'weight') {
    const cur = currentWeight(), { r1 } = weeklyRates();
    push(cur ? fmt(cur) : null, 'Peso', 'media 7 días', () => { progMode = 'weight'; showTab('progress'); });
    push(r1 != null ? signed(r1, 2) : null, 'Kg / semana', 'ritmo real', () => { progMode = 'weight'; showTab('progress'); });
  }
  if (g === 'run' && typeof runRecords === 'function') {
    const rr = runRecords().rec || {};
    if (rr[5]) push(mmss(rr[5].t), 'Mejor 5 km', 'récord', () => showTab('train'));
  }
  const sc = typeof strengthScores === 'function' ? strengthScores(todayStr()) : null;
  push(sc && sc.overall != null ? Math.round(sc.overall) + '' : null, 'Fuerza', 'puntaje 0–100', () => { progMode = 'fuerza'; showTab('progress'); });
  const streak = trainingStreakWeeks();
  push(streak ? streak + '' : null, 'Racha', streak === 1 ? 'semana' : 'semanas', () => { progMode = 'historia'; showTab('progress'); });
  if (g !== 'weight') { const cur = currentWeight(); push(cur ? fmt(cur) : null, 'Peso', 'media 7 días', () => { progMode = 'weight'; showTab('progress'); }); }
  return out;
}
function todayKpisHtml() {
  const k = todayKpis();
  if (!k.length) return `<section class="td-sec keep"><div class="td-sec-h"><h2>Rendimiento</h2></div><p class="td-note">Tus indicadores aparecen cuando registres tus primeras series, pruebas o pesos.</p></section>`;
  return `<section class="td-sec keep"><div class="td-sec-h"><h2>Rendimiento</h2></div><div class="td-kpis n${k.length}">${k.map((x, i) => `<button class="td-kpi" data-kpi="${i}"><b>${esc(x.v)}</b><span>${esc(x.l)}</span><small>${esc(x.s)}</small></button>`).join('')}</div></section>`;
}

/** Nutrición de hoy en una línea (el detalle vive en Perfil → Nutrición). */
function todayFoodHtml() {
  if (isSimple()) return '';
  const tg = targets(), tot = dayTotals(todayStr());
  const pct = Math.min(100, tot.kcal / Math.max(1, tg.kcal) * 100);
  return `<button class="td-food keep" id="td-food">${ico('utensils', 20)}<span class="grow"><b>Nutrición de hoy</b><small>${tot.kcal.toLocaleString('es-MX')} de ${tg.kcal.toLocaleString('es-MX')} kcal · ${Math.round(tot.p)} de ${tg.protein} g proteína · ${fmt(tot.water / 1000, 1)} L</small><span class="td-bar"><i style="--w:${pct}%"></i></span></span>${ico('chevron-right', 16)}</button>`;
}

function bindToday(root) {
  const g = $('#td-goal', root); if (g) g.onclick = () => todayGoal().go();
  $$('#td-ck, [data-td=ck], [data-td=sleep]', root).forEach(b => b.onclick = () => openCheckin(() => render(currentTab)));
  $$('[data-td=hr], [data-td=energy]', root).forEach(b => b.onclick = () => (typeof openBodyDetail === 'function' && DB.watch && DB.watch.hcOn) ? openBodyDetail(b.dataset.td) : openCheckin(() => render(currentTab)));
  const ks = todayKpis(); $$('[data-kpi]', root).forEach(b => b.onclick = () => ks[+b.dataset.kpi].go());
  const f = $('#td-food', root); if (f) f.onclick = () => showTab('food');
}

/* =====================================================================
 *  36.0 · PROGRESO: transformación + análisis inteligente
 *  El análisis solo habla cuando hay datos para sostenerlo.
 * ===================================================================== */
function progInsights() {
  const t = todayStr(), out = [];
  const inRange = (d, a, b) => d > addDays(t, -a) && d <= addDays(t, -b);
  const ses = (a, b) => DB.sessions.filter(s => s.end && inRange(s.date, a, b)).length;
  const km = (a, b) => (DB.runs || []).filter(r => inRange(r.date, a, b)).reduce((x, r) => x + (r.km || 0), 0);
  const s1 = ses(21, 0), s0 = ses(42, 21);
  const now = typeof strengthScores === 'function' ? strengthScores(t).overall : null, past = typeof strengthScores === 'function' ? strengthScores(addDays(t, -28)).overall : null;
  const k1 = km(21, 0), k0 = km(42, 21), anyRuns = (DB.runs || []).length > 0;
  if (now != null && past != null) {
    const d = Math.round(now - past);
    if (d >= 2 && anyRuns && Math.abs(k1 - k0) < 1) out.push({ c: 'warn', t: `Tu fuerza subió ${d} puntos en 4 semanas, pero tu volumen de carrera no cambió en las últimas 3.`, a: 'Aumenta gradualmente el volumen aeróbico (≈10 % por semana) siempre que tu recuperación sea buena.' });
    else if (d >= 2) out.push({ c: 'good', t: `Tu fuerza subió ${d} puntos en 4 semanas.`, a: 'Sigue con la progresión: sube peso cuando completes el rango de repeticiones.' });
    else if (d <= -2) out.push({ c: 'warn', t: `Tu fuerza bajó ${-d} puntos en 4 semanas.`, a: 'Revisa sueño, proteína y descanso. Una semana de descarga suele devolver el rendimiento.' });
    else if (s1 >= 6) out.push({ c: 'info', t: 'Tu fuerza está estable desde hace 4 semanas aunque entrenas con constancia.', a: 'Cambia el estímulo: otro rango de repeticiones o una variante del ejercicio principal.' });
  }
  if (s0 >= 3 && s1 + s0 >= 6) {
    if (s1 >= s0 + 2) out.push({ c: 'good', t: `Entrenaste ${s1} veces en 3 semanas, ${s1 - s0} más que las 3 anteriores.`, a: 'Buen momento para mantener el ritmo, no para subirlo de golpe.' });
    else if (s1 <= s0 - 2) out.push({ c: 'warn', t: `Entrenaste ${s1} veces en 3 semanas, ${s0 - s1} menos que las 3 anteriores.`, a: 'Elige 2 días fijos esta semana. Lo importante es volver, no compensar.' });
  }
  if (anyRuns && k0 >= 5 && k1 > k0 * 1.3) out.push({ c: 'warn', t: `Tu volumen de carrera subió ${Math.round((k1 / k0 - 1) * 100)} % en 3 semanas.`, a: 'Subidas de más del 30 % elevan el riesgo de lesión. Mantén este volumen una semana antes de subir.' });
  return out.slice(0, 2);
}
function progressHero() {
  const p = DB.profile, t = todayStr(), done = DB.sessions.filter(s => s.end).length;
  const since = p.startDate ? Math.max(0, daysBetween(p.startDate, t)) + 1 : null;
  const prs = DB.achievements.filter(a => a.pr).length, cur = currentWeight();
  const dW = cur != null && p.startWeight ? Math.round((cur - p.startWeight) * 10) / 10 : null;
  const tiles = [[done, 'entrenos'], [bestStreakWeeks(), 'mejor racha (sem)'], [prs, 'récords']];
  if (dW != null && Math.abs(dW) >= 0.1) tiles[2] = [(dW > 0 ? '+' : '') + fmt(dW), 'kg desde el inicio'];
  const ins = progInsights(), enough = done >= 3 || (DB.runs || []).length >= 3;
  return `<div class="pg-hero keep"><div class="hx-eyebrow">TU TRANSFORMACIÓN${since ? ' · DÍA ' + since : ''}</div>
    <div class="pg-tiles">${tiles.map(([v, l]) => `<div><b>${esc(String(v))}</b><small>${esc(l)}</small></div>`).join('')}</div></div>
    <section class="td-sec keep"><div class="td-sec-h"><h2>Análisis</h2></div>
    ${ins.length ? ins.map(x => `<div class="pg-ins ${x.c}"><b>${esc(x.t)}</b><span>${ico('lightbulb', 14)}${esc(x.a)}</span></div>`).join('')
      : `<p class="td-note">${enough ? 'Sin cambios relevantes en las últimas 3 semanas. Sigue registrando: cuando algo mejore o se estanque te lo diré aquí.' : 'Con 3 semanas de entrenos registrados empiezo a detectar mejoras, estancamientos y patrones. No saco conclusiones con datos insuficientes.'}</p>`}</section>`;
}
