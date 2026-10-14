/* Mi Progreso 12.0 · Motor de misiones personales y gamificación sana.
   Cada misión tiene objetivo, criterio de éxito y por qué. Si la recuperación lo pide, la
   misión cambia a una alternativa suave. Nada premia entrenar de más. */

function lastActiveDate() { const d = Array.from(activeDates()).sort(); return d[d.length - 1] || null; }
function inComeback() { const c = DB.profile.comeback; return !!(c && todayStr() <= c.until); }

/** Misiones de hoy: fuerza, running, hábito y recuperación, según tu plan y tu chequeo. */
function todayMissions() {
  const t = todayStr(), out = [], rd = typeof readiness === 'function' ? readiness() : null;
  const low = rd && (rd.plan === 'modificar' || rd.score < 45);
  // Fuerza: el día que toca de tu rutina
  const nd = nextDay(DB.profile.routine), doneStrength = DB.sessions.some(s => s.end && s.date === t);
  if (nd && !nd.rest && DB.profile.trainMode !== 'running') {
    if (low) out.push({ ico: '🧘', kind: 'rec', title: 'Recuperación activa', goal: '15 min de movilidad o 20–30 min caminando', success: 'Moverte suave sin dolor; si prefieres descansar, también vale.', why: `Tu chequeo de hoy marca ${rd.score}/100: ${rd.why.filter(w => w.pts < 0).slice(0, 2).map(w => w.text.toLowerCase()).join(' y ') || 'te conviene recuperar'}.`, done: doneStrength || (DB.activities || []).some(a => a.date === t && ['movilidad', 'caminar', 'yoga'].includes(a.type)) });
    else {
      const prog = nd.ex.map(e => ({ e, c: coachFor(e[0], e[2]) })).find(x => x.c.kind === 'subir' || x.c.kind === 'reps');
      const reduce = rd && rd.plan === 'reducir';
      out.push({ ico: '🏋️', kind: 'str', title: 'Fuerza · ' + nd.name.split('·').pop().trim(),
        goal: reduce ? 'Sesión reducida: una serie menos por ejercicio' : prog ? `Progresa en ${prog.e[0]}: ${prog.c.sug.a.w ? prog.c.sug.a.w + ' ' + prog.c.u + ' × ' : ''}${prog.c.sug.a.r}` : `Completa los ${nd.ex.length} ejercicios`,
        success: reduce ? 'Terminar con 2–3 repeticiones en reserva en cada serie.' : 'Completar las series planeadas con 1–3 repeticiones en reserva y buena técnica.',
        why: reduce ? 'Tu chequeo pide reducir: entrenar inteligente hoy protege tus próximas sesiones.' : prog ? prog.c.text : 'Sumar sesiones constantes es lo que construye tu fuerza.',
        done: doneStrength });
    }
  }
  // Running: la sesión de hoy del plan
  const rs = typeof nextRunSession === 'function' ? nextRunSession() : null;
  if (rs && rs.date === t) {
    const m = runMission(rs);
    if (low) out.push({ ico: '🚶', kind: 'rec', title: 'Running · cambio por recuperación', goal: '20–30 min caminando o descanso', success: 'Moverte sin fatiga.', why: 'Tu chequeo recomienda descarga; la sesión del plan puede esperar sin acumularse.', done: false });
    else out.push({ ico: '🏃', kind: 'run', title: 'Running · ' + rs.label, goal: m.goal, success: m.success, why: m.why, done: !!rs.done });
  }
  // Hábito: un compromiso pendiente hoy
  const c = (DB.commits || []).find(x => !commitDone(x, t));
  if (c) out.push({ ico: '🤝', kind: 'hab', title: 'Hábito', goal: c.title, success: 'Hecho hoy (lo marcas en Mis compromisos).', why: 'Un compromiso pequeño y diario sostiene la constancia. Si hoy no sale, mañana sigue igual: no hay cadenas que romper.', done: false });
  // Recuperación: sueño corto varios días
  const bad = lastDays(4).filter(d => { const r = DB.days[d] && DB.days[d].rec; return r && r.sleepH != null && r.sleepH < 6.5; }).length;
  if (bad >= 2) out.push({ ico: '😴', kind: 'rec2', title: 'Recuperación', goal: 'Duerme 7–9 horas esta noche', success: 'Registrar 7 h o más en tu próximo chequeo.', why: `${bad} de tus últimas 4 noches dormiste menos de 6.5 h. El sueño es cuando se consolida el progreso.`, done: false });
  if (!out.length) out.push({ ico: '🌿', kind: 'rest', title: 'Día libre', goal: 'Descansa o camina 20 min si te apetece', success: 'Opcional: el descanso también es parte del plan.', why: 'No tienes sesión planeada hoy.', done: false });
  return out;
}
function missionsCard() {
  const ms = todayMissions(), done = ms.filter(m => m.done).length;
  return `<div class="card missions-card" data-fold-title="Misiones de hoy" data-fold-sum="${esc(ms.map(m => m.title.split(' · ')[0]).join(' · '))}" data-fold-badge="${done}/${ms.length}" data-fold-ico="🎯">
    <h2>Misiones de hoy</h2>
    ${inComeback() ? '<div class="adapt-note" style="margin:0 0 10px">👋 <b>Regreso suave activo:</b> misiones al 60–70 % hasta el ' + shortDate(DB.profile.comeback.until) + '. Volver es lo que cuenta.</div>' : ''}
    ${ms.map(m => `<div class="ms-item ${m.done ? 'done' : ''} ${m.kind}"><span class="ms-ico">${m.done ? '✅' : m.ico}</span><div class="grow"><b>${esc(m.title)}</b><div class="ms-goal">🎯 ${esc(m.goal)}</div>
      <details class="ms-why"><summary class="small">Criterio y por qué</summary><div class="small">✔ ${esc(m.success)}<br>💡 ${esc(m.why)}</div></details></div></div>`).join('')}
  </div>`;
}

