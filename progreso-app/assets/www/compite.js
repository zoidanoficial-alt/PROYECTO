'use strict';
/* Mi Progreso 21.0 · Fisicoculturismo para competir.
   - Programas listos para elegir y empezar, inspirados en lo que se ha publicado de cómo entrenaban
     Arnold Schwarzenegger (Golden Six, Arnold split nivel I y su volumen de competencia de los 70)
     y Chris Bumstead (rotación 3-1-3-1 de su preparación 2023 para el Olympia).
   - Cada programa se adapta solo a Planet Fitness: si tu club no tiene un equipo, se cambia por el
     sustituto más fiel (no por uno cualquiera) y se explica el cambio.
   - Plan de preparación: fecha del show, categoría y fase (fuera de temporada, preparación, semana del show).
   Las series y repeticiones vienen de fuentes secundarias (BarBend, Muscle & Strength, Fitness Volt,
   Generation Iron) y varían entre ellas; ver docs/FUENTES-v21.md. No hay afiliación con ninguna de
   estas personas ni con sus marcas. Los nombres visibles están en COMP_NAMES para cambiarlos en un solo lugar. */

/* ---------- Ejercicios nuevos ---------- */
EQUIP.bfija = 'Barra de peso fijo';
GYM_PRESETS.completo.equip.push('bfija');
GYM_PRESETS.pf.equip.push('bfija');
// [nombre, grupo, tipo, patrón, equipo, ¿PF?, ícono, foto]
[
  ['Press Arnold', 'hombro', 'c', 'empuje-v', 'manc', 1, 'press', 'Arnold_Dumbbell_Press'],
  ['Curl concentrado', 'biceps', 'a', 'curl', 'manc', 1, 'curl', 'Concentration_Curls'],
  ['Encogimientos con mancuernas', 'espalda', 'a', 'encogimiento', 'manc', 1, 'row', 'Dumbbell_Shrug'],
  ['Curl de muñeca con mancuerna', 'biceps', 'a', 'antebrazo', 'manc', 1, 'curl', 'Seated_Dumbbell_Palms-Up_Wrist_Curl'],
  ['Curl con barra EZ', 'biceps', 'a', 'curl', 'bfija', 1, 'curl', 'EZ-Bar_Curl'],
  ['Press francés con barra EZ', 'triceps', 'a', 'triceps', 'bfija', 1, 'press', 'EZ-Bar_Skullcrusher'],
  ['Press de pecho Magnum (discos)', 'pecho', 'c', 'empuje-h', 'maq', 1, 'bench', 'Leverage_Chest_Press'],
  ['Press inclinado (máquina)', 'pecho', 'c', 'empuje-inc', 'maq', 1, 'bench', 'Leverage_Incline_Chest_Press'],
  ['Elevaciones laterales (máquina)', 'hombro', 'a', 'elev-lat', 'maq', 1, 'raise', null],
  ['Remo en T (Magnum)', 'espalda', 'c', 'remo', 'maq', 0, 'row', 'T-Bar_Row_with_Handle'],
  ['Remo con pecho apoyado (mancuernas)', 'espalda', 'c', 'remo', 'manc', 1, 'row', 'Dumbbell_Incline_Row'],
  ['Pullover en polea (brazos rectos)', 'espalda', 'a', 'jalon', 'polea', 1, 'row', 'Straight-Arm_Pulldown'],
  ['Glute drive Magnum (discos)', 'gluteo', 'c', 'gluteo', 'maq', 1, 'bridge', null],
  ['Abdominales completos (sit-ups)', 'abdomen', 'a', 'abdomen', 'corporal', 1, 'crunch', 'Sit-Up']
].forEach(([n, g, t, p, e, pf, icon, photo]) => {
  if (!EX[n]) EX[n] = { g, t, p, e, pf: !!pf, icon: ICONS[icon] ? icon : 'curl' };
  if (photo && !EX_PHOTO[n]) EX_PHOTO[n] = photo;
});
['Hack squat', 'Elevación de talones sentado', 'Curl predicador', 'Curl femoral tumbado', 'Prensa 45°'].forEach(n => { if (EX[n]) EX[n].pf = true; });
Object.assign(HOWTO_EX, {
  'Press Arnold': [['Sentado, mancuernas frente a la cara con las palmas hacia ti.', 'Al subir, gira las palmas hacia el frente y extiende los brazos sobre la cabeza.', 'Baja girando de regreso a la posición inicial.'], 'Arquear la espalda baja para subir más peso.'],
  'Curl concentrado': [['Sentado, el codo apoyado en la cara interna del muslo.', 'Sube la mancuerna sin mover el codo y aprieta arriba 1 s.', 'Baja lento hasta extender casi por completo.'], 'Balancear el torso para ayudarte.'],
  'Encogimientos con mancuernas': [['De pie, mancuernas a los lados y brazos rectos.', 'Sube los hombros hacia las orejas y aprieta 1 s.', 'Baja controlado sin girar los hombros.'], 'Hacer círculos con los hombros.'],
  'Curl de muñeca con mancuerna': [['Antebrazo apoyado en el muslo o banco, palma hacia arriba.', 'Flexiona solo la muñeca hacia arriba.', 'Baja despacio hasta estirar.'], 'Mover el antebrazo en lugar de la muñeca.'],
  'Curl con barra EZ': [['De pie, toma la barra EZ por las curvas, codos pegados al torso.', 'Sube hasta el pecho sin mover los codos.', 'Baja controlado hasta casi extender.'], 'Balancear la cadera para subir la barra.'],
  'Press francés con barra EZ': [['Acostado en banco plano, barra EZ sobre la frente con brazos verticales.', 'Dobla solo los codos para bajar la barra hacia la frente.', 'Extiende los codos sin abrirlos.'], 'Abrir los codos hacia los lados.'],
  'Press de pecho Magnum (discos)': [['Ajusta el asiento para que las asas queden a la altura del pecho medio.', 'Empuja hasta casi extender los codos.', 'Regresa lento sintiendo el estiramiento del pecho.'], 'Despegar la espalda del respaldo.'],
  'Press inclinado (máquina)': [['Asiento a la altura en que las asas queden a la altura de la parte alta del pecho.', 'Empuja hacia arriba y al frente.', 'Regresa lento sin soltar la tensión.'], 'Levantar los hombros hacia las orejas.'],
  'Elevaciones laterales (máquina)': [['Sentado, hombros alineados con el eje de la máquina y codos en las almohadillas.', 'Sube los codos hasta la altura de los hombros.', 'Baja lento sin dejar que el peso descanse.'], 'Encoger los hombros al subir.'],
  'Remo en T (Magnum)': [['Pecho apoyado en la almohadilla y pies firmes.', 'Jala las asas hacia el abdomen juntando las escápulas.', 'Estira los brazos por completo al bajar.'], 'Despegar el pecho para usar impulso.'],
  'Remo con pecho apoyado (mancuernas)': [['Banco a 30–45°, acuéstate boca abajo con el pecho apoyado.', 'Jala las mancuernas hacia la cadera juntando las escápulas.', 'Baja hasta estirar los brazos.'], 'Levantar el pecho del banco.'],
  'Pullover en polea (brazos rectos)': [['De pie frente a la polea alta, brazos casi rectos y torso un poco inclinado.', 'Lleva la barra o cuerda hacia los muslos usando la espalda.', 'Regresa lento hasta sentir el estiramiento del dorsal.'], 'Doblar los codos y convertirlo en un jalón de tríceps.'],
  'Glute drive Magnum (discos)': [['Espalda alta en el respaldo y el cinturón sobre la cadera.', 'Empuja con los talones y sube la cadera hasta alinearla con el torso.', 'Aprieta el glúteo 1 s arriba y baja controlado.'], 'Arquear la espalda baja en lugar de extender la cadera.'],
  'Abdominales completos (sit-ups)': [['Acostado, rodillas dobladas y pies firmes.', 'Sube el torso hasta sentarte, sin jalar el cuello.', 'Baja controlado vértebra por vértebra.'], 'Jalar la cabeza con las manos.']
});

