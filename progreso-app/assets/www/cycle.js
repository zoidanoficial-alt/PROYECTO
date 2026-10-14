/* Mi Progreso 9.0 · Ciclo menstrual conectado con el entrenamiento (opcional).
   Principios: responder a los datos y preferencias de la usuaria, no a estereotipos;
   nunca bajar la exigencia solo por la fase; mostrar la incertidumbre; no diagnosticar.
   Los datos viven solo en el teléfono. */

const CYC_SYMPTOMS = {
  colicos: '🌀 Cólicos', fatiga: '🥱 Cansancio', hinchazon: '🎈 Hinchazón', sensibilidad: '💗 Sensibilidad en senos',
  cabeza: '🤕 Dolor de cabeza', apetito: '🍫 Más apetito', calor: '🌡️ Más calor', animo: '🌧️ Ánimo bajo', irritable: '⚡ Irritabilidad',
  espalda: '🔙 Dolor lumbar', acne: '✨ Acné', motivacion: '🔥 Mucha motivación'
};
const FLOW = ['Nada', 'Manchado', 'Ligero', 'Medio', 'Abundante'];
const CYC_PHASES = {
  menstruacion: { ico: '🩸', name: 'Menstruación', cls: 'ph-men',
    text: 'Empieza un ciclo nuevo. Las hormonas sexuales están en su punto más bajo.',
    observe: 'Registra sangrado, cólicos, cansancio, sueño y ánimo. Muchas mujeres entrenan igual que siempre; otras prefieren algo más suave los primeros días.',
    train: 'Si te sientes bien, entrena según tu programa. Si hay cólicos o fatiga, la app te ofrece una sesión ligera, movilidad o descanso: tú eliges.' },
  folicular: { ico: '🌱', name: 'Fase folicular', cls: 'ph-fol',
    text: 'El estrógeno suele ir en aumento después de la regla.',
    observe: 'Comprueba si en tu caso suben la energía, la motivación o el rendimiento. No a todas les pasa.',
    train: 'Si notas buena energía y recuperación, es un buen momento para perseguir tus misiones de progreso.' },
  ovulacion: { ico: '✨', name: 'Alrededor de la ovulación (estimada)', cls: 'ph-ov',
    text: 'La ovulación ocurre aproximadamente 14 días antes de la siguiente regla, pero el día exacto varía de un ciclo a otro.',
    observe: 'Observa tu rendimiento real: la ovulación no garantiza más fuerza ni más energía.',
    train: 'Entrena según cómo te sientas y tu recuperación.' },
  lutea: { ico: '🌙', name: 'Fase lútea', cls: 'ph-lut',
    text: 'Sube la progesterona. Algunas mujeres notan más calor, más apetito o cambios en el sueño.',
    observe: 'Registra apetito, sueño, temperatura percibida, hinchazón, sensibilidad y ánimo.',
    train: 'Mantén tu plan si te sientes bien. Hidrátate más si sientes calor.' },
  premenstrual: { ico: '🌘', name: 'Días previos a la regla', cls: 'ph-pre',
    text: 'Final de la fase lútea: las hormonas bajan antes de la siguiente menstruación.',
    observe: 'Si tus síntomas se repiten estos días, la app los anticipa con base en TU historial.',
    train: 'Puedes planear una sesión flexible. No es obligatorio bajar la intensidad: decide según tu recuperación.' }
};
const CYC_CAVEAT = 'Las fases son orientativas: la duración del ciclo, el momento de la ovulación y los síntomas varían, y los anticonceptivos hormonales pueden cambiar estos patrones. Esta función no sirve como método anticonceptivo ni diagnostica nada.';

