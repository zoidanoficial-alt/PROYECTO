'use strict';
/* =====================================================================
 *  35.0 · Proyecto Atleta: tu transformación en atleta de alto rendimiento (meta: los 40)
 *  - Perfil de capacidades contra rangos ORIENTATIVOS de alto rendimiento (no requisitos oficiales).
 *  - Nada se inventa: cada capacidad dice de dónde sale su dato o que falta medirla.
 *  - No se mejora todo a la vez: plan por años y bloques de 6 semanas con 1 foco principal.
 *  - Las 7 áreas: entrenamiento, alimentación, sueño, recuperación, medicina, psicología, tecnología.
 * ===================================================================== */

function ath() { if (!DB.athlete) DB.athlete = { on: false, start: null, goal: 'ag', med: {}, psy: {}, blocks: {} }; return DB.athlete; }
const athOn = () => !!(DB.athlete && DB.athlete.on);
const ATH_GOALS = { ag: 'Campeón del mundo en mi grupo de edad (40–44)', elite: 'Nivel Elite (los mejores del mundo)', pro: 'Categoría Pro competitiva' };

/* ---------- Estimaciones (con su fórmula) ---------- */
/** VO₂máx estimado (VDOT de Jack Daniels) a partir de una carrera: distancia en m, tiempo en s. */
function vdot(m, s) {
  const t = s / 60, v = m / t;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pct;
}
/** Grasa corporal estimada con RFM (Woolcott y Bergman 2018): 64 − 20 × estatura/cintura (+12 en mujeres). */
const rfm = (h, w, fem) => 64 - 20 * h / w + (fem ? 12 : 0);
function athRuns() {
  const rr = typeof runRecords === 'function' ? runRecords() : {}, rec = (rr && rr.rec) || rr || {};
  return { k5: rec[5] ? rec[5].t : null, k10: rec[10] ? rec[10].t : null, k1: rec[1] ? rec[1].t : null };
}
const athFem = () => DB.profile.sex === 'f';
const scale = (v, lo, hi) => Math.max(0, Math.min(100, Math.round((v - lo) / (hi - lo) * 100)));

