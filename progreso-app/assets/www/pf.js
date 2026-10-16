'use strict';
/* Mi Progreso 14.0 · Tu Planet Fitness.
   Catálogo de equipo de Planet Fitness México según el informe que compartió el usuario
   ("Planet Fitness México: caminadoras y catálogo completo de máquinas"). Cada máquina dice qué tan
   seguro es que exista en México: 'mx' confirmado en México, 'prob' probable (estándar de la cadena),
   'nv' no verificado en México. Las cantidades cambian por sucursal: el usuario marca lo que hay en
   la suya y, si algo no está, las rutinas usan sustitutos solas. */

const PF_CONF = { mx: 'Confirmado en México', prob: 'Estándar de la cadena', var: 'Varía por club', nv: 'No verificado' };
/* 21.0: catálogo revisado con el comunicado de PF México 2026 (half racks, Smith, prensa, extensión, pec fly,
   racks de mancuernas, bancos, hack squat y Magnum Glute Trainer en Andamar, El Molino, Center Plazas, San Marcos,
   Villa Verde, Satélite y Lindavista), el comunicado de PF de enero 2025 (Matrix Magnum: press supino, hack squat
   y pantorrilla sentado) y las listas de la cadena. Lo que "varía" o "no está verificado" solo se usa en tus rutinas
   si marcas que sí lo hay en tu club; si no, se usa su sustituto. Fuentes en docs/FUENTES-v21.md. */
