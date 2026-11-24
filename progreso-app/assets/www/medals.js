'use strict';
/* =====================================================================
 *  39.0 · PROTOCOLO DE MEDALLAS
 *  1) Catálogo: familias (fuerza máxima por ejercicio, repeticiones con un peso, fuerza
 *     relativa, récords, constancia, volumen, running, HYROX, nutrición, cuerpo,
 *     bienestar, exploración) × umbrales. Cada medalla tiene id estable, meta medible y
 *     su propio diseño (forma por categoría, metal por nivel, icono y cifra).
 *  2) Niveles por dificultad dentro de su familia: Bronce → Plata → Oro → Platino → Diamante → Leyenda.
 *  3) Detección: se calcula con tus datos reales (nunca con estimaciones de otros) al guardar
 *     una serie y al abrir pantallas. Una medalla ganada no se pierde.
 *  4) Celebración: aviso breve con la medalla; sin presión ni castigos por rachas rotas.
 * ===================================================================== */
const MD_TIERS = [
  { k: 'bronce', n: 'Bronce', c: ['#f2b98a', '#c47a45', '#6b3a17'] },
  { k: 'plata', n: 'Plata', c: ['#f4f6f8', '#aeb6bf', '#5d6670'] },
  { k: 'oro', n: 'Oro', c: ['#fff1a8', '#e3b21b', '#7a5a00'] },
  { k: 'platino', n: 'Platino', c: ['#ffffff', '#c9d6df', '#6f8595'] },
  { k: 'diamante', n: 'Diamante', c: ['#e9fcff', '#6fd6f0', '#1b5f7a'] },
  { k: 'leyenda', n: 'Leyenda', c: ['#f3ffc4', '#c6f432', '#23300a'] }
];
const MD_CATS = {
  fuerza: { n: 'Fuerza máxima', ico: 'dumbbell', shape: 'hex', rib: '#c6f432' },
  reps: { n: 'Repeticiones con peso', ico: 'refresh-cw', shape: 'circle', rib: '#ff7a59' },
  peso_c: { n: 'Peso corporal', ico: 'person-standing', shape: 'circle', rib: '#ffb84d' },
  rel: { n: 'Fuerza relativa', ico: 'weight', shape: 'shield', rib: '#a78bfa' },
  prog: { n: 'Progresión', ico: 'trending-up', shape: 'shield', rib: '#34d399' },
  pr: { n: 'Récords', ico: 'trophy', shape: 'star', rib: '#facc15' },
  const: { n: 'Constancia', ico: 'calendar', shape: 'circle', rib: '#60a5fa' },
  vol: { n: 'Volumen', ico: 'layers', shape: 'oct', rib: '#f472b6' },
  run: { n: 'Running', ico: 'footprints', shape: 'circle', rib: '#22d3ee' },
  hyrox: { n: 'HYROX', ico: 'timer', shape: 'hex', rib: '#fde047' },
  nut: { n: 'Nutrición', ico: 'utensils', shape: 'shield', rib: '#4ade80' },
  cuerpo: { n: 'Cuerpo', ico: 'ruler', shape: 'oct', rib: '#fb923c' },
  bien: { n: 'Bienestar', ico: 'moon', shape: 'circle', rib: '#818cf8' },
  expl: { n: 'Exploración', ico: 'map', shape: 'star', rib: '#2dd4bf' }
};
/** Grupos de ejercicios: la medalla cuenta cualquiera de sus variantes. */
const MD_LIFTS = {
  sq: { n: 'Sentadilla', ex: ['Sentadilla con barra', 'Sentadilla en Smith'], kg: [40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 250, 300] },
  dl: { n: 'Peso muerto', ex: ['Peso muerto'], kg: [40, 60, 70, 80, 90, 100, 110, 120, 140, 150, 160, 180, 200, 220, 240, 260, 280, 300, 320] },
  bp: { n: 'Press banca', ex: ['Press banca con barra', 'Press banca en Smith'], kg: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 250] },
  ohp: { n: 'Press militar', ex: ['Press militar con barra', 'Press militar en Smith'], kg: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140] },
  ht: { n: 'Hip thrust', ex: ['Hip thrust', 'Puente de glúteo con barra'], kg: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400] },
  row: { n: 'Remo con barra', ex: ['Remo con barra', 'Remo en Smith'], kg: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220] },
  leg: { n: 'Prensa', ex: ['Prensa 45°', 'Prensa de piernas (máquina)'], kg: [60, 80, 100, 120, 140, 160, 180, 200, 220, 250, 280, 300, 330, 360, 400, 450, 500, 550, 600] },
  rdl: { n: 'Peso muerto rumano', ex: ['Peso muerto rumano con barra', 'Peso muerto rumano en Smith', 'Peso muerto rumano'], kg: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 250] },
  inc: { n: 'Press inclinado', ex: ['Press inclinado con barra', 'Press inclinado en Smith'], kg: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220] },
  lun: { n: 'Zancadas', ex: ['Zancadas con barra', 'Zancadas en Smith'], kg: [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200] },
  dbp: { n: 'Press con mancuernas', ex: ['Press banca con mancuernas', 'Press inclinado con mancuernas'], kg: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 48, 52, 60], per: 'por mano' },
  curl: { n: 'Curl con barra', ex: ['Curl con barra de pie'], kg: [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110] }
};
const MD_BW = {   // repeticiones en una serie (peso corporal)
  pull: { n: 'Dominadas', ex: ['Dominadas / chin-ups'], r: [1, 3, 5, 8, 10, 12, 15, 18, 20, 25, 30] },
  push: { n: 'Lagartijas', ex: ['Lagartijas'], r: [10, 15, 20, 25, 30, 40, 50, 60, 75, 100] },
  dip: { n: 'Fondos', ex: ['Fondos en paralelas (con lastre)', 'Fondos en banco'], r: [5, 10, 15, 20, 25, 30, 40, 50] }
};
const MD_RUN = { 1: [7, 6, 5.5, 5, 4.5, 4.2, 4, 3.8, 3.5, 3.3, 3.1, 3], 5: [40, 35, 32, 30, 28, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], 10: [80, 70, 65, 60, 55, 52, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32], 21.0975: [160, 150, 140, 130, 120, 110, 105, 100, 95, 90, 85, 80, 75, 70], 42.195: [360, 330, 300, 270, 240, 225, 210, 195, 180, 170, 160, 150, 140] };
const MD_RUN_N = { 1: '1 km', 5: '5 km', 10: '10 km', 21.0975: 'Medio maratón', 42.195: 'Maratón' };
const mdNum = v => Number.isInteger(v) ? String(v) : String(v).replace('.', ',');