/** Las 9 capacidades: valor, rango objetivo, avance hacia el rango (0–100) y fuente. */
function athCapacities() {
  const f = athFem(), R = athRuns(), out = [];
  const tf = f ? 1.12 : 1, vf = f ? 0.88 : 1;   // ajuste orientativo para mujeres
  // VO2máx
  let vo = null, voSrc = null;
  if (R.k10) { vo = vdot(10000, R.k10); voSrc = 'tu mejor 10 km'; }
  if (R.k5) { const v5 = vdot(5000, R.k5); if (!vo || v5 > vo) { vo = v5; voSrc = 'tu mejor 5 km'; } }
  if (!vo && typeof hxCurrent === 'function' && hxCurrent('run1k')) { vo = vdot(1000, hxCurrent('run1k').sec) * 0.93; voSrc = 'tu 1 km fresco (menos preciso)'; }
  out.push({ k: 'vo2', n: 'VO₂máx (estimado)', area: 'Motor', v: vo, show: vo ? fmt(vo, 0) + ' ml/kg/min' : null, target: `${Math.round(60 * vf)}–${Math.round(75 * vf)}+`, score: vo ? scale(vo, 35 * vf, 60 * vf) : null, src: vo ? `Fórmula VDOT de Daniels con ${voSrc}` : 'Corre un 5 km con GPS o registra tu 1 km fresco', block: 'aerobico' });
  out.push({ k: 'k5', n: '5 km', area: 'Motor', v: R.k5, show: R.k5 ? hxT(R.k5) : null, target: `${hxT(900 * tf)}–${hxT(1080 * tf)}`, score: R.k5 ? scale(-R.k5, -1800 * tf, -1080 * tf) : null, src: R.k5 ? 'Tu mejor tramo de 5 km (Running con GPS)' : 'Corre 5 km con el GPS de la app', block: 'aerobico' });
  out.push({ k: 'k10', n: '10 km', area: 'Motor', v: R.k10, show: R.k10 ? hxT(R.k10) : null, target: `${hxT(1860 * tf)}–${hxT(2220 * tf)}`, score: R.k10 ? scale(-R.k10, -3600 * tf, -2220 * tf) : null, src: R.k10 ? 'Tu mejor tramo de 10 km' : 'Corre 10 km con el GPS de la app', block: 'aerobico' });
  // Umbral (ritmo sostenible ~1 h): aprox. ritmo de 10 km × 1.04 o de 5 km × 1.08
  const thr = R.k10 ? R.k10 / 10 * 1.04 : R.k5 ? R.k5 / 5 * 1.08 : null;
  out.push({ k: 'thr', n: 'Umbral (ritmo)', area: 'Motor', v: thr, show: thr ? hxT(thr) + '/km' : null, target: `${hxT(193 * tf)}–${hxT(231 * tf)}/km`, score: thr ? scale(-thr, -360 * tf, -231 * tf) : null, src: thr ? `Estimado: ritmo de ${R.k10 ? '10 km × 1.04' : '5 km × 1.08'}` : 'Necesita un 5 o 10 km', block: 'umbral' });
  // Fuerza relativa
  const st = typeof hxStrength === 'function' ? hxStrength() : null;
  out.push({ k: 'str', n: 'Fuerza relativa', area: 'Fuerza', v: st && st.s, show: st ? st.parts.map(p => `${p.n.split(' ')[0]} ${fmt(p.rel, 2)}×`).join(' · ') : null, target: f ? 'sentadilla 1.25× · peso muerto 1.75× tu peso' : 'sentadilla 1.5× · peso muerto 2× tu peso', score: st ? Math.min(100, Math.round(st.s * 1.15)) : null, src: st ? 'Máximo estimado de tus series de los últimos 90 días ÷ tu peso' : 'Registra sentadilla o peso muerto en tus entrenos', block: 'fuerza' });
  // Resistencia muscular: mejora en tus pruebas
  const rt = DB.resist && DB.resist.tests ? DB.resist.tests : [];
  const firstLast = k => { const t = rt.filter(x => x.kind === k); return t.length ? [t[0].value, Math.max(...t.map(x => x.value))] : null; };
  const rep = firstLast('rep60') || firstLast('pushups');
  out.push({ k: 'mend', n: 'Resistencia muscular', area: 'Fuerza', v: rep && rep[1], show: rep ? `${rep[1]} reps${rep[1] > rep[0] ? ` (+${Math.round((rep[1] / rep[0] - 1) * 100)} %)` : ''}` : null, target: '+50–90 % en reps al 60 % tras varios bloques', score: rep ? Math.min(100, Math.round((rep[1] / rep[0] - 1) * 110 + 20)) : null, src: rep ? 'Tus pruebas de Resistencia' : 'Haz tus pruebas en Resistencia', block: 'resmusc' });
  // Composición corporal
  const h = Number(DB.profile.height), wm = (DB.measures || []).filter(m => m.waist).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const bf = h && wm ? rfm(h, wm.waist, f) : null;
  out.push({ k: 'bf', n: 'Grasa corporal (estimada)', area: 'Físico', v: bf, show: bf ? fmt(bf, 1) + ' %' : null, target: f ? '16–22 %' : '8–12 %', score: bf ? scale(-bf, f ? -36 : -28, f ? -22 : -12) : null, src: bf ? `Fórmula RFM con tu cintura (${fmt(wm.waist, 1)} cm, ${shortDate(wm.date)}) y estatura` : 'Registra tu cintura en Progreso → Medidas', block: 'aerobico' });
  // Recuperación: pulso en reposo (media 7 días) y HRV
  const rh = [], hv = []; for (let i = 0; i < 7; i++) { const r = DB.days[addDays(todayStr(), -i)] && DB.days[addDays(todayStr(), -i)].rec; if (r && r.rhr) rh.push(r.rhr); if (r && r.hrv) hv.push(r.hrv); }
  const rhr = rh.length >= 3 ? rh.reduce((a, b) => a + b, 0) / rh.length : null;
  out.push({ k: 'rec', n: 'Pulso en reposo', area: 'Recuperación', v: rhr, show: rhr ? Math.round(rhr) + ' lpm' + (hv.length >= 3 ? ` · HRV ${Math.round(hv.reduce((a, b) => a + b, 0) / hv.length)} ms` : '') : null, target: '40–55 lpm', score: rhr ? scale(-rhr, -75, -55) : null, src: rhr ? 'Media de 7 días (reloj o chequeo diario)' : 'Conecta tu reloj o llena el chequeo diario 3+ días', block: 'aerobico' });
  // Fatiga repetida / esfuerzos repetidos: caída de ritmo bajo fatiga (RDI de HYROX)
  const fat = typeof hxFatigue === 'function' ? hxFatigue() : null;
  out.push({ k: 'rep', n: 'Repetir esfuerzos', area: 'Fuerza', v: fat && fat.rdi, show: fat ? `caída ${fmt(fat.rdi, 1)} % bajo fatiga` : null, target: 'caída ≤ 5 %', score: fat ? scale(-fat.rdi, -25, -5) : null, src: fat ? 'Running bajo fatiga de HYROX Lab' : 'Mide un 1 km después de una estación', block: 'especifico' });
  return out;
}

