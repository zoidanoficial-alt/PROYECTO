'use strict';
/* =====================================================================
 *  43.0 · Plan minimalista
 *  Plan → eliges disciplina → eliges cómo competir (por tiempo o por ejercicio) → listo.
 *  - Gimnasio: el Coach IA arma tu rutina con tu objetivo (bajar de peso, masa, fuerza o
 *    resistencia), tus días, tu tiempo, tu equipo y TUS datos (grupos rezagados, ejercicios
 *    estancados). Se recalcula cada 4 semanas o cuando quieras. Funciona sin internet.
 *  - Running y HYROX: su entrenamiento completo vive aquí; la pestaña HYROX queda para
 *    resultados, rankings, HYROX Lab y tus tiempos.
 *  - CrossFit, Spartan, Cardio, Yoga y Pilates: programas con sesiones guiadas (temporizador,
 *    rondas, AMRAP, EMOM, posturas) y récords por sesión o por ejercicio.
 *  El chequeo de hoy y los retos de peso corporal se mudan a Perfil.
 * ===================================================================== */
const DISC = {
  gym: { n: 'Gimnasio', ico: 'dumbbell', d: 'Rutina hecha por tu Coach IA' },
  run: { n: 'Running', ico: 'footprints', d: 'Plan de carrera, GPS y récords' },
  hyrox: { n: 'HYROX', ico: 'timer', d: '8 km + 8 estaciones' },
  spartan: { n: 'Spartan', ico: 'mountain', d: 'Obstáculos: motor, agarre y cargas' },
  crossfit: { n: 'CrossFit', ico: 'flame', d: 'WODs por tiempo, AMRAP y EMOM' },
  cardio: { n: 'Cardio', ico: 'heart-pulse', d: 'Zona 2, intervalos y contrarreloj' },
  yoga: { n: 'Yoga', ico: 'flower-2', d: 'Movilidad, equilibrio y recuperación' },
  pilates: { n: 'Pilates', ico: 'person-standing', d: 'Core, postura y control' }
};
const COMP_TXT = {
  gym: ['Cada entreno contra el reloj: terminarlo completo en menos tiempo.', 'Cada ejercicio guarda su récord: más peso o más reps.'],
  run: ['Tus marcas en 1, 5, 10, 21 y 42 km.', 'Series, intervalos y ritmos de cada sesión.'],
  hyrox: ['Simulaciones completas y tu tiempo final.', 'Cada estación y el 1 km por separado.'],
  def: ['Cada sesión es un récord: terminar más rápido, más rondas o aguantar más.', 'Cada ejercicio guarda su récord: más reps, más peso o más segundos.']
};
const LEVELS = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };

function planState() {
  const p = DB.profile;
  if (!p.plan && window.MP_DEFAULT_PLAN) p.plan = { disc: window.MP_DEFAULT_PLAN, comp: 'ex', days: 3, level: 'intermedio', auto: true };
  if (!p.plan && (DB.sessions.length || (DB.runs || []).length || (typeof hxOn === 'function' && DB.hyrox && hxOn()))) {   // quien ya usaba la app no repite el asistente
    const s = typeof mainSport === 'function' ? mainSport() : '';
    p.plan = { disc: s === 'hyrox' && hxOn() ? 'hyrox' : p.trainMode === 'running' ? 'run' : 'gym', comp: 'ex', days: 3, level: p.level === 'principiante' ? 'principiante' : 'intermedio', auto: true };
  }
  return p.plan || null;
}
function planSetDisc(d) { const p = DB.profile; p.plan = Object.assign(p.plan || { comp: 'time', days: 3, level: 'intermedio' }, { disc: d }); saveData(); }
function compName(pl) { return pl.comp === 'time' ? 'Por tiempo' : 'Por ejercicio'; }