/* ---------- Catálogo ---------- */
let MD_CAT = null;
function mdCatalog() {
  if (MD_CAT) return MD_CAT;
  const out = [];
  const fam = (cat, f, list, mk) => list.forEach((x, i) => { const m = mk(x, i); m.cat = cat; m.fam = f; m.tier = Math.min(5, Math.floor(i / list.length * 6)); m.ord = i; out.push(m); });
  Object.keys(MD_LIFTS).forEach(k => { const L = MD_LIFTS[k];
    fam('fuerza', 'max-' + k, L.kg, kg => ({ id: `max-${k}-${kg}`, n: `${L.n} · ${kg} kg`, d: `Levanta ${kg} kg${L.per ? ' ' + L.per : ''} en ${L.n.toLowerCase()} al menos una repetición.`, lab: String(kg), sub: 'KG', stat: 'liftMax', arg: k, goal: kg }));
    fam('prog', 'times-' + k, [1, 10, 25, 50, 100, 200], n => ({ id: `times-${k}-${n}`, n: `${L.n} · ${n} ${n === 1 ? 'sesión' : 'sesiones'}`, d: `Entrena ${L.n.toLowerCase()} en ${n} ${n === 1 ? 'sesión' : 'sesiones'} distintas.`, lab: '×' + n, sub: 'SESIONES', stat: 'liftTimes', arg: k, goal: n }));
    fam('prog', 'gain-' + k, [5, 10, 15, 20, 25, 30, 40, 50], p => ({ id: `gain-${k}-${p}`, n: `${L.n} · +${p} %`, d: `Sube ${p} % tu 1RM estimado de ${L.n.toLowerCase()} frente a hace 12 semanas.`, lab: '+' + p, sub: '% 1RM', stat: 'liftGain', arg: k, goal: p }));
  });
  ['sq', 'dl', 'bp', 'ohp', 'ht', 'row', 'rdl', 'inc'].forEach(k => fam('rel', 'rel-' + k, [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3], x => ({ id: `rel-${k}-${x}`, n: `${MD_LIFTS[k].n} · ${mdNum(x)}× tu peso`, d: `Tu 1RM estimado en ${MD_LIFTS[k].n.toLowerCase()} llega a ${mdNum(x)} veces tu peso corporal.`, lab: mdNum(x) + '×', sub: 'TU PESO', stat: 'rel', arg: k, goal: x })));
  // Repeticiones con un peso (cualquier ejercicio): "50 reps con 50 kg"
  const W = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 160], RR = [10, 12, 15, 20, 25, 30, 40, 50, 75, 100];
  W.forEach(w => { const ok = RR.filter(r => w * (1 + r / 30) <= 360); fam('reps', 'rw-' + w, ok, r => ({ id: `rw-${w}-${r}`, n: `${r} reps con ${w} kg`, d: `Haz ${r} repeticiones seguidas con ${w} kg o más en una sola serie (cualquier ejercicio).`, lab: `${r}×${w}`, sub: 'REPS × KG', stat: 'repsAt', arg: w, goal: r })); });
  Object.keys(MD_BW).forEach(k => { const B = MD_BW[k]; fam('peso_c', 'bw-' + k, B.r, r => ({ id: `bw-${k}-${r}`, n: `${B.n} · ${r} seguidas`, d: `Haz ${r} ${B.n.toLowerCase()} en una sola serie.`, lab: String(r), sub: 'REPS', stat: 'bwReps', arg: k, goal: r })); });
  const simple = (cat, f, list, n, d, lab, sub, stat, dir) => fam(cat, f, list, x => ({ id: `${f}-${x}`, n: n(x), d: d(x), lab: lab(x), sub, stat, goal: x, dir }));
  simple('pr', 'prs', [1, 5, 10, 25, 50, 100, 150, 200, 300, 500, 750, 1000], x => `${x} ${x === 1 ? 'récord' : 'récords'} personales`, x => `Rompe ${x} récords personales (peso, reps a un peso o 1RM).`, x => String(x), 'RÉCORDS', 'prs');
  simple('const', 'ses', [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000], x => x === 1 ? 'Primera sesión' : `${x} sesiones`, x => `Completa ${x} ${x === 1 ? 'sesión' : 'sesiones'} de fuerza.`, x => String(x), 'SESIONES', 'sessions');
  simple('const', 'wk', [2, 3, 4, 6, 8, 10, 12, 16, 20, 26, 39, 52, 78, 104, 156], x => `${x} semanas seguidas`, x => `Cumple tu meta semanal ${x} semanas seguidas (las pausas no rompen la racha).`, x => String(x), 'SEMANAS', 'streak');
  simple('const', 'weigh', [3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 365], x => `${x} días pesándote`, x => `Regístrate el peso ${x} días seguidos.`, x => String(x), 'DÍAS', 'weigh');
  simple('const', 'month', [1, 3, 6, 9, 12, 18, 24, 36], x => `${x} ${x === 1 ? 'mes sólido' : 'meses sólidos'}`, x => `Acumula ${x} ${x === 1 ? 'mes' : 'meses'} con 8 o más sesiones.`, x => String(x), 'MESES', 'months');
  simple('const', 'days', [7, 30, 90, 180, 365, 730, 1095], x => x >= 365 ? `${x / 365} ${x === 365 ? 'año' : 'años'} contigo` : `${x} días contigo`, x => `Lleva ${x} días usando Mi Progreso.`, x => x >= 365 ? (x / 365) + 'A' : String(x), x => '', 'since');
  out.filter(m => m.fam === 'days').forEach(m => { const y = m.goal / 365; m.lab = m.goal >= 365 ? String(y) : String(m.goal); m.sub = m.goal >= 365 ? (y === 1 ? 'AÑO' : 'AÑOS') : 'DÍAS'; });
  simple('vol', 'ton', [1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000], x => `${mdNum(x)} toneladas`, x => `Levanta ${mdNum(x)} toneladas acumuladas (peso × reps).`, x => String(x), 'TON', 'tons');
  simple('vol', 'sets', [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000], x => `${x.toLocaleString('es-MX')} series`, x => `Registra ${x.toLocaleString('es-MX')} series efectivas.`, x => x >= 1000 ? x / 1000 + 'k' : String(x), 'SERIES', 'sets');
  simple('vol', 'reps', [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], x => `${x.toLocaleString('es-MX')} repeticiones`, x => `Acumula ${x.toLocaleString('es-MX')} repeticiones.`, x => x >= 1000 ? x / 1000 + 'k' : String(x), 'REPS', 'repsTotal');
  simple('run', 'km', [5, 10, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000], x => `${x.toLocaleString('es-MX')} km corridos`, x => `Corre ${x.toLocaleString('es-MX')} km en total.`, x => x >= 1000 ? x / 1000 + 'k' : String(x), 'KM', 'km');
  simple('run', 'long', [1, 3, 5, 8, 10, 12, 15, 21.1, 25, 30, 35, 42.2, 50], x => `Carrera de ${mdNum(x)} km`, x => `Completa una carrera de al menos ${mdNum(x)} km.`, x => mdNum(x), 'KM', 'longest');
  simple('run', 'runs', [1, 5, 10, 25, 50, 100, 200, 300, 500], x => x === 1 ? 'Primera carrera' : `${x} carreras`, x => `Registra ${x} ${x === 1 ? 'carrera' : 'carreras'}.`, x => String(x), 'CARRERAS', 'runs');
  Object.keys(MD_RUN).forEach(km => fam('run', 'rt-' + km, MD_RUN[km], m => ({ id: `rt-${km}-${m}`, n: `${MD_RUN_N[km]} sub ${mdT(m)}`, d: `Corre ${MD_RUN_N[km].toLowerCase()} en menos de ${mdT(m)} (mejor esfuerzo con GPS o cinta).`, lab: mdT(m), sub: MD_RUN_N[km].toUpperCase(), stat: 'runBest', arg: km, goal: m * 60, dir: 'down' })));
  // HYROX
  ['ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb'].forEach(st => {
    const nm = { ski: 'SkiErg', push: 'Sled push', pull: 'Sled pull', bbj: 'Burpee broad jumps', row: 'Remo', farm: 'Farmers carry', lunge: 'Sandbag lunges', wb: 'Wall balls' }[st];
    fam('hyrox', 'hs-' + st, [10, 25, 40, 55, 70, 85, 95], s => ({ id: `hs-${st}-${s}`, n: `${nm} · nivel ${s}`, d: `Alcanza un puntaje de ${s}/100 en ${nm} (modelo interno de HYROX Lab).`, lab: String(s), sub: 'PUNTOS', stat: 'hxSt', arg: st, goal: s }));
    fam('hyrox', 'hn-' + st, [1, 5, 10, 25], n => ({ id: `hn-${st}-${n}`, n: `${nm} · ${n} ${n === 1 ? 'prueba' : 'pruebas'}`, d: `Cronometra ${nm} ${n} ${n === 1 ? 'vez' : 'veces'}.`, lab: '×' + n, sub: 'PRUEBAS', stat: 'hxN', arg: st, goal: n }));
  });
  fam('hyrox', 'hsim', [120, 110, 100, 95, 90, 85, 80, 75, 70, 65, 60, 57], m => ({ id: `hsim-${m}`, n: `Simulación sub ${mdT(m, true)}`, d: `Completa una simulación HYROX completa en menos de ${mdT(m, true)}.`, lab: mdT(m, true), sub: 'SIMULACIÓN', stat: 'hxSim', goal: m * 60, dir: 'down' }));
  simple('hyrox', 'hpi', [30, 40, 50, 60, 70, 80, 90], x => `HPI ${x}`, x => `Llega a un HPI de ${x}/100 (modelo interno de la app).`, x => String(x), 'HPI', 'hpi');
  simple('hyrox', 'h1k', [6, 5.5, 5, 4.5, 4.2, 4, 3.8, 3.5, 3.3, 3.1].map(x => x * 60), x => `1 km fresco sub ${mdT(x / 60)}`, x => `Corre 1 km fresco en menos de ${mdT(x / 60)} con el temporizador HYROX.`, x => mdT(x / 60), '1 KM', 'hx1k', 'down');
  // Nutrición
  simple('nut', 'nlog', [1, 7, 14, 30, 60, 90, 180, 365], x => `${x} ${x === 1 ? 'día' : 'días'} registrando comida`, x => `Registra tus comidas ${x} ${x === 1 ? 'día' : 'días'}.`, x => String(x), 'DÍAS', 'foodDays');
  simple('nut', 'nprot', [1, 7, 14, 30, 60, 100, 200, 365], x => `Proteína cumplida · ${x} ${x === 1 ? 'día' : 'días'}`, x => `Llega a tu objetivo de proteína ${x} ${x === 1 ? 'día' : 'días'}.`, x => String(x), 'DÍAS', 'protDays');
  simple('nut', 'nwat', [1, 7, 30, 100, 200, 365], x => `Hidratación · ${x} ${x === 1 ? 'día' : 'días'}`, x => `Cumple tu meta de agua ${x} ${x === 1 ? 'día' : 'días'}.`, x => String(x), 'DÍAS', 'waterDays');
  simple('nut', 'nadh', [2, 4, 8, 12, 26, 52], x => `${x} semanas en tu estrategia`, x => `Mantén una estrategia nutricional activa ${x} semanas.`, x => String(x), 'SEMANAS', 'stratWeeks');
  // Cuerpo
  simple('cuerpo', 'lost', [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], x => `−${x} kg`, x => `Baja ${x} kg desde tu peso inicial (media de 7 días, en definición).`, x => '−' + x, 'KG', 'lost');
  simple('cuerpo', 'gain', [1, 2, 3, 4, 5, 6, 8, 10], x => `+${x} kg en volumen`, x => `Sube ${x} kg desde tu peso inicial en fase de volumen (media de 7 días).`, x => '+' + x, 'KG', 'gained');
  simple('cuerpo', 'waist', [1, 2, 3, 4, 5, 6, 8, 10, 12, 15], x => `Cintura −${x} cm`, x => `Reduce tu cintura ${x} cm desde tu primera medida.`, x => '−' + x, 'CM', 'waist');
  simple('cuerpo', 'meas', [1, 5, 10, 25, 50], x => `${x} ${x === 1 ? 'medición' : 'mediciones'}`, x => `Registra tus medidas ${x} ${x === 1 ? 'vez' : 'veces'}.`, x => String(x), 'MEDIDAS', 'measures');
  // Bienestar
  simple('bien', 'chk', [1, 7, 30, 100, 365], x => `${x} ${x === 1 ? 'chequeo' : 'chequeos'}`, x => `Haz tu chequeo de recuperación ${x} ${x === 1 ? 'vez' : 'veces'}.`, x => String(x), 'CHEQUEOS', 'checkins');
  simple('bien', 'sleep', [7, 30, 100, 200, 365], x => `${x} noches de 7 h+`, x => `Duerme 7 horas o más ${x} noches registradas.`, x => String(x), 'NOCHES', 'sleep7');
  simple('bien', 'early', [1, 10, 25, 50, 100], x => `Madrugador · ${x}`, x => `Empieza ${x} ${x === 1 ? 'sesión' : 'sesiones'} antes de las 7:00.`, x => String(x), 'ANTES 7:00', 'early');
  simple('bien', 'late', [1, 10, 25, 50, 100], x => `Nocturno · ${x}`, x => `Empieza ${x} ${x === 1 ? 'sesión' : 'sesiones'} después de las 21:00.`, x => String(x), 'DESPUÉS 21:00', 'late');
  // Exploración
  simple('expl', 'exs', [5, 10, 20, 30, 40, 50, 75, 100], x => `${x} ejercicios distintos`, x => `Entrena ${x} ejercicios diferentes.`, x => String(x), 'EJERCICIOS', 'distinctEx');
  simple('expl', 'actm', [60, 300, 600, 1200, 3000, 6000, 12000], x => `${x.toLocaleString('es-MX')} min de actividad`, x => `Suma ${x.toLocaleString('es-MX')} minutos de otras actividades (bici, natación, yoga…).`, x => x >= 1000 ? x / 1000 + 'k' : String(x), 'MIN', 'actMin');
  simple('expl', 'actt', [2, 4, 6, 8, 10], x => `${x} tipos de actividad`, x => `Prueba ${x} tipos de actividad distintos.`, x => String(x), 'TIPOS', 'actTypes');
  simple('expl', 'retos', [1, 5, 10, 25, 50], x => `${x} ${x === 1 ? 'reto' : 'retos'}`, x => `Completa ${x} ${x === 1 ? 'reto' : 'retos'} de peso corporal.`, x => String(x), 'RETOS', 'retos');
  // Repeticiones con peso: el nivel depende de la fuerza equivalente (Epley), no de su lugar en la familia
  out.filter(m => m.cat === 'reps').forEach(m => { const e = m.arg * (1 + m.goal / 30); m.tier = e < 40 ? 0 : e < 60 ? 1 : e < 90 ? 2 : e < 130 ? 3 : e < 180 ? 4 : 5; m.score = e; });
  out.forEach(m => { const c = MD_CATS[m.cat]; m.ico = c.ico; m.dir = m.dir || 'up'; if (m.score == null) m.score = m.cat === 'fuerza' ? m.goal : m.ord; });
  MD_CAT = out; return out;
}
function mdT(min, long) { const s = Math.round(min * 60); if (long || s >= 3600) { const h = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60); return h ? `${h}:${String(mm).padStart(2, '0')} h` : `${mm} min`; } return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* ---------- Estadísticas para medir ---------- */
function mdCtx() {
  const t = todayStr(), L = DB.lifts, kgBody = currentWeight() || 70;
  const groupOf = {}; Object.keys(MD_LIFTS).forEach(k => MD_LIFTS[k].ex.forEach(e => { groupOf[e] = k; }));
  const liftMax = {}, liftSes = {}, e1Now = {}, e1Old = {}, bwReps = {}, bwOf = {};
  Object.keys(MD_BW).forEach(k => MD_BW[k].ex.forEach(e => { bwOf[e] = k; }));
  const old = addDays(t, -84), recent = addDays(t, -28);
  let reps = 0, ton = 0;
  const sets = L.filter(l => l.r > 0);
  sets.forEach(l => {
    reps += l.r; ton += (l.w || 0) * l.r;
    const g = groupOf[l.ex];
    if (g) {
      liftMax[g] = Math.max(liftMax[g] || 0, l.w || 0);
      (liftSes[g] = liftSes[g] || new Set()).add(l.sid || l.date);
      const e = e1rm(l.w || 0, Math.min(l.r, 12));
      if (l.date <= old) e1Old[g] = Math.max(e1Old[g] || 0, e);
      if (l.date > recent) e1Now[g] = Math.max(e1Now[g] || 0, e);
      e1Now['all_' + g] = Math.max(e1Now['all_' + g] || 0, e);
    }
    const b = bwOf[l.ex]; if (b) bwReps[b] = Math.max(bwReps[b] || 0, l.r);
  });
  const repsAt = {}; [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 140, 160].forEach(w => { repsAt[w] = sets.reduce((a, l) => (l.w || 0) >= w - 0.01 ? Math.max(a, l.r) : a, 0); });
  const ses = DB.sessions.filter(s => s.end), months = {};
  ses.forEach(s => { const m = s.date.slice(0, 7); months[m] = (months[m] || 0) + 1; });
  const rr = typeof runRecords === 'function' ? runRecords() : { rec: {}, longest: null };
  const H = DB.hyrox, hxst = {}, hxn = {};
  if (H && typeof hxScore === 'function') H.results.filter(r => r.kind === 'st' && !r.pf).forEach(r => { hxst[r.st] = Math.max(hxst[r.st] || 0, hxScore(r.st, r.sec) || 0); hxn[r.st] = (hxn[r.st] || 0) + 1; });
  const sims = H ? H.results.filter(r => r.kind === 'sim' && !r.pf).map(r => r.sec) : [], r1k = H ? H.results.filter(r => r.kind === 'run1k').map(r => r.sec) : [];
  let hpi = null; try { if (H && H.profile && typeof hxPerformance === 'function') hpi = hxPerformance().hpi; } catch (e) {}
  const tg = typeof targets === 'function' ? targets() : null;
  let foodDays = 0, protDays = 0, waterDays = 0, checkins = 0, sleep7 = 0;
  Object.keys(DB.days).forEach(d => { const e = DB.days[d]; const tot = (e.meals && e.meals.length) || e.kcal ? dayTotals(d) : null;
    if (tot) { foodDays++; if (tg && tot.p >= tg.protein) protDays++; }
    if (tg && e.water && e.water >= tg.water) waterDays++;
    if (e.rec) { checkins++; if (e.rec.sleepH >= 7) sleep7++; } });
  const p = DB.profile, cur = currentWeight();
  const waists = (DB.measures || []).filter(m => m.waist).sort((a, b) => a.date < b.date ? -1 : 1);
  const acts = DB.activities || [];
  const ph = DB.nutri && DB.nutri.phases ? DB.nutri.phases : [];
  const stratDays = ph.reduce((a, x) => a + daysBetween(x.start, x.end || t), 0);
  const firstDate = [p.startDate, ...Object.keys(DB.days)].filter(Boolean).sort()[0] || t;
  return {
    liftMax, liftTimes: Object.fromEntries(Object.entries(liftSes).map(([k, s]) => [k, s.size])),
    liftGain: Object.fromEntries(Object.keys(MD_LIFTS).map(k => [k, e1Old[k] && e1Now[k] ? (e1Now[k] / e1Old[k] - 1) * 100 : 0])),
    rel: Object.fromEntries(Object.keys(MD_LIFTS).map(k => [k, (e1Now['all_' + k] || 0) / kgBody])),
    repsAt, bwReps, prs: DB.achievements.filter(a => a.pr).length, sessions: ses.length,
    streak: typeof bestStreakWeeks === 'function' ? bestStreakWeeks() : 0, weigh: typeof weighStreakDays === 'function' ? weighStreakDays() : 0,
    months: Object.values(months).filter(n => n >= 8).length, since: daysBetween(firstDate, t) + 1,
    tons: ton / 1000, sets: sets.length, repsTotal: reps,
    km: (DB.runs || []).reduce((a, r) => a + (r.km || 0), 0), longest: rr.longest ? rr.longest.km : 0, runs: (DB.runs || []).length,
    runBest: Object.fromEntries(Object.keys(MD_RUN).map(km => [km, rr.rec[km] ? rr.rec[km].t : null])),
    hxSt: hxst, hxN: hxn, hxSim: sims.length ? Math.min(...sims) : null, hpi: hpi || 0, hx1k: r1k.length ? Math.min(...r1k) : null,
    foodDays, protDays, waterDays, stratWeeks: Math.floor(stratDays / 7),
    lost: p.phase === 'definicion' && cur ? Math.max(0, p.startWeight - cur) : 0, gained: p.phase === 'volumen' && cur ? Math.max(0, cur - p.startWeight) : 0,
    waist: waists.length > 1 ? Math.max(0, waists[0].waist - Math.min(...waists.map(w => w.waist))) : 0, measures: (DB.measures || []).length,
    checkins, sleep7, early: ses.filter(s => new Date(s.start).getHours() < 7).length, late: ses.filter(s => new Date(s.start).getHours() >= 21).length,
    distinctEx: new Set(sets.map(l => l.ex)).size, actMin: acts.reduce((a, x) => a + (x.min || 0), 0), actTypes: new Set(acts.map(x => x.type)).size, retos: (DB.retos || []).filter(r => r.complete !== false).length
  };
}
/** Valor actual de una medalla y si ya se cumple. */
function mdVal(m, c) { const v = c[m.stat]; return m.arg != null ? (v ? v[m.arg] : null) : v; }
function mdDone(m, c) { const v = mdVal(m, c); if (v == null) return false; return m.dir === 'down' ? v > 0 && v <= m.goal : v >= m.goal - 1e-9; }
function mdProgress(m, c) { const v = mdVal(m, c); if (v == null || v <= 0) return 0; return Math.max(0, Math.min(1, m.dir === 'down' ? m.goal / v : v / m.goal)); }