/* ---------- Plan hasta los 40: años y bloques ---------- */
const ATH_PHASES = [
  { k: 'fund', n: 'Fundamentos', d: 'Base aeróbica, fuerza general, técnica y composición corporal.', blocks: ['aerobico', 'fuerza', 'aerobico', 'resmusc', 'transicion'] },
  { k: 'cons', n: 'Construcción', d: 'Umbral alto y resistencia muscular sobre una base sólida.', blocks: ['aerobico', 'umbral', 'fuerza', 'resmusc', 'transicion'] },
  { k: 'espe', n: 'Especialización', d: 'HYROX específico: correr bajo fatiga y repetir esfuerzos.', blocks: ['umbral', 'especifico', 'fuerza', 'especifico', 'transicion'] },
  { k: 'rend', n: 'Rendimiento', d: 'Competir para clasificar: picos de forma y calendario.', blocks: ['especifico', 'pico', 'aerobico', 'especifico', 'transicion'] }
];
const ATH_BLOCKS = {
  aerobico: { n: 'Motor aeróbico', main: 'VO₂máx y base en zona 2', keep: 'fuerza 1×/sem', how: 'Tiradas largas, zona 2 y un tempo por semana (método Rončević).', method: 'roncevic' },
  fuerza: { n: 'Fuerza', main: 'fuerza máxima y piernas', keep: 'zona 2 2×/sem', how: 'Bloque de fuerza (método McIntyre) + Resistencia B dos veces por semana.', method: 'mcintyre' },
  umbral: { n: 'Umbral', main: 'sostener ritmo alto', keep: 'fuerza 1×/sem', how: 'Días altos y bajos: umbral sobre piernas cansadas (método Wenisch).', method: 'wenisch' },
  resmusc: { n: 'Resistencia muscular', main: 'repeticiones y densidad', keep: 'zona 2 2×/sem', how: 'Programa de Resistencia de 6 semanas (A, B y C).', resist: true },
  especifico: { n: 'Específico HYROX', main: 'correr bajo fatiga y repetir esfuerzos', keep: 'fuerza 1×/sem', how: 'Running bajo fatiga y simulaciones (método Wietrzyk).', method: 'wietrzyk' },
  pico: { n: 'Pico y competencia', main: 'llegar fresco a la carrera objetivo', keep: 'todo en dosis bajas', how: 'Taper y carrera: usa Competiciones para fijar tu objetivo.' },
  transicion: { n: 'Transición', main: 'recuperar cuerpo y cabeza', keep: 'moverte suave', how: '1–2 semanas suaves, chequeo médico y revisión del año.' }
};
function athPlan() {
  const a = ath(), age = Number(DB.profile.age) || 30, years = Math.max(1, 40 - age);
  const yrs = Array.from({ length: years }, (_, i) => { const ph = ATH_PHASES[Math.min(ATH_PHASES.length - 1, Math.floor(i / years * ATH_PHASES.length))]; return { y: i + 1, age: age + i, ph }; });
  if (years >= 2) yrs[yrs.length - 1].ph = ATH_PHASES[3];
  const start = a.start || todayStr(), w = Math.max(0, Math.floor(daysBetween(start, todayStr()) / 7));
  const yearIdx = Math.min(yrs.length - 1, Math.floor(w / 52)), wy = w % 52, blkIdx = Math.min(Math.floor(wy / 6), 7);
  const ph = yrs[yearIdx].ph, seq = ph.blocks.concat(ph.blocks).slice(0, 8);
  let cur = seq[blkIdx];
  // El foco del bloque se ajusta a tu brecha más grande si es del mismo "tipo" de fase (fundamentos/construcción).
  const caps = athCapacities().filter(c => c.score != null).sort((x, y) => x.score - y.score);
  let note = null;
  if (cur !== 'transicion' && cur !== 'pico' && caps[0] && caps[0].score < 40 && ['fund', 'cons'].includes(ph.k) && caps[0].block !== cur && ['aerobico', 'fuerza', 'resmusc', 'umbral'].includes(caps[0].block)) {
    note = `Tu brecha más grande es ${caps[0].n}: este bloque la prioriza.`; cur = caps[0].block;
  }
  return { years, yrs, yearIdx, week: w + 1, blkIdx, cur, seq, ph, note, weekInBlock: (wy % 6) + 1, age };
}

