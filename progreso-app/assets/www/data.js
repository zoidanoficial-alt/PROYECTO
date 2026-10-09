'use strict';
/*
 * Contenido de la app: ejercicios, rutinas, nutrición, suplementos, hábitos y
 * mentalidad. Resumido de los libros que compartió el usuario (estilo "Get The
 * Pump", Arnold Schwarzenegger, Marc McLean y Jeff Olson) más el plan inicial.
 */

/* ------------------------------------------------------------------ *
 *  Ejercicios
 *  [nombre, grupo, tipo (c = compuesto, a = aislamiento), patrón, equipo, ¿Planet Fitness?, ícono]
 *  El patrón agrupa ejercicios intercambiables (para sustituir una máquina ocupada).
 *  El equipo decide la unidad por defecto: máquinas y poleas en lb, como sus placas.
 * ------------------------------------------------------------------ */
const EX_LIST = [
  // Sentadilla / prensa
  ['Sentadilla con barra', 'pierna', 'c', 'sentadilla', 'barra', 0, 'squat'],
  ['Sentadilla en Smith', 'pierna', 'c', 'sentadilla', 'smith', 1, 'squat'],
  ['Hack squat', 'pierna', 'c', 'sentadilla', 'maq', 0, 'squat'],
  ['Prensa 45°', 'pierna', 'c', 'sentadilla', 'maq', 0, 'legpress'],
  ['Prensa de piernas (máquina)', 'pierna', 'c', 'sentadilla', 'maq', 1, 'legpress'],
  ['Sentadilla goblet con mancuerna', 'pierna', 'c', 'sentadilla', 'manc', 1, 'squat'],
  ['Zancadas / split squat búlgaro', 'pierna', 'c', 'zancada', 'manc', 1, 'lunge'],
  ['Zancadas en Smith', 'pierna', 'c', 'zancada', 'smith', 1, 'lunge'],
  ['Extensión de cuádriceps', 'pierna', 'a', 'ext-cuad', 'maq', 1, 'legext'],
  // Bisagra / femoral / glúteo
  ['Peso muerto', 'espalda', 'c', 'bisagra', 'barra', 0, 'hinge'],
  ['Peso muerto rumano', 'femoral', 'c', 'bisagra', 'manc', 1, 'hinge'],
  ['Peso muerto rumano en Smith', 'femoral', 'c', 'bisagra', 'smith', 1, 'hinge'],
  ['Hip thrust', 'gluteo', 'c', 'gluteo', 'smith', 1, 'hipthrust'],
  ['Patada de glúteo (máquina)', 'gluteo', 'a', 'gluteo', 'maq', 1, 'hipthrust'],
  ['Curl femoral tumbado', 'femoral', 'a', 'curl-fem', 'maq', 0, 'legcurl'],
  ['Curl femoral sentado', 'femoral', 'a', 'curl-fem', 'maq', 1, 'legcurl'],
  ['Abductor (máquina)', 'gluteo', 'a', 'abductor', 'maq', 1, 'abduct'],
  ['Aductor (máquina)', 'pierna', 'a', 'aductor', 'maq', 1, 'abduct'],
  ['Hiperextensiones', 'espalda', 'a', 'lumbar', 'corporal', 0, 'backext'],
  ['Extensión de espalda (máquina)', 'espalda', 'a', 'lumbar', 'maq', 1, 'backext'],
  // Pecho
  ['Press banca con barra', 'pecho', 'c', 'empuje-h', 'barra', 0, 'bench'],
  ['Press banca con mancuernas', 'pecho', 'c', 'empuje-h', 'manc', 1, 'bench'],
  ['Press banca en Smith', 'pecho', 'c', 'empuje-h', 'smith', 1, 'bench'],
  ['Chest press (máquina)', 'pecho', 'c', 'empuje-h', 'maq', 1, 'bench'],
  ['Hammer Strength press', 'pecho', 'c', 'empuje-h', 'maq', 0, 'bench'],
  ['Press inclinado con barra', 'pecho', 'c', 'empuje-inc', 'barra', 0, 'incline'],
  ['Press inclinado con mancuernas', 'pecho', 'c', 'empuje-inc', 'manc', 1, 'incline'],
  ['Press inclinado en Smith', 'pecho', 'c', 'empuje-inc', 'smith', 1, 'incline'],
  ['Fondos en paralelas (con lastre)', 'pecho', 'c', 'fondos', 'corporal', 0, 'dip'],
  ['Fondos asistidos (máquina)', 'pecho', 'c', 'fondos', 'maq', 1, 'dip'],
  ['Aperturas con mancuernas', 'pecho', 'a', 'apertura', 'manc', 1, 'fly'],
  ['Aperturas en máquina / polea', 'pecho', 'a', 'apertura', 'maq', 1, 'fly'],
  ['Pec deck (aperturas en máquina)', 'pecho', 'a', 'apertura', 'maq', 1, 'fly'],
  ['Cruces en polea', 'pecho', 'a', 'apertura', 'polea', 1, 'fly'],
  // Espalda
  ['Remo con barra', 'espalda', 'c', 'remo', 'barra', 0, 'row'],
  ['Remo con mancuerna', 'espalda', 'c', 'remo', 'manc', 1, 'row'],
  ['Remo inclinado con mancuernas', 'espalda', 'c', 'remo', 'manc', 1, 'row'],
  ['Remo en Smith', 'espalda', 'c', 'remo', 'smith', 1, 'row'],
  ['Remo sentado (máquina)', 'espalda', 'c', 'remo', 'maq', 1, 'seatedrow'],
  ['Remo en polea agarre estrecho', 'espalda', 'c', 'remo', 'polea', 1, 'seatedrow'],
  ['Remo a una mano en polea', 'espalda', 'c', 'remo', 'polea', 1, 'seatedrow'],
  ['Jalón al pecho', 'espalda', 'c', 'jalon', 'maq', 1, 'pulldown'],
  ['Dominadas / chin-ups', 'espalda', 'c', 'jalon', 'corporal', 0, 'pullup'],
  ['Dominadas asistidas (máquina)', 'espalda', 'c', 'jalon', 'maq', 1, 'pullup'],
  // Hombro
  ['Press militar con barra', 'hombro', 'c', 'empuje-v', 'barra', 0, 'ohp'],
  ['Press militar con mancuernas', 'hombro', 'c', 'empuje-v', 'manc', 1, 'ohp'],
  ['Press militar en Smith', 'hombro', 'c', 'empuje-v', 'smith', 1, 'ohp'],
  ['Shoulder press (máquina)', 'hombro', 'c', 'empuje-v', 'maq', 1, 'ohp'],
  ['Remo al cuello', 'hombro', 'c', 'remo-cuello', 'manc', 1, 'curl'],
  ['Elevaciones laterales', 'hombro', 'a', 'elev-lat', 'manc', 1, 'lateral'],
  ['Elevaciones laterales sentado', 'hombro', 'a', 'elev-lat', 'manc', 1, 'lateral'],
  ['Elevaciones laterales en polea', 'hombro', 'a', 'elev-lat', 'polea', 1, 'lateral'],
  ['Elevaciones frontales', 'hombro', 'a', 'elev-front', 'manc', 1, 'lateral'],
  ['Pájaro posterior (reverse pec deck)', 'hombro', 'a', 'deltoide-post', 'maq', 1, 'reardelt'],
  ['Pájaros con mancuernas', 'hombro', 'a', 'deltoide-post', 'manc', 1, 'reardelt'],
  ['Face pull', 'hombro', 'a', 'deltoide-post', 'polea', 1, 'seatedrow'],
  // Brazos
  ['Press banca agarre cerrado', 'triceps', 'c', 'triceps-c', 'barra', 0, 'bench'],
  ['Curl con barra de pie', 'biceps', 'a', 'curl', 'barra', 1, 'curl'],
  ['Curl inclinado con mancuernas', 'biceps', 'a', 'curl', 'manc', 1, 'curl'],
  ['Curl predicador', 'biceps', 'a', 'curl', 'maq', 0, 'curl'],
  ['Curl martillo', 'biceps', 'a', 'curl', 'manc', 1, 'curl'],
  ['Curl de bíceps (máquina)', 'biceps', 'a', 'curl', 'maq', 1, 'curl'],
  ['Curl en polea', 'biceps', 'a', 'curl', 'polea', 1, 'curl'],
  ['Extensión de tríceps en polea', 'triceps', 'a', 'triceps', 'polea', 1, 'triceps'],
  ['Extensión de tríceps (máquina)', 'triceps', 'a', 'triceps', 'maq', 1, 'triceps'],
  ['Press francés', 'triceps', 'a', 'triceps', 'manc', 1, 'triceps'],
  // Pantorrilla y abdomen
  ['Elevación de talones de pie', 'pantorrilla', 'a', 'pantorrilla', 'smith', 1, 'calf'],
  ['Elevación de talones sentado', 'pantorrilla', 'a', 'pantorrilla', 'maq', 0, 'calf'],
  ['Elevación de talones en prensa', 'pantorrilla', 'a', 'pantorrilla', 'maq', 1, 'calf'],
  ['Donkey calf raise', 'pantorrilla', 'a', 'pantorrilla', 'corporal', 0, 'calf'],
  ['Crunch en polea', 'abdomen', 'a', 'abdomen', 'polea', 1, 'abs'],
  ['Crunch abdominal (máquina)', 'abdomen', 'a', 'abdomen', 'maq', 1, 'abs'],
  ['Torso rotation (máquina)', 'abdomen', 'a', 'abdomen', 'maq', 1, 'rotation'],
  ['Elevaciones de piernas colgado', 'abdomen', 'a', 'abdomen', 'corporal', 1, 'abs'],
  ['Plancha', 'abdomen', 'a', 'abdomen', 'corporal', 1, 'plank']
];

