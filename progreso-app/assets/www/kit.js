'use strict';
/* Mi Progreso 22.0 · Kit del competidor de fisicoculturismo.
   - Sesiones de CBUM: entrenamientos concretos de sus videos y newsletter (orden real de ejercicios y técnicas),
     para "entrenar como él hoy"; y dos rotaciones completas (preparación 2023 y off-season 2024).
   - Poses obligatorias por categoría y federación, con modo práctica cronometrado.
   - Nutrición del competidor con las guías para naturales de Helms 2014 (preparación) e Iraki 2019 (off-season).
   - Check-in semanal, cómo competir en México, topes de Classic Physique y semana / día del show.
   Fuentes y nivel de confianza en docs/FUENTES-v22.md. Las series de CBUM casi nunca se publican completas:
   donde no se reportaron, la app usa 2–3 series de trabajo (su regla dicha en 2023) y lo marca como aproximado. */

/* ---------- Ejercicios que usa CBUM ---------- */
[
  ['Pendulum squat', 'pierna', 'c', 'sentadilla', 'maq', 0, 'squat', null],
  ['Belt squat', 'pierna', 'c', 'sentadilla', 'maq', 0, 'squat', null],
  ['Sentadilla sissy', 'pierna', 'a', 'ext-cuad', 'corporal', 1, 'squat', 'Weighted_Sissy_Squat'],
  ['Curl femoral de pie', 'femoral', 'a', 'curl-fem', 'maq', 0, 'legcurl', 'Standing_Leg_Curl'],
  ['Fondos en máquina (sentado)', 'triceps', 'c', 'triceps-c', 'maq', 0, 'press', 'Dip_Machine'],
  ['Press JM', 'triceps', 'c', 'triceps-c', 'barra', 0, 'press', 'JM_Press'],
  ['Remo alto en máquina', 'espalda', 'c', 'remo', 'maq', 0, 'row', 'Leverage_High_Row'],
  ['Press declinado en máquina', 'pecho', 'c', 'empuje-h', 'maq', 0, 'bench', 'Leverage_Decline_Chest_Press'],
  ['Pullover en máquina', 'espalda', 'a', 'jalon', 'maq', 0, 'row', null],
  ['Extensión de tríceps sobre la cabeza en polea', 'triceps', 'a', 'triceps', 'polea', 1, 'press', 'Cable_Rope_Overhead_Triceps_Extension'],
  ['Curl araña', 'biceps', 'a', 'curl', 'manc', 1, 'curl', 'Spider_Curl'],
  ['Aperturas inclinadas en polea', 'pecho', 'a', 'apertura', 'polea', 1, 'fly', 'Incline_Cable_Flye'],
  ['Pájaro en polea', 'hombro', 'a', 'deltoide-post', 'polea', 1, 'raise', 'Cable_Rear_Delt_Fly'],
  ['Elevación tibial', 'pantorrilla', 'a', 'tibial', 'corporal', 1, 'calf', null]
].forEach(([n, g, t, p, e, pf, icon, photo]) => {
  if (!EX[n]) EX[n] = { g, t, p, e, pf: !!pf, icon: ICONS[icon] ? icon : 'curl' };
  if (photo && !EX_PHOTO[n]) EX_PHOTO[n] = photo;
});
Object.assign(HOWTO_EX, {
  'Pendulum squat': [['Espalda pegada al respaldo y hombros bajo las almohadillas.', 'Baja profundo con control, rodillas hacia el frente.', 'Pausa abajo y sube empujando con todo el pie.'], 'Despegar la cadera del respaldo.'],
  'Belt squat': [['Cinturón en la cadera y pies a la anchura de hombros sobre la plataforma.', 'Baja con el torso erguido hasta que el muslo quede paralelo o más.', 'Sube empujando con los talones.'], 'Inclinarse hacia el frente.'],
  'Sentadilla sissy': [['Agárrate de algo firme y sube a las puntas.', 'Echa las rodillas al frente y el torso atrás en línea recta con los muslos.', 'Baja lo que tu rodilla permita y sube apretando el cuádriceps.'], 'Doblar la cadera (eso la vuelve una sentadilla normal).'],
  'Curl femoral de pie': [['De pie en la máquina, almohadilla sobre el talón.', 'Dobla la rodilla llevando el talón al glúteo, lento.', 'Baja en 3 s hasta estirar.'], 'Mover la cadera para ayudarte.'],
  'Fondos en máquina (sentado)': [['Sentado, agarra las asas a los lados del cuerpo.', 'Empuja hacia abajo hasta extender los codos.', 'Sube controlado hasta un estiramiento cómodo.'], 'Encoger los hombros.'],
  'Press JM': [['Acostado, barra con agarre cerrado sobre el pecho.', 'Baja doblando los codos hacia el frente, con la barra hacia el cuello/mentón.', 'Extiende los codos para subir.'], 'Abrir los codos hacia los lados.'],
  'Remo alto en máquina': [['Pecho en la almohadilla y brazos estirados hacia arriba y al frente.', 'Jala hacia abajo y atrás llevando los codos a las costillas.', 'Regresa lento hasta estirar el dorsal.'], 'Usar impulso con el torso.'],
  'Press declinado en máquina': [['Ajusta el asiento para que las asas queden a la altura del pecho bajo.', 'Empuja hacia abajo y al frente.', 'Regresa lento.'], 'Despegar la espalda del respaldo.'],
  'Pullover en máquina': [['Codos en las almohadillas y brazos arriba.', 'Lleva los codos hacia abajo y atrás usando el dorsal.', 'Regresa lento hasta un buen estiramiento.'], 'Jalar con las manos en vez de los codos.'],
  'Extensión de tríceps sobre la cabeza en polea': [['De espaldas a la polea, cuerda detrás de la cabeza y codos apuntando al frente.', 'Extiende los codos hacia el frente y arriba.', 'Regresa lento hasta estirar el tríceps.'], 'Mover los codos.'],
  'Curl araña': [['Pecho apoyado en un banco inclinado, brazos colgando.', 'Sube las mancuernas sin mover los codos.', 'Baja lento hasta estirar.'], 'Balancear el cuerpo.'],
  'Aperturas inclinadas en polea': [['Banco inclinado entre dos poleas bajas.', 'Abre los brazos con los codos un poco doblados.', 'Junta las manos arriba del pecho apretando.'], 'Convertirlo en un press doblando de más los codos.'],
  'Pájaro en polea': [['Poleas a la altura de los hombros, cables cruzados.', 'Abre los brazos hacia atrás con los codos casi rectos.', 'Regresa lento.'], 'Jalar con la espalda en vez del deltoide posterior.'],
  'Elevación tibial': [['Espalda en la pared y talones a un pie de distancia.', 'Sube las puntas de los pies lo más que puedas.', 'Baja lento.'], 'Rebotar.']
});
Object.assign(PF_SWAP, {
  'Pendulum squat': ['Hack squat', 'Sentadilla en Smith'],
  'Belt squat': ['Sentadilla en Smith', 'Prensa de piernas (máquina)'],
  'Curl femoral de pie': ['Curl femoral sentado'],
  'Fondos en máquina (sentado)': ['Fondos asistidos (máquina)', 'Extensión de tríceps (máquina)'],
  'Press JM': ['Press francés con barra EZ', 'Extensión de tríceps (máquina)'],
  'Remo alto en máquina': ['Remo sentado (máquina)', 'Jalón al pecho'],
  'Press declinado en máquina': ['Chest press (máquina)', 'Press de pecho Magnum (discos)'],
  'Pullover en máquina': ['Pullover en polea (brazos rectos)', 'Pullover con mancuerna (banco transversal)']
});
Object.assign(PF_WHY, {
  'Hack squat': PF_WHY['Hack squat'], 'Sentadilla en Smith': PF_WHY['Sentadilla en Smith'],
  'Curl femoral sentado': 'mismo curl femoral en la máquina que hay en PF',
  'Remo sentado (máquina)': 'remo en máquina con apoyo',
  'Chest press (máquina)': 'press en máquina de placas',
  'Pullover en polea (brazos rectos)': 'mismo trabajo de dorsal con los brazos rectos',
  'Press francés con barra EZ': 'tríceps con barra, lo más parecido al JM'
});