/* ---------- Las 7 áreas ---------- */
const ATH_MED = [['medico', 'Chequeo médico deportivo', 365], ['ecg', 'Electrocardiograma (y prueba de esfuerzo si te la indican)', 365], ['sangre', 'Análisis de sangre (hierro, vitamina D, perfil general)', 180], ['fisio', 'Revisión con fisioterapeuta', 180]];
const ATH_PSY = [['viz', 'Visualicé mi carrera o mi sesión clave'], ['plan', 'Escribí mi plan de carrera (ritmos y sets)'], ['ritual', 'Practiqué mi rutina previa a competir'], ['review', 'Revisé qué salió bien y qué ajustar']];
function athWeekKey() { const t = todayStr(), dow = (parseDate(t).getDay() + 6) % 7; return addDays(t, -dow); }
function athAreas() {
  const t = todayStr(), a = ath(), out = [];
  const sess = DB.sessions.filter(s => s.end && s.date >= addDays(t, -27)).length + ((DB.hyrox && DB.hyrox.sessions) || []).filter(s => s.date >= addDays(t, -27)).length + (DB.runs || []).filter(r => r.date >= addDays(t, -27)).length;
  out.push({ k: 'train', n: 'Entrenamiento', ico: 'dumbbell', v: `${sess} sesiones en 4 semanas`, st: sess >= 16 ? 'ok' : sess >= 8 ? 'warn' : 'bad', next: sess >= 16 ? 'Constancia de atleta: mantén el plan del bloque.' : 'Un atleta entrena 4–6 días: completa las sesiones de tu bloque.' });
  let foodDays = 0, protOk = 0; const tg = typeof targets === 'function' ? targets() : null;
  for (let i = 0; i < 7; i++) { const d = addDays(t, -i), tot = typeof dayTotals === 'function' ? dayTotals(d) : null; if (tot && tot.kcal > 0) { foodDays++; if (tg && tot.p >= tg.protein * 0.9) protOk++; } }
  out.push({ k: 'food', n: 'Alimentación', ico: 'utensils', v: `${foodDays}/7 días registrados · proteína ${protOk}/7`, st: protOk >= 5 ? 'ok' : foodDays >= 3 ? 'warn' : 'bad', next: protOk >= 5 ? 'Combustible según la carga: más carbohidratos en días duros.' : 'Registra tus comidas y llega a tu proteína al menos 5 días.' });
  const sl = []; for (let i = 0; i < 7; i++) { const r = DB.days[addDays(t, -i)] && DB.days[addDays(t, -i)].rec; if (r && r.sleepH != null) sl.push(r.sleepH); }
  const sAvg = sl.length ? sl.reduce((x, y) => x + y, 0) / sl.length : null;
  out.push({ k: 'sleep', n: 'Sueño', ico: 'moon', v: sAvg != null ? `${fmt(sAvg)} h de media` : 'sin datos', st: sAvg == null ? 'bad' : sAvg >= 7.5 ? 'ok' : sAvg >= 6.5 ? 'warn' : 'bad', next: sAvg != null && sAvg >= 7.5 ? 'Prioridad absoluta cumplida.' : 'Prioridad absoluta: 7.5–9 h. Misma hora de dormir y luz de mañana.' });
  const rd = typeof readiness === 'function' ? readiness() : null, en = typeof bodyEnergy === 'function' ? bodyEnergy() : null;
  out.push({ k: 'rec', n: 'Recuperación', ico: 'bed', v: en ? `energía ${en.v}` : rd ? `chequeo ${rd.score}` : 'sin chequeo hoy', st: en ? (en.v >= 60 ? 'ok' : en.v >= 40 ? 'warn' : 'bad') : rd ? (rd.score >= 70 ? 'ok' : 'warn') : 'warn', next: 'Gestiona la fatiga: días fáciles fáciles y semana de descarga cada 4–6.' });
  const due = ATH_MED.filter(([k, , days]) => !a.med[k] || daysBetween(a.med[k], t) > days);
  out.push({ k: 'med', n: 'Medicina deportiva', ico: 'heart-pulse', v: due.length ? `${due.length} pendiente(s)` : 'al día', st: !due.length ? 'ok' : due.length <= 2 ? 'warn' : 'bad', next: due.length ? `Siguiente: ${due[0][1]}.` : 'Prevención al día.' });
  const wk = a.psy[athWeekKey()] || [];
  out.push({ k: 'psy', n: 'Psicología', ico: 'brain', v: `${wk.length}/4 prácticas esta semana`, st: wk.length >= 3 ? 'ok' : wk.length >= 1 ? 'warn' : 'bad', next: 'Preparación competitiva: visualiza, planea y repasa cada semana.' });
  const w = DB.watch || {};
  const tech = (w.hcOn ? 1 : 0) + (w.hrDev ? 1 : 0) + (w.remoteOk ? 1 : 0);
  out.push({ k: 'tech', n: 'Tecnología', ico: 'activity', v: `${tech}/3 conectado`, st: tech >= 2 ? 'ok' : tech === 1 ? 'warn' : 'bad', next: tech >= 2 ? 'Tus métricas llegan solas.' : 'Conecta Mi Fitness y un sensor de pulso en Mi reloj.' });
  return out;
}