/* ---------- Detección y celebración ---------- */
function mdState() { if (!DB.medals) DB.medals = { got: {}, first: true }; return DB.medals; }
function medalScan(opts) {
  opts = opts || {}; const st = mdState(), c = mdCtx(), news = [];
  mdCatalog().forEach(m => { if (!st.got[m.id] && mdDone(m, c)) { st.got[m.id] = { d: todayStr(), t: Date.now(), retro: !!st.first }; news.push(m); } });
  const silent = st.first || opts.silent; st.first = false;
  if (news.length) saveData();
  if (!silent && news.length && (typeof gamify !== 'function' || gamify())) mdCelebrate(news);
  return news;
}
let mdScanT = null;
function mdScanSoon() { clearTimeout(mdScanT); mdScanT = setTimeout(() => { try { medalScan(); } catch (e) { console.error(e); } }, 300); }
function mdCelebrate(news) {
  news.sort((a, b) => b.tier - a.tier || b.score - a.score);
  const top = news[0], more = news.length - 1;
  let el = document.getElementById('md-pop'); if (el) el.remove();
  el = document.createElement('button'); el.id = 'md-pop'; el.className = 'md-pop t' + top.tier;
  el.innerHTML = `${mdSvg(top, true, 64)}<span><small>¡MEDALLA ${MD_TIERS[top.tier].n.toUpperCase()}!</small><b>${esc(top.n)}</b>${more ? `<em>+${more} medalla${more > 1 ? 's' : ''} más</em>` : ''}</span>`;
  el.onclick = () => { el.remove(); openMedal(top.id); };
  document.body.appendChild(el); vibrate(top.tier >= 3 ? 200 : 90);
  setTimeout(() => el.classList.add('out'), 4200); setTimeout(() => el.remove(), 4700);
}