function cycleOn() { return !!DB.profile.cycleOn; }
function cycDay(d) { return (DB.days[d] && DB.days[d].cyc) || null; }
/** Inicios de regla: el primer día de cada racha de sangrado (se toleran 2 días sin registro). */
function cycStarts() {
  const flowDays = Object.keys(DB.days).filter(d => { const c = DB.days[d].cyc; return c && c.flow >= 2; }).sort();
  const starts = [], lens = [];
  let prev = null, runStart = null;
  flowDays.forEach(d => {
    if (!prev || daysBetween(prev, d) > 3) { if (runStart) lens.push(daysBetween(runStart, prev) + 1); starts.push(d); runStart = d; }
    prev = d;
  });
  if (runStart) lens.push(daysBetween(runStart, prev) + 1);
  return { starts, lens };
}
/** Duración media del ciclo, su variación y la predicción con margen. */
function cycStats() {
  const { starts, lens } = cycStarts();
  const cyc = [];
  for (let i = 1; i < starts.length; i++) { const n = daysBetween(starts[i - 1], starts[i]); if (n >= 15 && n <= 60) cyc.push(n); }
  const recent = cyc.slice(-6);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : (DB.profile.cycleLen || 28);
  const sd = recent.length >= 2 ? Math.sqrt(recent.reduce((a, b) => a + (b - avg) ** 2, 0) / (recent.length - 1)) : null;
  const L = Math.round(avg), P = lens.length ? Math.round(lens.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, lens.length)) : (DB.profile.periodLen || 5);
  const last = starts[starts.length - 1] || null;
  let next = null, margin = null;
  if (last) {
    next = addDays(last, L);
    while (next < addDays(todayStr(), -3)) next = addDays(next, L);   // si no se ha registrado, se proyecta el siguiente
    margin = sd != null ? Math.max(2, Math.round(1.5 * sd)) : 4;
  }
  return { starts, cycles: cyc, avg, sd, L, P, last, next, margin, confident: recent.length >= 3 };
}
/** Fase (orientativa) de un día, usando el inicio real anterior y el siguiente si ya ocurrió. */
function phaseOn(date, st) {
  st = st || cycStats();
  if (!st.last) return null;
  const prevStarts = st.starts.filter(s => s <= date);
  let start = prevStarts[prevStarts.length - 1], L = st.L;
  if (!start) return null;
  const nextReal = st.starts.find(s => s > date);
  if (nextReal) L = daysBetween(start, nextReal);
  else while (daysBetween(start, date) >= L) start = addDays(start, L);   // ciclos futuros proyectados
  const n = daysBetween(start, date) + 1, c = cycDay(date);
  const predicted = !nextReal && date > todayStr();
  // Menstruación: lo registrado manda; sin registro, se estima con tu duración media de regla.
  const men = c && c.flow != null ? (c.flow >= 1 && n <= 10) : n <= st.P;
  const key = men ? 'menstruacion' : n >= L - 16 && n <= L - 12 ? 'ovulacion' : n > L - 5 ? 'premenstrual' : n < L - 16 ? 'folicular' : 'lutea';
  return { key, n, L, start, predicted, untilNext: L - n + 1 };
}

/* ------------------------------------------------------------------ *
 *  Registro diario rápido
 * ------------------------------------------------------------------ */