/* ---------- Coach IA (gimnasio) ---------- */
const AI_GOALS = {
  perder: { n: 'Bajar de peso', d: 'Quemar grasa sin perder músculo', ico: 'flame', c: [3, '8–12', 75], a: [3, '12–15', 45], why: 'Bajar de peso: 8–15 reps con descansos cortos para conservar tu músculo; la nutrición marca el déficit y los pasos diarios ayudan (las calorías del ejercicio no se suman a tu presupuesto).' },
  masa: { n: 'Ganar masa muscular', d: 'Hipertrofia: más músculo', ico: 'dumbbell', c: [4, '6–10', 120], a: [3, '10–15', 75], why: 'Masa muscular: 10–20 series por músculo a la semana, 6–15 reps cerca del fallo y cada músculo 2 veces por semana (Schoenfeld 2016 y 2017).' },
  fuerza: { n: 'Crear fuerza', d: 'Levantar más pesado', ico: 'trophy', c: [5, '3–5', 180], a: [3, '6–10', 90], why: 'Fuerza: cargas altas (3–5 reps, ≥ 80 % de tu máximo) en los básicos con barra y descansos de 3 min (ACSM 2009).' },
  resist: { n: 'Resistencia', d: 'Aguantar más y recuperar rápido', ico: 'heart-pulse', c: [3, '12–15', 60], a: [3, '15–20', 40], why: 'Resistencia muscular: 12–20 reps con descansos cortos de 40–60 s (ACSM 2009).' }
};
const AI_DAYS = {
  full: { n: 'Cuerpo completo A', s: ['sentadilla', 'empuje-h', 'remo', 'bisagra', 'empuje-v', 'jalon', 'abdomen'] },
  full2: { n: 'Cuerpo completo B', s: ['zancada', 'empuje-inc', 'jalon', 'gluteo', 'elev-lat', 'curl', 'triceps'] },
  full3: { n: 'Cuerpo completo C', s: ['sentadilla', 'empuje-v', 'remo', 'curl-fem', 'empuje-h', 'deltoide-post', 'abdomen'] },
  upper: { n: 'Torso', s: ['empuje-h', 'remo', 'empuje-v', 'jalon', 'elev-lat', 'curl', 'triceps'] },
  lower: { n: 'Pierna', s: ['sentadilla', 'bisagra', 'zancada', 'curl-fem', 'pantorrilla', 'abdomen'] },
  push: { n: 'Empuje', s: ['empuje-h', 'empuje-inc', 'empuje-v', 'elev-lat', 'triceps', 'apertura'] },
  pull: { n: 'Jalón', s: ['jalon', 'remo', 'remo', 'deltoide-post', 'curl', 'abdomen'] },
  legs: { n: 'Pierna y glúteo', s: ['sentadilla', 'bisagra', 'zancada', 'ext-cuad', 'curl-fem', 'pantorrilla'] }
};
const AI_SPLIT = { 2: ['full', 'full2'], 3: ['full', 'full2', 'full3'], 4: ['upper', 'lower', 'upper', 'lower'], 5: ['upper', 'lower', 'push', 'pull', 'legs'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
const AI_WDAYS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
/** Ejercicio estancado: 4+ sesiones en 6 semanas y sin mejorar su 1RM estimado en las últimas 3. */
function aiStalled(ex) {
  const t = todayStr(), S = DB.lifts.filter(l => l.ex === ex && l.date >= addDays(t, -42) && l.w > 0);
  if (new Set(S.map(l => l.sid || l.date)).size < 4) return false;
  const best = arr => arr.reduce((a, l) => Math.max(a, e1rm(l.w, l.r)), 0), cut = addDays(t, -21);
  const before = best(S.filter(l => l.date < cut)), recent = best(S.filter(l => l.date >= cut));
  return before > 0 && recent > 0 && recent <= before;
}
function aiGymPlan(o) {
  const G = AI_GOALS[o.goal] || AI_GOALS.masa, split = AI_SPLIT[o.days] || AI_SPLIT[3], why = [], notes = [];
  const fam = {}; DB.lifts.forEach(l => { fam[l.ex] = (fam[l.ex] || 0) + 1; });
  const t = todayStr(), gs = {}; DB.lifts.filter(l => l.date >= addDays(t, -14)).forEach(l => { const g = exInfo(l.ex).g; gs[g] = (gs[g] || 0) + 1; });
  const weak = DB.lifts.length >= 30 ? Object.keys(WEEKLY_TARGET).filter(g => (gs[g] || 0) / 2 < WEEKLY_TARGET[g] * 0.5) : [];
  const seen = {}, cnt = {}, est = ex => Math.round(5 + ex.reduce((a, e) => a + e[1] * (e[3] + 40), 0) / 60);
  split.forEach(k => { cnt[k] = (cnt[k] || 0) + 1; });
  const rep = {};
  const workouts = split.map(k => {
    const D = AI_DAYS[k], used = new Set(), ex = [];
    rep[k] = (rep[k] || 0) + 1;
    D.s.forEach(pat => {
      const occ = seen[pat] = (seen[pat] || 0) + 1;
      const cands = Object.keys(EX).filter(n => EX[n].p === pat && !used.has(n) && okForMe(n) && !EX[n].custom).map(n => {
        let sc = (fam[n] ? 3 + Math.min(3, fam[n] / 10) : 0) + (typeof EX_PHOTO === 'object' && EX_PHOTO[n] ? 1 : 0) + (EX[n].t === 'c' ? 1 : 0);
        if (o.goal === 'fuerza' && EX[n].e === 'barra') sc += 3;
        if (o.goal === 'resist' && ['maq', 'polea', 'corporal', 'manc'].includes(EX[n].e)) sc += 1;
        if (o.level === 'principiante' && EX[n].e === 'barra') sc -= 1;
        if (typeof EX_META === 'object' && EX_META[n] && EX_META[n].level === 'Avanzado' && o.level !== 'avanzado') sc -= 4;
        const st = fam[n] && aiStalled(n); if (st) sc -= 6;
        return { n, sc, st };
      }).sort((a, b) => b.sc - a.sc);
      if (!cands.length) return;
      const keep = o.goal === 'fuerza' && EX[cands[0].n].t === 'c';   // en fuerza el básico se repite
      const c = cands[keep ? 0 : (occ - 1) % Math.min(cands.length, 2)];
      const stalledTop = cands.find(x => x.st);
      if (stalledTop && !notes.includes(stalledTop.n)) { notes.push(stalledTop.n); why.push(`Cambié ${stalledTop.n} por ${c.n}: llevas 3 semanas sin subir ahí; una variante nueva vuelve a dar estímulo.`); }
      used.add(c.n);
      const comp = EX[c.n].t === 'c', P = comp ? G.c : G.a;
      let sets = P[0] - (o.level === 'principiante' ? 1 : 0);
      if (weak.includes(EX[c.n].g) && sets < 5) sets++;
      ex.push([c.n, Math.max(2, sets), P[1], P[2]]);
    });
    while (ex.length > 3 && est(ex) > (o.min || 60) + 5) ex.pop();
    if (o.level === 'principiante') while (ex.length > 5) ex.pop();
    const name = cnt[k] > 1 ? D.n.replace(/ [A-C]$/, '') + ' ' + 'AB'[rep[k] - 1] : D.n;
    return { name, ex, min: est(ex) };
  });
  why.unshift(
    `${o.days} días por semana → ${o.days <= 3 ? 'cuerpo completo: cada músculo ' + o.days + ' veces por semana' : o.days === 4 ? 'torso y pierna: cada músculo 2 veces por semana' : o.days === 5 ? 'torso, pierna, empuje, jalón y pierna: 2 veces por semana' : 'empuje, jalón y pierna dos veces por semana'}.`,
    G.why,
    `${o.min} min por sesión → ${Math.round(workouts.reduce((a, w) => a + w.ex.length, 0) / workouts.length)} ejercicios en promedio (≈ ${Math.round(workouts.reduce((a, w) => a + w.min, 0) / workouts.length)} min con calentamiento).`,
    o.level === 'principiante' ? 'Vas empezando → una serie menos y máximo 5 ejercicios: primero la técnica.' : o.level === 'avanzado' ? 'Nivel avanzado → volumen completo; progresa con doble progresión (primero reps, luego peso).' : 'Nivel intermedio → volumen completo con progresión de reps y luego peso.'
  );
  if (weak.length) why.push(`Tus datos de 2 semanas muestran pocos ejercicios de ${weak.map(g => (GROUPS[g] || g).toLowerCase()).slice(0, 3).join(', ')} → les sumé una serie.`);
  if (!DB.lifts.length) why.push('Aún no tengo tus datos: cuando registres tus series, el coach ajusta la rutina con lo que de verdad levantas.');
  return { workouts, why };
}
function aiApply(o) {
  const p = DB.profile, pl = planState() || {};
  if (o.gym && GYM_PRESETS[o.gym]) { p.gym = o.gym; p.equip = GYM_PRESETS[o.gym].equip.slice(); }
  const r = aiGymPlan(o);
  DB.workouts = DB.workouts.filter(w => !w.ai);
  const ids = r.workouts.map(w => { const x = { id: uid(), name: w.name, ex: w.ex, auto: true, ai: true }; DB.workouts.push(x); return x.id; });
  const plan = Array(7).fill(null); (AI_WDAYS[o.days] || AI_WDAYS[3]).forEach((d, i) => { plan[d] = ids[i]; });
  DB.plan = plan; p.routine = 'custom'; p.planWhy = r.why; p.minutes = o.min;
  pl.ai = { at: todayStr(), block: ((pl.ai && pl.ai.block) || 0) + 1, sess: DB.sessions.filter(s => s.end).length };
  p.plan = pl; saveData();
  return r;
}
/** Cada 4 semanas (con al menos 6 entrenos nuevos) el coach rehace la rutina con tus datos. */
function aiMaybeRefresh(pl) {
  if (!pl.ai || !pl.goal || daysBetween(pl.ai.at, todayStr()) < 28) return false;
  if (DB.sessions.filter(s => s.end).length - (pl.ai.sess || 0) < 6) return false;
  aiApply({ goal: pl.goal, days: pl.days, min: pl.min, level: pl.level });
  toast(`Tu Coach IA ajustó la rutina con tus datos · bloque ${pl.ai.block}`);
  return true;
}

/* ---------- Programas guiados ---------- */
// Bloque: [nombre, cantidad, carga]. Cantidad: número = reps · 'Ns' / 'Nmin' = tiempo · 'max' = lo más que aguantes · texto = distancia.
const WODS = {
  crossfit: [
    { id: 'cf1', n: 'Motor 21-15-9', type: 'fortime', cap: 12, b: [['Thrusters con mancuernas', 21, '2 × 15 kg'], ['Burpees', 21], ['Thrusters con mancuernas', 15, '2 × 15 kg'], ['Burpees', 15], ['Thrusters con mancuernas', 9, '2 × 15 kg'], ['Burpees', 9]], why: 'Corto e intenso: potencia de piernas y capacidad anaeróbica.' },
    { id: 'cf2', n: 'AMRAP 12 · Triple', type: 'amrap', cap: 12, b: [['Swings con kettlebell', 12, '16–24 kg'], ['Saltos al cajón o step-ups', 10], ['Abdominales sit-up', 15]], why: 'Rondas al máximo con ritmo sostenible.' },
    { id: 'cf3', n: 'EMOM 16 · Fuerza y motor', type: 'emom', cap: 16, b: [['Remo (calorías)', 12], ['Sentadilla goblet', 10, '20–32 kg'], ['Lagartijas', 10], ['Plancha', '40s']], why: 'Cada minuto un ejercicio: aprendes a recuperar rápido.' },
    { id: 'cf4', n: 'Chipper 25', type: 'fortime', cap: 25, b: [['Saltos de cuerda', 100], ['Swings con kettlebell', 40, '16–24 kg'], ['Zancadas caminando', 30], ['Push press con mancuernas', 20, '2 × 12 kg'], ['Burpees sobre la barra', 10]], why: 'Largo y variado: aprende a dosificar.' },
    { id: 'cf5', n: '5 rondas · Correr y jalar', type: 'fortime', cap: 25, rounds: 5, b: [['Carrera', '400 m'], ['Swings con kettlebell', 15, '16–24 kg'], ['Dominadas o remo invertido', 10]], why: 'Motor aeróbico más agarre y espalda.' },
    { id: 'cf6', n: 'AMRAP 20 · 6-12-18', type: 'amrap', cap: 20, b: [['Dominadas o jalón', 6], ['Lagartijas', 12], ['Sentadillas', 18]], why: 'Gimnástico clásico: volumen con tu propio peso.' }
  ],
  spartan: [
    { id: 'sp1', n: 'Simulación de obstáculos', type: 'fortime', cap: 45, b: [['Carrera', '1 km'], ['Burpees (penalización)', 30], ['Carrera', '1 km'], ['Farmer carry pesado', '50 m', '2 × 24 kg'], ['Carrera', '1 km'], ['Saltos al cajón', 20], ['Carrera', '1 km'], ['Colgado de barra', '60s'], ['Carrera', '1 km'], ['Lanzamientos de balón medicinal', 20, '6–9 kg']], why: 'Lo que pasa en carrera: correr cansado entre obstáculos.' },
    { id: 'sp2', n: 'Agarre de hierro', type: 'flow', rounds: 4, b: [['Colgado de barra', 'max'], ['Farmer carry', '40 m', '2 × 24 kg'], ['Remo invertido', 12], ['Arrastre de oso', '20 m']], why: 'El agarre decide los obstáculos: barras, cuerdas y cargas.' },
    { id: 'sp3', n: 'Burpee 100', type: 'fortime', cap: 15, b: [['Burpees', 100]], why: 'La penalización más común: hazla tu fortaleza.' },
    { id: 'sp4', n: 'Colinas y cargas', type: 'intervals', rounds: 6, b: [['Subida (caminadora inclinada o cuesta)', '2min'], ['Recupera caminando', '1min']], why: 'Fuerza en subida: la mayoría de las carreras tienen desnivel.' },
    { id: 'sp5', n: 'AMRAP 15 · Barro', type: 'amrap', cap: 15, b: [['Burpees', 10], ['Swings con kettlebell', 15, '16–24 kg'], ['Arrastre de oso', '20 m'], ['Sentadilla con saco', 10, '20–30 kg']], why: 'Resistencia general con cargas incómodas.' }
  ],
  cardio: [
    { id: 'cd1', n: 'Zona 2 · 40 min', type: 'intervals', b: [['Ritmo conversacional (zona 2)', '40min']], why: 'La base aeróbica: puedes hablar en frases completas. Mejora el motor sin fatigarte (Seiler 2010).' },
    { id: 'cd2', n: 'Intervalos 4 × 4', type: 'intervals', b: [['Calentamiento suave', '10min'], ['Fuerte (85–95 % FC máx.)', '4min'], ['Suave', '3min'], ['Fuerte (85–95 % FC máx.)', '4min'], ['Suave', '3min'], ['Fuerte (85–95 % FC máx.)', '4min'], ['Suave', '3min'], ['Fuerte (85–95 % FC máx.)', '4min'], ['Vuelta a la calma', '5min']], why: 'El protocolo 4 × 4 sube el VO₂máx (Helgerud 2007).' },
    { id: 'cd3', n: '20/10 × 8', type: 'intervals', rounds: 8, b: [['Máximo esfuerzo', '20s'], ['Descanso', '10s']], why: '4 minutos muy intensos (Tabata 1996). Calienta 10 min antes.' },
    { id: 'cd4', n: 'Contrarreloj 5 km', type: 'fortime', cap: 40, b: [['5 km en bici, caminadora o remo', '5 km']], why: 'Tu marca de referencia: repítela cada 4 semanas.' },
    { id: 'cd5', n: 'Pirámide 1-2-3-2-1', type: 'intervals', b: [['Calentamiento', '8min'], ['Fuerte', '1min'], ['Suave', '1min'], ['Fuerte', '2min'], ['Suave', '2min'], ['Fuerte', '3min'], ['Suave', '2min'], ['Fuerte', '2min'], ['Suave', '1min'], ['Fuerte', '1min'], ['Vuelta a la calma', '5min']], why: 'Cambios de ritmo: umbral y recuperación activa.' }
  ],
  yoga: [
    { id: 'yg1', n: 'Saludo y movilidad', type: 'flow', b: [['Postura de montaña', '30s'], ['Saludo al sol (5 vueltas)', '5min'], ['Perro boca abajo', '1min'], ['Guerrero I (cada lado)', '90s'], ['Guerrero II (cada lado)', '90s'], ['Triángulo (cada lado)', '80s'], ['Paloma (cada lado)', '2min'], ['Postura del niño', '1min'], ['Silla', 'max'], ['Relajación final', '3min']], why: 'Movilidad de cadera, hombro y columna en 20 minutos.' },
    { id: 'yg2', n: 'Yoga para atletas', type: 'flow', b: [['Respiración y postura fácil', '1min'], ['Gato-vaca', '1min'], ['Estocada baja (cada lado)', '2min'], ['Media separación (cada lado)', '90s'], ['Figura 4 acostado (cada lado)', '2min'], ['Torsión supina (cada lado)', '90s'], ['Puente', 'max'], ['Piernas en la pared', '3min']], why: 'Flexores de cadera, isquios y espalda baja: lo que más se acorta al entrenar.' },
    { id: 'yg3', n: 'Equilibrio y fuerza', type: 'flow', b: [['Árbol (cada lado)', '90s'], ['Guerrero III (cada lado)', '60s'], ['Silla', '1min'], ['Plancha lateral (cada lado)', '60s'], ['Barco', 'max'], ['Cuervo (o preparación)', '30s'], ['Postura del niño', '1min']], why: 'Estabilidad de tobillo, cadera y core.' },
    { id: 'yg4', n: 'Recuperación profunda', type: 'flow', b: [['Mariposa', '3min'], ['Oruga (pliegue sentado)', '3min'], ['Esfinge', '3min'], ['Torsión acostado (cada lado)', '4min'], ['Relajación final', '5min']], why: 'Posturas largas y suaves para los días de descanso.' }
  ],
  pilates: [
    { id: 'pl1', n: 'Core esencial', type: 'flow', b: [['El cien (hundred)', '1min'], ['Roll up', 10], ['Estiramiento de una pierna', 20], ['Estiramiento de dos piernas', 10], ['Criss-cross', 20], ['Plancha', 'max'], ['Natación (swimming)', '40s'], ['Estiramiento de columna', 8]], why: 'La base del método: control del centro.' },
    { id: 'pl2', n: 'Glúteo y cadera', type: 'flow', rounds: 2, b: [['Puente', 15], ['Almeja (cada lado)', 30], ['Patadas laterales (cada lado)', 24], ['Patada de glúteo en cuadrupedia (cada lado)', 30], ['Plancha lateral (cada lado)', '60s']], why: 'Glúteo medio y estabilidad de cadera.' },
    { id: 'pl3', n: 'Postura y espalda', type: 'flow', b: [['Gato-vaca', 10], ['Cisne (swan)', 8], ['Bird dog (cada lado)', 20], ['Natación (swimming)', '45s'], ['Sierra (saw)', 8], ['Teaser', 'max']], why: 'Extensores de espalda y control para una mejor postura.' },
    { id: 'pl4', n: 'Pilates power', type: 'flow', rounds: 3, b: [['Plancha con toque de hombros', 20], ['Puente a una pierna (cada lado)', 20], ['Bicho muerto (dead bug)', 16], ['Sentadilla con pausa', 15], ['Hollow hold', '30s']], why: 'Circuito de fuerza con el control del pilates.' }
  ]
};
const WOD_TYPE = { fortime: 'Por tiempo', amrap: 'AMRAP', emom: 'EMOM', flow: 'Secuencia', intervals: 'Intervalos' };
const LV_MULT = { principiante: 0.6, intermedio: 0.8, avanzado: 1 };
function wodDB() { if (!DB.wod) DB.wod = { log: [], best: {} }; return DB.wod; }
function wodById(id) { for (const k in WODS) { const w = WODS[k].find(x => x.id === id); if (w) return { ...w, disc: k }; } return null; }
function parseAmt(a) {
  if (typeof a === 'number') return { r: a };
  if (a === 'max') return { max: true };
  const m = /^(\d+)(s|min)$/.exec(a); if (m) return { t: Number(m[1]) * (m[2] === 'min' ? 60 : 1) };
  return { txt: a };
}
/** Pasos de la sesión ya escalados a tu nivel. */
function wodSteps(w, level) {
  const f = LV_MULT[level] || 0.8, rounds = w.type === 'emom' ? Math.round(w.cap / w.b.length) : Math.max(1, (w.rounds || 1) - (level === 'principiante' && w.rounds > 2 ? 1 : 0)), out = [];
  for (let r = 0; r < rounds; r++) w.b.forEach(([n, a, load]) => {
    const p = parseAmt(a);
    if (p.r) p.r = Math.max(1, Math.round(p.r * f));
    if (p.t && w.type !== 'intervals' && w.type !== 'emom') p.t = Math.max(15, Math.round(p.t * (0.7 + 0.3 * f) / 5) * 5);
    out.push({ n, ...p, load: load || null, round: r + 1 });
  });
  return out;
}
function wodCap(w, level) { return w.cap ? Math.round(w.cap * (level === 'principiante' ? 1.2 : 1)) : null; }
function amtTxt(s) { return s.r ? s.r + ' reps' : s.t ? hxT(s.t) : s.max ? 'lo más que aguantes' : s.txt; }
function wodScoreTxt(w, x) { if (!x) return '—'; if (x.capped) return 'tope'; return w.type === 'fortime' ? hxT(x.sec) : w.type === 'amrap' ? `${x.rounds} rondas + ${x.reps}` : x.hold ? hxT(x.hold) + ' de aguante' : hxT(x.sec); }
/** Valor comparable (mayor = mejor). */
function wodVal(w, x) { if (!x || x.capped) return null; return w.type === 'fortime' ? -x.sec : w.type === 'amrap' ? x.rounds * 1000 + x.reps : x.hold || null; }
function wodLog(disc) { return wodDB().log.filter(x => !disc || x.disc === disc); }
function wodBest(id) { const w = wodById(id); return wodDB().log.filter(x => x.wid === id && wodVal(w, x) != null).reduce((a, x) => !a || wodVal(w, x) > wodVal(w, a) ? x : a, null); }
function wodNext(disc) {
  const list = WODS[disc] || [], last = wodLog(disc).slice(-1)[0];
  if (!last) return list[0];
  const i = list.findIndex(w => w.id === last.wid);
  return list[(i + 1) % list.length];
}

/* ---------- Reproductor de sesión guiada ---------- */
let WP = null, wpTick = null;
function wpBeep(hi) { try { hypeAudio = hypeAudio || new (window.AudioContext || window.webkitAudioContext)(); const a = hypeAudio, o = a.createOscillator(), g = a.createGain(); o.frequency.value = hi ? 1046 : 660; g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.15, a.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.25); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.3); } catch (e) {} }
function startWod(id) {
  const w = wodById(id), pl = planState() || {};
  if (!w) return;
  WP = { w, level: pl.level || 'intermedio', comp: pl.comp || 'time', steps: wodSteps(w, pl.level), i: 0, t0: Date.now(), stepT0: Date.now(), paused: 0, pauseAt: null, rounds: 0, res: {}, hold: 0 };
  clearInterval(wpTick); wpTick = setInterval(wpUpdate, 250);
  wpDraw();
}
function wpNow() { return (WP.pauseAt || Date.now()) - WP.paused; }
function wpElapsed() { return Math.max(0, (wpNow() - WP.t0) / 1000); }
function wpStepEl() { return Math.max(0, (wpNow() - WP.stepT0) / 1000); }
function wpCur() { const s = WP.steps; return WP.w.type === 'amrap' ? s[WP.i % s.length] : s[WP.i]; }
function wpNextStep() { const s = WP.steps; return WP.w.type === 'amrap' ? s[(WP.i + 1) % s.length] : s[WP.i + 1]; }
function wpDraw() {
  if (!WP) return;
  const w = WP.w, s = wpCur(), nx = wpNextStep(), cap = wodCap(w, WP.level), tot = WP.steps.length;
  const ask = s && (s.max || (WP.comp === 'ex' && s.r));
  const pct = w.type === 'amrap' ? (WP.i % tot) / tot * 100 : WP.i / tot * 100;
  openModal(`<div class="wp">
    <div class="wp-top"><div><small>${esc(DISC[w.disc].n.toUpperCase())} · ${esc(WOD_TYPE[w.type])}${cap ? ' · ' + (w.type === 'fortime' ? 'tope ' : '') + cap + ' min' : ''}</small><b>${esc(w.n)}</b></div><span class="wp-clock" id="wp-clock">0:00</span></div>
    <div class="wp-bar"><i style="width:${pct}%"></i></div>
    ${w.type === 'amrap' ? `<div class="wp-rounds">Ronda <b>${WP.rounds + 1}</b></div>` : `<div class="wp-rounds">Paso <b>${Math.min(WP.i + 1, tot)}</b> de ${tot}${s && s.round > 1 || (w.rounds || 1) > 1 ? ` · ronda ${s ? s.round : ''}` : ''}</div>`}
    ${s ? `<div class="wp-step">
      <b class="wp-name">${esc(s.n)}</b>
      <div class="wp-amt" id="wp-amt">${s.t ? hxT(s.t) : s.max ? '0:00' : esc(amtTxt(s))}</div>
      <small>${s.t ? 'cuenta regresiva' : s.max ? 'aguanta lo más que puedas y toca Listo' : s.load ? 'carga sugerida: ' + esc(s.load) : '&nbsp;'}</small>
      ${ask && !s.max ? `<label class="wp-in">${s.load ? 'Kg que usaste' : 'Reps que hiciste'}<input id="wp-val" type="number" inputmode="decimal" value="${s.load ? '' : s.r}" placeholder="${s.load ? 'kg' : s.r}"></label>` : ''}
    </div>` : ''}
    <p class="wp-next">${nx && !(w.type !== 'amrap' && WP.i + 1 >= tot) ? 'Sigue: <b>' + esc(nx.n) + '</b> · ' + esc(amtTxt(nx)) : w.type === 'amrap' ? '' : 'Último paso'}</p>
    <button class="block wp-go" id="wp-go">${s && s.t ? 'Saltar' : 'Listo'} ${ico('check', 18)}</button>
    <div class="row wp-ctl"><button class="secondary" id="wp-pause">${WP.pauseAt ? 'Seguir' : 'Pausa'}</button><button class="ghost" id="wp-end">Terminar</button></div>
  </div>`, m => {
    $('#wp-go', m).onclick = () => wpDone();
    $('#wp-pause', m).onclick = () => { if (WP.pauseAt) { WP.paused += Date.now() - WP.pauseAt; WP.pauseAt = null; } else WP.pauseAt = Date.now(); wpDraw(); };
    $('#wp-end', m).onclick = () => wpFinish(true);
  });
  MODAL_LOCK = true;
  wpUpdate();
}
function wpUpdate() {
  if (!WP) { clearInterval(wpTick); return; }
  const w = WP.w, cap = wodCap(w, WP.level), el = wpElapsed(), s = wpCur();
  const ck = document.getElementById('wp-clock'); if (!ck) return;
  ck.textContent = (w.type === 'amrap' || w.type === 'emom') && cap ? hxT(Math.max(0, cap * 60 - el)) : hxT(el);
  if (cap && el >= cap * 60) { wpFinish(false, true); return; }
  const a = document.getElementById('wp-amt');
  if (w.type === 'emom') {
    const left = Math.ceil(60 - el % 60);
    if (a) a.textContent = WP.rest ? 'Descansa · ' + hxT(left) : s && s.t ? hxT(Math.max(0, Math.min(s.t, left))) : hxT(left);
    if (left <= 3 && WP.beep !== left) { WP.beep = left; wpBeep(false); }
    if (Math.floor(el / 60) > WP.i) wpDone(true);
    return;
  }
  if (s && s.t) {
    const left = Math.ceil((w.type === 'emom' ? 60 : s.t) - wpStepEl());
    if (a) a.textContent = hxT(Math.max(0, left));
    if (left <= 3 && left > 0 && WP.beep !== left) { WP.beep = left; wpBeep(false); }
    if (left <= 0) wpDone(true);
  } else if (s && s.max && a) a.textContent = hxT(wpStepEl());
  else if (w.type === 'emom' && a && wpStepEl() >= 60) wpDone(true);
}
function wpDone(auto) {
  const s = wpCur(); if (!s || WP.pauseAt) return;
  const inp = document.getElementById('wp-val');
  if (s.max) { const v = Math.round(wpStepEl()); WP.hold += v; WP.res[s.n] = Math.max(WP.res[s.n] || 0, v); }
  else if (WP.comp === 'ex' && s.r && inp && inp.value !== '') { const v = Number(inp.value); if (v > 0) WP.res[s.n] = Math.max(WP.res[s.n] || 0, v); WP.unit = WP.unit || {}; WP.unit[s.n] = s.load ? 'kg' : 'reps'; }
  if (s.max) { WP.unit = WP.unit || {}; WP.unit[s.n] = 's'; }
  if (WP.w.type === 'emom' && !auto) { WP.rest = true; const g = document.getElementById('wp-go'); if (g) g.disabled = true; wpBeep(true); return; }
  wpBeep(true); vibrate(40);
  WP.i++; WP.stepT0 = Date.now(); WP.beep = null; WP.rest = false;
  if (WP.w.type === 'amrap' && WP.i % WP.steps.length === 0) WP.rounds++;
  if (WP.w.type !== 'amrap' && WP.i >= WP.steps.length) return wpFinish(false);
  wpDraw();
}
function wpFinish(manual, capped) {
  if (!WP) return;
  clearInterval(wpTick);
  const w = WP.w, sec = Math.round(wpElapsed()), tot = WP.steps.length;
  const partial = w.type === 'amrap' ? WP.steps.slice(0, WP.i % tot).reduce((a, s) => a + (s.r || 0), 0) : 0;
  const done = WP.i >= tot || w.type === 'amrap' || (w.type === 'emom' && capped);
  const x = { id: uid(), disc: w.disc, wid: w.id, date: todayStr(), t: Date.now(), comp: WP.comp, level: WP.level, sec, rounds: WP.rounds, reps: partial, hold: WP.hold || null, res: WP.res, unit: WP.unit || {}, done, capped: w.type === 'fortime' && !!capped };
  const R = WP; WP = null; MODAL_LOCK = false;
  if (manual && WP == null && R.i === 0) { closeModal(true); return; }
  wodSummary(w, x, R);
}
const ACT_OF = { crossfit: 'circuito', spartan: 'circuito', cardio: 'eliptica', yoga: 'yoga', pilates: 'pilates' };
function wodSummary(w, x, R) {
  const prev = wodBest(w.id), D = wodDB(), prs = [];
  Object.keys(x.res).forEach(k => { const key = w.disc + '|' + k, b = D.best[key]; if (!b || x.res[k] > b.v) prs.push({ n: k, v: x.res[k], old: b ? b.v : null, u: x.unit[k] }); });
  const v = wodVal(w, x), pv = wodVal(w, prev), sessPR = x.done && v != null && (pv == null || v > pv);
  openModal(`<div class="wp-sum"><div class="hx-eyebrow">${x.done ? 'SESIÓN TERMINADA' : 'SESIÓN GUARDADA'}</div><h3>${esc(w.n)}</h3>
    <div class="wp-score"><b>${esc(wodScoreTxt(w, x))}</b><small>${x.capped ? 'Llegaste al tope de tiempo: la próxima, menos descanso entre bloques.' : prev ? 'Tu récord: ' + esc(wodScoreTxt(w, prev)) : 'Primera vez: esta es tu marca a romper'} · ${hxT(x.sec)} en total</small></div>
    ${prs.length ? `<div class="pg-rec"><b>Récords por ejercicio</b><small>${prs.map(p => `${esc(p.n)}: ${p.u === 's' ? hxT(p.v) : p.v + ' ' + (p.u || '')}${p.old != null ? ` (antes ${p.u === 's' ? hxT(p.old) : p.old})` : ''}`).join(' · ')}</small></div>` : ''}
    <div class="rir-label"><span>¿Qué tan duro fue? (1–10)</span></div>
    <div class="seg wrap">${[4, 5, 6, 7, 8, 9, 10].map(n => `<button data-wrpe="${n}" class="${n === 7 ? 'on' : ''}">${n}</button>`).join('')}</div>
    <button class="block" id="wp-save" style="margin-top:12px">Guardar</button></div>`, m => {
    let rpe = 7;
    $$('[data-wrpe]', m).forEach(b => b.onclick = () => { rpe = Number(b.dataset.wrpe); $$('[data-wrpe]', m).forEach(y => y.classList.toggle('on', y === b)); });
    $('#wp-save', m).onclick = () => {
      x.rpe = rpe; D.log.push(x);
      prs.forEach(p => { D.best[w.disc + '|' + p.n] = { v: p.v, u: p.u, date: x.date }; });
      DB.activities = (DB.activities || []).concat({ id: uid(), date: x.date, type: ACT_OF[w.disc] || 'circuito', min: Math.max(1, Math.round(x.sec / 60)), rpe, wod: x.id, note: w.n });
      saveData(); closeModal(true); render(currentTab);
      if (typeof achToast === 'function') {
        if (sessPR) achToast(prev ? `Nuevo récord · ${w.n}` : `Primera marca · ${w.n}`, wodScoreTxt(w, x) + (prev ? ' · antes ' + wodScoreTxt(w, prev) : ''));
        if (prs.length) { const p = prs[0]; achToast(`Récord · ${p.n}`, `${p.u === 's' ? hxT(p.v) : p.v + ' ' + (p.u || '')}${prs.length > 1 ? ` · y ${prs.length - 1} récord${prs.length > 2 ? 's' : ''} más` : ''}`); }
        if (!sessPR && !prs.length && prev && x.done) apolloToast(`${w.n}: hoy ${wodScoreTxt(w, x)}. Tu récord: ${wodScoreTxt(w, prev)}. Levántate y vuelve.`);
      }
      if (typeof mdScanSoon === 'function') mdScanSoon();
    };
  });
}