const EX = {};
EX_LIST.forEach(([n, g, t, p, e, pf, icon]) => { EX[n] = { g, t, p, e, pf: !!pf, icon }; });

const EQUIP = { barra: 'Barra', manc: 'Mancuernas', maq: 'Máquina', polea: 'Polea', smith: 'Smith', corporal: 'Peso corporal' };

const GROUPS = {
  pecho: 'Pecho', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps',
  pierna: 'Cuádriceps', femoral: 'Femoral', gluteo: 'Glúteo', pantorrilla: 'Pantorrilla', abdomen: 'Abdomen'
};

/** Series efectivas por semana que se consideran óptimas por grupo (meta del mapa de calor). */
const WEEKLY_TARGET = { pecho: 16, espalda: 18, hombro: 16, biceps: 12, triceps: 12, pierna: 16, femoral: 12, gluteo: 12, pantorrilla: 12, abdomen: 12 };
/** Por encima de esta proporción de la meta se avisa de sobreentrenamiento. */
const OVERREACH = 1.4;

/* Nivel de fuerza relativo: 1RM estimado / peso corporal (hombres, aproximado). */
const STRENGTH_LEVELS = ['Principiante', 'Intermedio', 'Avanzado', 'Élite'];
const STRENGTH_LIFTS = [
  { name: 'Press banca', ex: ['Press banca con barra', 'Press banca en Smith'], cuts: [0.75, 1.25, 1.75] },
  { name: 'Sentadilla', ex: ['Sentadilla con barra', 'Sentadilla en Smith'], cuts: [1.0, 1.5, 2.25] },
  { name: 'Peso muerto', ex: ['Peso muerto'], cuts: [1.25, 1.75, 2.5] },
  { name: 'Press militar', ex: ['Press militar con barra', 'Press militar en Smith'], cuts: [0.5, 0.8, 1.1] }
];

/* ------------------------------------------------------------------ *
 *  Ilustraciones (pictogramas SVG por movimiento)
 * ------------------------------------------------------------------ */