function openCycleDay(date, after) {
  date = date || todayStr();
  const prev = cycDay(date) || {}, rec = (DB.days[date] && DB.days[date].rec) || {};
  const c = { flow: prev.flow || 0, pain: prev.pain || 0, sym: (prev.sym || []).slice(), energy: prev.energy || rec.energy || 3, mood: prev.mood || 3, sleepQ: prev.sleepQ || rec.sleepQ || 3, note: prev.note || '' };
  const ph = phaseOn(date);
  const scale = (k, labels) => `<div class="ck-scale">${labels.map((l, i) => `<button data-cy="${k}|${i + 1}" class="${c[k] === i + 1 ? 'on' : ''}"><span>${l[0]}</span><small>${l[1]}</small></button>`).join('')}</div>`;
  const draw = m => {
    m.innerHTML = `<h3>${date === todayStr() ? '¿Cómo te sientes hoy?' : longDate(date)}</h3>
      ${ph ? `<p class="small muted" style="margin-top:0">${CYC_PHASES[ph.key].ico} Día ${ph.n} del ciclo · <span class="tag-est">fase estimada</span> ${CYC_PHASES[ph.key].name}</p>` : ''}
      ${prev.flow != null ? '<p class="small" style="margin:-4px 0 8px"><span class="tag-reg">registrado</span> Ya tienes datos de este día; puedes corregirlos.</p>' : ''}
      <div class="ck-q">Sangrado</div>
      <div class="seg wrap">${FLOW.map((f, i) => `<button data-flow="${i}" class="${c.flow === i ? 'on' : ''}">${i ? '🩸'.repeat(Math.min(3, i)) + ' ' : ''}${f}</button>`).join('')}</div>
      <div class="ck-q">Cólicos o dolor</div>
      <div class="seg">${['Nada', 'Leve', 'Moderado', 'Fuerte'].map((f, i) => `<button data-pain="${i}" class="${c.pain === i ? 'on' : ''}">${f}</button>`).join('')}</div>
      <div class="ck-q">Energía</div>${scale('energy', [['🪫', 'Muy baja'], ['😮‍💨', 'Baja'], ['😐', 'Normal'], ['💪', 'Buena'], ['⚡', 'Alta']])}
      <div class="ck-q">Sueño</div>${scale('sleepQ', [['😫', 'Pésimo'], ['😕', 'Malo'], ['😐', 'Normal'], ['🙂', 'Bueno'], ['😴', 'Excelente']])}
      <div class="ck-q">Ánimo</div>${scale('mood', [['😞', 'Muy bajo'], ['😕', 'Bajo'], ['😐', 'Normal'], ['🙂', 'Bien'], ['😄', 'Muy bien']])}
      <div class="ck-q">¿Algo más?</div>
      <div class="chips">${Object.keys(CYC_SYMPTOMS).map(k => `<button class="chip-btn ${c.sym.includes(k) ? 'on' : ''}" data-sym="${k}">${CYC_SYMPTOMS[k]}</button>`).join('')}</div>
      <label style="margin-top:12px">Nota (opcional)<input id="cy-note" value="${esc(c.note)}" placeholder="Ej. entrené pierna y me sentí fuerte"></label>
      <button class="block" id="cy-save">Guardar</button>`;
    $$('[data-flow]', m).forEach(b => b.onclick = () => { c.flow = Number(b.dataset.flow); draw(m); });
    $$('[data-pain]', m).forEach(b => b.onclick = () => { c.pain = Number(b.dataset.pain); draw(m); });
    $$('[data-cy]', m).forEach(b => b.onclick = () => { const [k, v] = b.dataset.cy.split('|'); c[k] = Number(v); draw(m); });
    $$('[data-sym]', m).forEach(b => b.onclick = () => { const k = b.dataset.sym; c.sym = c.sym.includes(k) ? c.sym.filter(x => x !== k) : c.sym.concat(k); draw(m); });
    $('#cy-save', m).onclick = () => {
      c.note = $('#cy-note', m).value.trim();
      const d = day(date); d.cyc = c;
      // La energía y el sueño también alimentan el chequeo de recuperación.
      d.rec = Object.assign({}, d.rec || {}, { energy: c.energy, sleepQ: c.sleepQ });
      saveData(); closeModal();
      const alert = cycleAlerts().find(a => a.date === date);
      toast(alert ? '⚠️ ' + alert.short : '✓ Guardado');
      if (after) after(); else render(currentTab);
    };
  };
  openModal('', draw);
}

/* ------------------------------------------------------------------ *
 *  Señales para consultar a un profesional (sin diagnosticar)
 * ------------------------------------------------------------------ */
function cycleAlerts() {
  const out = [], st = cycStats(), { lens } = cycStarts();
  Object.keys(DB.days).forEach(d => {
    const c = DB.days[d].cyc;
    if (c && c.pain === 3) out.push({ date: d, short: 'Dolor fuerte registrado', text: 'Registraste dolor fuerte. Si el dolor no cede con lo habitual, te impide tus actividades o es distinto a lo normal para ti, consulta a un profesional de salud.' });
  });
  // Sangrado abundante 4 días o más dentro de una misma regla
  const heavyRun = st.starts.map(s0 => Array.from({ length: 10 }, (_, k) => addDays(s0, k)).filter(d => DB.days[d] && DB.days[d].cyc && DB.days[d].cyc.flow === 4).length);
  if (heavyRun.some(n => n >= 4)) out.push({ short: 'Sangrado abundante varios días', text: 'En alguna regla registraste sangrado abundante 4 días o más. Si es más de lo habitual para ti o te sientes débil o mareada, coméntalo con tu médico.' });
  if (lens.some(n => n > 8)) out.push({ short: 'Regla de más de 8 días', text: 'Algún periodo duró más de 8 días. Vale la pena comentarlo en tu próxima consulta.' });
  const odd = st.cycles.filter(n => n < 21 || n > 35);
  if (odd.length >= 2) out.push({ short: 'Ciclos fuera del rango típico', text: `${odd.length} de tus ciclos midieron menos de 21 o más de 35 días. Puede ser normal para ti, pero conviene comentarlo con un profesional.` });
  return out;
}