/* ---------- Sesiones de CBUM ---------- */
const CB = (n, s, r, rest) => [n, s, r, rest || 90];
const CBUM_SESSIONS = [
  { id: 'cb-q22', t: 'Cuádriceps que queman · prep 2022', when: 'Olympia 2022', conf: 'A', sets: 'del video', note: 'Calienta en la escaladora. Pocas series, todas al fallo.',
    ex: [CB('Extensión de cuádriceps', 2, '20 o más · a una pierna', 60), CB('Aductor (máquina)', 1, '6', 60), CB('Sentadilla en Smith', 2, '11–12', 150), CB('Prensa de piernas (máquina)', 2, '7–10 · a una pierna', 120), CB('Elevación de talones sentado', 5, '8–10', 60)] },
  { id: 'cb-q24', t: 'Cuádriceps y pantorrilla · off-season 2024', when: 'Off-season 2024, coach Justin King', conf: 'B', sets: 'reportadas por terceros', note: 'Belt squat primero para cuidar las rodillas; luego tri-set sin descanso entre máquinas.',
    ex: [CB('Belt squat', 3, '10–12', 120), CB('Pendulum squat', 3, '10–12 · tri-set', 0), CB('Hack squat', 3, '10–12 · tri-set, pies abajo', 0), CB('Prensa de piernas (máquina)', 3, '8–10 · tri-set', 150),
      CB('Extensión de cuádriceps', 3, '12–15 · súper serie', 0), CB('Aductor (máquina)', 3, '12–15 · súper serie', 75), CB('Elevación de talones sentado', 3, '12–15', 60)] },
  { id: 'cb-legs', t: 'Pierna completa · Revive Gym', when: '2023–2024', conf: 'B', sets: 'aproximadas', note: 'Súper series; dos drop sets triples de cuádriceps con poco peso para cuidar las rodillas.',
    ex: [CB('Extensión de cuádriceps', 3, '12–15 · súper serie + drop set', 0), CB('Curl femoral tumbado', 3, '10–12 · súper serie', 75), CB('Sentadilla en Smith', 3, '8–10 · súper serie', 0), CB('Sentadilla sissy', 3, 'al fallo', 120),
      CB('Prensa de piernas (máquina)', 3, '10–12 · a una pierna, rest-pause', 90), CB('Curl femoral sentado', 3, '10–12 · súper serie', 0), CB('Elevación de talones sentado', 3, '12–15', 60)] },
  { id: 'cb-ham23', t: 'Femoral · prep 2023', when: '6 semanas antes del Olympia 2023, con Hany Rambod', conf: 'A', sets: 'aproximadas (10–15 reps del coach)', note: 'Bajadas controladas; la meta es el femoral "3D" de las poses de perfil.',
    ex: [CB('Curl femoral tumbado', 3, '10–15 · bajada lenta', 75), CB('Curl femoral de pie', 3, '10–15 · a una pierna', 60), CB('Abductor (máquina)', 3, '12–15', 60), CB('Curl femoral sentado', 3, '10–15', 75), CB('Belt squat', 3, '10–12', 120), CB('Elevación de talones sentado', 3, '12–15', 60)] },
  { id: 'cb-ham24', t: 'Femoral y glúteo · inicio prep 2024 (FST-7)', when: '13 semanas antes del Olympia 2024, con Hany Rambod', conf: 'A', sets: 'aproximadas; el video corta la lista', note: 'Repeticiones forzadas al fallo en el curl de pie.',
    ex: [CB('Curl femoral de pie', 3, '10–12 · + forzadas', 60), CB('Curl femoral tumbado', 3, '10–12', 75), CB('Belt squat', 3, '10–12 · rango completo, empuja con talones', 120), CB('Zancadas / split squat búlgaro', 3, '10 por pierna', 90), CB('Elevación de talones sentado', 3, '12–15', 60)] },
  { id: 'cb-ch24', t: 'Pecho, tríceps y deltoide posterior · off-season 2024', when: 'Off-season 2024, coach Justin King', conf: 'B', sets: 'reportadas por terceros', note: 'Press inclinado con bajada de 3–4 s y pausa de 1 s; chest press en volumen alemán (10 × 10); "gauntlet" de tríceps.',
    ex: [CB('Press inclinado con mancuernas', 3, '6–8 · bajada 3–4 s, pausa 1 s', 150), CB('Chest press (máquina)', 10, '10 · volumen alemán', 60), CB('Press JM', 2, '8–10 · tri-set', 0), CB('Fondos en máquina (sentado)', 2, 'al fallo · tri-set', 0),
      CB('Extensión de tríceps sobre la cabeza en polea', 2, '12–15 · tri-set', 90), CB('Pájaro posterior (reverse pec deck)', 3, '12–15 · súper serie', 0), CB('Elevaciones laterales sentado', 3, '12', 60)] },
  { id: 'cb-tempo', t: 'Pecho y tríceps con tempo', when: 'Video del 8 de junio de 2024', conf: 'A', sets: 'aproximadas', note: 'Tempo 3-1-1: 3 s bajando, 1 s de pausa estirado, 1 s subiendo. Última serie de máquina en rest-pause (15 s).',
    ex: [CB('Press inclinado con mancuernas', 3, '8–10 · tempo 3-1-1', 150), CB('Chest press (máquina)', 3, '8–10 · tempo 3-1-1, última rest-pause', 120), CB('Press francés con barra EZ', 2, '10 · giant set', 0), CB('Fondos en máquina (sentado)', 2, 'al fallo · giant set', 0),
      CB('Extensión de tríceps en polea', 2, '12 · giant set', 90), CB('Extensión de tríceps sobre la cabeza en polea', 2, '12–15', 60)] },
  { id: 'cb-cb24', t: 'Pecho y espalda con isométricos · 2024', when: 'Off-season 2024', conf: 'A', sets: 'del video (2 × 6–8 en los pares)', note: 'Primera repetición con pausa de 10 s a media altura y luego ~5 más; pausas largas abajo.',
    ex: [CB('Press inclinado con mancuernas', 3, '1 rep con pausa 10 s + 5 · súper serie', 0), CB('Dominadas / chin-ups', 3, 'al fallo · súper serie', 120), CB('Remo en T (Magnum)', 2, '6–8 · pausa abajo, súper serie', 0),
      CB('Press inclinado (máquina)', 2, '6–8 · súper serie', 120), CB('Remo alto en máquina', 2, '10–12 · súper serie', 0), CB('Lagartijas', 2, 'al fallo', 90)] },
  { id: 'cb-ch8', t: 'Pecho a 8 semanas del Olympia 2024', when: '22 de agosto de 2024, con Hany Rambod', conf: 'A', sets: 'aproximadas', note: 'Press inclinado con agarres variados (él usó mancuernas de 150 lb). Practica poses antes del último ejercicio.',
    ex: [CB('Press inclinado (máquina)', 3, '8–10', 120), CB('Press inclinado con mancuernas', 3, '6–10 · varía el agarre', 150), CB('Press declinado en máquina', 3, '8–12', 120), CB('Cruces en polea', 3, '12–15 · inclinado al frente', 60), CB('Aperturas inclinadas en polea', 2, '12–15 · de abajo hacia arriba', 60)] },
  { id: 'cb-chq', t: 'Pecho en 35 minutos (newsletter)', when: 'Newsletter The Stndrd, 2025', conf: 'A', sets: 'de él', note: 'Tri-set con 10 s entre ejercicios y 3 min entre rondas, 5 rondas. Él usa press declinado con mancuernas; aquí va plano si no hay banco declinado.',
    ex: [CB('Press inclinado con mancuernas', 5, '8–10 · tri-set', 10), CB('Press banca con mancuernas', 5, '8–10 · tri-set', 10), CB('Aperturas con mancuernas', 5, '10–12 · tri-set', 180), CB('Pec deck (aperturas en máquina)', 3, '15', 60)] },
  { id: 'cb-back23', t: 'Espalda · off-season 2023', when: 'Video en su gimnasio privado, 2023', conf: 'A', sets: 'del video', note: 'Su regla: 2 series de trabajo (a veces 3), la última muchas veces con drop set; pullover para calentar.',
    ex: [CB('Pullover en máquina', 3, '10–12 · calentamiento', 60), CB('Remo con barra', 3, '8–10', 120), CB('Remo con mancuerna', 2, '10–12', 90), CB('Remo con pecho apoyado (mancuernas)', 3, '10–12', 90),
      CB('Jalón al pecho', 3, '10–12 · pausa abajo', 90), CB('Remo sentado (máquina)', 2, '10–12 · drop set', 90), CB('Pájaros con mancuernas', 1, '12–15', 60)] },
  { id: 'cb-pull', t: 'Jalón (newsletter)', when: 'Newsletter The Stndrd, 2025', conf: 'A', sets: 'de él (90 s de descanso)', note: 'Una copia del newsletter dice 2 × 30 en el jalón; aquí va 3 × 8.',
    ex: [CB('Jalón al pecho', 3, '8', 90), CB('Remo en T (Magnum)', 3, '10', 90), CB('Pájaro en polea', 3, '15', 90), CB('Pullover con mancuerna (banco transversal)', 3, '20', 90)] },
  { id: 'cb-backbp', t: 'Espalda a prueba de balas (newsletter)', when: 'Newsletter The Stndrd', conf: 'A', sets: 'de él', note: 'Una serie fuerte de peso muerto y luego volumen con apoyo.',
    ex: [CB('Peso muerto', 1, '4–5 · serie fuerte', 180), CB('Remo con pecho apoyado (mancuernas)', 4, '8–10', 120), CB('Dominadas / chin-ups', 4, '6–12 · al fallo', 120), CB('Remo con mancuerna', 3, '10–12', 90)] },
  { id: 'cb-sh23', t: 'Hombro a 2 semanas del Olympia 2023', when: '26 de octubre de 2023', conf: 'A', sets: 'del video', note: 'Laterales descendentes (él: 45 → 40 → 35 lb). Press de discos con drop set, parciales y ayuda al final.',
    ex: [CB('Elevaciones laterales', 3, '12 · baja el peso cada serie', 60), CB('Shoulder press (máquina)', 3, '8–10 · última con drop set y parciales', 120), CB('Elevaciones laterales en polea', 1, '12–15 · ambos brazos, cables cruzados', 60),
      CB('Pájaro posterior (reverse pec deck)', 3, '12–15', 60), CB('Elevación de talones sentado', 3, '12–15', 60), CB('Elevación tibial', 2, '15–20', 45)] },
  { id: 'cb-arm24', t: 'Brazo a 2 semanas del Olympia 2024', when: 'Octubre de 2024, con Hany Rambod', conf: 'A', sets: 'aproximadas (~3 por ejercicio)', note: 'Carga en estiramiento, parciales, bajadas lentas y pausas isométricas.',
    ex: [CB('Extensión de tríceps en polea', 3, '10–12', 60), CB('Press francés con barra EZ', 3, '8–10', 75), CB('Press banca en Smith', 3, '8–10 · agarre cerrado', 90), CB('Extensión de tríceps sobre la cabeza en polea', 3, '12–15', 60),
      CB('Curl en polea', 3, '10–12 · a un brazo', 60), CB('Curl araña', 3, '10–12', 60), CB('Curl predicador', 3, '8–10', 60)] }
];
const cbSess = id => CBUM_SESSIONS.find(s => s.id === id);
const dayOf = (id, name) => ({ id: 'cb_' + id, name, ex: cbSess(id).ex.map(e => e.slice()), cbum: id });
/* Rotaciones completas armadas con sus sesiones documentadas */
COMP_ROUTINES.cbum.days = [dayOf('cb-q22', 'Día 1 · Cuádriceps'), dayOf('cb-ch8', 'Día 2 · Pecho y algo de tríceps'), dayOf('cb-back23', 'Día 3 · Espalda y algo de bíceps'), { id: 'cbr1', name: 'Descanso', rest: true, ex: [] },
  dayOf('cb-sh23', 'Día 4 · Hombro'), dayOf('cb-ham23', 'Día 5 · Femoral'), dayOf('cb-arm24', 'Día 6 · Brazo'), { id: 'cbr2', name: 'Descanso', rest: true, ex: [] }];