/* ---------- Adaptación curada a Planet Fitness ---------- */
/** Sustituto más fiel en Planet Fitness, en orden de preferencia (se usa el primero que tengas). */
const PF_SWAP = {
  'Sentadilla con barra': ['Hack squat', 'Sentadilla en Smith', 'Prensa de piernas (máquina)'],
  'Peso muerto': ['Peso muerto rumano en Smith', 'Peso muerto rumano'],
  'Peso muerto rumano con barra': ['Peso muerto rumano en Smith', 'Peso muerto rumano'],
  'Press banca con barra': ['Press de pecho Magnum (discos)', 'Press banca en Smith', 'Press banca con mancuernas'],
  'Press inclinado con barra': ['Press inclinado en Smith', 'Press inclinado con mancuernas', 'Press inclinado (máquina)'],
  'Hammer Strength press': ['Press de pecho Magnum (discos)', 'Chest press (máquina)'],
  'Remo con barra': ['Remo en Smith', 'Remo con mancuerna'],
  'Remo en T (Magnum)': ['Remo con pecho apoyado (mancuernas)', 'Remo sentado (máquina)'],
  'Press militar con barra': ['Press militar en Smith', 'Shoulder press (máquina)', 'Press militar con mancuernas'],
  'Zancadas con barra': ['Zancadas en Smith', 'Zancadas / split squat búlgaro'],
  'Curl con barra de pie': ['Curl con barra EZ', 'Curl en polea'],
  'Press banca agarre cerrado': ['Press francés con barra EZ', 'Extensión de tríceps (máquina)'],
  'Puente de glúteo con barra': ['Glute drive Magnum (discos)', 'Hip thrust'],
  'Hip thrust': ['Glute drive Magnum (discos)'],
  'Dominadas / chin-ups': ['Dominadas asistidas (máquina)', 'Jalón al pecho'],
  'Fondos en paralelas (con lastre)': ['Fondos asistidos (máquina)', 'Extensión de tríceps (máquina)'],
  'Prensa 45°': ['Prensa de piernas (máquina)'],
  'Curl femoral tumbado': ['Curl femoral sentado'],
  'Curl predicador': ['Curl de bíceps (máquina)', 'Curl con barra EZ'],
  'Donkey calf raise': ['Elevación de talones en prensa', 'Elevación de talones de pie'],
  'Elevación de talones sentado': ['Elevación de talones en prensa', 'Elevación de talones de pie'],
  'Press inclinado (máquina)': ['Press inclinado en Smith', 'Press inclinado con mancuernas'],
  'Elevaciones laterales (máquina)': ['Elevaciones laterales en polea', 'Elevaciones laterales'],
  'Glute drive Magnum (discos)': ['Hip thrust'],
  'Hiperextensiones': ['Peso muerto rumano', 'Curl femoral sentado']
};
/** Por qué el sustituto se parece al original (se muestra en la sesión). */
const PF_WHY = {
  'Hack squat': 'misma carga de cuádriceps que la sentadilla, con la espalda apoyada',
  'Sentadilla en Smith': 'mismo patrón de sentadilla con la barra guiada',
  'Peso muerto rumano en Smith': 'misma bisagra de cadera; sin barra olímpica no hay peso muerto desde el piso',
  'Press de pecho Magnum (discos)': 'press plano de discos, lo más parecido a la barra',
  'Press banca en Smith': 'press plano con barra guiada',
  'Press inclinado en Smith': 'press inclinado con barra guiada',
  'Remo en Smith': 'remo inclinado con barra guiada',
  'Remo con pecho apoyado (mancuernas)': 'remo pesado con el pecho apoyado, como el remo en T',
  'Press militar en Smith': 'press vertical con barra guiada',
  'Curl con barra EZ': 'curl con barra de peso fijo',
  'Glute drive Magnum (discos)': 'hip thrust de discos con la espalda apoyada',
  'Dominadas asistidas (máquina)': 'mismo jalón vertical con ayuda de contrapeso',
  'Fondos asistidos (máquina)': 'mismo fondo con ayuda de contrapeso'
};
/** Sustituto curado para Planet Fitness, o null si no aplica. */
function pfSwapFor(name, avoid) {
  if (!isPF() || !PF_SWAP[name]) return null;
  return PF_SWAP[name].find(n => EX[n] && okForMe(n) && !(avoid || []).includes(n)) || null;
}