const PF_NEW_CLUBS = ['Andamar', 'El Molino', 'Center Plazas', 'San Marcos', 'Villa Verde', 'Satélite', 'Lindavista'];
const PF_MACHINES = [
  // Máquinas de placas (selectorizadas)
  { id: 'chest', sec: 'fuerza', name: 'Chest press (press de pecho)', conf: 'prob', ex: ['Chest press (máquina)'] },
  { id: 'incl', sec: 'fuerza', name: 'Press inclinado (máquina)', conf: 'var', ex: ['Press inclinado (máquina)'] },
  { id: 'peck', sec: 'fuerza', name: 'Pec deck / pectoral fly', conf: 'mx', info: '2 en Plaza Satélite; también sirve para deltoide posterior', ex: ['Pec deck (aperturas en máquina)', 'Aperturas en máquina / polea', 'Pájaro posterior (reverse pec deck)'] },
  { id: 'hombro', sec: 'fuerza', name: 'Press de hombro', conf: 'prob', ex: ['Shoulder press (máquina)'] },
  { id: 'lateral', sec: 'fuerza', name: 'Elevaciones laterales (máquina)', conf: 'var', ex: ['Elevaciones laterales (máquina)'] },
  { id: 'jalon', sec: 'fuerza', name: 'Jalón al pecho', conf: 'prob', ex: ['Jalón al pecho'] },
  { id: 'remo', sec: 'fuerza', name: 'Remo sentado', conf: 'prob', ex: ['Remo sentado (máquina)'] },
  { id: 'asist', sec: 'fuerza', name: 'Dominadas y fondos asistidos', conf: 'var', ex: ['Dominadas asistidas (máquina)', 'Fondos asistidos (máquina)'] },
  { id: 'bic', sec: 'fuerza', name: 'Curl de bíceps (máquina)', conf: 'prob', ex: ['Curl de bíceps (máquina)'] },
  { id: 'predic', sec: 'fuerza', name: 'Banco predicador', conf: 'var', ex: ['Curl predicador'] },
  { id: 'tri', sec: 'fuerza', name: 'Extensión de tríceps', conf: 'prob', ex: ['Extensión de tríceps (máquina)'] },
  { id: 'prensa', sec: 'fuerza', name: 'Prensa de pierna', conf: 'mx', info: '2 en Plaza Satélite; llegan más en 2026', ex: ['Prensa de piernas (máquina)', 'Elevación de talones en prensa'] },
  { id: 'extcuad', sec: 'fuerza', name: 'Extensión de pierna', conf: 'mx', ex: ['Extensión de cuádriceps'] },
  { id: 'curlfem', sec: 'fuerza', name: 'Curl femoral sentado', conf: 'prob', ex: ['Curl femoral sentado'] },
  { id: 'curltumb', sec: 'fuerza', name: 'Curl femoral acostado', conf: 'var', ex: ['Curl femoral tumbado'] },
  { id: 'abd', sec: 'fuerza', name: 'Abductor y aductor', conf: 'prob', ex: ['Abductor (máquina)', 'Aductor (máquina)'] },
  { id: 'gluteo', sec: 'fuerza', name: 'Patada de glúteo (máquina)', conf: 'nv', ex: ['Patada de glúteo (máquina)'] },
  { id: 'lumbar', sec: 'fuerza', name: 'Extensión de espalda / hiperextensiones', conf: 'nv', ex: ['Extensión de espalda (máquina)', 'Hiperextensiones'] },
  { id: 'crunch', sec: 'fuerza', name: 'Abdominal (crunch) y rotación', conf: 'prob', ex: ['Crunch abdominal (máquina)', 'Torso rotation (máquina)'] },
  // Matrix Magnum (de discos)
  { id: 'hack', sec: 'discos', name: 'Hack squat (Magnum)', conf: 'mx', info: 'Llega en 2026 a ' + PF_NEW_CLUBS.length + ' clubes de México; estándar en EE. UU.', ex: ['Hack squat'] },
  { id: 'magbench', sec: 'discos', name: 'Press de pecho supino (Magnum)', conf: 'prob', info: 'En casi todos los clubes de EE. UU. desde 2025', ex: ['Press de pecho Magnum (discos)'] },
  { id: 'seatcalf', sec: 'discos', name: 'Pantorrilla sentado (Magnum)', conf: 'prob', ex: ['Elevación de talones sentado'] },
  { id: 'glutedrive', sec: 'discos', name: 'Magnum Glute Trainer (hip thrust)', conf: 'mx', info: 'Llega en 2026 a ' + PF_NEW_CLUBS.length + ' clubes de México', ex: ['Glute drive Magnum (discos)'] },
  { id: 'prensa45', sec: 'discos', name: 'Prensa de discos 45°', conf: 'var', ex: ['Prensa 45°'] },
  { id: 'tbar', sec: 'discos', name: 'Remo en T (Magnum)', conf: 'nv', info: 'Matrix lo lanzó en 2025; no hay fuente de que PF lo tenga', ex: ['Remo en T (Magnum)'] },
  // Peso libre
  { id: 'smith', sec: 'libre', name: 'Máquinas Smith', conf: 'mx', info: '6 en Plaza Satélite', equip: 'smith' },
  { id: 'rack', sec: 'libre', name: 'Half rack con barra olímpica', conf: 'var', info: 'Anunciado en 2026 para ' + PF_NEW_CLUBS.join(', ') + '. Márcalo solo si en tu club hay barra y discos: así la app te deja la sentadilla, el press y el peso muerto con barra.', equip: 'barra' },
  { id: 'manc', sec: 'libre', name: 'Racks de mancuernas', conf: 'mx', info: 'Normalmente de 5 a 75 lb (2 a 34 kg); algunos clubes llegan a 50–60 lb', equip: 'manc' },
  { id: 'bancos', sec: 'libre', name: 'Bancos planos y ajustables', conf: 'mx' },
  { id: 'bfija', sec: 'libre', name: 'Barras de peso fijo (rectas y EZ, ~20–60 lb)', conf: 'prob', equip: 'bfija' },
  { id: 'poleas', sec: 'libre', name: 'Torres de cable / polea doble ajustable', conf: 'prob', equip: 'polea' },
  { id: 'rig', sec: 'libre', name: 'Zona funcional PF 360 (barra para dominadas, TRX, kettlebells)', conf: 'prob', ex: ['Dominadas / chin-ups', 'Elevaciones de piernas colgado'] },
  { id: 'paralelas', sec: 'libre', name: 'Paralelas para fondos', conf: 'nv', ex: ['Fondos en paralelas (con lastre)'] },
  { id: 'circuito', sec: 'libre', name: 'Circuito Express de 30 minutos', conf: 'mx', info: '10 máquinas y estaciones de step: 60 s de trabajo y 30 s de descanso' },
  // Cardio
  { id: 'cinta', sec: 'cardio', name: 'Caminadora Matrix', conf: 'mx', info: 'Marca confirmada; modelo probable Endurance: 0.8–20 km/h, 0–15 %, usuario hasta 182 kg' },
  { id: 'eliptica', sec: 'cardio', name: 'Elíptica', conf: 'mx', act: 'eliptica' },
  { id: 'bici', sec: 'cardio', name: 'Bicicleta vertical', conf: 'mx', act: 'bici' },
  { id: 'recumb', sec: 'cardio', name: 'Bicicleta recumbente', conf: 'prob', act: 'bici' },
  { id: 'escalera', sec: 'cardio', name: 'Escalera infinita (StepMill) / escaladora', conf: 'mx', act: 'escalera' },
  { id: 'remoerg', sec: 'cardio', name: 'Remo (ergómetro)', conf: 'mx', act: 'remo' },
  { id: 'arc', sec: 'cardio', name: 'Arc / Ascent Trainer', conf: 'prob', act: 'eliptica' },
  { id: 'ube', sec: 'cardio', name: 'Ergómetro de brazos', conf: 'mx' },
  // Black Card
  { id: 'masaje', sec: 'spa', name: 'Sillones de masaje', conf: 'mx' },
  { id: 'hydro', sec: 'spa', name: 'Camas HydroMassage', conf: 'mx' },
  { id: 'tbe', sec: 'spa', name: 'Total Body Enhancement (luz roja + vibración)', conf: 'mx' },
  { id: 'cabina', sec: 'spa', name: 'Cabina de bienestar', conf: 'mx', info: 'Confirmada en Plaza Satélite' }
];
const PF_SECS = { fuerza: '💪 Máquinas de placas', discos: '🏋️ Máquinas de discos (Matrix Magnum)', libre: '🏋️ Peso libre, poleas y zona funcional', cardio: '🏃 Cardio', spa: '💆 Black Card (spa)' };