/* ---------- Tarjeta en Hoy ---------- */
function athCard() {
  if (!athOn()) return `<button class="card keep ath-cta" id="ath-open"><div class="hx-eyebrow">PROYECTO ATLETA</div><b>Conviértete en atleta de alto rendimiento</b><small class="muted">Tu perfil de capacidades, tus 7 áreas y un plan por bloques hasta los 40.</small>${ico('chevron-right', 18)}</button>`;
  const P = athPlan(), B = ATH_BLOCKS[P.cur], caps = athCapacities(), measured = caps.filter(c => c.score != null);
  const avg = measured.length ? Math.round(measured.reduce((a, c) => a + c.score, 0) / measured.length) : null;
  const yearsLeft = Math.max(0, 40 - P.age);
  return `<button class="card keep ath-card" id="ath-open"><div class="hx-eyebrow">PROYECTO ATLETA · ${yearsLeft ? `${yearsLeft} AÑO${yearsLeft > 1 ? 'S' : ''} PARA LOS 40` : 'TU AÑO 40'}</div>
    <div class="ath-row"><div><small>Bloque actual · semana ${P.weekInBlock}/6</small><b>${esc(B.n)}</b><span>${esc(P.ph.n)} · año ${P.yearIdx + 1} de ${P.years}</span></div>
    <div class="ath-ring" style="--p:${avg || 0}"><b>${avg != null ? avg : '—'}</b><small>perfil</small></div></div></button>`;
}
function bindAthCard(root) { const b = $('#ath-open', root); if (b) b.onclick = () => openAthlete(); }