COMP_ROUTINES.cbum.desc = 'Su rotación de preparación (3 días, 1 de descanso, 3 días, 1 de descanso) y en cada día una sesión real de sus videos: cuádriceps 2022, pecho a 8 semanas del Olympia, espalda 2023, hombro a 2 semanas del Olympia 2023, femoral prep 2023 y brazo 2024. Pocas series de trabajo, muy intensas (drop sets, parciales, pausas).';
COMP_ROUTINES.cbum.src = 'Videos de CBUM resumidos por Fitness Volt, BarBend, Breaking Muscle y Generation Iron; ver docs/FUENTES-v22.md';
ROUTINES.cbum.days = COMP_ROUTINES.cbum.days; ROUTINES.cbum.desc = COMP_ROUTINES.cbum.desc;
COMP_NAMES.cbum24 = 'CBUM · off-season 2024 (rotación de 9 días)';
COMP_ROUTINES.cbum24 = {
  desc: 'La rotación de 9 días de su off-season 2024 con Justin King, con sus sesiones de ese año: pecho/tríceps/deltoide posterior con volumen alemán, espalda, cuádriceps con tri-set de máquinas, hombro, brazo, pecho y espalda con isométricos y femoral.',
  level: 'Avanzado', ico: '💎', weeks: 'Bloques de 9 días', src: 'Hunt Fitness, BarBend y Fitness Volt (off-season 2024)',
  days: [dayOf('cb-ch24', 'Día 1 · Pecho, tríceps y deltoide posterior'), dayOf('cb-back23', 'Día 2 · Espalda y bíceps'), dayOf('cb-q24', 'Día 3 · Cuádriceps y pantorrilla'), { id: 'c24r1', name: 'Descanso', rest: true, ex: [] },
    dayOf('cb-sh23', 'Día 4 · Hombro'), dayOf('cb-arm24', 'Día 5 · Brazo'), dayOf('cb-cb24', 'Día 6 · Pecho y espalda'), dayOf('cb-ham24', 'Día 7 · Femoral, glúteo y pantorrilla'), { id: 'c24r2', name: 'Descanso', rest: true, ex: [] }]
};
ROUTINES.cbum24 = { name: COMP_NAMES.cbum24, desc: COMP_ROUTINES.cbum24.desc, days: COMP_ROUTINES.cbum24.days, comp: true, famous: true };
ROUTINE_ICO.cbum24 = '💎'; ROUTINE_LEVEL.cbum24 = 'Avanzado';
COMP_KEYS.splice(COMP_KEYS.indexOf('cbum') + 1, 0, 'cbum24');
FAMOUS_KEYS.splice(1, 0, 'cbum24'); FAMOUS_SHORT.cbum = 'CBUM · prep Olympia'; FAMOUS_SHORT.cbum24 = 'CBUM · off-season 2024';