/* ---------- Programas para competir ---------- */
const COMP_NAMES = {
  golden6: 'Golden Six · inspirado en Arnold',
  arnold1: 'Arnold split · nivel I',
  arnold2: 'Era dorada · volumen de competencia (Arnold, años 70)',
  cbum: 'Classic Physique · inspirado en Chris Bumstead (CBUM)'
};
const ABS_ARNOLD = ['Crunch en el suelo', 5, '25', 45];
const CALVES_ARNOLD = [['Elevación de talones de pie', 4, '15', 60], ['Elevación de talones sentado', 4, '15', 60]];
const COMP_ROUTINES = {
  golden6: {
    desc: 'La rutina de cuerpo completo atribuida a Arnold (y antes a Reg Park): 6 básicos, 3 días a la semana en días no seguidos. Ideal para construir la base antes de un split. El press tras nuca original se cambió por press al frente, más seguro para el hombro.',
    level: 'Principiante–intermedio', ico: '🏛️', weeks: '8–12 semanas',
    src: 'Fitness Volt, Lift Vault, Boostcamp (varían: algunas fuentes ponen 4–5 × 10 en todo)',
    days: [
      { id: 'g6a', name: 'Día A · Golden Six', ex: [['Sentadilla con barra', 4, '10', 150], ['Press banca con barra', 3, '10', 120], ['Dominadas / chin-ups', 3, 'al fallo', 120],
        ['Press militar con barra', 4, '10', 120], ['Curl con barra de pie', 3, '10', 90], ['Abdominales completos (sit-ups)', 3, 'al fallo', 60]] },
      { id: 'g6r1', name: 'Descanso', rest: true, ex: [] },
      { id: 'g6b', name: 'Día B · Golden Six', ex: [['Sentadilla con barra', 4, '10', 150], ['Press banca con barra', 3, '10', 120], ['Dominadas / chin-ups', 3, 'al fallo', 120],
        ['Press militar con barra', 4, '10', 120], ['Curl con barra de pie', 3, '10', 90], ['Abdominales completos (sit-ups)', 3, 'al fallo', 60]] },
      { id: 'g6r2', name: 'Descanso', rest: true, ex: [] },
      { id: 'g6c', name: 'Día C · Golden Six', ex: [['Sentadilla con barra', 4, '10', 150], ['Press banca con barra', 3, '10', 120], ['Dominadas / chin-ups', 3, 'al fallo', 120],
        ['Press militar con barra', 4, '10', 120], ['Curl con barra de pie', 3, '10', 90], ['Abdominales completos (sit-ups)', 3, 'al fallo', 60]] },
      { id: 'g6r3', name: 'Descanso', rest: true, ex: [] },
      { id: 'g6r4', name: 'Descanso', rest: true, ex: [] }
    ]
  },
  arnold1: {
    desc: 'El split clásico de Arnold en su versión básica (nivel I de su enciclopedia, según lo reportado): pecho + espalda, hombro + brazo y pierna, dos veces por semana. 3–4 series de ~10 en todo y abdomen 5 × 25.',
    level: 'Intermedio', ico: '🏆', weeks: '8–16 semanas',
    src: 'Muscle & Strength ("Variation 1", citando la enciclopedia), BarBend',
    days: (() => {
      const cb = [['Press banca con barra', 4, '10', 120], ['Press inclinado con barra', 4, '10', 120], ['Pullover con mancuerna (banco transversal)', 3, '10', 90],
        ['Dominadas / chin-ups', 4, '10', 120], ['Remo con barra', 4, '10', 120], ['Peso muerto', 3, '10', 150], ABS_ARNOLD];
      const sa = [['Press militar con barra', 4, '10', 120], ['Elevaciones laterales', 4, '10', 60], ['Pájaros con mancuernas', 3, '10', 60],
        ['Curl con barra de pie', 4, '10', 75], ['Curl inclinado con mancuernas', 3, '10', 75], ['Press francés con barra EZ', 4, '10', 75], ['Extensión de tríceps en polea', 3, '10', 60], ABS_ARNOLD];
      const lg = [['Sentadilla con barra', 4, '10', 150], ['Zancadas con barra', 3, '10 por pierna', 90], ['Curl femoral tumbado', 4, '10', 75],
        ['Peso muerto rumano con barra', 3, '10', 120]].concat(CALVES_ARNOLD.slice(0, 1), [ABS_ARNOLD]);
      return [{ id: 'a1', name: 'Día 1 · Pecho y espalda', ex: cb }, { id: 'a2', name: 'Día 2 · Hombro y brazo', ex: sa }, { id: 'a3', name: 'Día 3 · Pierna', ex: lg },
        { id: 'a4', name: 'Día 4 · Pecho y espalda', ex: cb }, { id: 'a5', name: 'Día 5 · Hombro y brazo', ex: sa }, { id: 'a6', name: 'Día 6 · Pierna', ex: lg },
        { id: 'a7', name: 'Descanso', rest: true, ex: [] }];
    })()
  },
  arnold2: {
    desc: 'El volumen de competencia de la era dorada: pirámides (10/8/6/4), pecho y espalda en súper serie de antagonistas, cada músculo 2 veces por semana. Arnold lo hacía en doble sesión de 2–3 h; aquí está condensado en una sesión por día. Solo para quien ya entrena fuerte y se recupera bien.',
    level: 'Avanzado', ico: '🥇', weeks: 'Bloques de 6–8 semanas',
    src: 'BarBend; Muscle & Strength ("Variation 2"); Marty Gallagher vía Iron Company',
    days: (() => {
      const cb = [['Press banca con barra', 4, '10/8/6/4', 150], ['Dominadas / chin-ups', 4, '10 o más', 120], ['Press inclinado con barra', 4, '10/8/6/4', 150], ['Remo en T (Magnum)', 4, '15/12/8/6', 120],
        ['Aperturas con mancuernas', 3, '10/8/6', 90], ['Remo con barra', 4, '8–12', 120], ['Fondos en paralelas (con lastre)', 3, '15/10/8', 90], ['Pullover con mancuerna (banco transversal)', 3, '12', 75], ABS_ARNOLD];
      const sa = [['Press militar con barra', 5, '8–10', 120], ['Elevaciones laterales', 5, '10', 60], ['Pájaros con mancuernas', 4, '10', 60], ['Press Arnold', 3, '10', 90],
        ['Curl con barra de pie', 5, '15/10/8/6/4', 90], ['Curl inclinado con mancuernas', 4, '10', 75], ['Curl concentrado', 3, '10', 60],
        ['Press francés con barra EZ', 4, '10', 75], ['Extensión de tríceps en polea', 4, '10', 60], ['Curl de muñeca con mancuerna', 3, '15', 45]];
      const lg = [['Sentadilla con barra', 5, '10/8/6/4/4', 180], ['Hack squat', 3, '10', 120], ['Prensa 45°', 4, '8–12', 120], ['Extensión de cuádriceps', 4, '12–15', 75],
        ['Curl femoral tumbado', 4, '10–15', 75], ['Peso muerto rumano con barra', 4, '12–15', 120], ['Zancadas con barra', 3, '15 por pierna', 90]].concat(CALVES_ARNOLD, [ABS_ARNOLD]);
      return [{ id: 'b1', name: 'Día 1 · Pecho y espalda', ex: cb }, { id: 'b2', name: 'Día 2 · Hombro y brazo', ex: sa }, { id: 'b3', name: 'Día 3 · Pierna', ex: lg },
        { id: 'b4', name: 'Día 4 · Pecho y espalda', ex: cb }, { id: 'b5', name: 'Día 5 · Hombro y brazo', ex: sa }, { id: 'b6', name: 'Día 6 · Pierna', ex: lg },
        { id: 'b7', name: 'Descanso', rest: true, ex: [] }];
    })()
  },
  cbum: {
    desc: 'Estilo Classic Physique moderno: rotación de 3 días, 1 de descanso, 3 días y 1 de descanso (ciclo de 8 días, no de semana), cada músculo con su día. Muchas máquinas, bajadas lentas, pausas, drop sets y súper series, y calentamiento hasta una serie fuerte de 6–10.',
    level: 'Avanzado', ico: '💎', weeks: 'Bloques de 8 días que se repiten',
    src: 'Fitness Volt (split de su preparación 2023), Generation Iron, Men\'s Journal, Men\'s Fitness',
    days: [
      { id: 'c1', name: 'Día 1 · Cuádriceps', ex: [['Extensión de cuádriceps', 3, '5–7 (calentamiento pesado)', 75], ['Prensa de piernas (máquina)', 3, '8–12', 120], ['Hack squat', 3, '10–12', 120],
        ['Sentadilla en Smith', 4, '10', 120], ['Zancadas / split squat búlgaro', 3, '10 por pierna', 90], ['Aductor (máquina)', 3, '12–15', 60], ['Elevación de talones sentado', 3, '12–15', 60]] },
      { id: 'c2', name: 'Día 2 · Pecho y algo de tríceps', ex: [['Press inclinado con mancuernas', 3, '8 (baja el peso cada serie)', 120], ['Press de pecho Magnum (discos)', 2, '12 (bajada lenta)', 90],
        ['Press inclinado (máquina)', 3, '10–12', 90], ['Cruces en polea', 3, '15–20', 60], ['Lagartijas', 1, 'al fallo', 60], ['Extensión de tríceps en polea', 2, '8–10 + drop set', 60]] },
      { id: 'c3', name: 'Día 3 · Espalda y algo de bíceps', ex: [['Jalón al pecho', 3, '12–15 (pausa abajo)', 90], ['Remo con pecho apoyado (mancuernas)', 3, '12', 90], ['Remo a una mano en polea', 2, '15 o más', 75],
        ['Remo con barra', 2, '12–15 (agarre supino)', 90], ['Pullover en polea (brazos rectos)', 3, '12–15', 60], ['Curl predicador', 2, '8–10 + drop set', 60]] },
      { id: 'c4', name: 'Descanso', rest: true, ex: [] },
      { id: 'c5', name: 'Día 4 · Hombro y algo de pecho', ex: [['Elevaciones laterales', 4, '12–15', 60], ['Shoulder press (máquina)', 3, '8–10', 120], ['Pájaro posterior (reverse pec deck)', 3, '15', 45],
        ['Elevaciones laterales sentado', 3, '12', 45], ['Press militar con mancuernas', 3, '8–10', 90], ['Pec deck (aperturas en máquina)', 2, '12–15', 60]] },
      { id: 'c6', name: 'Día 5 · Femoral y algo de espalda', ex: [['Curl femoral tumbado', 4, '10–12', 75], ['Peso muerto rumano', 3, '8–10', 120], ['Curl femoral sentado', 3, '12–15', 60],
        ['Hiperextensiones', 3, '12–15', 60], ['Remo sentado (máquina)', 3, '12', 75], ['Elevación de talones de pie', 4, '12–15', 60]] },
      { id: 'c7', name: 'Día 6 · Brazo', ex: [['Extensión de tríceps en polea', 2, '8–10 + drop set', 60], ['Press francés', 2, '8–10 (banco inclinado)', 75], ['Curl predicador', 3, '8–10 + drop set', 60],
        ['Curl martillo', 2, '12', 60], ['Curl en polea', 2, '12–15', 45], ['Extensión de tríceps (máquina)', 2, '12', 45]] },
      { id: 'c8', name: 'Descanso', rest: true, ex: [] }
    ]
  }
};
const COMP_KEYS = Object.keys(COMP_ROUTINES);
COMP_KEYS.forEach(k => { const c = COMP_ROUTINES[k]; ROUTINES[k] = { name: COMP_NAMES[k], desc: c.desc, days: c.days, comp: true }; ROUTINE_ICO[k] = c.ico; ROUTINE_LEVEL[k] = c.level; });
const isCompRoutine = k => COMP_KEYS.includes(k);