const isPF = () => DB.profile.gym === 'pf';
const pfMarks = () => DB.profile.pfMachines || {};
/** ¿Está disponible esta máquina en tu club? Lo confirmado o estándar se da por hecho salvo que digas que no;
    lo que varía o no está verificado solo cuenta si marcas que sí. */
function pfHas(m) { const v = pfMarks()[m.id]; return v === 'si' || (v !== 'no' && !['var', 'nv'].includes(m.conf)); }
/** El ejercicio necesita una máquina de PF y ninguna de las que lo permiten está en tu club. */
function pfMissing(name) {
  if (!isPF()) return false;
  const ms = PF_MACHINES.filter(m => m.ex && m.ex.includes(name));
  return ms.length > 0 && !ms.some(pfHas);
}
const pfBlack = () => isPF() && DB.profile.pfMember === 'black';

function pfSummary() {
  const mk = pfMarks(), si = Object.values(mk).filter(v => v === 'si').length, no = Object.values(mk).filter(v => v === 'no').length;
  return `${DB.profile.pfClub ? DB.profile.pfClub + ' · ' : ''}${si} confirmadas · ${no} no hay`;
}
/** Hoja "Tu Planet Fitness": sucursal, membresía y qué máquinas hay. */
function openPfSheet(after) {
  const p = DB.profile;
  const draw = m => {
    const mk = pfMarks();
    m.innerHTML = `<h3>🟣 Tu Planet Fitness</h3>
      <p class="small muted" style="margin-top:0">El equipo cambia por sucursal. Marca lo que hay en la tuya: si algo no está, tus rutinas lo cambian por el sustituto más parecido. Lo confirmado y lo estándar se usa salvo que marques No; lo que <b>varía por club</b> o <b>no está verificado</b> solo entra a tus rutinas si marcas Sí.</p>
      <label>Sucursal<input id="pf-club" value="${esc(p.pfClub || '')}" placeholder="Ej. Plaza Satélite"></label>
      <div class="rir-label"><span>Membresía</span></div>
      <div class="seg"><button data-pfm="classic" class="${p.pfMember !== 'black' ? 'on' : ''}">Classic</button><button data-pfm="black" class="${p.pfMember === 'black' ? 'on' : ''}">Black Card</button></div>
      <p class="small muted" style="margin:-6px 0 4px">El piso de cardio y fuerza es el mismo; la Black Card suma el spa (varía por club).</p>
      ${Object.keys(PF_SECS).filter(s => s !== 'spa' || p.pfMember === 'black').map(sec => `<div class="pf-sec">${PF_SECS[sec]}</div>` +
        PF_MACHINES.filter(x => x.sec === sec).map(x => `<div class="pf-item"><div class="grow"><b>${esc(x.name)}</b><small><span class="pf-conf ${x.conf}">${PF_CONF[x.conf]}</span>${x.info ? esc(x.info) : ''}</small></div>
          <div class="pf-yn" role="group" aria-label="¿Hay ${esc(x.name)} en tu club?"><button data-pf="${x.id}" data-v="si" class="${mk[x.id] === 'si' ? 'on' : ''}" aria-label="Sí hay">Sí</button><button data-pf="${x.id}" data-v="no" class="${mk[x.id] === 'no' ? 'on' : ''}" aria-label="No hay">No</button></div></div>`).join('')).join('')}
      <p class="small muted" style="margin:12px 0">Fuentes: informe "Planet Fitness México: caminadoras y catálogo completo de máquinas", comunicado de PF México 2026 sobre equipo nuevo en 7 clubes y comunicado de PF de enero 2025 (Matrix Magnum). El modelo exacto de las caminadoras no está confirmado; la marca (Matrix) sí. Para confirmarlo, revisa la placa en la base frontal.</p>
      <button class="block" id="pf-ok">Listo</button>`;
    $$('[data-pf]', m).forEach(b => b.onclick = () => {
      const id = b.dataset.pf, v = b.dataset.v, x = PF_MACHINES.find(q => q.id === id);
      p.pfMachines = Object.assign({}, pfMarks());
      if (p.pfMachines[id] === v) delete p.pfMachines[id]; else p.pfMachines[id] = v;
      if (x.equip) { const set = new Set(p.equip); if (pfHas(x)) set.add(x.equip); else set.delete(x.equip); p.equip = Array.from(set); }
      p.pfClub = $('#pf-club', m).value.trim();
      saveData(); keepModalScroll(m, () => draw(m));
    });
    $$('[data-pfm]', m).forEach(b => b.onclick = () => { p.pfMember = b.dataset.pfm; p.pfClub = $('#pf-club', m).value.trim(); saveData(); keepModalScroll(m, () => draw(m)); });
    $('#pf-ok', m).onclick = () => { p.pfClub = $('#pf-club', m).value.trim(); saveData(); closeModal(); if (after) after(); else render(currentTab); toast('🟣 Equipo de tu club guardado'); };
  };
  openModal('', draw);
}
function keepModalScroll(m, fn) { const y = m.scrollTop; fn(); m.scrollTop = y; }

/** Recuperación con Black Card: opción agradable, sin prometer lo que no está probado. */
function pfSpaTip() {
  if (!pfBlack()) return '';
  const mk = pfMarks(), has = id => mk[id] !== 'no';
  const opts = [has('hydro') && 'HydroMassage', has('masaje') && 'sillón de masaje'].filter(Boolean);
  return opts.length ? `Con tu Black Card puedes cerrar con ${opts.join(' o ')} 10–15 min: se siente bien y ayuda a relajarte, pero no sustituye el sueño ni el descanso.` : '';
}
