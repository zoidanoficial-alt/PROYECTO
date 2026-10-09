'use strict';
/*
 * Contenido de la app: ejercicios, rutinas, nutrición, suplementos, hábitos y
 * mentalidad. Resumido de los libros que compartió el usuario (estilo "Get The
 * Pump", Arnold Schwarzenegger, Marc McLean y Jeff Olson) más el plan inicial.
 */

/* ------------------------------------------------------------------ *
 *  Ejercicios: grupo muscular y tipo (compuesto / aislamiento)
 * ------------------------------------------------------------------ */
const EX = {
  // Pierna
  'Sentadilla con barra': ['pierna', 'c'],
  'Sentadilla en Smith': ['pierna', 'c'],
  'Hack squat': ['pierna', 'c'],
  'Prensa 45°': ['pierna', 'c'],
  'Peso muerto': ['espalda', 'c'],
  'Peso muerto rumano': ['femoral', 'c'],
  'Zancadas / split squat búlgaro': ['pierna', 'c'],
  'Hip thrust': ['gluteo', 'c'],
  'Extensión de cuádriceps': ['pierna', 'a'],
  'Curl femoral tumbado': ['femoral', 'a'],
  'Curl femoral sentado': ['femoral', 'a'],
  // Pecho
  'Press banca con barra': ['pecho', 'c'],
  'Press banca con mancuernas': ['pecho', 'c'],
  'Press banca en Smith': ['pecho', 'c'],
  'Press inclinado con barra': ['pecho', 'c'],
  'Press inclinado con mancuernas': ['pecho', 'c'],
  'Hammer Strength press': ['pecho', 'c'],
  'Fondos en paralelas (con lastre)': ['pecho', 'c'],
  'Aperturas con mancuernas': ['pecho', 'a'],
  'Aperturas en máquina / polea': ['pecho', 'a'],
  // Espalda
  'Remo con barra': ['espalda', 'c'],
  'Remo con mancuerna': ['espalda', 'c'],
  'Remo inclinado con mancuernas': ['espalda', 'c'],
  'Remo en polea agarre estrecho': ['espalda', 'c'],
  'Remo a una mano en polea': ['espalda', 'c'],
  'Jalón al pecho': ['espalda', 'c'],
  'Dominadas / chin-ups': ['espalda', 'c'],
  'Hiperextensiones': ['espalda', 'a'],
  // Hombro
  'Press militar con barra': ['hombro', 'c'],
  'Press militar con mancuernas': ['hombro', 'c'],
  'Remo al cuello': ['hombro', 'c'],
  'Elevaciones laterales': ['hombro', 'a'],
  'Elevaciones laterales sentado': ['hombro', 'a'],
  'Elevaciones frontales': ['hombro', 'a'],
  'Pájaro posterior (reverse pec deck)': ['hombro', 'a'],
  'Face pull': ['hombro', 'a'],
  // Brazos
  'Press banca agarre cerrado': ['triceps', 'c'],
  'Curl con barra de pie': ['biceps', 'a'],
  'Curl inclinado con mancuernas': ['biceps', 'a'],
  'Curl predicador': ['biceps', 'a'],
  'Curl martillo': ['biceps', 'a'],
  'Extensión de tríceps en polea': ['triceps', 'a'],
  'Press francés': ['triceps', 'a'],
  // Pantorrilla y abdomen
  'Elevación de talones de pie': ['pantorrilla', 'a'],
  'Elevación de talones sentado': ['pantorrilla', 'a'],
  'Donkey calf raise': ['pantorrilla', 'a'],
  'Crunch en polea': ['abdomen', 'a'],
  'Elevaciones de piernas colgado': ['abdomen', 'a'],
  'Plancha': ['abdomen', 'a']
};

const GROUPS = {
  pierna: 'Cuádriceps', femoral: 'Femoral', gluteo: 'Glúteo', pecho: 'Pecho', espalda: 'Espalda',
  hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps', pantorrilla: 'Pantorrilla', abdomen: 'Abdomen'
};

/** Series por semana por grupo: menos de `low` se queda corto, más de `high` es riesgo de sobreentrenamiento. */
const VOLUME_BANDS = { low: 8, high: 22 };

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