/* ---------- Diseño (SVG) ---------- */
let mdUid = 0;
const MD_SHAPES = {
  circle: '<circle cx="50" cy="52" r="38"/>',
  hex: '<path d="M50 12 L84 32 L84 72 L50 92 L16 72 L16 32 Z"/>',
  shield: '<path d="M50 12 L84 22 C84 58 72 80 50 92 C28 80 16 58 16 22 Z"/>',
  oct: '<path d="M35 14 H65 L88 37 V67 L65 90 H35 L12 67 V37 Z"/>',
  star: '<path d="M50 10 L60 24 L77 20 L76 37 L91 46 L80 59 L86 75 L69 77 L60 92 L50 81 L40 92 L31 77 L14 75 L20 59 L9 46 L24 37 L23 20 L40 24 Z"/>'
};
function mdSvg(m, on, size) {
  const id = 'md' + (++mdUid), T = MD_TIERS[m.tier], C = MD_CATS[m.cat], col = on ? T.c : ['#3a3a3a', '#2a2a2a', '#141414'];
  const shape = MD_SHAPES[C.shape], lab = m.lab, fs = lab.length > 6 ? 13 : lab.length > 4 ? 16 : lab.length > 2 ? 21 : 26;
  const icon = (typeof ICONS_L === 'object' && ICONS_L[m.ico]) || '';
  return `<svg class="md-svg ${on ? 'on' : 'off'}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col[0]}"/><stop offset=".5" stop-color="${col[1]}"/><stop offset="1" stop-color="${col[2]}"/></linearGradient>
    <linearGradient id="${id}i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${col[2]}"/><stop offset="1" stop-color="${col[1]}"/></linearGradient></defs>
    ${m.tier >= 2 ? `<path d="M30 4 L42 4 L50 22 L58 4 L70 4 L58 30 L42 30 Z" fill="${on ? C.rib : '#2a2a2a'}" opacity=".9"/>` : ''}
    <g fill="url(#${id}g)" stroke="${col[2]}" stroke-width="2">${shape}</g>
    <g transform="translate(50 52) scale(.78) translate(-50 -52)" fill="url(#${id}i)" stroke="${on ? col[0] : '#333'}" stroke-width="1.2" opacity=".95">${shape}</g>
    ${m.tier >= 4 ? `<g stroke="${col[0]}" stroke-width=".8" opacity=".5"><path d="M28 40 L50 30 L72 40 M28 40 L50 74 L72 40"/></g>` : ''}
    <g transform="translate(41 24) scale(.75)" fill="none" stroke="${on ? col[0] : '#555'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
    <text x="50" y="${m.sub ? 62 : 66}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="${fs}" fill="${on ? '#fff' : '#666'}" stroke="${on ? col[2] : 'none'}" stroke-width=".6" paint-order="stroke">${esc(lab)}</text>
    ${m.sub ? `<text x="50" y="74" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${m.sub.length > 10 ? 5.2 : 6.5}" letter-spacing=".6" fill="${on ? col[0] : '#555'}">${esc(m.sub)}</text>` : ''}
    ${m.tier === 5 && on ? '<g fill="#fff"><path d="M83 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M14 80 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z"/></g>' : ''}
  </svg>`;
}

/* ---------- Pantalla: Logros, estadísticas y medallas ---------- */
let mdView = 'med', mdCat = 'all', mdFilter = 'all', mdLimit = 48, mdRecEx = null;
function renderLogros(el) {
  medalScan({ silent: false });
  const seg = `<div class="seg md-seg">${[['med', '🏅 Medallas'], ['rec', '🏆 Récords'], ['est', '📊 Estadísticas']].map(([k, n]) => `<button data-mdv="${k}" class="${mdView === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  el.innerHTML = seg + '<div id="md-body"></div>';
  $$('[data-mdv]', el).forEach(b => b.onclick = () => { mdView = b.dataset.mdv; redrawChart = () => {}; renderLogros(el); });
  ({ med: mdMedals, rec: mdRecords, est: mdStats })[mdView]($('#md-body', el));
}
function mdMedals(el) {
  const cat = mdCatalog(), st = mdState(), c = mdCtx(), got = cat.filter(m => st.got[m.id]);
  const byTier = MD_TIERS.map((T, i) => got.filter(m => m.tier === i).length);
  const next = cat.filter(m => !st.got[m.id]).map(m => ({ m, p: mdProgress(m, c) })).filter(x => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 8);
  const recent = got.slice().sort((a, b) => st.got[b.id].t - st.got[a.id].t).slice(0, 8);
  let list = cat.filter(m => (mdCat === 'all' || m.cat === mdCat) && (mdFilter === 'all' || (mdFilter === 'got') === !!st.got[m.id]));
  const total = list.length; list = list.slice(0, mdLimit);
  const cell = (m, p) => `<button class="md-cell ${st.got[m.id] ? 'on' : ''}" data-md="${m.id}">${mdSvg(m, !!st.got[m.id], 68)}${!st.got[m.id] && p != null ? `<i style="--p:${Math.round(p * 100)}%"></i>` : ''}<span>${esc(m.n)}</span></button>`;
  el.innerHTML = `<div class="md-head"><div><b>${got.length}</b><span>de ${cat.length.toLocaleString('es-MX')} medallas</span></div><span class="td-bar"><i style="--w:${got.length / cat.length * 100}%"></i></span>
      <div class="md-tiers">${MD_TIERS.map((T, i) => `<span><i style="background:linear-gradient(135deg,${T.c[0]},${T.c[1]} 55%,${T.c[2]})"></i>${byTier[i]}<small>${T.n}</small></span>`).join('')}</div></div>
    ${next.length ? `<div class="ds-h">Muy cerca</div><div class="md-row">${next.map(x => cell(x.m, x.p)).join('')}</div>` : ''}
    ${recent.length ? `<div class="ds-h">Últimas ganadas</div><div class="md-row">${recent.map(m => cell(m)).join('')}</div>` : ''}
    <div class="ds-h">Colección</div>
    <div class="chips md-cats"><button class="chip-btn ${mdCat === 'all' ? 'on' : ''}" data-mdc="all">Todas</button>${Object.keys(MD_CATS).map(k => `<button class="chip-btn ${mdCat === k ? 'on' : ''}" data-mdc="${k}">${MD_CATS[k].n} <small>${cat.filter(m => m.cat === k && st.got[m.id]).length}/${cat.filter(m => m.cat === k).length}</small></button>`).join('')}</div>
    <div class="seg md-filter">${[['all', 'Todas'], ['got', 'Ganadas'], ['todo', 'Por ganar']].map(([k, n]) => `<button data-mdf="${k}" class="${mdFilter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="md-grid">${list.map(m => cell(m, st.got[m.id] ? null : mdProgress(m, c))).join('') || '<p class="small muted">Nada aquí todavía.</p>'}</div>
    ${total > mdLimit ? `<button class="secondary block" id="md-more">Mostrar más (${total - mdLimit})</button>` : ''}`;
  $$('[data-md]', el).forEach(b => b.onclick = () => openMedal(b.dataset.md));
  $$('[data-mdc]', el).forEach(b => b.onclick = () => { mdCat = b.dataset.mdc; mdLimit = 48; mdMedals(el); });
  $$('[data-mdf]', el).forEach(b => b.onclick = () => { mdFilter = b.dataset.mdf; mdLimit = 48; mdMedals(el); });
  const mo = $('#md-more', el); if (mo) mo.onclick = () => { mdLimit += 96; keepScroll(() => mdMedals(el)); };
}
function mdValTxt(m, v) {
  if (v == null || v === 0) return 'sin datos aún';
  if (m.dir === 'down') return mdT(v / 60, m.fam === 'hsim');
  if (['rel'].includes(m.stat)) return fmt(v, 2) + '×';
  if (m.stat === 'liftGain') return (v >= 0 ? '+' : '') + fmt(v, 1) + ' %';
  if (m.stat === 'tons' || m.stat === 'km' || m.stat === 'lost' || m.stat === 'gained' || m.stat === 'waist') return fmt(v, 1);
  return Math.round(v).toLocaleString('es-MX');
}
function openMedal(id) {
  const m = mdCatalog().find(x => x.id === id); if (!m) return;
  const st = mdState(), g = st.got[id], c = mdCtx(), v = mdVal(m, c), p = mdProgress(m, c), T = MD_TIERS[m.tier];
  const famL = mdCatalog().filter(x => x.fam === m.fam), nx = famL.find(x => !st.got[x.id]);
  openModal(`<div class="md-detail t${m.tier}">${mdSvg(m, !!g, 170)}
      <small>${esc(MD_CATS[m.cat].n.toUpperCase())} · ${esc(T.n.toUpperCase())}</small><h3>${esc(m.n)}</h3><p>${esc(m.d)}</p>
      ${g ? `<div class="md-got">${ico('check', 16)}Ganada el ${longDate(g.d)}${g.retro ? ' · con tu historial' : ''}</div>` : `<div class="md-prog"><span class="td-bar"><i style="--w:${Math.round(p * 100)}%"></i></span><small>Tu marca: ${esc(mdValTxt(m, v))} · ${Math.round(p * 100)} %</small></div>`}
      <div class="md-fam">${famL.map(x => `<button data-mdf2="${x.id}" class="${x.id === id ? 'cur' : ''}" aria-label="${esc(x.n)}">${mdSvg(x, !!st.got[x.id], 40)}</button>`).join('')}</div>
      <p class="small muted">${famL.filter(x => st.got[x.id]).length} de ${famL.length} en esta familia${nx && nx.id !== id ? ` · siguiente: ${esc(nx.n)}` : ''}.</p></div>
    <button class="ghost block" id="md-x">← Volver</button>`, md => {
    $$('[data-mdf2]', md).forEach(b => b.onclick = () => openMedal(b.dataset.mdf2));
    $('#md-x', md).onclick = () => closeModal();
  });
}

/* Récords */
function mdRecords(el) {
  const L = DB.lifts.filter(l => l.r > 0), exs = [...new Set(L.map(l => l.ex))].sort((a, b) => L.filter(l => l.ex === b).length - L.filter(l => l.ex === a).length);
  if (!mdRecEx || !exs.includes(mdRecEx)) mdRecEx = exs[0] || null;
  const rr = typeof runRecords === 'function' ? runRecords() : { rec: {}, longest: null };
  let liftHtml = '<p class="small muted">Registra series con peso y aquí verás tus marcas por ejercicio.</p>';
  if (mdRecEx) {
    const ls = L.filter(l => l.ex === mdRecEx), u = unitFor(mdRecEx);
    const top = ls.reduce((a, l) => !a || l.w > a.w || (l.w === a.w && l.r > a.r) ? l : a, null), be = ls.reduce((a, l) => !a || e1rm(l.w, Math.min(l.r, 12)) > e1rm(a.w, Math.min(a.r, 12)) ? l : a, null);
    const byW = {}; ls.forEach(l => { const k = Math.round(l.w * 2) / 2; if (!byW[k] || l.r > byW[k].r) byW[k] = l; });
    const rows = Object.keys(byW).map(Number).sort((a, b) => b - a).slice(0, 14);
    liftHtml = `<select id="md-ex" class="md-ex">${exs.map(e => `<option ${e === mdRecEx ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
      <div class="nu-row3"><div><b>${wFmt(top.w, u)}</b><small>peso máximo · ${top.r} rep${top.r > 1 ? 's' : ''}<br>${shortDate(top.date)}</small></div><div><b>${wFmt(e1rm(be.w, Math.min(be.r, 12)), u)}</b><small>1RM estimado<br>${wFmt(be.w, u)} × ${be.r}</small></div><div><b>${ls.length}</b><small>series<br>${new Set(ls.map(l => l.sid || l.date)).size} sesiones</small></div></div>
      <div class="ds-h">Récord de repeticiones por peso</div>
      <table class="md-tbl"><thead><tr><th>Peso</th><th class="num">Reps máx.</th><th class="num">Fecha</th></tr></thead><tbody>${rows.map(w => `<tr><td>${wFmt(w, u)}</td><td class="num"><b>${byW[w].r}</b></td><td class="num muted">${shortDate(byW[w].date)}</td></tr>`).join('')}</tbody></table>`;
  }
  const H = DB.hyrox, hx = H && H.results.length ? ['ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb'].map(s => ({ s, b: typeof hxBest === 'function' ? hxBest('st', s) : null })).filter(x => x.b) : [];
  const prs = DB.achievements.filter(a => a.pr).slice(0, 12);
  el.innerHTML = `<div class="ds-h">Fuerza</div>${liftHtml}
    ${Object.keys(rr.rec).length ? `<div class="ds-h">Running</div><div class="md-list">${Object.keys(rr.rec).map(k => `<div><span>${esc(MD_RUN_N[k] || k + ' km')}</span><b>${mdT(rr.rec[k].t / 60, rr.rec[k].t >= 3600)}</b><small>${shortDate(rr.rec[k].date)}</small></div>`).join('')}${rr.longest ? `<div><span>Más larga</span><b>${fmt(rr.longest.km, 1)} km</b><small>${shortDate(rr.longest.date)}</small></div>` : ''}</div>` : ''}
    ${hx.length ? `<div class="ds-h">HYROX</div><div class="md-list">${hx.map(x => `<div><span>${esc(HX_ST[x.s].n)}</span><b>${hxT(x.b.sec)}</b><small>${shortDate(x.b.date)}</small></div>`).join('')}</div>` : ''}
    <div class="ds-h">Récords recientes</div>
    ${prs.length ? `<div class="md-list">${prs.map(a => `<div><span>${esc(a.title)}</span><b>${esc(a.detail || '')}</b><small>${shortDate(a.date)}</small></div>`).join('')}</div>` : '<p class="small muted">Supera una marca (peso, reps a un peso o 1RM) y aparecerá aquí.</p>'}`;
  const s = $('#md-ex', el); if (s) s.onchange = () => { mdRecEx = s.value; mdRecords(el); };
}

/* Estadísticas */
function mdStats(el) {
  const c = mdCtx(), t = todayStr(), ses = DB.sessions.filter(s => s.end);
  const mins = ses.reduce((a, s) => a + Math.min(240, (s.end - s.start) / 60000), 0);
  const months = []; for (let i = 11; i >= 0; i--) { const d = new Date(parseDate(t)); d.setDate(1); d.setMonth(d.getMonth() - i); const k = d.toISOString().slice(0, 7); months.push({ k, n: ses.filter(s => s.date.startsWith(k)).length, l: MONTHS[d.getMonth()] }); }
  const mx = Math.max(1, ...months.map(m => m.n));
  const exCount = {}; DB.lifts.forEach(l => { exCount[l.ex] = (exCount[l.ex] || 0) + 1; });
  const top = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 5), topMax = top.length ? top[0][1] : 1;
  const weeks = []; for (let i = 15; i >= 0; i--) { const wk = weekKey(addDays(t, -7 * i)); weeks.push({ date: wk, y: DB.lifts.filter(l => weekKey(l.date) === wk).reduce((a, l) => a + (l.w || 0) * l.r, 0) / 1000 }); }
  const tile = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  el.innerHTML = `<div class="md-stats">${tile(c.sessions, 'sesiones')}${tile(Math.round(mins / 60), 'horas entrenando')}${tile(c.sets.toLocaleString('es-MX'), 'series')}${tile(c.repsTotal.toLocaleString('es-MX'), 'repeticiones')}${tile(fmt(c.tons, 1), 'toneladas')}${tile(c.prs, 'récords')}${tile(fmt(c.km, 1), 'km corridos')}${tile(c.distinctEx, 'ejercicios')}${tile(c.streak, 'mejor racha (sem)')}</div>
    <div class="ds-h">Sesiones por mes</div>
    <div class="md-bars">${months.map(m => `<div><i style="height:${m.n / mx * 100}%"></i><b>${m.n || ''}</b><small>${m.l}</small></div>`).join('')}</div>
    <div class="ds-h">Toneladas por semana</div>
    <div class="evo-card"><canvas class="evo-canvas sm" id="md-ton"></canvas></div>
    ${top.length ? `<div class="ds-h">Tus ejercicios más entrenados</div><div class="md-top">${top.map(([n, k]) => `<div><span>${esc(n)}</span><i style="--w:${k / topMax * 100}%"></i><b>${k}</b></div>`).join('')}</div>` : ''}`;
  showChart(() => drawChart($('#md-ton'), { series: [{ points: weeks, color: getVar('--accent'), dots: true }], yDec: 1 }));
}

/* ---------- Enganches ---------- */
window.addEventListener('load', () => {
  const r0 = render; render = function (tab) { r0(tab); mdScanSoon(); };
  const c0 = checkSetRecords; checkSetRecords = function (set) { const out = c0(set); mdScanSoon(); return out; };
});

/* =====================================================================
 *  40.0 · Pestaña LOGROS: estante de medallas por disciplina
 * ===================================================================== */
const SHELVES = [
  { k: 'gym', n: 'Gimnasio', ico: 'dumbbell', cats: ['fuerza', 'reps', 'rel', 'prog', 'peso_c', 'pr', 'vol'], d: 'Fuerza, repeticiones, récords y volumen' },
  { k: 'hyrox', n: 'HYROX', ico: 'timer', cats: ['hyrox'], d: 'Estaciones, simulaciones y HPI' },
  { k: 'run', n: 'Running', ico: 'footprints', cats: ['run'], d: 'Distancias, tiempos y kilómetros' },
  { k: 'const', n: 'Constancia', ico: 'calendar', cats: ['const', 'expl'], d: 'Sesiones, rachas y exploración' },
  { k: 'cuerpo', n: 'Cuerpo y nutrición', ico: 'utensils', cats: ['nut', 'cuerpo'], d: 'Alimentación, peso y cintura' },
  { k: 'bien', n: 'Bienestar', ico: 'moon', cats: ['bien'], d: 'Recuperación, sueño y hábitos' }
];
let lgView = 'shelf';
function renderLogrosTab() {
  const root = $('#view-logros'); if (!root) return;
  medalScan();
  const seg = `<div class="seg md-seg">${[['shelf', 'Estante'], ['rec', 'Récords'], ['est', 'Estadísticas']].map(([k, n]) => `<button data-lgv="${k}" class="${lgView === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  root.innerHTML = seg + '<div id="lg-body"></div>';
  $$('[data-lgv]', root).forEach(b => b.onclick = () => { lgView = b.dataset.lgv; redrawChart = () => {}; renderLogrosTab(); });
  const body = $('#lg-body', root);
  if (lgView === 'rec') return mdRecords(body);
  if (lgView === 'est') return mdStats(body);
  const cat = mdCatalog(), st = mdState(), c = mdCtx(), got = cat.filter(m => st.got[m.id]);
  const best = got.slice().sort((a, b) => b.tier - a.tier || b.score - a.score).slice(0, 3);
  const shelf = S => {
    const all = cat.filter(m => S.cats.includes(m.cat)), mine = all.filter(m => st.got[m.id]).sort((a, b) => b.tier - a.tier || b.score - a.score);
    const next = all.filter(m => !st.got[m.id]).map(m => ({ m, p: mdProgress(m, c) })).sort((a, b) => b.p - a.p).slice(0, mine.length ? 2 : 5).map(x => x.m);
    const items = mine.slice(0, 10).concat(next);
    const rows = []; for (let i = 0; i < items.length; i += 5) rows.push(items.slice(i, i + 5));
    return `<section class="sh" data-shelf="${S.k}"><div class="sh-h">${ico(S.ico, 20)}<span><b>${S.n}</b><small>${S.d}</small></span><em>${mine.length}<small>/${all.length}</small></em></div>
      <span class="td-bar"><i style="--w:${mine.length / all.length * 100}%"></i></span>
      ${rows.map(r => `<div class="sh-row">${r.map(m => `<button class="sh-m ${st.got[m.id] ? 'on' : 'off'}" data-md="${m.id}" aria-label="${esc(m.n)}">${mdSvg(m, !!st.got[m.id], 58)}</button>`).join('')}</div><div class="sh-plank"></div>`).join('')}
      <button class="ghost sh-all" data-shall="${S.k}">${mine.length ? 'Ver toda la vitrina' : 'Ver cómo ganarlas'} ›</button></section>`;
  };
  body.innerHTML = `<div class="lg-hero"><div><small>TU VITRINA</small><b>${got.length}</b><span>de ${cat.length.toLocaleString('es-MX')} medallas</span></div>
      <div class="lg-best">${best.length ? best.map(m => `<button data-md="${m.id}">${mdSvg(m, true, 64)}</button>`).join('') : `<p class="small muted">Tu primera medalla llega con tu primera serie.</p>`}</div></div>
    ${SHELVES.map(shelf).join('')}`;
  $$('[data-md]', body).forEach(b => b.onclick = () => openMedal(b.dataset.md));
  $$('[data-shall]', body).forEach(b => b.onclick = () => openShelf(b.dataset.shall));
}
let shLimit = 60;
function openShelf(k, keep) {
  const S = SHELVES.find(x => x.k === k), cat = mdCatalog(), st = mdState(), c = mdCtx();
  if (!keep) shLimit = 60;
  const groups = S.cats.map(ct => ({ ct, l: cat.filter(m => m.cat === ct).sort((a, b) => (!!st.got[b.id] - !!st.got[a.id]) || (a.fam < b.fam ? -1 : a.fam > b.fam ? 1 : a.ord - b.ord)) }));
  const per = g => shLimit > 60 ? g.l.length : Math.max(12, g.l.filter(m => st.got[m.id]).length + 6);
  openModal(`<div class="hx-eyebrow">VITRINA</div><h3 style="margin:2px 0 10px">${esc(S.n)}</h3>
    ${groups.map(g => { const take = g.l.slice(0, per(g)); return take.length ? `<div class="ds-h">${esc(MD_CATS[g.ct].n)} <span class="ds-h-r">${g.l.filter(m => st.got[m.id]).length}/${g.l.length}</span></div>
      <div class="sh-grid">${take.map(m => `<button class="sh-m ${st.got[m.id] ? 'on' : 'off'}" data-md="${m.id}" aria-label="${esc(m.n)}">${mdSvg(m, !!st.got[m.id], 52)}${st.got[m.id] ? '' : `<i style="--p:${Math.round(mdProgress(m, c) * 100)}%"></i>`}</button>`).join('')}</div>` : ''; }).join('')}
    ${groups.some(g => g.l.length > per(g)) ? '<button class="secondary block" id="sh-more">Mostrar todas</button>' : ''}
    <button class="ghost block" id="sh-x">← Volver</button>`, md => {
    $$('[data-md]', md).forEach(b => b.onclick = () => { openMedal(b.dataset.md); const x = $('#md-x'); if (x) x.onclick = () => openShelf(k, true); });
    const mo = $('#sh-more', md); if (mo) mo.onclick = () => { shLimit = 9999; openShelf(k, true); };
    $('#sh-x', md).onclick = () => closeModal();
  });
}