/* ------------------------------------------------------------------ *
 *  Patrones personales (lo más valioso)
 * ------------------------------------------------------------------ */
/** Compara los días previos a la regla con el resto de tu ciclo, solo en ciclos ya completos. */
function cyclePatterns() {
  const st = cycStats(), res = { cycles: st.cycles.length, notes: [], perf: null };
  if (st.starts.length < 3) return res;   // al menos 2 ciclos completos
  const starts = st.starts.slice(-4);
  const bucket = { pre: [], men: [], fol: [], rest: [] }, symPre = {}, symRest = {};
  for (let i = 0; i < starts.length - 1; i++) {
    const a = starts[i], b = starts[i + 1], L = daysBetween(a, b);
    for (let k = 0; k < L; k++) {
      const d = addDays(a, k), c = cycDay(d), rec = (DB.days[d] && DB.days[d].rec) || {};
      if (!c && rec.energy == null && rec.sleepQ == null) continue;
      const rel = L - k;   // días que faltan para la siguiente regla
      const zone = rel <= 3 ? 'pre' : k < 3 ? 'men' : k < L - 16 ? 'fol' : 'rest';
      const row = { energy: (c && c.energy) || rec.energy, sleep: (c && c.sleepQ) || rec.sleepQ, mood: c && c.mood, cyc: i };
      bucket[zone].push(row); if (zone !== 'pre') bucket.rest.push(row);
      ((c && c.sym) || []).forEach(s => { const tgt = zone === 'pre' ? symPre : symRest; tgt[s] = tgt[s] || new Set(); tgt[s].add(i); });
    }
  }
  const avg = (arr, k) => { const v = arr.map(r => r[k]).filter(x => x != null); return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const nC = starts.length - 1;
  const worse = [], better = [];
  [['energy', 'energía', 'más fatiga'], ['sleep', 'sueño', 'peor sueño'], ['mood', 'ánimo', 'ánimo más bajo']].forEach(([k, name, w]) => {
    const pre = avg(bucket.pre, k), rest = avg(bucket.rest, k), men = avg(bucket.men, k);
    if (pre != null && rest != null && rest - pre >= 0.6) worse.push(`${w} (${name} ${fmt(pre, 1)} vs ${fmt(rest, 1)})`);
    if (pre != null && men != null && men - pre >= 0.6) better.push(name);
  });
  const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0];
  if (worse.length) res.notes.push({ ico: '🌘', text: `En tus últimos ${nC} ciclos registraste ${list(worse)} en los 3 días antes de la menstruación, comparado con el resto del ciclo.` });
  if (better.length) res.notes.push({ ico: '🌅', text: `Al empezar la menstruación mejoran tu ${list(better)} respecto a los días previos.` });
  Object.keys(symPre).forEach(s => {
    if (symPre[s].size >= 2) res.notes.push({ ico: '🔁', text: `${CYC_SYMPTOMS[s]} aparece antes de la regla en ${symPre[s].size} de tus últimos ${nC} ciclos.`, sym: s });
  });
  // Rendimiento: 1RM estimado de cada serie comparado con la mediana de ese ejercicio
  const med = {};
  trainedExercises().forEach(ex => { const v = DB.lifts.filter(l => l.ex === ex).map(l => e1rm(l.w, l.r)).sort((a, b) => a - b); if (v.length >= 6) med[ex] = v[Math.floor(v.length / 2)]; });
  const byPh = {};
  DB.lifts.forEach(l => { if (!med[l.ex] || l.date < starts[0]) return; const ph = phaseOn(l.date, st); if (!ph || ph.predicted) return; (byPh[ph.key] = byPh[ph.key] || []).push(e1rm(l.w, l.r) / med[l.ex]); });
  const phAvg = Object.keys(byPh).filter(k => byPh[k].length >= 6).map(k => [k, (byPh[k].reduce((a, b) => a + b, 0) / byPh[k].length - 1) * 100, byPh[k].length]);
  if (phAvg.length >= 2) {
    const best = phAvg.slice().sort((a, b) => b[1] - a[1])[0], worst = phAvg.slice().sort((a, b) => a[1] - b[1])[0];
    res.perf = phAvg;
    if (best[1] - worst[1] >= 3) res.notes.push({ ico: '🏋️', text: `Tu rendimiento registrado fue ${fmt(best[1] - worst[1], 0)} % mayor en "${CYC_PHASES[best[0]].name}" que en "${CYC_PHASES[worst[0]].name}" (con ${best[2]} y ${worst[2]} series). Es una observación de tus datos, no una regla.` });
    else res.notes.push({ ico: '〰️', text: 'Tu rendimiento es parecido en todas las fases: el ciclo no parece cambiar tu fuerza de forma notable.' });
  }
  return res;
}