/* ---------- Pantallas ---------- */
let planWz = null;
function planHead(pl) {
  const D = DISC[pl.disc], extra = pl.disc === 'gym' && pl.goal ? AI_GOALS[pl.goal].n : LEVELS[pl.level] || '';
  return `<div class="pn-head">${ico(D.ico, 22)}<span><b>${esc(D.n)}</b><small>${esc(compName(pl))}${extra ? ' · ' + esc(extra) : ''}</small></span><button class="ghost" id="pn-change">Cambiar</button></div>`;
}
function bindPlanHead(v) { const b = $('#pn-change', v); if (b) b.onclick = () => { const pl = planState(); planWz = { step: 0, edit: true, disc: pl.disc, comp: pl.comp, goal: pl.goal || null, days: pl.days || 3, min: pl.min || 60, level: pl.level || 'intermedio', gym: DB.profile.gym && GYM_PRESETS[DB.profile.gym] ? DB.profile.gym : 'completo' }; renderTrain(); window.scrollTo(0, 0); }; }

function planWizard(v) {
  const w = planWz = planWz || { step: 0, disc: null, comp: null, goal: null, days: 3, min: 60, level: DB.profile.level === 'principiante' ? 'principiante' : 'intermedio', gym: DB.profile.gym && GYM_PRESETS[DB.profile.gym] ? DB.profile.gym : 'completo' };
  const steps = w.disc === 'gym' ? 4 : w.disc === 'run' || w.disc === 'hyrox' ? 2 : 3;
  const dots = `<div class="pn-dots">${Array.from({ length: steps }, (_, i) => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}<span>Paso ${w.step + 1}${w.disc ? ' de ' + steps : ''}</span></div>`;
  const back = `<button class="ghost block" id="pn-back">${w.step ? '← Atrás' : w.edit ? 'Cancelar' : ''}</button>`;
  let h = '';
  if (w.step === 0) h = `<h2 class="pn-q">¿Qué quieres entrenar?</h2><div class="pn-grid">${Object.keys(DISC).map(k => `<button class="pn-opt${w.disc === k ? ' on' : ''}" data-pdisc="${k}">${ico(DISC[k].ico, 26)}<b>${DISC[k].n}</b><small>${DISC[k].d}</small></button>`).join('')}</div>`;
  else if (w.step === 1) {
    const T = COMP_TXT[w.disc] || COMP_TXT.def;
    h = `<h2 class="pn-q">¿Cómo quieres competir?</h2><p class="pn-sub">Contra ti mismo: cada vez que superas tu marca, se desbloquea un logro.</p>
      <div class="pn-list"><button class="pn-big${w.comp === 'time' ? ' on' : ''}" data-pcomp="time">${ico('timer', 28)}<span><b>Por tiempo</b><small>${T[0]}</small></span></button>
      <button class="pn-big${w.comp === 'ex' ? ' on' : ''}" data-pcomp="ex">${ico('dumbbell', 28)}<span><b>Por ejercicio</b><small>${T[1]}</small></span></button></div>`;
  } else if (w.step === 2 && w.disc === 'gym') {
    h = `<h2 class="pn-q">¿Cuál es tu objetivo?</h2><div class="pn-list">${Object.keys(AI_GOALS).map(k => `<button class="pn-big${w.goal === k ? ' on' : ''}" data-pgoal="${k}">${ico(AI_GOALS[k].ico, 28)}<span><b>${AI_GOALS[k].n}</b><small>${AI_GOALS[k].d}</small></span></button>`).join('')}</div>`;
  } else {
    const gym = w.disc === 'gym';
    h = `<h2 class="pn-q">${gym ? 'Tu Coach IA necesita 4 datos' : 'Tu semana'}</h2>
      <div class="rir-label"><span>Días por semana</span></div><div class="seg">${[2, 3, 4, 5, 6].map(n => `<button data-pdays="${n}" class="${w.days === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${gym ? `<div class="rir-label"><span>Minutos por sesión</span></div><div class="seg">${[30, 45, 60, 75].map(n => `<button data-pmin="${n}" class="${w.min === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="rir-label"><span>¿Dónde entrenas?</span></div><div class="seg wrap">${['completo', 'pf', 'casa', 'nada'].map(k => `<button data-pgym="${k}" class="${w.gym === k ? 'on' : ''}">${GYM_PRESETS[k].name}</button>`).join('')}</div>` : ''}
      <div class="rir-label"><span>Tu nivel</span></div><div class="seg">${Object.keys(LEVELS).map(k => `<button data-plevel="${k}" class="${w.level === k ? 'on' : ''}">${LEVELS[k]}</button>`).join('')}</div>
      <button class="block pn-go" id="pn-go">${gym ? ico('sparkles', 18, 'lead') + 'Crear mi rutina con IA' : 'Empezar'}</button>`;
  }
  v.innerHTML = `<div class="pn-wz">${dots}${h}${w.step || w.edit ? back : ''}</div>`;
  const next = () => { w.step++; planWizard(v); window.scrollTo(0, 0); };
  $$('[data-pdisc]', v).forEach(b => b.onclick = () => { w.disc = b.dataset.pdisc; next(); });
  $$('[data-pcomp]', v).forEach(b => b.onclick = () => { w.comp = b.dataset.pcomp; if (w.disc === 'run' || w.disc === 'hyrox') planCommit(); else next(); });
  $$('[data-pgoal]', v).forEach(b => b.onclick = () => { w.goal = b.dataset.pgoal; next(); });
  const pick = (attr, key, num) => $$(`[data-${attr}]`, v).forEach(b => b.onclick = () => { w[key] = num ? Number(b.dataset[attr]) : b.dataset[attr]; $$(`[data-${attr}]`, v).forEach(y => y.classList.toggle('on', y === b)); });
  pick('pdays', 'days', true); pick('pmin', 'min', true); pick('pgym', 'gym'); pick('plevel', 'level');
  const go = $('#pn-go', v); if (go) go.onclick = () => planCommit(v);
  const bk = $('#pn-back', v); if (bk) bk.onclick = () => { if (w.step) { w.step--; planWizard(v); } else { planWz = null; renderTrain(); } };
}
function planCommit(v) {
  const w = planWz, p = DB.profile;
  const pl = Object.assign(p.plan || {}, { disc: w.disc, comp: w.comp, days: w.days, level: w.level, auto: false });
  if (w.disc === 'gym') Object.assign(pl, { goal: w.goal, min: w.min });
  p.plan = pl; p.trainMode = w.disc === 'run' ? 'running' : 'fuerza';
  if (w.disc === 'hyrox' || w.disc === 'run' || w.disc === 'spartan' || w.disc === 'cardio') { const map = { hyrox: 'hyrox', run: 'run', spartan: 'spartan', cardio: 'run' }; if (typeof SPORTS === 'object' && SPORTS[map[w.disc]]) p.sport = map[w.disc]; }
  else if (w.disc === 'gym') p.sport = w.goal === 'fuerza' ? 'fuerza' : 'fisico';
  saveData();
  if (w.disc === 'gym' && v) {
    v.innerHTML = `<div class="pn-wz pn-ai"><div class="pn-ai-orb">${ico('sparkles', 34)}</div><h2 class="pn-q">Tu Coach IA está armando tu rutina…</h2>
      <ul class="pn-ai-steps"><li>Objetivo: ${esc(AI_GOALS[w.goal].n.toLowerCase())}</li><li>${w.days} días · ${w.min} min · ${esc(GYM_PRESETS[w.gym].name)}</li><li>${DB.lifts.length ? `Analizando tus ${DB.lifts.length} series registradas` : 'Eligiendo ejercicios para tu nivel'}</li><li>Ajustando series, reps y descansos</li></ul></div>`;
    setTimeout(() => { aiApply({ goal: w.goal, days: w.days, min: w.min, level: w.level, gym: w.gym }); planWz = null; renderTrain(); window.scrollTo(0, 0); toast('Tu rutina está lista'); }, 1400);
    return;
  }
  planWz = null; renderTrain(); window.scrollTo(0, 0);
}

function gymMinimal(base, v, pl) {
  aiMaybeRefresh(pl);
  const rc = readinessCard, rt = retosCard;
  readinessCard = () => ''; retosCard = () => '';
  try { base(); } finally { readinessCard = rc; retosCard = rt; }
  $$('.mode-seg', v).forEach(e => e.remove());
  const plCard = $('.plan-card', v) || $('.routine-card', v);
  const ai = pl.ai ? `<div class="pn-ai-card">${ico('sparkles', 20)}<span><b>Coach IA · bloque ${pl.ai.block}</b><small>Rutina de ${esc(AI_GOALS[pl.goal] ? AI_GOALS[pl.goal].n.toLowerCase() : 'tu objetivo')} desde ${shortDate(pl.ai.at)}. Se ajusta sola cada 4 semanas con tus datos.</small></span><button class="secondary" id="pn-ai-re">Recalcular</button></div>`
    : `<div class="pn-ai-card">${ico('sparkles', 20)}<span><b>Coach IA</b><small>Haz que el coach arme tu rutina con tu objetivo y tus datos.</small></span><button class="secondary" id="pn-ai-go">Crear</button></div>`;
  if (plCard) plCard.insertAdjacentHTML('beforebegin', ai); else v.insertAdjacentHTML('afterbegin', ai);
  if (pl.comp === 'time') {
    const nd = nextDay(DB.profile.routine);
    const done = nd ? DB.sessions.filter(s => s.end && s.dayName === nd.name && s.end - s.start > 6e5) : [];
    const best = done.reduce((a, s) => !a || s.end - s.start < a.end - a.start ? s : a, null);
    const box = `<div class="pn-time">${ico('timer', 18)}<span>${best ? `Tu récord en <b>${esc(nd.name.split('·').pop().trim())}</b>: ${hxT(Math.round((best.end - best.start) / 1000))}. Termínalo completo en menos tiempo.` : 'Compites por tiempo: cada entreno completo guarda tu mejor duración.'}</span></div>`;
    const a = $('.pn-ai-card', v); if (a) a.insertAdjacentHTML('afterend', box);
  }
  const re = $('#pn-ai-re', v); if (re) re.onclick = () => { aiApply({ goal: pl.goal, days: pl.days, min: pl.min, level: pl.level }); renderTrain(); toast('Rutina recalculada con tus datos'); };
  const gi = $('#pn-ai-go', v); if (gi) gi.onclick = () => { planWz = { step: 2, edit: true, disc: 'gym', comp: pl.comp, goal: pl.goal || null, days: pl.days || 3, min: pl.min || 60, level: pl.level || 'intermedio', gym: DB.profile.gym && GYM_PRESETS[DB.profile.gym] ? DB.profile.gym : 'completo' }; renderTrain(); window.scrollTo(0, 0); };
}

function wodView(v, pl) {
  const list = WODS[pl.disc] || [], nx = wodNext(pl.disc), log = wodLog(pl.disc);
  const wk = weekKey(todayStr()), thisWeek = log.filter(x => weekKey(x.date) === wk).length, target = pl.days || 3;
  const steps = wodSteps(nx, pl.level), best = wodBest(nx.id), cap = wodCap(nx, pl.level);
  const recs = Object.keys(wodDB().best).filter(k => k.startsWith(pl.disc + '|')).map(k => ({ n: k.split('|')[1], ...wodDB().best[k] }));
  v.innerHTML = `<div class="pn-hero">
      <small>SESIÓN DE HOY · ${esc(WOD_TYPE[nx.type].toUpperCase())}${cap ? ' · ' + cap + ' MIN' : ''}</small>
      <h2>${esc(nx.n)}</h2><p>${esc(nx.why)}</p>
      <ol class="pn-steps">${nx.b.map(([n, a, load]) => { const s = parseAmt(a); if (s.r) s.r = Math.max(1, Math.round(s.r * (LV_MULT[pl.level] || 0.8))); return `<li><b>${esc(n)}</b><span>${esc(amtTxt(s))}${load ? ' · ' + esc(load) : ''}</span></li>`; }).join('')}</ol>
      ${nx.rounds > 1 ? `<p class="pn-rounds">${steps.length / nx.b.length} rondas</p>` : ''}
      <div class="pn-rec">${ico('trophy', 16)}${best ? `Tu récord: <b>${esc(wodScoreTxt(nx, best))}</b>` : 'Sin récord todavía: hoy pones la marca'}</div>
      <button class="block" id="pn-start" data-wod="${nx.id}">${ico('play', 18, 'lead')}Empezar</button></div>
    <div class="pn-week"><span>Esta semana</span><div>${Array.from({ length: target }, (_, i) => `<i class="${i < thisWeek ? 'on' : ''}"></i>`).join('')}</div><b>${thisWeek}/${target}</b></div>
    <details class="pn-more"><summary>Tu programa · ${list.length} sesiones</summary><div class="kit-list">${list.map(w => { const b = wodBest(w.id); return `<button class="kit-item" data-wod="${w.id}">${ico(DISC[pl.disc].ico, 20)}<span class="grow"><b>${esc(w.n)}</b><small>${esc(WOD_TYPE[w.type])}${b ? ' · récord ' + esc(wodScoreTxt(w, b)) : ''}</small></span>${ico('play', 16)}</button>`; }).join('')}</div></details>
    ${recs.length ? `<details class="pn-more"><summary>Récords por ejercicio · ${recs.length}</summary><table class="small hx-tbl"><tbody>${recs.map(r => `<tr><td>${esc(r.n)}</td><td><b>${r.u === 's' ? hxT(r.v) : r.v + ' ' + esc(r.u || '')}</b></td><td class="muted">${shortDate(r.date)}</td></tr>`).join('')}</tbody></table></details>` : ''}
    ${log.length ? `<details class="pn-more"><summary>Historial · ${log.length}</summary><table class="small hx-tbl"><tbody>${log.slice().reverse().slice(0, 12).map(x => { const w = wodById(x.wid); return `<tr><td>${shortDate(x.date)}</td><td>${esc(w ? w.n : '')}</td><td><b>${esc(w ? wodScoreTxt(w, x) : '')}</b></td></tr>`; }).join('')}</tbody></table></details>` : ''}`;
  $$('[data-wod]', v).forEach(b => b.onclick = () => startWod(b.dataset.wod));
}

window.addEventListener('load', () => {
  const base = renderTrain;
  renderTrain = function () {
    if ((typeof RUN === 'object' && RUN.st) || activeSession()) return base();
    const v = $('#view-train'), pl = planState();
    if (!pl || planWz) { planWizard(v); return; }
    if (pl.disc === 'gym') { DB.profile.trainMode = 'fuerza'; gymMinimal(base, v, pl); }
    else if (pl.disc === 'run') { DB.profile.trainMode = 'running'; base(); $$('.mode-seg', v).forEach(e => e.remove()); }
    else if (pl.disc === 'hyrox') renderHyroxTab(v, 'train');
    else wodView(v, pl);
    v.insertAdjacentHTML('afterbegin', planHead(pl));
    bindPlanHead(v);
  };
});

/* Gimnasio "por tiempo": al terminar un entreno completo, ¿fue tu más rápido? */
function gymTimeReact(s) {
  const pl = planState();
  if (!pl || pl.disc !== 'gym' || pl.comp !== 'time' || !s || !s.end || typeof achToast !== 'function') return;
  const ex = sessionExercises(s), full = ex.length && ex.every(e => DB.lifts.filter(l => l.sid === s.id && l.ex === e[0]).length >= e[1]);
  const dur = Math.round((s.end - s.start) / 1000);
  if (!full || dur < 600) return;
  const prev = DB.sessions.filter(x => x.id !== s.id && x.end && x.dayName === s.dayName && x.timeFull).reduce((a, x) => !a || x.end - x.start < a.end - a.start ? x : a, null);
  s.timeFull = true; saveData();
  const nm = s.dayName.split('·').pop().trim();
  if (!prev) return achToast(`Primera marca · ${nm}`, `${hxT(dur)} completo`);
  const pd = Math.round((prev.end - prev.start) / 1000);
  if (dur < pd) achToast(`Nuevo récord de tiempo · ${nm}`, `${hxT(dur)} · ${hxT(pd - dur)} más rápido`);
  else apolloToast(`${nm}: hoy ${hxT(dur)}. Tu récord: ${hxT(pd)}. Menos descanso entre series y vuelve.`);
}
window.addEventListener('load', () => {
  const f0 = finishSession;
  finishSession = function () { const s = activeSession(); const r = f0.apply(this, arguments); if (s && s.end) setTimeout(() => { try { gymTimeReact(s); } catch (e) { console.error(e); } }, 1200); return r; };
});