/** Empieza hoy una sesión suelta (sin cambiar tu rutina). */
function startNamedSession(name, ex, coach, famId) {
  startSession('libre'); const s = activeSession(); if (!s) return;
  s.dayName = name; if (coach) { s.coach = coach; s.famId = famId; } s.base = ex.map(e => e.slice()); s.swaps = {}; s.adapt = {};
  const used = s.base.map(e => e[0]).filter(okForMe);
  s.base.forEach((e, i) => { const a = adaptFor(e[0], used); if (a && a.alt) { s.swaps[i] = a.alt; s.adapt[i] = 'En vez de ' + e[0] + ' (' + a.why + ')'; used.push(a.alt); } });
  saveData(); closeModal(); showTab('train'); window.scrollTo(0, 0);
}
function openCbumSessions(back) {
  openModal(`<h3>Entrena como CBUM hoy</h3>
    <p class="small muted" style="margin-top:0">Sesiones reales de sus videos y su newsletter, con su orden de ejercicios y sus técnicas. Empieza una sin cambiar tu rutina.${isPF() ? ' Ya vienen adaptadas a tu Planet Fitness.' : ''}</p>
    ${CBUM_SESSIONS.map(s => `<button class="rg-card" data-cbs="${s.id}"><span class="grow"><b>${esc(s.t)}</b><small>${esc(s.when)} · ${s.ex.length} ejercicios · series ${esc(s.sets)}</small></span><span aria-hidden="true">›</span></button>`).join('')}
    <p class="small muted" style="margin-top:10px">Basado en lo publicado de sus videos; sin afiliación con él ni con STNDRD. Las series casi nunca se publican completas.</p>
    <button class="ghost block" id="cbs-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => {
    $$('[data-cbs]', m).forEach(b => b.onclick = () => previewCbumSession(b.dataset.cbs, back));
    $('#cbs-x', m).onclick = () => back ? back() : closeModal();
  });
}
function previewCbumSession(id, back) {
  const s = cbSess(id);
  openModal(`<h3>${esc(s.t)}</h3><p class="small muted" style="margin-top:0">${esc(s.when)} · confianza ${s.conf === 'A' ? 'alta (de su video)' : 'media (resumen de terceros)'} · series ${esc(s.sets)}</p>
    <div class="adapt-note">${ico('lightbulb', 16, 'lead')}${esc(s.note)}</div>
    <ol class="cbs-list">${(al => s.ex.map((e, i) => { const a = al[i]; return `<li><b>${esc(a)}</b><small>${e[1]} × ${esc(e[2])}${e[3] ? ' · descanso ' + mmss(e[3]) : ' · sin descanso: sigue al siguiente'}</small>${a !== e[0] ? `<small class="rp-swap">en vez de ${esc(e[0])}</small>` : ''}</li>`; }).join(''))(adaptList(s.ex))}</ol>
    <button class="block" id="cbs-go">${ico('play', 18)} Empezar esta sesión</button>
    <button class="ghost block" id="cbs-b" style="margin-top:6px">← Otras sesiones</button>`, m => {
    $('#cbs-go', m).onclick = () => startNamedSession('CBUM · ' + s.t, s.ex, 'cbum', s.id);
    $('#cbs-b', m).onclick = () => openCbumSessions(back);
  });
}

/* ---------- Poses obligatorias ---------- */
const BB_POSES = {
  fdb: ['Doble bíceps de frente', 'Codos a la altura de los hombros o un poco arriba, hombros abajo, dorsal abierto, pecho arriba, cintura apretada y piernas flexionadas.'],
  fls: ['Dorsal de frente', 'Pies a la anchura de hombros, puños en la cintura; abre el dorsal hacia fuera y al frente sin perder la cintura.'],
  sch: ['Pecho de perfil', 'Pierna de adelante doblada en puntas, toma tu muñeca, aprieta pecho y bíceps y flexiona el muslo sin girar de más.'],
  bdb: ['Doble bíceps de espalda', 'Una pierna atrás en puntas para mostrar pantorrilla y femoral, codos arriba, abre la espalda.'],
  bls: ['Dorsal de espalda', 'Como el dorsal de frente pero de espaldas, con pantorrillas flexionadas.'],
  str: ['Tríceps de perfil', 'Brazo recto y bloqueado detrás del cuerpo, tríceps apretado, pierna de adelante doblada.'],
  abt: ['Abdominales y muslos', 'Manos detrás de la cabeza, saca el aire, contrae el abdomen y adelanta una pierna con el cuádriceps flexionado.'],
  mm: ['Más muscular', 'Inclínate un poco al frente y contrae todo a la vez: trapecio, pecho, brazos y piernas.'],
  vac: ['Vacuum', 'Saca todo el aire y mete el abdomen hacia arriba, bajo las costillas; normalmente con los brazos arriba.'],
  fav: ['Pose clásica favorita', 'Tu pose (no puede ser un más muscular). Elige la que mejor muestre tus proporciones.'],
  mpf: ['Frente (Men\'s Physique)', 'Postura firme, una mano en la cadera y una pierna un poco al lado; abdomen y dorsal activos sin flexionar como fisicoculturista.'],
  mpb: ['Espalda (Men\'s Physique)', 'Una mano en la cadera y el dorsal apenas abierto, natural.'],
  qt: ['Cuartos de giro', 'Frente, perfil derecho, espalda y perfil izquierdo (o derecho), según llame el juez. Mantén la postura en cada uno.'],
  bkf: ['Frente (Bikini)', 'Camina al centro, pose de frente con cadera ligeramente girada y cintura apretada.'],
  bkb: ['Espalda (Bikini)', 'Gira 180°, pose de espalda mostrando glúteo y la línea de la cintura; regresa al frente.']
};
const POSE_SETS = {
  bodybuilding: { npc: ['fdb', 'fls', 'sch', 'bdb', 'bls', 'str', 'abt', 'mm'], ifbb: ['fdb', 'fls', 'sch', 'bdb', 'bls', 'str', 'abt'], note: 'NPC/Pro League: 8 poses en máximo 60 s. IFBB (FMFF): 7, sin el más muscular. En la final, rutina libre.' },
  classic: { npc: ['qt', 'fdb', 'sch', 'bdb', 'abt', 'fav'], ifbb: ['qt', 'fdb', 'sch', 'bdb', 'vac', 'abt'], note: 'NPC: cuartos de giro + 5 poses (60 s) y rutina con música de hasta 60 s en la final; la "moon pose" descalifica. IFBB (FMFF): la eliminatoria incluye vacuum.' },
  mens: { npc: ['mpf', 'mpb'], ifbb: ['qt', 'mpf', 'mpb'], note: 'NPC: al centro, frente y espalda, 30 s. IFBB: cuatro cuartos de giro (derecha, espalda, derecha, frente). Pararse mal tras un aviso es tarjeta amarilla.' },
  bikini: { npc: ['bkf', 'bkb'], ifbb: ['qt', 'bkf', 'bkb'], note: 'NPC: presentación de 10 s o menos (frente, 180° a espalda, frente). Se premia forma y balance, no densidad ni estrías.' },
  wellness: { npc: ['qt', 'bkf', 'bkb'], ifbb: ['qt'], note: 'Cuartos de giro: frente, derecha, espalda, derecha. Más masa en el tren inferior que en Bikini.' },
  figure: { npc: ['qt'], ifbb: ['qt'], note: 'Solo cuartos de giro, sin poses de flexión. (Fuente secundaria: verifica con tu promotor.)' },
  wphysique: { npc: ['qt', 'fdb', 'sch', 'bdb', 'str', 'abt'], ifbb: ['qt', 'fdb', 'sch', 'bdb', 'str', 'abt'], note: 'Cuartos de giro + 5 poses (manos abiertas en el doble bíceps), 30 s en la prejueceo y rutina de 60 s en la final. Descalza.' }
};
COMP_CATS.wphysique = "Women's Physique";
let POSE_FED = 'npc';
function openPoseGuide(back) {
  const cat = (DB.profile.comp && DB.profile.comp.cat) || (fem() ? 'bikini' : 'classic'), set = POSE_SETS[cat] || POSE_SETS.classic;
  const draw = m => {
    const list = set[POSE_FED];
    const mins = posingMinutes(7);
    m.innerHTML = `<h3>Poses · ${esc(COMP_CATS[cat] || cat)}</h3>
      <div class="seg"><button data-fed="npc" class="${POSE_FED === 'npc' ? 'on' : ''}">NPC / Pro League</button><button data-fed="ifbb" class="${POSE_FED === 'ifbb' ? 'on' : ''}">IFBB (FMFF)</button></div>
      <p class="small muted" style="margin-top:0">${esc(set.note)}</p>
      <ol class="pose-list">${list.map(k => `<li><b>${esc(BB_POSES[k][0])}</b><small>${esc(BB_POSES[k][1])}</small></li>`).join('')}</ol>
      <div class="rir-label"><span>Práctica: sostén cada pose</span></div>
      <div class="seg">${[20, 30, 45, 60].map(s => `<button data-ph="${s}" class="${(DB.profile.poseHold || 30) === s ? 'on' : ''}">${s} s</button>`).join('')}</div>
      <button class="block" id="pz-go">${ico('play', 18)} Practicar mis poses</button>
      <p class="small muted" style="text-align:center;margin:8px 0">Esta semana: ${mins} min de poses. En preparación se recomiendan 10–15 min diarios (convención de coaches).</p>
      <p class="small muted">Cambia tu categoría en "Mi show". Las reglas cambian cada año: confírmalas con tu federación o promotor.</p>
      <button class="ghost block" id="pz-x">${back ? '← Volver' : 'Cerrar'}</button>`;
    $$('[data-fed]', m).forEach(b => b.onclick = () => { POSE_FED = b.dataset.fed; draw(m); });
    $$('[data-ph]', m).forEach(b => b.onclick = () => { DB.profile.poseHold = Number(b.dataset.ph); saveData(); draw(m); });
    $('#pz-go', m).onclick = () => posePractice(list, cat, () => openPoseGuide(back));
    $('#pz-x', m).onclick = () => back ? back() : closeModal();
  };
  openModal('', draw);
}
function posingMinutes(days) { const from = addDays(todayStr(), -(days - 1)); return Math.round((DB.posing || []).filter(x => x.date >= from).reduce((a, x) => a + x.sec, 0) / 60); }
/** Práctica guiada: cada pose N s, 10 s para cambiar, 2 vueltas. Cuenta el tiempo para el check-in. */
function posePractice(list, cat, done) {
  const hold = DB.profile.poseHold || 30, seq = list.concat(list);
  let i = 0, phase = 'hold', left = hold, t0 = Date.now(), timer = null;
  const finish = (complete) => {
    clearInterval(timer);
    const sec = Math.round((Date.now() - t0) / 1000);
    if (sec >= 20) { DB.posing = DB.posing || []; DB.posing.push({ date: todayStr(), sec, cat }); saveData(); }
    openModal(`<h3>${complete ? 'Práctica completa' : 'Práctica guardada'}</h3><p>${Math.round(sec / 60 * 10) / 10} min de poses. Esta semana llevas ${posingMinutes(7)} min.</p><p class="small muted">Tip: grábate y compara con la semana pasada.</p><button class="block" id="pp-ok">Listo</button>`, m => { $('#pp-ok', m).onclick = done; });
  };
  openModal('<div id="pp"></div>', m => {
    const paint = () => {
      const k = seq[i], nx = seq[i + 1];
      $('#pp', m).innerHTML = `<div class="pp-top"><span>${i + 1} de ${seq.length}</span><span>${phase === 'hold' ? 'Sostén' : 'Cambia de pose'}</span></div>
        <div class="pp-name">${esc(BB_POSES[k][0])}</div><div class="pp-time ${phase}">${left}</div>
        <p class="small muted">${esc(BB_POSES[k][1])}</p>${nx ? `<p class="small">Sigue: <b>${esc(BB_POSES[nx][0])}</b></p>` : ''}
        <button class="secondary block" id="pp-stop">Terminar</button>`;
      $('#pp-stop', m).onclick = () => finish(false);
    };
    paint();
    timer = setInterval(() => {
      left--;
      if (left <= 0) {
        if (phase === 'hold') { vibrate(80); if (i >= seq.length - 1) { finish(true); return; } phase = 'switch'; left = 10; }
        else { phase = 'hold'; left = hold; i++; vibrate(40); }
      }
      paint();
    }, 1000);
  });
}

/* ---------- Nutrición del competidor (naturales) ---------- */
function compNutrition() {
  const p = DB.profile, w = currentWeight() || p.startWeight, bf = (p.bodyFat || (p.sex === 'f' ? 22 : 15)) / 100, lbm = w * (1 - bf);
  const ph = compPhase().k, base = Math.round(w * KG_TO_LB * 15 / 10) * 10;   // mantenimiento aproximado de la app (peso en lb × 15)
  if (ph === 'prep' || ph === 'show') {
    const lossKg = w * 0.0075, kcal = Math.round((base - lossKg * 7700 / 7) / 10) * 10;
    const protein = Math.round(lbm * 2.7), fat = Math.round(kcal * 0.22 / 9), carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { ph, kcal, protein, fat, carbs, w, lbm, bf, rate: `Bajar ${fmt(w * 0.005)}–${fmt(w * 0.01)} kg por semana (0.5–1 % de tu peso)`,
      why: ['Proteína 2.3–3.1 g por kg de masa magra (aquí 2.7 g/kg de ' + fmt(lbm) + ' kg)', 'Grasa 15–30 % de las calorías (aquí 22 %)', 'Carbohidratos: el resto, más cerca del entreno', 'Si la pérdida se estanca 2 semanas, baja 100–150 kcal o suma cardio suave'], src: 'Helms, Aragon y Fitschen 2014 (JISSN)' };
  }
  const kcal = Math.round(base * 1.1 / 10) * 10, protein = Math.round(w * 2), fat = Math.round(w * 1), carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { ph, kcal, protein, fat, carbs, w, lbm, bf, rate: `Subir ${fmt(w * 0.0025)}–${fmt(w * 0.005)} kg por semana (0.25–0.5 % de tu peso)`,
    why: ['Superávit de 10–20 % (aquí 10 %)', 'Proteína 1.6–2.2 g/kg (aquí 2 g/kg)', 'Grasa 0.5–1.5 g/kg (aquí 1 g/kg)', 'Carbohidratos: el resto, al menos 3–5 g/kg'], src: 'Iraki, Fitschen, Espinar y Helms 2019 (Sports)' };
}
function openCompNutrition(back) {
  const draw = m => {
    const n = compNutrition(), p = DB.profile;
    m.innerHTML = `<h3>Nutrición del competidor</h3>
      <p class="small muted" style="margin-top:0">Fase: <b>${esc(compPhase().name)}</b>. Guías para competidores naturales (${esc(n.src)}).</p>
      <label>Grasa corporal estimada (%)<input id="cn-bf" inputmode="decimal" value="${p.bodyFat || ''}" placeholder="${p.sex === 'f' ? 22 : 15} (estimado)"></label>
      <div class="cn-grid"><div><b>${n.kcal.toLocaleString('es-MX')}</b><small>kcal</small></div><div><b>${n.protein} g</b><small>proteína</small></div><div><b>${n.carbs} g</b><small>carbohidratos</small></div><div><b>${n.fat} g</b><small>grasa</small></div></div>
      <p class="small"><b>${esc(n.rate)}.</b></p>
      <ul class="comp-list">${n.why.map(t => `<li>${ico('check', 16)}<span>${esc(t)}</span></li>`).join('')}</ul>
      <div class="status info"><b>Suplementos con evidencia</b>Creatina monohidratada 3–5 g diarios; cafeína antes de entrenar (hasta 3–6 mg/kg si la toleras); beta-alanina 3–5 g. Lo demás tiene evidencia débil.</div>
      <div class="status warn" style="margin-top:8px"><b>Cuida tu cabeza</b>La preparación aumenta el riesgo de problemas con la comida y la imagen corporal. Si te pasa, busca a un profesional.</div>
      <button class="block" id="cn-apply" style="margin-top:12px">Usar estas metas en la app</button>
      <button class="ghost block" id="cn-x" style="margin-top:6px">${back ? '← Volver' : 'Cerrar'}</button>`;
    $('#cn-bf', m).onchange = e => { const v = num(e.target.value); DB.profile.bodyFat = v > 3 && v < 50 ? v : null; saveData(); draw(m); };
    $('#cn-apply', m).onclick = () => { Object.assign(DB.profile, { autoMacros: false, kcal: n.kcal, protein: n.protein, fatG: n.fat, phase: n.ph === 'prep' || n.ph === 'show' ? 'definicion' : 'volumen' }); saveData(); toast('Metas actualizadas: ' + n.kcal + ' kcal y ' + n.protein + ' g de proteína'); };
    $('#cn-x', m).onclick = () => back ? back() : closeModal();
  };
  openModal('', draw);
}

/* ---------- Check-in semanal ---------- */
function openCheckinWeekly(back) {
  const avg = weekAvg(todayStr()), list = (DB.checkins || []).slice().sort((a, b) => b.date < a.date ? -1 : 1);
  const prev = list[0], c = { waist: '', energy: 3, hunger: 3, sleep: 3, notes: '' };
  const sc = (k, l) => `<div class="rir-label"><span>${l}</span></div><div class="seg">${[1, 2, 3, 4, 5].map(v => `<button data-ck="${k}|${v}" class="${c[k] === v ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  const rate = (a, b) => a && b && b.w ? ((a.w - b.w) / b.w * 100) / Math.max(1, daysBetween(b.date, a.date) / 7) : null;
  const draw = m => {
    m.innerHTML = `<h3>Check-in semanal</h3>
      <p class="small muted" style="margin-top:0">Lo que revisaría un coach cada semana. Peso promedio de 7 días: <b>${avg ? fmt(avg.avg) + ' kg' : 'registra tu peso'}</b> · poses: <b>${posingMinutes(7)} min</b>.</p>
      <label>Cintura (cm, a la altura del ombligo)<input id="ck-waist" inputmode="decimal" value="${c.waist}"></label>
      ${sc('energy', 'Energía (1 baja · 5 alta)')}${sc('hunger', 'Hambre (1 poca · 5 mucha)')}${sc('sleep', 'Sueño (1 malo · 5 bueno)')}
      <label>Notas<textarea id="ck-notes" rows="2" placeholder="Cómo te sentiste, cambios, dudas para tu coach">${esc(c.notes)}</textarea></label>
      <button class="block" id="ck-save">Guardar check-in</button>
      <button class="secondary block" id="ck-photo" style="margin-top:8px">${ico('camera', 18, 'lead')}Tomar fotos de la semana</button>
      ${list.length ? `<div class="rir-label" style="margin-top:14px"><span>Historial</span></div>${list.slice(0, 8).map((x, i) => { const r = rate(x, list[i + 1]); return `<div class="ck-row"><span class="grow"><b>${shortDate(x.date)}</b><small>${x.w ? fmt(x.w) + ' kg' : '—'}${x.waist ? ' · cintura ' + fmt(x.waist) + ' cm' : ''} · E${x.energy} H${x.hunger} S${x.sleep} · ${x.pose || 0} min poses</small></span>${r != null ? `<span class="rs-tag ${Math.abs(r) > 1.2 ? 'down' : ''}">${signed(r, 1)} %/sem</span>` : ''}</div>`; }).join('')}` : ''}
      <button class="ghost block" id="ck-x" style="margin-top:6px">${back ? '← Volver' : 'Cerrar'}</button>`;
    $$('[data-ck]', m).forEach(b => b.onclick = () => { const [k, v] = b.dataset.ck.split('|'); c.waist = $('#ck-waist', m).value; c.notes = $('#ck-notes', m).value; c[k] = Number(v); draw(m); });
    $('#ck-save', m).onclick = () => {
      DB.checkins = (DB.checkins || []).filter(x => x.date !== todayStr());
      DB.checkins.push({ date: todayStr(), w: avg ? Math.round(avg.avg * 10) / 10 : null, waist: num($('#ck-waist', m).value), energy: c.energy, hunger: c.hunger, sleep: c.sleep, notes: $('#ck-notes', m).value.slice(0, 500), pose: posingMinutes(7) });
      saveData(); toast('Check-in guardado'); openCheckinWeekly(back);
    };
    $('#ck-photo', m).onclick = () => { closeModal(); progMode = 'photos'; showTab('progress'); };
    $('#ck-x', m).onclick = () => back ? back() : closeModal();
  };
  void prev; openModal('', draw);
}

/* ---------- Competir en México ---------- */
const MX_FEDS = [
  { n: 'FMFF · Federación Mexicana de Fisicoconstructivismo y Fitness', d: 'La federación nacional reconocida por la IFBB. Te afilias en la asociación de tu estado y quedas en el RUF (Registro Único de la Federación). Camino: local → estatal → selectivo nacional. Hay un nacional para Principiantes y Novatos.', ev: 'Mr. México Principiantes y Novatos (Palacio de los Deportes, CDMX) · Mr. México Juvenil y Veteranos (mayo, Puebla) · 74.º Clásico Mr. México (WTC CDMX).' },
  { n: 'NPC Worldwide / IFBB Pro League', d: 'Necesitas la credencial anual (enero–diciembre, 18+, alrededor de 40 USD). Como mexicano compites en un Regional en México. "True Novice": nunca has competido en NPC Worldwide. Las cuotas se pagan al promotor por categoría (Mexican Nationals: Open 4,500 MXN, Crossover 2,500, Regional 1,500).', ev: '2026: Mexico Supershow (Guadalajara, 18–19 jul) · Mexico Grand Battle (Monterrey, 15–16 ago) · Xtreme Bodybuilding Mexico Pro (Tijuana, 5 jul) · Pharlabs Mexico Pro (Nuevo Vallarta, 4 oct).' },
  { n: 'WNBF México (100 % natural)', d: 'Polígrafo en cada show y prueba de orina a por lo menos el 30 % de los atletas en un laboratorio acreditado por la WADA. Afiliación obligatoria. Categorías: Bodybuilding, Classic Physique, Men\'s Physique, Bikini y Figura.', ev: 'Mazatlán, 18 de octubre de 2026 (pesaje 16–17 oct).' },
  { n: 'Naturalmanía (FMAFFFNAC)', d: 'Federación natural fundada en 2016, ligada a la WNBF.', ev: '' }
];
function openCompeteMexico(back) {
  openModal(`<h3>Competir en México</h3><p class="small muted" style="margin-top:0">Datos de 2026 recopilados de páginas de las federaciones y medios. Cuotas y fechas cambian: confírmalas antes de inscribirte.</p>
    ${MX_FEDS.map(f => `<div class="mx-fed"><b>${esc(f.n)}</b><p class="small">${esc(f.d)}</p>${f.ev ? `<p class="small muted"><b>Eventos:</b> ${esc(f.ev)}</p>` : ''}</div>`).join('')}
    <div class="status info"><b>Si eres natural</b>WNBF y Naturalmanía hacen pruebas. NPC tiene reglas de shows naturales; en la FMFF no encontramos pruebas sistemáticas.</div>
    <button class="ghost block" id="mx-x" style="margin-top:10px">${back ? '← Volver' : 'Cerrar'}</button>`, m => { $('#mx-x', m).onclick = () => back ? back() : closeModal(); });
}

/* ---------- Topes de Classic Physique ---------- */
const CP_CAPS = [   // [hasta cm, Pro League 2023 kg, NPC amateur kg]
  [167.6, 84.8, 80.3], [170.2, 87.1, 82.6], [172.7, 89.4, 84.8], [175.3, 92.5, 88.0], [177.8, 96.2, 91.6], [180.3, 99.3, null], [182.9, 103.0, null]
];
function openCpCaps(back) {
  const h = DB.profile.height, row = CP_CAPS.find(r => h <= r[0]), w = currentWeight();
  const ifbb = h ? (h - 100) + (h <= 175 ? 4 : h <= 180 ? 5 : 6) : null;
  openModal(`<h3>Tope de peso · Classic Physique</h3><p class="small muted" style="margin-top:0">Tu estatura: <b>${h || '—'} cm</b> · tu peso: <b>${w ? fmt(w) + ' kg' : '—'}</b>. En Classic Physique te pesan al registrarte y no puedes pasar el tope de tu estatura.</p>
    ${row ? `<div class="cn-grid"><div><b>${fmt(row[1])} kg</b><small>Pro League (2023)</small></div>${row[2] ? `<div><b>${fmt(row[2])} kg</b><small>NPC amateur</small></div>` : ''}<div><b>≈${fmt(ifbb)} kg</b><small>IFBB/FMFF (fórmula aprox.)</small></div></div>` : '<p class="small">Tu estatura está fuera de la tabla resumida; consulta la tabla oficial.</p>'}
    <table class="small"><tbody><tr><th>Hasta</th><th>Pro</th><th>NPC</th></tr>${CP_CAPS.map(r => `<tr${row === r ? ' class="hl"' : ''}><td>${r[0]} cm</td><td>${r[1]} kg</td><td>${r[2] ? r[2] + ' kg' : '—'}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">Las fuentes no coinciden y los topes cambian cada año (el Pro League subió 2–7 lb en 2023). En la IFBB el tope es (estatura en cm − 100) + un margen por rango. Confírmalo con tu federación.</p>
    <button class="ghost block" id="cp-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => { $('#cp-x', m).onclick = () => back ? back() : closeModal(); });
}

/* ---------- Semana y día del show ---------- */
function openShowDay(back) {
  openModal(`<h3>Semana y día del show</h3>
    <div class="status warn"><b>Lo que NO debes hacer</b>Cortar el agua, cortar el sodio o usar diuréticos. Puede causar desequilibrios peligrosos de potasio y sodio (hay casos con arritmias y rabdomiólisis) y casi nunca mejora cómo te ves.</div>
    <ul class="comp-list" style="margin-top:12px">
      <li>${ico('check', 16)}<span>Ensaya cualquier cambio de carbohidratos 1–3 semanas antes, en una "semana de prueba".</span></li>
      <li>${ico('check', 16)}<span>Carga de carbohidratos: se han usado 3–12 g/kg y depende de cada quien; sin sodio bajo (lo necesitas para absorber la glucosa).</span></li>
      <li>${ico('check', 16)}<span>Lo demás constante: agua, sodio, fibra y comidas que ya conoces.</span></li>
      <li>${ico('check', 16)}<span>El bronceado: sin crema, desodorante ni loción antes de aplicarlo. Casi todos los shows tienen compañía oficial.</span></li>
    </ul>
    <div class="rir-label"><span>Qué llevar</span></div>
    <ul class="comp-list">${['Credencial / identificación y papeles de registro', 'Traje y uno de repuesto, pegamento para traje', 'Tacones y joyería (en las categorías que lo permiten)', 'Ropa oscura y holgada o bata', 'Toallitas, gel antibacterial, esponja para retocar el bronceado y aceite o glaze', 'Comida y carbohidratos ya porcionados (más de lo que crees), agua y electrolitos', 'Ligas o mancuernas ligeras para el bombeo', 'USB con tu música (y otra de repuesto), sin groserías'].map(t => `<li>${ico('check', 16)}<span>${t}</span></li>`).join('')}</ul>
    <p class="small muted">Fuentes: Escalante et al. 2021; Homer, Cross y Helms 2024; Chappell y Simper 2018. La semana del show debe guiarla tu coach.</p>
    <button class="ghost block" id="sd-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => { $('#sd-x', m).onclick = () => back ? back() : closeModal(); });
}

/* ---------- Menú del kit (Explorar → Competir) ---------- */
function openCompete() {
  const ph = compPhase(), c = DB.profile.comp;
  const items = [
    ['programs', 'trophy', 'Programas completos', 'Arnold, CBUM y Tom Holland, listos para empezar'],
    ['cbum', 'zap', 'Entrena como CBUM hoy', CBUM_SESSIONS.length + ' sesiones reales de sus videos'],
    ['show', 'calendar', 'Mi show', c && c.date ? `${COMP_CATS[c.cat] || ''} · ${ph.name}${ph.weeks != null && ph.k !== 'post' ? ' · ' + ph.weeks + ' sem' : ''}` : 'Fecha, categoría y fase'],
    ['poses', 'person-standing', 'Poses obligatorias', 'Guía por categoría y práctica cronometrada'],
    ['food', 'utensils', 'Nutrición del competidor', 'Calorías y macros para tu fase (naturales)'],
    ['check', 'clipboard-list', 'Check-in semanal', 'Peso, cintura, sensaciones y fotos'],
    ['mx', 'map-pin', 'Competir en México', 'Federaciones, inscripción y eventos'],
    ['caps', 'ruler', 'Tope de Classic Physique', 'Peso máximo para tu estatura'],
    ['day', 'list-checks', 'Semana y día del show', 'Qué hacer, qué evitar y qué llevar']
  ];
  const back = openCompete;
  openModal(`<h3>Kit del competidor</h3><p class="small muted" style="margin-top:0">Todo para empezar en el fisicoculturismo, del primer entreno a la tarima.</p>
    <div class="kit-list">${items.map(([k, i, t, s]) => `<button class="kit-item" data-kit="${k}">${ico(i, 22)}<span class="grow"><b>${t}</b><small>${esc(s)}</small></span>${ico('chevron-right', 16)}</button>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">Inspirado en lo publicado sobre Arnold Schwarzenegger, Chris Bumstead y Tom Holland; sin afiliación con ellos ni con sus marcas.</p>
    <button class="ghost block" id="kit-x">Cerrar</button>`, m => {
    $$('[data-kit]', m).forEach(b => b.onclick = () => ({
      programs: () => openCompPrograms(back), cbum: () => openCbumSessions(back), show: () => openCompSetup(() => { render(currentTab); openCompete(); }),
      poses: () => openPoseGuide(back), food: () => openCompNutrition(back), check: () => openCheckinWeekly(back), mx: () => openCompeteMexico(back), caps: () => openCpCaps(back), day: () => openShowDay(back)
    })[b.dataset.kit]());
    $('#kit-x', m).onclick = closeModal;
  });
}
/** Lista de programas completos (la de 21.0, más Tom Holland). */
function openCompPrograms(back) {
  const pf = isPF(), keys = COMP_KEYS.concat(['heroe']);
  openModal(`<h3>Programas completos</h3>
    <p class="small muted" style="margin-top:0">Elige uno y empieza hoy. ${pf ? 'Ya vienen adaptados a tu Planet Fitness.' : 'Lo que no tengas se cambia por el sustituto más parecido.'}</p>
    ${keys.map(k => { const c = COMP_ROUTINES[k], r = ROUTINES[k], n = r.days.filter(d => !d.rest).length, a = routineAdaptCount(k);
      return `<button class="rg-card ${DB.profile.routine === k ? 'on' : ''}" data-cmp="${k}"><span class="rg-ico">${c ? c.ico : ROUTINE_ICO[k]}</span><span class="grow"><b>${esc(r.name)}</b><small>${n} días · ${esc(c ? c.level : ROUTINE_LEVEL[k] || '')}${a ? ` · ${a} cambios para ${pf ? 'Planet Fitness' : 'tu equipo'}` : ''}</small></span><span aria-hidden="true">›</span></button>`; }).join('')}
    ${pf ? '<button class="secondary block" id="cmp-pf" style="margin-top:10px">Revisar las máquinas de mi club</button>' : ''}
    <button class="ghost block" id="cmp-x">← Volver</button>`, m => {
    $$('[data-cmp]', m).forEach(b => b.onclick = () => previewRoutine(b.dataset.cmp));
    const pb = $('#cmp-pf', m); if (pb) pb.onclick = () => openPfSheet(() => openCompPrograms(back));
    $('#cmp-x', m).onclick = () => back();
  });
}

/* ------------------------------------------------------------------ *
 *  23.0 · Mi rutina día por día: tu entreno, CBUM, Tom Holland o Arnold
 * ------------------------------------------------------------------ */
const FAM_GROUPS = [
  { who: 'cbum', label: 'Entrena como CBUM', items: () => CBUM_SESSIONS.map(s => ({ v: 'cbs:' + s.id, n: s.t, ex: s.ex, note: s.note })) },
  { who: 'tom', label: 'Entrena como Tom Holland', items: () => uniqDays('heroe') },
  { who: 'arnold', label: 'Entrena como Arnold', items: () => uniqDays('golden6').concat(uniqDays('arnold1'), uniqDays('arnold2', 'Era dorada · ')) }
];
function uniqDays(key, prefix) {
  const seen = {}, r = ROUTINES[key];
  return r ? r.days.filter(d => !d.rest && d.ex.length).filter(d => { const n = d.name.split('·').pop().trim(); if (seen[n]) return false; seen[n] = 1; return true; })
    .map(d => ({ v: 'rd:' + key + ':' + d.id, n: (prefix || (key === 'golden6' ? 'Golden Six · ' : key === 'heroe' ? '' : '')) + d.name.split('·').pop().trim(), ex: d.ex })) : [];
}
const COACH_NAMES = { cbum: 'CBUM', tom: 'Tom Holland', arnold: 'Arnold' };
/** Opciones del selector de cada día (optgroups) y cuál está elegida. */
function famousDayOptions(cur) {
  const w = workoutById(cur), sel = w && w.fam;
  return FAM_GROUPS.map(g => `<optgroup label="${esc(g.label)}">${g.items().map(it => `<option value="fam|${it.v}" ${sel === it.v ? 'selected' : ''}>${esc(COACH_NAMES[g.who] + ' · ' + it.n)}</option>`).join('')}</optgroup>`).join('');
}
/** Pone en ese día el entreno famoso (lo crea una vez y lo reutiliza). */
function assignFamousDay(k, v) {
  let w = DB.workouts.find(x => x.fam === v);
  if (!w) {
    const g = FAM_GROUPS.find(gr => gr.items().some(it => it.v === v)), it = g.items().find(x => x.v === v);
    w = { id: uid(), name: COACH_NAMES[g.who] + ' · ' + it.n, ex: it.ex.map(e => e.slice()), coach: g.who, fam: v };
    DB.workouts.push(w);
  }
  DB.plan[k] = w.id;
  DB.profile.trainDays = DB.plan.map((x, j) => x ? j : null).filter(x => x != null); DB.profile.weeklyTarget = Math.max(1, DB.profile.trainDays.length);
  saveData();
}

/* ------------------------------------------------------------------ *
 *  23.0 · Modo coach: si entrenas como CBUM, Tom Holland o Arnold, te lo dice y te da sus tips
 * ------------------------------------------------------------------ */
const COACHES = {
  cbum: { tag: 'Entrenas como CBUM', ico: '💎',
    tips: ['Pocas series de trabajo (normalmente 2), muy cerca del fallo; la última muchas veces con drop set.', 'Calienta con 1–2 series de aproximación antes de la serie fuerte.',
      'Controla la bajada y haz una pausa en el estiramiento: así entrena con Justin King y Hany Rambod.', 'Anota tus pesos: él insiste en la sobrecarga progresiva.',
      'Cambia el ejercicio si te lastima: él elige máquinas y variantes que cuidan sus rodillas y hombros.', 'Duerme 8 h o más y toma 2 días de descanso por semana.'],
    ex: {
      'Press inclinado con mancuernas': 'Casi siempre es su primer o segundo ejercicio de pecho. Bajada de 3–4 s y pausa de 1 s abajo.',
      'Chest press (máquina)': 'Bajada lenta; en la última serie, rest-pause con 15 s de descanso.', 'Press de pecho Magnum (discos)': 'Bajada lenta; en la última serie, rest-pause con 15 s de descanso.',
      'Press inclinado (máquina)': 'Pausa larga abajo, en el estiramiento.', 'Press declinado en máquina': 'Controla la bajada y aprieta arriba.',
      'Remo en T (Magnum)': 'Codos altos y junta los omóplatos (indicación de su coach Justin King).', 'Remo con pecho apoyado (mancuernas)': 'Codos altos y junta los omóplatos (indicación de su coach Justin King).',
      'Jalón al pecho': 'Pausa abajo con el dorsal apretado; cambia de agarre entre sesiones.',
      'Pullover en máquina': 'Lo usa para calentar la espalda antes de los remos.', 'Pullover en polea (brazos rectos)': 'Lo usa para calentar la espalda antes de los remos.', 'Pullover con mancuerna (banco transversal)': 'Estira bien el dorsal en la bajada.',
      'Elevaciones laterales': 'Él las hace sentado porque de pie le molesta el hombro. Baja el peso en cada serie.', 'Elevaciones laterales sentado': 'Así las prefiere él: de pie le molesta el hombro.',
      'Extensión de cuádriceps': 'La pone primero para calentar las rodillas; pausa arriba y, a veces, a una pierna.',
      'Hack squat': 'Pies abajo en la plataforma para cargar más el cuádriceps; pausa abajo.', 'Pendulum squat': 'Pausa abajo; a veces hace repeticiones de 1¼.',
      'Belt squat': 'Lo pone primero porque cuida la espalda y las rodillas.', 'Sentadilla en Smith': 'Rango completo y control; en su pierna de 2022 hizo 2 series de 11–12 al fallo.',
      'Curl femoral tumbado': 'Bajada lenta y rango completo; al fallo, repeticiones forzadas (método de Hany Rambod).', 'Curl femoral sentado': 'Bajada lenta y rango completo.', 'Curl femoral de pie': 'Lento y completo; al fallo, repeticiones forzadas.',
      'Curl predicador': 'Drop set en la última serie.', 'Extensión de tríceps en polea': 'Con cuerda y doble drop set al final.',
      'Elevación de talones sentado': 'Siempre al final del día de pierna.', 'Pájaro posterior (reverse pec deck)': 'En súper serie con laterales sentado.' } },
  tom: { tag: 'Entrenas como Tom Holland', ico: '🕸️',
    tips: ['En el circuito pasa de un ejercicio al siguiente con solo 30 s de descanso.', 'Busca moverte como atleta: técnica limpia y explosiva, no solo cargar más.', 'No te saltes el cardio de la semana.'],
    ex: { 'Peso muerto': 'Técnica antes que peso: espalda neutra y la barra pegada a las piernas.', 'Dominadas / chin-ups': 'Si te salen más de 10 limpias, añade lastre.', 'Fondos en paralelas (con lastre)': 'Baja controlado y sube explosivo.' } },
  arnold: { tag: 'Entrenas como Arnold', ico: '🏆',
    tips: ['Haz pecho y espalda en súper serie: él los alternaba sin descanso.', 'Pirámide: sube el peso y baja las repeticiones en cada serie (10, 8, 6, 4).', 'Concéntrate en el músculo que trabajas y apriétalo en la contracción.', 'Cuando te estanques, cambia el estímulo: su "principio de choque".'],
    ex: { 'Pullover con mancuerna (banco transversal)': 'Respira hondo y estira el pecho en la bajada: era uno de sus favoritos.', 'Curl concentrado': 'Aprieta arriba 1 s, como en sus fotos clásicas.', 'Press Arnold': 'Gira las palmas mientras subes, sin arquear la espalda.' } }
};
const ROUTINE_COACH = { cbum: 'cbum', cbum24: 'cbum', heroe: 'tom', golden6: 'arnold', arnold1: 'arnold', arnold2: 'arnold' };
/** ¿Con quién entrenas en esta sesión? (rutina famosa, día famoso de tu semana o sesión suelta) */
function sessionCoach(s) {
  if (!s) return null;
  if (s.coach) return s.coach;
  if (ROUTINE_COACH[s.routine]) return ROUTINE_COACH[s.routine];
  if (s.routine === 'custom' && s.dayId) { const d = weekRoutine().days.find(x => x.id === s.dayId), w = d && workoutById(d.wid); return w && w.coach || null; }
  return null;
}
function dayCoach(nd) {
  if (!nd) return null;
  if (ROUTINE_COACH[DB.profile.routine]) return ROUTINE_COACH[DB.profile.routine];
  const w = nd.wid && workoutById(nd.wid); return w && w.coach || null;
}
function sessionNote(s) {
  const id = s.famId || (s.dayId && String(s.dayId).startsWith('cb_') ? String(s.dayId).slice(3) : null);
  if (id && cbSess(id)) return cbSess(id).note;
  const d = s.routine === 'custom' && s.dayId ? weekRoutine().days.find(x => x.id === s.dayId) : null, w = d && workoutById(d.wid);
  if (w && w.fam && w.fam.startsWith('cbs:') && cbSess(w.fam.slice(4))) return cbSess(w.fam.slice(4)).note;
  return '';
}
/** Tarjeta "Entrenas como CBUM" arriba de la sesión, con un tip que cambia cada día. */
function coachBanner(s) {
  const who = sessionCoach(s); if (!who) return '';
  const c = COACHES[who], k = (daysBetween('2026-01-01', todayStr()) % c.tips.length + c.tips.length) % c.tips.length, note = sessionNote(s);
  return `<div class="card coach-banner"><div class="cb-head"><span class="cb-ico">${c.ico}</span><b>${esc(c.tag)}</b></div>
    ${note ? `<p class="small" style="margin:6px 0 0">${esc(note)}</p>` : ''}
    <p class="small cb-tip">${ico('lightbulb', 15)}<span><b>Tip:</b> ${esc(c.tips[k])}</span></p></div>`;
}
/** Tip del ejercicio (también si en tu gimnasio se cambió por un sustituto). */
function coachTip(s, name, i) {
  const who = sessionCoach(s); if (!who) return '';
  const orig = s.base && s.base[i] ? s.base[i][0] : name, t = COACHES[who].ex[name] || COACHES[who].ex[orig];
  return t ? `<div class="cb-extip">${COACHES[who].ico} <b>Tip de ${COACH_NAMES[who]}:</b> ${esc(t)}</div>` : '';
}