/* ------------------------------------------------------------------ *
 *  Ajuste del chequeo de recuperación con lo que registró hoy
 * ------------------------------------------------------------------ */
/** Se llama desde readiness(): solo reacciona a síntomas registrados, nunca a la fase por sí sola. */
function cycleReadiness(add) {
  if (!cycleUseReco()) return;   // 12.0: solo con permiso explícito
  const t = todayStr(), c = cycDay(t);
  if (c) {
    if (c.pain >= 2) add(c.pain === 3 ? -20 : -10, '🌀', `Cólicos ${c.pain === 3 ? 'fuertes' : 'moderados'} hoy`, 'tu registro del ciclo');
    if (c.sym && c.sym.includes('fatiga')) add(-5, '🥱', 'Registraste cansancio', 'tu registro del ciclo');
  }
  const bad = lastDays(4).filter(d => { const r = DB.days[d] && DB.days[d].rec; return r && r.sleepQ != null && r.sleepQ <= 2; }).length;
  if (bad >= 3) add(-10, '😴', `${bad} de los últimos 4 días con mal sueño: prioriza recuperar`, 'tu historial');
}

/* ------------------------------------------------------------------ *
 *  Pantallas
 * ------------------------------------------------------------------ */
function cycleCard() {
  if (!cycleOnHome()) return '';
  const st = cycStats(), t = todayStr(), ph = phaseOn(t, st), c = cycDay(t);
  if (!st.last) return `<div class="card cyc-card open"><h2>Tu ciclo</h2><p class="small muted" style="margin-top:0">Registra el primer día de tu última regla para empezar. Con cada ciclo aprenderé tus patrones.</p>
    <div class="row"><button id="cy-start" style="flex:1">🩸 Me bajó hoy</button><button class="secondary" id="cy-past" style="flex:1">Fue otro día</button></div></div>`;
  const P = CYC_PHASES[ph.key], pat = cyclePatterns();
  const upcoming = ph.untilNext <= 5 ? pat.notes.filter(n => n.ico === '🌘' || n.ico === '🔁') : [];
  return `<div class="card cyc-card ${P.cls}" data-fold-title="Tu ciclo" data-fold-sum="Día ${ph.n} · ${P.name.split(' (')[0]} · próxima regla ~${shortDate(st.next)}" data-fold-ico="${P.ico}" ${upcoming.length ? '' : ''}>
    <div class="row spread"><div><div class="small muted">Día ${ph.n} de tu ciclo · <span class="tag-reg">desde tu último registro</span></div><h2 style="margin:0">${P.ico} ${P.name}</h2><span class="tag-est">fase estimada</span></div>
      <button class="secondary small-btn" id="cy-log">${c ? '✓ Editar hoy' : '+ ¿Cómo estás?'}</button></div>
    <p class="small" style="margin:8px 0 4px">Próxima regla <span class="tag-est">estimación</span>: <b>${shortDate(addDays(st.next, -st.margin))} – ${shortDate(addDays(st.next, st.margin))}</b> <span class="muted">(lo más probable ${shortDate(st.next)}${st.confident ? '' : ', estimación con pocos datos'})</span></p>
    ${upcoming.length ? `<div class="status info"><b>Lo que has visto estos días en ciclos anteriores</b>${esc(upcoming.map(n => n.text).join(' '))} Si vuelve a pasar, puedes planear una sesión flexible. No es obligatorio bajar la intensidad: decide según cómo te sientas.</div>` : ''}
    <div class="row" style="margin-top:8px"><button class="ghost small-btn" id="cy-start">🩸 Me bajó hoy</button><button class="ghost small-btn" id="cy-cal">📅 Calendario e informe</button></div>
  </div>`;
}
function bindCycleCard(root, rerender) {
  const s = $('#cy-start', root); if (s) s.onclick = () => { const d = day(todayStr()); d.cyc = Object.assign({ pain: 0, sym: [], energy: 3, mood: 3, sleepQ: 3 }, d.cyc || {}, { flow: Math.max(2, (d.cyc && d.cyc.flow) || 0) }); saveData(); rerender(); toast('🩸 Registrado: día 1 de tu ciclo'); };
  const p = $('#cy-past', root); if (p) p.onclick = () => openModal(`<h3>¿Qué día empezó tu última regla?</h3><label>Fecha<input type="date" id="cy-d" max="${todayStr()}" value="${addDays(todayStr(), -7)}"></label><button class="block" id="cy-ok">Guardar</button>`, m => {
    $('#cy-ok', m).onclick = () => { const v = $('#cy-d', m).value; if (!v) return; day(v).cyc = { flow: 3, pain: 0, sym: [], energy: 3, mood: 3, sleepQ: 3 }; saveData(); closeModal(); rerender(); };
  });
  const l = $('#cy-log', root); if (l) l.onclick = () => openCycleDay(todayStr(), rerender);
  const c = $('#cy-cal', root); if (c) c.onclick = () => { progMode = 'ciclo'; showTab('progress'); };
}