/* ---------- Pantalla principal ---------- */
function openAthlete() {
  const a = ath();
  if (!a.on) return openAthSetup();
  const P = athPlan(), B = ATH_BLOCKS[P.cur], caps = athCapacities(), areas = athAreas();
  const measured = caps.filter(c => c.score != null), avg = measured.length ? Math.round(measured.reduce((x, c) => x + c.score, 0) / measured.length) : null;
  const gaps = measured.slice().sort((x, y) => x.score - y.score).slice(0, 2);
  openModal(`<div class="hx-eyebrow">PROYECTO ATLETA · ${esc(ATH_GOALS[a.goal].toUpperCase())}</div>
    <div class="hx-count"><b class="t-display-l">${Math.max(0, 40 - P.age)}</b><span>años para<br>tus 40</span></div>
    <div class="ld-next"><small>BLOQUE ACTUAL · SEMANA ${P.weekInBlock} DE 6 · ${esc(P.ph.n.toUpperCase())}</small><b>${esc(B.n)}: ${esc(B.main)}</b><span>${esc(B.how)} Mantener: ${esc(B.keep)}.${P.note ? ' ' + esc(P.note) : ''}</span></div>
    <button class="block" id="ath-apply">${B.method || B.resist ? 'Activar este bloque en mi plan' : 'Ver qué hacer en este bloque'}</button>
    <div class="rir-label"><span>Tu perfil de atleta ${avg != null ? '· ' + avg + '/100' : ''}</span></div>
    <p class="small muted" style="margin-top:0">Rangos orientativos de alto rendimiento, no requisitos oficiales. La barra muestra cuánto te acercas al rango.</p>
    <div class="ath-caps">${caps.map(c => `<div class="ath-cap${c.score == null ? ' none' : ''}"><div class="row spread"><b>${esc(c.n)}</b><span>${c.show ? esc(c.show) : 'sin medir'}</span></div>
      <span class="hx-bar wide"><i style="width:${c.score || 0}%"></i></span><small>Meta: ${esc(c.target)} · ${esc(c.src)}</small></div>`).join('')}</div>
    ${gaps.length ? `<p class="small"><b>Tus brechas más grandes:</b> ${gaps.map(g => esc(g.n)).join(' y ')}. No se trabajan todas a la vez: el plan las ataca por bloques.</p>` : '<p class="small">Mide tus capacidades (5 km, fuerza, cintura, pruebas de resistencia) para ver tus brechas.</p>'}
    <div class="rir-label"><span>Tus 7 áreas</span></div>
    <div class="ath-areas">${areas.map(x => `<button class="ath-area ${x.st}" data-area="${x.k}">${ico(x.ico, 20)}<span class="grow"><b>${esc(x.n)}</b><small>${esc(x.v)}</small></span><i></i></button>`).join('')}</div>
    <div class="rir-label"><span>Tu camino hasta los 40</span></div>
    <div class="ath-years">${P.yrs.map((y, i) => `<div class="${i === P.yearIdx ? 'now' : i < P.yearIdx ? 'done' : ''}"><small>Año ${y.y} · ${y.age} años</small><b>${esc(y.ph.n)}</b><span>${esc(y.ph.d)}</span></div>`).join('')}</div>
    <div class="ath-blocks">${P.seq.map((k, i) => `<span class="${i === P.blkIdx ? 'now' : i < P.blkIdx ? 'done' : ''}">${esc(ATH_BLOCKS[k].n)}</span>`).join('')}</div>
    <p class="small muted">Cada año: 8 bloques de 6 semanas y transición. En HYROX los campeonatos del mundo tienen grupos de edad (por ejemplo 40–44): llegar a los 40 en tu mejor forma es una meta concreta.</p>
    <button class="ghost block" id="ath-cfg">Ajustar mi proyecto</button><button class="ghost block" id="ath-x">Cerrar</button>`, m => {
    $('#ath-apply', m).onclick = () => athApplyBlock(P.cur);
    $$('[data-area]', m).forEach(b => b.onclick = () => openAthArea(b.dataset.area));
    $('#ath-cfg', m).onclick = () => openAthSetup();
    $('#ath-x', m).onclick = () => { closeModal(); render(currentTab); };
  });
}
function athApplyBlock(k) {
  const B = ATH_BLOCKS[k];
  if (B.resist) { if (!DB.resist || !DB.resist.start) { resState().start = todayStr(); saveData(); } openResist(); return; }
  if (B.method && typeof hxOn === 'function' && hxOn()) { hx().profile.method = B.method; hx().profile.methodStart = todayStr(); saveData(); toast(`Bloque ${B.n}: método ${CHAMPS[B.method].short} activado en HYROX Lab`); closeModal(); showTab('hyrox'); return; }
  if (B.method) { toast('Configura tu carrera en HYROX Lab para activar el método'); closeModal(); showTab('hyrox'); return; }
  if (k === 'pico') { openEvents(); return; }
  toast('Transición: semana suave, chequeo médico y revisión del año'); openAthArea('med');
}
function openAthArea(k) {
  const a = ath(), x = athAreas().find(z => z.k === k);
  let body = `<p class="small">${esc(x.next)}</p>`;
  if (k === 'med') body += `<div class="kit-list">${ATH_MED.map(([id, n, days]) => { const d = a.med[id], over = !d || daysBetween(d, todayStr()) > days; return `<button class="kit-item" data-med="${id}"><span class="grow"><b>${esc(n)}</b><small>${d ? 'Último: ' + longDate(d) : 'Sin registro'} · cada ${days === 365 ? 'año' : '6 meses'}</small></span><span class="pf-tag ${over ? '' : 'ok'}">${over ? 'pendiente' : 'al día'}</span></button>`; }).join('')}</div><p class="small muted">Toca para marcar que lo hiciste hoy. La app no sustituye a tu médico: un electrocardiograma es la base antes de entrenar a alta intensidad.</p>`;
  if (k === 'psy') { const wk = a.psy[athWeekKey()] || []; body += `<div class="kit-list">${ATH_PSY.map(([id, n]) => `<button class="kit-item" data-psy="${id}"><span class="grow"><b>${esc(n)}</b></span><span class="pf-tag ${wk.includes(id) ? 'ok' : ''}">${wk.includes(id) ? 'hecho' : 'esta semana'}</span></button>`).join('')}</div>`; }
  const links = { train: ['Ir a HYROX Lab', () => { closeModal(); showTab('hyrox'); }], food: ['Ir a Nutrición', () => { closeModal(); showTab('food'); }], sleep: ['Mi reloj (sueño automático)', () => openWatch()], rec: ['Tu cuerpo hoy', () => { closeModal(); showTab('home'); }], tech: ['Conectar Mi reloj', () => openWatch()] }[k];
  openModal(`<h3>${esc(x.n)}</h3><p class="small muted" style="margin-top:0">${esc(x.v)}</p>${body}
    ${links ? `<button class="block" id="aa-go">${links[0]}</button>` : ''}<button class="ghost block" id="aa-x">← Volver</button>`, m => {
    $$('[data-med]', m).forEach(b => b.onclick = () => { a.med[b.dataset.med] = todayStr(); saveData(); openAthArea(k); });
    $$('[data-psy]', m).forEach(b => b.onclick = () => { const wk = a.psy[athWeekKey()] = a.psy[athWeekKey()] || [], id = b.dataset.psy, i = wk.indexOf(id); if (i >= 0) wk.splice(i, 1); else wk.push(id); saveData(); openAthArea(k); });
    const g = $('#aa-go', m); if (g) g.onclick = links[1];
    $('#aa-x', m).onclick = () => openAthlete();
  });
}
function openAthSetup() {
  const a = ath(), p = DB.profile;
  openModal(`<div class="hx-eyebrow">PROYECTO ATLETA</div><h3 style="margin-top:4px">Tu transformación</h3>
    <p class="small muted" style="margin-top:0">El objetivo de la app pasa a ser convertirte en atleta de alto rendimiento: capacidades medidas, 7 áreas y un plan por bloques hasta tus 40.</p>
    <label>Tu edad<input id="as-age" inputmode="numeric" value="${p.age || ''}"></label>
    <label>Tu meta<select id="as-goal">${Object.entries(ATH_GOALS).map(([k, n]) => `<option value="${k}" ${a.goal === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <p class="small muted">Rangos de referencia para hombre de alto rendimiento: VO₂máx 60–75+, 5 km 15–18 min, 10 km 31–37 min. Son orientativos, no requisitos oficiales.</p>
    <button class="block" id="as-s">${a.on ? 'Guardar' : 'Empezar mi transformación'}</button>${a.on ? '<button class="ghost block" id="as-off" style="color:var(--bad)">Pausar el proyecto</button>' : ''}<button class="ghost block" id="as-x">Cancelar</button>`, m => {
    $('#as-s', m).onclick = () => { const age = num($('#as-age', m).value); if (age && age > 10 && age < 90) p.age = Math.round(age); a.goal = $('#as-goal', m).value; if (!a.on) { a.on = true; a.start = todayStr(); } saveData(); openAthlete(); };
    const off = $('#as-off', m); if (off) off.onclick = () => { a.on = false; saveData(); closeModal(); render(currentTab); };
    $('#as-x', m).onclick = () => a.on ? openAthlete() : closeModal();
  });
}