/* ---------- regreso tras una pausa ---------- */
function comebackCard() {
  const last = lastActiveDate(), t = todayStr();
  if (!last || inComeback()) return '';
  const gap = daysBetween(last, t);
  if (gap < 10 || DB.profile.comebackDismissed === last) return '';
  return `<div class="card keep comeback">
    <h2 style="margin:0 0 4px">👋 ¡Qué bueno verte!</h2>
    <p class="small" style="margin:0 0 10px">Han pasado ${gap} días desde tu última actividad. No hay nada que recuperar ni rachas que lamentar: hoy empieza de nuevo.</p>
    <p class="small muted" style="margin:0 0 10px">El regreso suave dura 2 semanas: sesiones más cortas (una serie menos, ritmo cómodo) y meta de 2 días por semana, para que tu cuerpo se readapte sin dolor.</p>
    <div class="row"><button id="cb-yes" style="flex:2">Activar regreso suave</button><button class="secondary" id="cb-no" style="flex:1">Estoy bien</button></div>
  </div>`;
}
function bindComeback(root, rerender) {
  const y = $('#cb-yes', root), n = $('#cb-no', root);
  if (y) y.onclick = () => {
    const t = todayStr(), wk = weekKey(t);
    DB.profile.comeback = { start: t, until: addDays(t, 13) };
    DB.hardWeeks = Array.from(new Set((DB.hardWeeks || []).concat([wk, addDays(wk, 7)])));
    addEvent(t, 'comeback', 'Volviste después de una pausa', '👋');
    saveData(); rerender(); toast('👋 Regreso suave activado por 2 semanas');
  };
  if (n) n.onclick = () => { DB.profile.comebackDismissed = lastActiveDate(); saveData(); rerender(); };
}

/* ---------- niveles por actividad y resumen del mes ---------- */
function levelOf(xp) { const level = Math.floor(Math.sqrt(xp / 40)) + 1, base = 40 * (level - 1) ** 2, next = 40 * level ** 2; return { xp, level, pct: (xp - base) / (next - base) * 100 }; }
function activityLevels() {
  const weeksWith = (dates, min) => { const w = {}; dates.forEach(d => { const k = weekKey(d); w[k] = (w[k] || 0) + 1; }); return Object.values(w).filter(n => n >= min).length; };
  const strDates = DB.sessions.filter(s => s.end).map(s => s.date);
  const prs = DB.achievements.filter(a => a.pr).length, misS = DB.sessions.reduce((n, s) => n + Object.keys(s.missionOk || {}).length, 0);
  const runs = allRuns(), km = runs.reduce((a, r) => a + (r.km || 0), 0);
  const runPR = (DB.events || []).filter(e => e.type === 'runpr').length;
  const misR = DB.runPlan ? DB.runPlan.weeks.flatMap(w => w.sessions).filter(s => s.missionOk).length : 0;
  return {
    fuerza: Object.assign(levelOf(weeksWith(strDates, 2) * 25 + prs * 8 + misS * 5), { parts: `${weeksWith(strDates, 2)} semanas con 2+ sesiones · ${prs} récords · ${misS} misiones` }),
    running: Object.assign(levelOf(Math.round(km * 2) + weeksWith(runs.map(r => r.date), 2) * 25 + runPR * 15 + misR * 5), { parts: `${fmt(km, 0)} km · ${weeksWith(runs.map(r => r.date), 2)} semanas con 2+ carreras · ${runPR} récords · ${misR} misiones` })
  };
}
function monthSummary(ym) {
  const inM = d => d.slice(0, 7) === ym;
  const runs = allRuns().filter(r => inM(r.date));
  return { ses: DB.sessions.filter(s => s.end && inM(s.date)).length, runs: runs.length, km: runs.reduce((a, r) => a + (r.km || 0), 0), days: Array.from(activeDates()).filter(inM).length,
    mins: activeMinutes(ym + '-01', ym + '-31'), prs: DB.achievements.filter(a => a.pr && inM(a.date)).length + (DB.events || []).filter(e => e.type === 'runpr' && inM(e.date)).length };
}
function monthCard() {
  const t = todayStr(), ym = t.slice(0, 7), d = parseDate(t); d.setMonth(d.getMonth() - 1);
  const pm = dateStr(d).slice(0, 7), a = monthSummary(ym), b = monthSummary(pm);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const row = (l, x, y, f) => `<tr><td>${l}</td><td class="num"><b>${f ? f(x) : x}</b></td><td class="num small muted">${f ? f(y) : y}</td></tr>`;
  return `<div class="card"><h2>Tu ${MESES[parseDate(t).getMonth()]} <small>· vs ${MESES[d.getMonth()]}</small></h2>
    <table><tbody>${row('Días activos', a.days, b.days)}${row('Sesiones de fuerza', a.ses, b.ses)}${row('Carreras', a.runs, b.runs)}${row('Kilómetros', a.km, b.km, v => fmt(v, 1))}${row('Minutos activos', a.mins, b.mins)}${row('Récords', a.prs, b.prs)}</tbody></table>
    <p class="small muted" style="margin:8px 0 0">${a.days >= b.days ? 'Vas igual o mejor que el mes pasado. 💪' : 'El mes aún no termina; cada día activo suma.'} Más no siempre es mejor: lo que buscamos es constancia.</p></div>`;
}