let cycMonth = null;
function renderCycle(el) {
  const st = cycStats(), t = todayStr();
  if (!cycMonth) cycMonth = t.slice(0, 7);
  const [y, mo] = cycMonth.split('-').map(Number), first = new Date(y, mo - 1, 1), daysIn = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7, cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  for (let d = 1; d <= daysIn; d++) {
    const date = `${cycMonth}-${String(d).padStart(2, '0')}`, ph = st.last ? phaseOn(date, st) : null, c = cycDay(date);
    const inPred = st.next && date >= addDays(st.next, -st.margin) && date <= addDays(st.next, st.margin) && date > t;
    cells.push(`<button class="cal-d ${ph ? CYC_PHASES[ph.key].cls : ''} ${ph && ph.predicted ? 'pred' : ''} ${inPred ? 'window' : ''} ${date === t ? 'today' : ''}" data-cday="${date}">${d}${c && c.flow ? '<i>🩸</i>' : c ? '<i class="dot"></i>' : ''}</button>`);
  }
  const pat = cyclePatterns(), alerts = cycleAlerts();
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const ph = st.last ? phaseOn(t, st) : null;
  el.innerHTML = `
    <div class="card">
      <div class="row spread"><button class="icon-btn" id="cal-prev">‹</button><h2 style="margin:0">${MESES[mo - 1]} ${y}</h2><button class="icon-btn" id="cal-next">›</button></div>
      <div class="cal-grid cal-head">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <div class="legend" style="justify-content:center">${Object.keys(CYC_PHASES).map(k => `<span><i class="${CYC_PHASES[k].cls}"></i>${CYC_PHASES[k].name.replace(' (estimada)', '')}</span>`).join('')}<span><i class="pred-sw"></i>Estimado</span><span>🩸 Registrado</span></div>
      <p class="small muted" style="margin:8px 0 0">Toca un día para registrar cómo te sentiste. ${st.last ? `Ciclo medio: <b>${Math.round(st.avg)} días</b>${st.sd != null ? ` (±${fmt(st.sd, 1)})` : ''} · regla ~${st.P} días.` : ''}</p>
    </div>
    ${ph ? `<div class="card ${CYC_PHASES[ph.key].cls}">
      <h2>${CYC_PHASES[ph.key].ico} Hoy: ${CYC_PHASES[ph.key].name}</h2>
      <p class="small" style="margin-top:0">${esc(CYC_PHASES[ph.key].text)}</p>
      <p class="small"><b>Qué observar:</b> ${esc(CYC_PHASES[ph.key].observe)}</p>
      <p class="small"><b>Entrenamiento:</b> ${esc(CYC_PHASES[ph.key].train)}</p>
    </div>` : ''}
    <div class="card">
      <h2>Tu informe <small>· patrones personales</small></h2>
      ${pat.notes.length ? pat.notes.map(n => `<div class="why-row"><span>${n.ico}</span><span>${esc(n.text)}</span><span></span></div>`).join('')
        : `<p class="small muted" style="margin:0">${st.starts.length < 3 ? `Necesito al menos 2 ciclos completos con registros (llevas ${Math.max(0, st.starts.length - 1)}). Registra unos segundos al día: energía, sueño, ánimo y síntomas.` : 'Aún no aparecen patrones claros en tus registros. Eso también es información: tu ciclo no parece cambiar mucho cómo te sientes.'}</p>`}
      <p class="small muted" style="margin:8px 0 0">Esto describe tus registros; no es un diagnóstico.</p>
    </div>
    ${alerts.length ? `<div class="card"><h2>Para comentar con un profesional</h2>${alerts.map(a => `<p class="small" style="margin:6px 0">⚠️ ${esc(a.text)}</p>`).join('')}</div>` : ''}
    <div class="card">
      <h2>Entrena según cómo te sientes</h2>
      <table><tbody>
        <tr><td>⚡ Energía alta y buena recuperación</td><td class="small">Sigue el plan y, si corresponde, persigue tu misión de progreso.</td></tr>
        <tr><td>😐 Energía moderada</td><td class="small">Mantén el plan o ajusta el volumen según tu experiencia.</td></tr>
        <tr><td>🌀 Cólicos o fatiga</td><td class="small">Sesión más ligera, movilidad o descanso.</td></tr>
        <tr><td>😴 Varios días de mal sueño</td><td class="small">Revisa la carga y prioriza la recuperación.</td></tr>
        <tr><td>⚠️ Síntomas intensos o inusuales</td><td class="small">Consulta a un profesional de salud.</td></tr>
      </tbody></table>
      <p class="small muted" style="margin:8px 0 0">La app nunca baja la exigencia solo por estar menstruando: responde a lo que registras en tu chequeo.</p>
    </div>
    <p class="small muted">${esc(CYC_CAVEAT)}${DB.profile.cycleHormonal ? ' Indicaste que usas anticoncepción hormonal: las fases pueden no aplicar; los registros de cómo te sientes siguen siendo útiles.' : ''}</p>`;
  $('#cal-prev').onclick = () => { const d = new Date(y, mo - 2, 1); cycMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); renderProgress(); };
  $('#cal-next').onclick = () => { const d = new Date(y, mo, 1); cycMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); renderProgress(); };
  $$('[data-cday]', el).forEach(b => b.onclick = () => { if (b.dataset.cday > t) { const p = phaseOn(b.dataset.cday, st); if (p) openModal(`<h3>${CYC_PHASES[p.key].ico} ${longDate(b.dataset.cday)}</h3><p class="small">${CYC_PHASES[p.key].name} (estimado, día ${p.n}).</p><p class="small">${esc(CYC_PHASES[p.key].observe)}</p><p class="small muted">${esc(CYC_CAVEAT)}</p><button class="block" id="cx">Entendido</button>`, m => { $('#cx', m).onclick = closeModal; }); return; } openCycleDay(b.dataset.cday, renderProgress); });
}