/** Cómo queda un ejercicio en tu gimnasio (para la vista previa del programa). */
function adaptedName(name) { const a = okForMe(name) ? null : adaptFor(name); return a && a.alt ? a.alt : name; }
/** 22.0: lo que harás en cada ejercicio de un día, con la misma regla que al empezar la sesión (sin repetir máquina). */
function adaptList(exs) {
  const used = exs.map(e => e[0]).filter(okForMe);
  return exs.map(e => { const a = adaptFor(e[0], used); if (a && a.alt) { used.push(a.alt); return a.alt; } return e[0]; });
}
function routineAdaptCount(key) {
  return ROUTINES[key].days.reduce((a, d) => { const al = adaptList(d.ex); return a + d.ex.filter((e, i) => al[i] !== e[0]).length; }, 0);
}

/* ---------- Plan de preparación ---------- */
const COMP_CATS = {
  classic: 'Classic Physique', bodybuilding: 'Fisicoculturismo (Bodybuilding)', mens: "Men's Physique",
  bikini: 'Bikini', wellness: 'Wellness', figure: 'Figura'
};
/** Fase según las semanas que faltan para el show. */
function compPhase() {
  const c = DB.profile.comp;
  if (!c || !c.date) return { k: 'off', name: 'Fuera de temporada', weeks: null };
  const days = daysBetween(todayStr(), c.date), weeks = Math.ceil(days / 7);
  if (days < 0) return { k: 'post', name: 'Después del show', weeks, days };
  if (days <= 7) return { k: 'show', name: 'Semana del show', weeks, days };
  if (weeks <= 20) return { k: 'prep', name: 'Preparación', weeks, days };
  return { k: 'off', name: 'Fuera de temporada', weeks, days };
}
const PHASE_GUIDE = {
  off: { cardio: '20 min de cardio suave 3–5 días', poses: 'Poses obligatorias 2 veces por semana (10 min)', food: 'volumen', text: 'Construye músculo con un superávit pequeño. Busca subir tus pesos en los básicos de cada día.' },
  prep: { cardio: 'Empieza con 30 min diarios y súbelos poco a poco (hasta ~45 min) si la pérdida de peso se estanca', poses: 'Poses 10–15 min diarios; rutina de libre si tu categoría la tiene', food: 'definicion', text: 'Déficit moderado (0.5–1 % de tu peso por semana) manteniendo la intensidad para conservar músculo.' },
  show: { cardio: 'Cardio suave, sin experimentos', poses: 'Ensaya tus poses y tu entrada cada día', food: 'definicion', text: 'No cambies nada drástico. La semana del show (agua, sodio, carbohidratos) debe guiarla tu coach.' },
  post: { cardio: 'Cardio suave', poses: 'Descansa de las poses', food: 'mantener', text: 'Regresa poco a poco a tus calorías de mantenimiento para evitar el rebote.' }
};
function compPlanCard() {
  const p = DB.profile, c = p.comp, ph = compPhase(), g = PHASE_GUIDE[ph.k];
  if (!c && !isCompRoutine(p.routine)) return '';
  return `<div class="card keep comp-card">
    <div class="row spread"><div><div class="small muted">Preparación para competir</div><h2 style="margin:0">${c && c.cat ? esc(COMP_CATS[c.cat]) : 'Sin fecha de show'}</h2></div>
      <span class="pill">${esc(ph.name)}${ph.weeks != null && ph.k !== 'post' ? ` · ${ph.weeks} sem` : ''}</span></div>
    <p class="small" style="margin:8px 0">${esc(g.text)}</p>
    <ul class="comp-list"><li>${ico('heart-pulse', 16)}<span>${esc(g.cardio)}</span></li><li>${ico('person-standing', 16)}<span>${esc(g.poses)}</span></li><li>${ico('camera', 16)}<span>Foto de frente, lado y espalda cada semana con la misma luz</span></li></ul>
    ${p.phase !== g.food && g.food !== 'mantener' ? `<button class="secondary block" id="cp-food">Ajustar mi nutrición a ${g.food === 'volumen' ? 'volumen' : 'definición'}</button>` : ''}
    <button class="ghost block" id="cp-edit" style="margin-top:6px">${c ? 'Cambiar fecha o categoría' : 'Poner la fecha de mi show'}</button>
  </div>`;
}
function bindCompPlan(root, rerender) {
  const f = $('#cp-food', root); if (f) f.onclick = () => { DB.profile.phase = PHASE_GUIDE[compPhase().k].food; saveData(); rerender(); toast('Nutrición ajustada a la fase'); };
  const e = $('#cp-edit', root); if (e) e.onclick = () => openCompSetup(rerender);
}
function openCompSetup(after) {
  const c = Object.assign({ cat: fem() ? 'bikini' : 'classic', date: '' }, DB.profile.comp || {});
  openModal(`<h3>Tu show</h3><p class="small muted" style="margin-top:0">Con la fecha calculo tu fase: fuera de temporada, preparación (20 semanas antes) y semana del show.</p>
    <label>Fecha de la competencia<input type="date" id="cs-date" value="${esc(c.date)}"></label>
    <div class="rir-label"><span>Categoría</span></div>
    <div class="chips">${Object.keys(COMP_CATS).map(k => `<button class="chip-btn ${c.cat === k ? 'on' : ''}" data-cc="${k}">${COMP_CATS[k]}</button>`).join('')}</div>
    <p class="small muted">Una preparación real necesita coach y revisión médica. La app no da protocolos de deshidratación, diuréticos ni sustancias.</p>
    <button class="block" id="cs-ok" style="margin-top:8px">Guardar</button>${DB.profile.comp ? '<button class="ghost block" id="cs-del" style="margin-top:6px">Quitar fecha</button>' : ''}`, m => {
    $$('[data-cc]', m).forEach(b => b.onclick = () => { c.cat = b.dataset.cc; $$('[data-cc]', m).forEach(x => x.classList.toggle('on', x === b)); });
    $('#cs-ok', m).onclick = () => { c.date = $('#cs-date', m).value; DB.profile.comp = c; saveData(); closeModal(); if (after) after(); };
    const d = $('#cs-del', m); if (d) d.onclick = () => { delete DB.profile.comp; saveData(); closeModal(); if (after) after(); };
  });
}

/* ---------- 22.0 · "Entrena como…": rutinas famosas listas en Mi rutina ---------- */
const FAMOUS_KEYS = ['cbum', 'heroe', 'arnold1', 'golden6', 'arnold2'];
const FAMOUS_SHORT = { cbum: 'CBUM · Classic Physique', heroe: 'Tom Holland · Spider-Man', arnold1: 'Arnold split', golden6: 'Golden Six', arnold2: 'Arnold · era dorada' };
FAMOUS_KEYS.forEach(k => { if (ROUTINES[k]) ROUTINES[k].famous = true; });