const ICONS = {
  squat: [[30, 11], 'M30 16L28 32M28 32L40 34L38 50M35 50H44M14 18H46M14 13V23M46 13V23M30 20L22 18'],
  legpress: [[16, 19], 'M17 24L23 42M23 42L35 32L45 40M45 28L53 46M40 56L58 22M10 22L18 48'],
  hinge: [[22, 13], 'M25 17L40 29M40 29L40 52M28 21L29 41M16 42H44M16 36V48M44 36V48'],
  hipthrust: [[12, 25], 'M6 32H20M16 28L34 29L42 40L44 52M28 22H40M28 18V26M40 18V26'],
  bench: [[14, 33], 'M8 40H50M48 40L50 52M18 36H40L50 46V54M24 35V20M10 20H40M10 15V25M40 15V25'],
  incline: [[17, 40], 'M12 50L42 30M20 42L38 32M38 32L48 44V54M26 38L20 22M10 20H34M10 15V25M34 15V25'],
  dip: [[32, 11], 'M14 30H26M38 30H50M32 16V36M32 20L22 30M32 20L42 30M32 36L28 50M32 36L36 50'],
  ohp: [[32, 20], 'M32 25V42M32 42L26 56M32 42L38 56M32 28L22 12M32 28L42 12M14 10H50M14 5V15M50 5V15'],
  pulldown: [[32, 24], 'M14 10H50M32 4V10M32 29V44M24 46H42M32 44H44V54M32 32L18 12M32 32L46 12'],
  pullup: [[32, 18], 'M10 8H54M32 23V42M32 42L30 56M32 26L24 8M32 26L40 8'],
  row: [[18, 17], 'M22 21L40 31M40 31L42 54M28 25L31 38M25 40H37M25 36V44M37 36V44'],
  seatedrow: [[18, 22], 'M10 48H30M20 27L22 46M22 46L44 44M46 38V52M21 32L36 34M36 34H54M54 18V50'],
  fly: [[32, 11], 'M32 16V40M32 22Q20 16 10 26M32 22Q44 16 54 26M32 40L28 56M32 40L36 56'],
  lateral: [[32, 11], 'M32 16V40M32 22L12 24M32 22L52 24M10 19V29M54 19V29M32 40L28 56M32 40L36 56'],
  reardelt: [[18, 20], 'M22 24L40 32M40 32L40 54M28 27L14 22M28 27L42 20'],
  curl: [[32, 11], 'M32 16V40M32 22L29 32L40 24M38 19L42 29M32 40L28 56M32 40L36 56'],
  triceps: [[28, 11], 'M50 6V50M50 10H40V28M28 16V40M28 22L30 32L40 30M28 40L24 56M28 40L32 56'],
  legext: [[18, 20], 'M12 28V48H30M18 25L20 44M20 44H34M34 44L50 38M48 34V42'],
  legcurl: [[18, 20], 'M12 28V48H30M18 25L20 44M20 44H34M34 44L30 57M26 54H34'],
  calf: [[32, 10], 'M32 15V36M32 36V50M32 50L36 54M22 56H44M22 15H42'],
  abs: [[18, 35], 'M8 54H56M22 38L32 48M32 48L42 38L50 52'],
  plank: [[12, 34], 'M8 52H56M16 36L52 44M18 38V50H26'],
  abduct: [[32, 14], 'M32 19V38M32 38L18 54M32 38L46 54M14 50V58M50 50V58M22 40H42'],
  backext: [[16, 30], 'M20 32L40 36M40 36L52 52M24 52L40 36'],
  rotation: [[32, 12], 'M32 17V40M22 26L42 22M18 42Q32 50 46 42M32 40L28 56M32 40L36 56'],
  lunge: [[30, 10], 'M30 15V34M30 34L42 40V54M30 34L22 46L16 52']
};
function exIcon(name, size) {
  const id = EX_PHOTO[name];
  if (id) return `<img class="ex-photo" src="img/ex/${id}-0.jpg" width="${size || 44}" height="${size || 44}" loading="lazy" alt="">`;
  const info = EX[name], def = ICONS[(info && info.icon) || 'curl'];
  return `<svg class="ex-ico" width="${size || 44}" height="${size || 44}" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="${def[0][0]}" cy="${def[0][1]}" r="4.5" fill="currentColor"/>
    <path d="${def[1]}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}


/* ------------------------------------------------------------------ *
 *  Fotos reales de cada ejercicio (posición inicial y final).
 *  Fuente: Free Exercise DB (github.com/yuhonas/free-exercise-db), dominio público (Unlicense).
 * ------------------------------------------------------------------ */
const EX_PHOTO = {
  "Sentadilla con barra": "Barbell_Squat",
  "Sentadilla en Smith": "Smith_Machine_Squat",
  "Hack squat": "Hack_Squat",
  "Prensa 45°": "Leg_Press",
  "Prensa de piernas (máquina)": "Leg_Press",
  "Sentadilla goblet con mancuerna": "Goblet_Squat",
  "Zancadas / split squat búlgaro": "Split_Squat_with_Dumbbells",
  "Zancadas en Smith": "Smith_Single-Leg_Split_Squat",
  "Extensión de cuádriceps": "Leg_Extensions",
  "Peso muerto": "Barbell_Deadlift",
  "Peso muerto rumano": "Stiff-Legged_Dumbbell_Deadlift",
  "Peso muerto rumano en Smith": "Smith_Machine_Stiff-Legged_Deadlift",
  "Hip thrust": "Barbell_Hip_Thrust",
  "Patada de glúteo (máquina)": "Glute_Kickback",
  "Curl femoral tumbado": "Lying_Leg_Curls",
  "Curl femoral sentado": "Seated_Leg_Curl",
  "Abductor (máquina)": "Thigh_Abductor",
  "Aductor (máquina)": "Thigh_Adductor",
  "Hiperextensiones": "Hyperextensions_Back_Extensions",
  "Extensión de espalda (máquina)": "Hyperextensions_Back_Extensions",
  "Press banca con barra": "Barbell_Bench_Press_-_Medium_Grip",
  "Press banca con mancuernas": "Dumbbell_Bench_Press",
  "Press banca en Smith": "Smith_Machine_Bench_Press",
  "Chest press (máquina)": "Machine_Bench_Press",
  "Hammer Strength press": "Leverage_Chest_Press",
  "Press inclinado con barra": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "Press inclinado con mancuernas": "Incline_Dumbbell_Press",
  "Press inclinado en Smith": "Smith_Machine_Incline_Bench_Press",
  "Fondos en paralelas (con lastre)": "Dips_-_Chest_Version",
  "Fondos asistidos (máquina)": "Dip_Machine",
  "Aperturas con mancuernas": "Dumbbell_Flyes",
  "Aperturas en máquina / polea": "Butterfly",
  "Pec deck (aperturas en máquina)": "Butterfly",
  "Cruces en polea": "Cable_Crossover",
  "Remo con barra": "Bent_Over_Barbell_Row",
  "Remo con mancuerna": "One-Arm_Dumbbell_Row",
  "Remo inclinado con mancuernas": "Dumbbell_Incline_Row",
  "Remo en Smith": "Smith_Machine_Bent_Over_Row",
  "Remo sentado (máquina)": "Leverage_Iso_Row",
  "Remo en polea agarre estrecho": "Seated_Cable_Rows",
  "Remo a una mano en polea": "Seated_One-arm_Cable_Pulley_Rows",
  "Jalón al pecho": "Wide-Grip_Lat_Pulldown",
  "Dominadas / chin-ups": "Chin-Up",
  "Dominadas asistidas (máquina)": "Band_Assisted_Pull-Up",
  "Press militar con barra": "Standing_Military_Press",
  "Press militar con mancuernas": "Dumbbell_Shoulder_Press",
  "Press militar en Smith": "Smith_Machine_Overhead_Shoulder_Press",
  "Shoulder press (máquina)": "Machine_Shoulder_Military_Press",
  "Remo al cuello": "Standing_Dumbbell_Upright_Row",
  "Elevaciones laterales": "Side_Lateral_Raise",
  "Elevaciones laterales sentado": "Seated_Side_Lateral_Raise",
  "Elevaciones laterales en polea": "Cable_Seated_Lateral_Raise",
  "Elevaciones frontales": "Front_Dumbbell_Raise",
  "Pájaro posterior (reverse pec deck)": "Reverse_Machine_Flyes",
  "Pájaros con mancuernas": "Seated_Bent-Over_Rear_Delt_Raise",
  "Face pull": "Face_Pull",
  "Press banca agarre cerrado": "Close-Grip_Barbell_Bench_Press",
  "Curl con barra de pie": "Barbell_Curl",
  "Curl inclinado con mancuernas": "Alternate_Incline_Dumbbell_Curl",
  "Curl predicador": "Preacher_Curl",
  "Curl martillo": "Hammer_Curls",
  "Curl de bíceps (máquina)": "Machine_Bicep_Curl",
  "Curl en polea": "Standing_Biceps_Cable_Curl",
  "Extensión de tríceps en polea": "Triceps_Pushdown",
  "Extensión de tríceps (máquina)": "Machine_Triceps_Extension",
  "Press francés": "EZ-Bar_Skullcrusher",
  "Elevación de talones de pie": "Smith_Machine_Calf_Raise",
  "Elevación de talones sentado": "Seated_Calf_Raise",
  "Elevación de talones en prensa": "Calf_Press_On_The_Leg_Press_Machine",
  "Donkey calf raise": "Donkey_Calf_Raises",
  "Crunch en polea": "Cable_Crunch",
  "Crunch abdominal (máquina)": "Ab_Crunch_Machine",
  "Torso rotation (máquina)": "Cable_Russian_Twists",
  "Elevaciones de piernas colgado": "Hanging_Leg_Raise",
  "Plancha": "Plank"
};

/** Pasos en español por patrón de movimiento: [pasos, error común]. */
const HOWTO = {
  sentadilla: [['Pies a la anchura de hombros, puntas ligeramente hacia afuera.', 'Baja como si te sentaras: cadera atrás y rodillas en la dirección de las puntas.', 'Baja hasta que el muslo quede paralelo al suelo y sube empujando con todo el pie.'], 'Que las rodillas se vayan hacia adentro o que se levanten los talones.'],
  zancada: [['Da un paso largo; el pie de atrás apoyado en la punta (o en un banco en la búlgara).', 'Baja recto hasta que la rodilla de atrás casi toque el suelo.', 'Sube empujando con el talón de la pierna de adelante.'], 'Inclinar el torso hacia adelante o dejar que la rodilla delantera se vaya hacia adentro.'],
  'ext-cuad': [['Ajusta el respaldo para que la rodilla quede alineada con el eje de la máquina.', 'Estira las piernas hasta casi bloquear y aprieta el cuádriceps 1 segundo.', 'Baja despacio, en 2–3 segundos.'], 'Usar impulso y dejar caer el peso.'],
  bisagra: [['Pies a la anchura de cadera, rodillas ligeramente flexionadas.', 'Lleva la cadera hacia atrás con la espalda recta; el peso baja pegado a las piernas.', 'Sube apretando glúteos hasta quedar erguido.'], 'Redondear la espalda baja.'],
  gluteo: [['Coloca el apoyo (banco o almohadilla) de modo que la cadera quede libre.', 'Empuja con los talones y eleva la cadera hasta alinearla con el torso.', 'Aprieta los glúteos 1 segundo arriba y baja controlado.'], 'Arquear la zona lumbar en lugar de mover la cadera.'],
  'curl-fem': [['Ajusta el rodillo justo arriba de los talones y la rodilla alineada con el eje.', 'Flexiona las piernas llevando los talones hacia los glúteos.', 'Regresa despacio sin dejar que el peso golpee.'], 'Levantar la cadera del asiento o del banco.'],
  abductor: [['Siéntate con la espalda apoyada y las almohadillas por fuera de las rodillas.', 'Abre las piernas lo más que puedas de forma controlada.', 'Regresa despacio sin que choquen las placas.'], 'Ir demasiado rápido y rebotar.'],
  aductor: [['Siéntate con la espalda apoyada y las almohadillas por dentro de las rodillas.', 'Cierra las piernas apretando la parte interna del muslo.', 'Abre despacio hasta sentir el estiramiento.'], 'Abrir más de lo que te permite tu flexibilidad.'],
  lumbar: [['Apoya la cadera en la almohadilla y cruza los brazos sobre el pecho.', 'Baja el torso con la espalda recta.', 'Sube hasta quedar en línea recta con las piernas, sin pasarte hacia atrás.'], 'Hiperextender la espalda al final del movimiento.'],
  'empuje-h': [['Acuéstate o siéntate con los omóplatos juntos y los pies firmes.', 'Baja el peso hasta la mitad del pecho con los codos a ~45°.', 'Empuja hacia arriba hasta casi estirar los brazos.'], 'Abrir los codos a 90° o rebotar el peso en el pecho.'],
  'empuje-inc': [['Banco a 30–45°, omóplatos juntos y pies firmes.', 'Baja el peso a la parte alta del pecho.', 'Empuja hacia arriba y ligeramente hacia atrás.'], 'Despegar la espalda del banco para empujar.'],
  fondos: [['Agarra las barras con los brazos estirados (o arrodíllate en la plataforma de asistencia).', 'Baja inclinando un poco el torso hacia adelante hasta que el hombro quede a la altura del codo.', 'Empuja hasta estirar los brazos.'], 'Bajar demasiado: estresa el hombro.'],
  apertura: [['Brazos abiertos con los codos ligeramente flexionados y fijos.', 'Junta las manos frente al pecho como si abrazaras un árbol.', 'Abre despacio hasta sentir el estiramiento en el pecho.'], 'Flexionar y estirar los codos: se convierte en un press.'],
  remo: [['Espalda recta y pecho afuera (inclinado o sentado según el ejercicio).', 'Jala llevando los codos hacia atrás y junta los omóplatos.', 'Regresa estirando los brazos sin encorvar la espalda.'], 'Jalar con los brazos y balancear el torso.'],
  jalon: [['Agarra la barra un poco más ancho que los hombros; muslos fijos bajo el rodillo.', 'Jala la barra hacia la parte alta del pecho llevando los codos hacia abajo.', 'Sube despacio hasta estirar los brazos.'], 'Echarse muy atrás o bajar la barra por detrás de la nuca.'],
  'empuje-v': [['Peso a la altura de los hombros, abdomen firme.', 'Empuja hacia arriba hasta casi estirar los brazos.', 'Baja controlado hasta la altura de la barbilla.'], 'Arquear la espalda baja para empujar.'],
  'remo-cuello': [['Peso frente a los muslos, agarre a la anchura de hombros.', 'Sube el peso pegado al cuerpo llevando los codos hacia arriba y afuera.', 'Para cuando los codos lleguen a la altura de los hombros y baja despacio.'], 'Subir de más: puede lastimar el hombro.'],
  'elev-lat': [['De pie o sentado, mancuernas a los lados y codos ligeramente flexionados.', 'Sube los brazos hacia los lados hasta la altura de los hombros.', 'Baja despacio en 2–3 segundos.'], 'Usar impulso o subir los hombros hacia las orejas.'],
  'elev-front': [['Mancuernas frente a los muslos.', 'Sube un brazo (o los dos) al frente hasta la altura de los hombros.', 'Baja despacio.'], 'Balancear el cuerpo.'],
  'deltoide-post': [['Pecho apoyado (máquina) o torso inclinado hacia adelante.', 'Abre los brazos hacia atrás apretando la parte trasera del hombro.', 'Regresa despacio.'], 'Juntar los omóplatos en exceso: trabaja más la espalda que el hombro.'],
  'triceps-c': [['Acostado en el banco, agarre a la anchura de hombros.', 'Baja la barra a la parte baja del pecho con los codos pegados.', 'Empuja hasta estirar los brazos.'], 'Agarre demasiado cerrado: lastima las muñecas.'],
  curl: [['Codos pegados al cuerpo y fijos.', 'Sube el peso flexionando el codo, sin mover el hombro.', 'Baja despacio hasta casi estirar el brazo.'], 'Balancear el torso para subir el peso.'],
  triceps: [['Codos pegados al cuerpo (o apuntando al techo en el press francés).', 'Estira el codo por completo apretando el tríceps.', 'Regresa despacio sin mover los codos.'], 'Abrir los codos o mover los hombros.'],
  pantorrilla: [['Coloca la punta de los pies en la plataforma con los talones libres.', 'Sube lo más alto posible sobre las puntas y aguanta 1 segundo.', 'Baja hasta sentir el estiramiento completo.'], 'Hacer rebotes cortos sin rango completo.'],
  abdomen: [['Contrae el abdomen antes de empezar.', 'Enrolla el torso llevando las costillas hacia la cadera.', 'Regresa despacio sin perder la tensión.'], 'Jalar con los brazos o el cuello.']
};
const HOWTO_EX = {
  'Plancha': [['Antebrazos bajo los hombros y cuerpo en línea recta de cabeza a talones.', 'Aprieta abdomen y glúteos.', 'Aguanta el tiempo indicado respirando normal.'], 'Dejar caer la cadera o levantarla demasiado.'],
  'Elevaciones de piernas colgado': [['Cuélgate de la barra con los brazos estirados.', 'Sube las piernas (rectas o con rodillas flexionadas) hasta la altura de la cadera o más.', 'Baja despacio sin balancearte.'], 'Usar impulso con el cuerpo.'],
  'Torso rotation (máquina)': [['Siéntate con el torso fijo en la máquina (en la foto, versión con polea).', 'Gira el torso hacia un lado usando el abdomen.', 'Regresa despacio y repite hacia el otro lado.'], 'Girar con los brazos en lugar del tronco.'],
  'Prensa 45°': [['Espalda pegada al respaldo, pies a la anchura de hombros en el centro de la plataforma.', 'Baja hasta que las rodillas formen ~90°.', 'Empuja sin bloquear las rodillas al final.'], 'Despegar la cadera del asiento al bajar.'],
  'Prensa de piernas (máquina)': [['Espalda pegada al respaldo, pies a la anchura de hombros.', 'Baja hasta que las rodillas formen ~90°.', 'Empuja sin bloquear las rodillas al final.'], 'Despegar la cadera del asiento al bajar.'],
  'Peso muerto': [['Barra sobre la mitad del pie, agarre justo por fuera de las piernas.', 'Espalda recta y pecho afuera; empuja el suelo con las piernas.', 'Sube la barra pegada al cuerpo hasta quedar erguido.'], 'Redondear la espalda o alejar la barra del cuerpo.']
};
/** Músculos que trabaja cada patrón (principal y secundarios), para la ficha del ejercicio. */
const MUSCLES = {
  sentadilla: 'Cuádriceps y glúteo · también femoral y abdomen', zancada: 'Cuádriceps y glúteo · también femoral', 'ext-cuad': 'Cuádriceps',
  bisagra: 'Femoral, glúteo y espalda baja', gluteo: 'Glúteo · también femoral', 'curl-fem': 'Femoral', abductor: 'Glúteo medio (parte externa de la cadera)',
  aductor: 'Aductores (parte interna del muslo)', lumbar: 'Espalda baja · también glúteo', 'empuje-h': 'Pecho · también tríceps y hombro frontal',
  'empuje-inc': 'Pecho superior · también hombro frontal y tríceps', fondos: 'Pecho inferior y tríceps', apertura: 'Pecho', remo: 'Espalda media y dorsal · también bíceps',
  jalon: 'Dorsal ancho · también bíceps', 'empuje-v': 'Hombro · también tríceps', 'remo-cuello': 'Hombro lateral y trapecio', 'elev-lat': 'Hombro lateral',
  'elev-front': 'Hombro frontal', 'deltoide-post': 'Hombro posterior y espalda alta', 'triceps-c': 'Tríceps · también pecho', curl: 'Bíceps · también antebrazo',
  triceps: 'Tríceps', pantorrilla: 'Pantorrilla', abdomen: 'Abdomen'
};

/** Patrones cercanos que también sirven de sustituto (ej. prensa ocupada → sentadilla búlgara). */
const RELATED = {
  sentadilla: ['zancada'], zancada: ['sentadilla'], 'empuje-h': ['empuje-inc', 'fondos'], 'empuje-inc': ['empuje-h'],
  fondos: ['empuje-h', 'triceps-c'], 'triceps-c': ['triceps', 'fondos'], triceps: ['triceps-c'], jalon: ['remo'], remo: ['jalon'],
  bisagra: ['gluteo', 'curl-fem'], gluteo: ['bisagra'], 'curl-fem': ['bisagra'], 'elev-lat': ['remo-cuello'], 'remo-cuello': ['elev-lat'],
  apertura: ['empuje-h'], lumbar: ['bisagra']
};

/** Sustitutos ordenados: mismo patrón, luego patrones cercanos, luego mismo grupo; Planet Fitness primero en cada nivel. */
function substitutes(name) {
  const me = EX[name];
  if (!me) return [];
  const all = Object.keys(EX).filter(n => n !== name);
  const pf = (a, b) => EX[b].pf - EX[a].pf;
  const same = all.filter(n => EX[n].p === me.p).sort(pf);
  const near = all.filter(n => (RELATED[me.p] || []).includes(EX[n].p)).sort(pf);
  const group = all.filter(n => EX[n].g === me.g && !same.includes(n) && !near.includes(n)).sort(pf);
  return same.concat(near, group).slice(0, 8);
}

/* Máquinas típicas de Planet Fitness (el equipo varía por sucursal). */
const PF_NOTE = 'Equipo típico de Planet Fitness: máquinas de placas (en lb), Smith, poleas, mancuernas hasta ~75 lb y estaciones de piernas. Cada sucursal varía.';

/* ------------------------------------------------------------------ *
 *  Rutinas predefinidas
 *  Cada ejercicio: [nombre, series, reps (texto), descanso en s]
 * ------------------------------------------------------------------ */
const CALVES = [['Elevación de talones de pie', 2, '25', 60], ['Elevación de talones sentado', 2, '25', 60], ['Donkey calf raise', 2, '25', 60]];

const ROUTINES = {
  pro: {
    name: 'Pro Split · Get The Pump',
    desc: 'Alta intensidad y volumen por grupo muscular. Ciclo de 7 días; pantorrillas 2 días sí, 1 no, 2 sí.',
    days: [
      { id: 'd1', name: 'Día 1 · Pierna', ex: [
        ['Hack squat', 4, '12–15', 120], ['Prensa 45°', 3, '12–15', 120],
        ['Sentadilla en Smith', 3, '6–7 explosivas', 150],
        ['Curl femoral tumbado', 4, '12–15', 75], ['Curl femoral sentado', 4, '8', 75]].concat(CALVES) },
      { id: 'd2', name: 'Día 2 · Pecho', ex: [
        ['Press inclinado con mancuernas', 3, '15', 120], ['Press inclinado con barra', 3, '10–12', 120],
        ['Fondos en paralelas (con lastre)', 3, '10–12', 120],
        ['Aperturas con mancuernas', 4, '10–12 (2 inclinado + 2 plano)', 75]].concat(CALVES) },
      { id: 'd3', name: 'Día 3 · Descanso', rest: true, ex: [] },
      { id: 'd4', name: 'Día 4 · Espalda', ex: [
        ['Remo en polea agarre estrecho', 4, '12–15', 105], ['Jalón al pecho', 4, '15', 105],
        ['Remo inclinado con mancuernas', 4, '12', 105], ['Remo a una mano en polea', 3, '12–15', 90],
        ['Hiperextensiones', 2, '15–20', 60]].concat(CALVES) },
      { id: 'd5', name: 'Día 5 · Hombro', ex: [
        ['Elevaciones laterales sentado', 5, '2 de calentamiento + 3 × 10–12', 60],
        ['Elevaciones frontales', 4, '10–12', 60], ['Press militar con barra', 4, '12', 120],
        ['Remo al cuello', 3, '15, 12, 10 (subiendo peso)', 90],
        ['Pájaro posterior (reverse pec deck)', 3, '10', 60]].concat(CALVES) },
      { id: 'd6', name: 'Día 6 · Descanso', rest: true, ex: [] },
      { id: 'd7', name: 'Día 7 · Brazos', ex: [
        ['Curl con barra de pie', 4, '15, 12, 10, 8', 75], ['Curl inclinado con mancuernas', 4, '15, 12, 10, 8', 75],
        ['Extensión de tríceps en polea', 4, '15, 12, 10, 8', 75], ['Press francés', 4, '15, 12, 10, 8', 75],
        ['Curl predicador', 4, '10–12', 75], ['Press banca agarre cerrado', 4, '10–12', 120]] }
    ]
  },
  tp4: {
    name: 'Torso / Pierna · 4–5 días',
    desc: 'El plan de definición inicial: básicos pesados, 1–2 repeticiones en reserva.',
    days: [
      { id: 'ta', name: 'Torso A · Fuerza', ex: [
        ['Press banca con mancuernas', 4, '6–8', 150], ['Remo con mancuerna', 4, '8–10', 120],
        ['Press militar con mancuernas', 3, '8–10', 120], ['Jalón al pecho', 3, '8–10', 120],
        ['Elevaciones laterales', 3, '12–15', 60], ['Curl martillo', 2, '10–12', 60], ['Extensión de tríceps en polea', 2, '10–12', 60]] },
      { id: 'pa', name: 'Pierna A', ex: [
        ['Sentadilla en Smith', 4, '6–8', 150], ['Peso muerto rumano', 3, '8–10', 120],
        ['Zancadas / split squat búlgaro', 3, '10 por pierna', 90], ['Curl femoral sentado', 3, '10–12', 75], ['Elevación de talones de pie', 3, '12–15', 60]] },
      { id: 'tb', name: 'Torso B · Volumen', ex: [
        ['Press inclinado con mancuernas', 4, '8–12', 120], ['Dominadas / chin-ups', 4, '8–12', 120],
        ['Aperturas en máquina / polea', 3, '12–15', 75], ['Remo en polea agarre estrecho', 3, '10–12', 90],
        ['Elevaciones laterales', 4, '12–15', 60], ['Face pull', 3, '15', 60]] },
      { id: 'pb', name: 'Pierna B + abdomen', ex: [
        ['Prensa 45°', 4, '10–12', 120], ['Hip thrust', 3, '10–12', 90], ['Extensión de cuádriceps', 3, '12–15', 75],
        ['Curl femoral tumbado', 3, '12', 75], ['Crunch en polea', 3, '12–15', 60], ['Elevaciones de piernas colgado', 3, '10–15', 60]] },
      { id: 'op', name: 'Opcional · Hombros, brazos y abdomen', ex: [
        ['Elevaciones laterales', 4, '15', 60], ['Pájaro posterior (reverse pec deck)', 3, '15', 60],
        ['Curl martillo', 3, '10–12', 60], ['Curl inclinado con mancuernas', 2, '12', 60],
        ['Press francés', 3, '10–12', 75], ['Crunch en polea', 3, '12–15', 60]] }
    ]
  }
};

/* ------------------------------------------------------------------ *
 *  Técnicas de intensidad
 * ------------------------------------------------------------------ */
const TECHNIQUES = {
  normal: { name: 'Normal', short: '' },
  drop: { name: 'Drop set / running the rack', short: 'DROP', text: 'Al llegar al fallo baja el peso y sigue sin descansar. Running the rack: recorre el rack de mancuernas hacia abajo.' },
  forced: { name: 'Repeticiones forzadas', short: 'FORZ', text: 'Al fallo, tu compañero te ayuda lo justo para sacar 2–3 repeticiones más.' },
  neg: { name: 'Negativas', short: 'NEG', text: 'Bajada lenta y controlada (3–5 s) con más peso del que puedes subir; el compañero ayuda en la subida.' },
  shock: { name: 'Choque (método Arnold)', short: 'CHOQUE', text: 'Sesión de volumen muy alto y fuera de lo habitual para romper un estancamiento. Úsala de vez en cuando, nunca como rutina.' }
};

/* ------------------------------------------------------------------ *
 *  Nutrición (Marc McLean)
 * ------------------------------------------------------------------ */
const KG_TO_LB = 2.20462;
const KCAL_FACTOR = { mantener: 15, definicion: 12, volumen: 17 };   // × peso en lb
const SOMATOTYPES = {
  ecto: { name: 'Ectomorfo', c: 55, p: 25, f: 20, desc: 'Delgado, le cuesta ganar peso.' },
  meso: { name: 'Mesomorfo', c: 40, p: 30, f: 30, desc: 'Atlético, gana músculo con facilidad.' },
  endo: { name: 'Endomorfo', c: 25, p: 35, f: 40, desc: 'Estructura ancha, acumula grasa con facilidad.' }
};

const PROTEIN_SOURCES = ['Huevos enteros', 'Claras de huevo', 'Pechuga de pollo', 'Res magra (eye of round)', 'Pavo', 'Pescado', 'Proteína de suero (whey)', 'Proteína vegetal (arroz integral / mezcla vegana)'];

/** Alimentos rápidos: [nombre, proteína, carbohidratos, grasa, azúcar] en gramos (valores aproximados). */
const FOODS = [
  ['Pechuga de pollo cocida 150 g', 46, 0, 5, 0],
  ['Arroz blanco cocido 200 g', 5, 56, 1, 0],
  ['Huevo entero', 6, 1, 5, 0],
  ['Claras de huevo (3)', 11, 1, 0, 1],
  ['Whey 1 scoop (30 g)', 24, 3, 2, 2],
  ['Avena 50 g', 7, 33, 3, 1],
  ['Plátano', 1, 27, 0, 14],
  ['Papa cocida 200 g', 4, 40, 0, 2],
  ['Res magra cocida 150 g', 42, 0, 9, 0],
  ['Atún en agua (lata)', 25, 0, 1, 0],
  ['Yogur griego natural 170 g', 17, 6, 0, 6],
  ['Aguacate ½', 1, 6, 11, 0],
  ['Pan integral (2 rebanadas)', 8, 24, 2, 4],
  ['Miel 1 cucharada', 0, 17, 0, 17]
];

/* ------------------------------------------------------------------ *
 *  Suplementos
 * ------------------------------------------------------------------ */
const SUPPLEMENTS = [
  { id: 'multi', name: 'Multivitamínico y minerales', what: 'Cubre deficiencias y ayuda contra radicales libres.', when: '1 dosis con el desayuno.' },
  { id: 'protein', name: 'Proteína de suero / vegetal', what: 'Aminoácidos esenciales de absorción rápida.', when: 'Después de entrenar y/o en ayunas.' },
  { id: 'creatine', name: 'Creatina', what: 'Recarga ATP: más fuerza y volumen celular.', when: '5 g diarios, con ~75 g de carbohidratos simples.' },
  { id: 'no', name: 'Precursor de óxido nítrico', what: 'Vasodilatación: más bombeo y transporte de nutrientes.', when: '30–60 min antes de entrenar.', caution: true },
  { id: 'glycerin', name: 'Glicerina farmacéutica', what: 'Hiperhidratación celular y tensión muscular.', when: '50 ml diluidos en mucha agua, 1 h antes de entrenar.', caution: true },
  { id: 'mag', name: 'Magnesio / ZMA', what: 'Rendimiento, relajación muscular y descanso.', when: 'Tópico u oral antes de dormir.' }
];

const PUMP_STEPS = [
  ['Hiperemia activa', 'La contracción intensa multiplica 3–4 veces el flujo de sangre hacia el músculo trabajado.'],
  ['Óxido nítrico (NO)', 'La enzima NOS produce NO, que dilata los vasos y satura el tejido de sangre y nutrientes.'],
  ['IGF-1', 'Estimula la síntesis de proteína y activa las células satélite.'],
  ['VEGF', 'Crea nuevos capilares (angiogénesis): más vías para que lleguen nutrientes.'],
  ['Volumen celular', 'El bombeo mete agua en la célula; esa hidratación es una señal de crecimiento que hace que las células satélite se fusionen con la fibra.']
];

/* ------------------------------------------------------------------ *
 *  Hábitos: 7 reglas de oro (se suma 1 por semana)
 * ------------------------------------------------------------------ */
const HABITS = [
  { id: 'water', name: 'Agua 2.5–3 L (limón en ayunas)', auto: 'water' },
  { id: 'sugar', name: 'Azúcar refinada ≤ 35 g', auto: 'sugar' },
  { id: 'alcohol', name: 'Sin alcohol' },
  { id: 'fresh', name: 'Cociné fresco, sin procesados ni comida rápida' },
  { id: 'meals', name: '3–4 comidas completas', auto: 'meals' },
  { id: 'soda', name: 'Agua en vez de refresco' },
  { id: 'journal', name: 'Anoté mi entreno en el diario', auto: 'journal' }
];

/* ------------------------------------------------------------------ *
 *  Mentalidad: una idea por día (ideas de los libros, en palabras propias)
 * ------------------------------------------------------------------ */
const MINDSET = [
  ['Conexión mente-músculo', 'En cada repetición pon la mente dentro del músculo que trabajas. Si no lo sientes, no lo estás reclutando del todo.', 'Arnold Schwarzenegger'],
  ['Visualiza antes de la serie', 'Antes de agarrar la barra, imagina el músculo creciendo y la repetición perfecta. Después ejecútala.', 'Arnold Schwarzenegger'],
  ['El ardor es progreso', 'El dolor de las últimas repeticiones es la señal de que estás construyendo. Las repeticiones que duelen son las que cuentan.', 'Arnold Schwarzenegger'],
  ['Ten la imagen clara', 'Ten una imagen concreta del físico que buscas: tu foto objetivo. La mente va primero y el cuerpo la sigue.', 'Arnold Schwarzenegger'],
  ['La pequeña ventaja', 'Los resultados vienen de acciones simples repetidas todos los días. Son fáciles de hacer y también fáciles de no hacer.', 'Jeff Olson, The Slight Edge'],
  ['El efecto compuesto', 'Un 1 % mejor cada día no se nota hoy. En un año es otra persona.', 'Jeff Olson, The Slight Edge'],
  ['Un hábito a la vez', 'No cambies todo de golpe. Un hábito nuevo por semana y en dos meses tienes un estilo de vida distinto.', 'Marc McLean'],
  ['Choca al músculo', 'Si llevas semanas estancado, haz algo que tu cuerpo no espera: más volumen, otra técnica u otro orden.', 'Arnold Schwarzenegger'],
  ['Anótalo todo', 'Lo que no se anota no se puede superar. Tu diario de entreno es tu biblia: pesos, series, reps y sensaciones.', 'Gym Bible'],
  ['Supera tu marca', 'Hoy tu único rival es tu registro de la semana pasada: una repetición más o un poco más de peso.', 'Sobrecarga progresiva'],
  ['Compromiso de lunes a viernes', 'Come limpio entre semana y date flexibilidad el fin de semana. Ser constante gana a ser perfecto.', 'Marc McLean'],
  ['Elige el camino difícil', 'Cada decisión de hoy (la comida, el entreno, la hora de dormir) suma o resta. No hay decisiones neutras.', 'Jeff Olson, The Slight Edge'],
  ['Calidad sobre ego', 'Rango completo y control. El músculo no sabe cuánto pesa la barra, solo siente la tensión.', 'Get The Pump'],
  ['Disfruta el bombeo', 'El bombeo es sangre y nutrientes llenando el músculo. Persíguelo con series controladas y descansos cortos en aislamiento.', 'Get The Pump']
];

/* Ventana post-entreno */
const PWO_MINUTES = 45;
const PWO_ITEMS = [
  ['pwo_protein', 'Proteína rápida (whey o vegetal)', '5–15 min después de entrenar'],
  ['pwo_carbs', 'Carbohidratos de alto índice glucémico', 'Dextrosa, fruta, miel o jugo'],
  ['pwo_creatine', 'Creatina 5 g', 'Junto con los carbohidratos']
];

/* ------------------------------------------------------------------ *
 *  RIR / RPE
 * ------------------------------------------------------------------ */
const RIR_OPTIONS = [
  [0, 'RIR 0 · RPE 10 · al fallo'], [1, 'RIR 1 · RPE 9'], [2, 'RIR 2 · RPE 8'], [3, 'RIR 3 · RPE 7'], [4, 'RIR 4+ · RPE ≤6 · fácil']
];

/* ------------------------------------------------------------------ *
 *  McDonald's México (del Excel del usuario: FatSecret México, datos no oficiales)
 *  [nombre, kcal, proteína, carbohidratos, grasa]; null = la fuente no trae el dato
 * ------------------------------------------------------------------ */
const MCDONALDS = [
  ['Hamburguesa', 258, 11.6, 36.5, 7.3],
  ['Hamburguesa con Queso', 409, null, null, null],
  ['Hamburguesa Doble con Queso', 450, null, null, null],
  ['Hamburguesa Triple con Queso', 548, null, null, null],
  ['Cuarto de Libra con Queso', 530, null, null, null],
  ['Cuarto de Libra Doble con Queso', 778, null, null, null],
  ['Big Mac', 540, 25, 52, 27],
  ['McNífica', 539, 27, 40, 30],
  ['McNífica Doble', 787, 47, 41, 48],
  ['McPollo', 516, 19, 34, 25],
  ['McNuggets 4', 166, null, null, null],
  ['McNuggets 10', 430, null, null, null],
  ['McMuffin Huevo Salchicha', 494, null, null, null],
  ['McBurrito a la Mexicana', 519, 22, 9, 36, 'Los carbohidratos (9 g) parecen bajos para la porción'],
  ['Papas Kids', 95, null, null, null],
  ['Papas Medianas', 281, null, null, null],
  ['Papas Grandes', 255, null, null, null, 'Menos kcal que las medianas en la fuente; verificar'],
  ['Papa Hashbrown', 142, null, null, null],
  ['Cono Vanilla', 162, null, null, null],
  ['Sundae Chocolate', 262, null, null, null],
  ['Sundae Fresa', 199, null, null, null],
  ['McFlurry Chocolate Oreo Mix', 424, null, null, null],
  ['Malteada Vainilla', 351, null, null, null],
  ['Pay de Manzana', 241, null, null, null],
  ['Pay de Queso', 257, null, null, null],
  ['Angus Premium Tocino', 869, 46, 71, 44, 'Descontinuado según la fuente']
];