/* ------------------------------------------------------------------ *
 *  12.0 · Privacidad desde el diseño: consentimiento, permisos separados y borrado
 * ------------------------------------------------------------------ */
function cycleUseReco() { return cycleOn() && DB.profile.cycleUseReco !== false; }
function cycleOnHome() { return cycleOn() && DB.profile.cycleHome !== false; }
function cycleExportOn() { return cycleOn() && DB.profile.cycleExport === true; }
function hasCycleData() { return Object.keys(DB.days).some(d => DB.days[d].cyc); }
/** Consentimiento explícito antes de activar: qué se guarda, dónde, para qué y qué controlas. */
function openCycleConsent(after) {
  const p = DB.profile;
  openModal(`<h3>🌙 Seguimiento del ciclo</h3>
    <p class="small" style="margin-top:0">Antes de activarlo, esto es lo que hace con tus datos:</p>
    <ul class="small" style="padding-left:18px;margin:0 0 10px">
      <li><b>Qué guarda:</b> solo lo que tú registres: días de sangrado, cólicos, energía, sueño, ánimo, síntomas y notas.</li>
      <li><b>Dónde:</b> únicamente en este teléfono. Sin cuenta, sin servidores, nadie más lo ve.</li>
      <li><b>Para qué:</b> estimar tu próxima regla con su margen y mostrarte tus propios patrones.</li>
      <li><b>Tú controlas:</b> no se incluye en exportaciones salvo que lo actives, y puedes borrarlo todo cuando quieras.</li>
    </ul>
    <label class="check"><input type="checkbox" id="cc-reco" ${p.cycleUseReco !== false ? 'checked' : ''}> <span>Usar mis síntomas registrados para ajustar el chequeo de entrenamiento</span></label>
    <label class="check"><input type="checkbox" id="cc-home" ${p.cycleHome === true ? 'checked' : ''}> <span>Mostrar la tarjeta del ciclo en Inicio</span></label>
    <p class="small muted">No es un método anticonceptivo ni una herramienta de diagnóstico.</p>
    <div class="row"><button class="secondary" id="cc-no" style="flex:1">Ahora no</button><button id="cc-yes" style="flex:1">Activar</button></div>`, m => {
    $('#cc-no', m).onclick = () => { DB.profile.cycleOn = false; saveData(); closeModal(); if (after) after(); };
    $('#cc-yes', m).onclick = () => {
      Object.assign(DB.profile, { cycleOn: true, cycleConsent: todayStr(), cycleUseReco: $('#cc-reco', m).checked, cycleHome: $('#cc-home', m).checked, cycleExport: DB.profile.cycleExport === true });
      saveData(); closeModal(); toast('🌙 Seguimiento del ciclo activado');
      if (after) after();
    };
  });
}
function deleteCycleData() {
  Object.keys(DB.days).forEach(d => { delete DB.days[d].cyc; });
  ['cycleLen', 'periodLen', 'cycleHormonal'].forEach(k => delete DB.profile[k]);
  saveData();
}
function cycleSettingsCard() {
  const p = DB.profile;
  return `<div class="card">
    <h2>Ciclo menstrual <small>· opcional y privado</small></h2>
    <p class="small muted" style="margin-top:0">Tus datos del ciclo se quedan solo en este teléfono.${p.cycleConsent ? ' Activado con tu consentimiento el ' + longDate(p.cycleConsent) + '.' : ''}</p>
    <label class="habit"><input type="checkbox" id="cy-on" ${p.cycleOn ? 'checked' : ''}> Seguimiento del ciclo activado</label>
    ${p.cycleOn ? `<label class="habit"><input type="checkbox" id="cy-reco" ${cycleUseReco() ? 'checked' : ''}> Usar mis síntomas en el chequeo de entrenamiento</label>
    <label class="habit"><input type="checkbox" id="cy-home" ${cycleOnHome() ? 'checked' : ''}> Mostrar en Inicio</label>
    <label class="habit"><input type="checkbox" id="cy-exp" ${cycleExportOn() ? 'checked' : ''}> Incluir en exportaciones (PDF/Excel)</label>
    <label class="habit"><input type="checkbox" id="cy-horm" ${p.cycleHormonal ? 'checked' : ''}> Uso anticoncepción hormonal (píldora, DIU hormonal, implante…)</label>
    <label>Duración habitual de tu ciclo (días, mientras aprendo el tuyo)<input id="cy-len" inputmode="numeric" value="${p.cycleLen || 28}"></label>` : ''}
    ${hasCycleData() ? '<button class="danger block" id="cy-del" style="margin-top:6px">Borrar todos mis datos del ciclo</button>' : ''}
  </div>`;
}
function bindCycleSettings(root, rerender) {
  const on = $('#cy-on', root);
  if (on) on.onchange = () => {
    if (on.checked) { on.checked = false; openCycleConsent(rerender); return; }
    DB.profile.cycleOn = false; saveData();
    if (hasCycleData() && confirm('Seguimiento desactivado. ¿Quieres borrar también tus datos del ciclo? (Cancelar = conservarlos ocultos)')) { deleteCycleData(); toast('Datos del ciclo borrados'); }
    rerender();
  };
  [['cy-reco', 'cycleUseReco'], ['cy-home', 'cycleHome'], ['cy-exp', 'cycleExport'], ['cy-horm', 'cycleHormonal']].forEach(([id, k]) => { const c = $('#' + id, root); if (c) c.onchange = () => { DB.profile[k] = c.checked; saveData(); rerender(); }; });
  const len = $('#cy-len', root); if (len) len.onchange = () => { const n = num(len.value); if (n >= 15 && n <= 60) { DB.profile.cycleLen = Math.round(n); saveData(); } };
  const del = $('#cy-del', root);
  if (del) del.onclick = () => { if (!confirm('¿Borrar todos tus registros del ciclo? No se puede deshacer.')) return; deleteCycleData(); toast('Datos del ciclo borrados'); rerender(); };
}
