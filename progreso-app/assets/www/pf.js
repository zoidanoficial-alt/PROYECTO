'use strict';
/* Mi Progreso 14.0 · Tu Planet Fitness.
   Catálogo de equipo de Planet Fitness México según el informe que compartió el usuario
   ("Planet Fitness México: caminadoras y catálogo completo de máquinas"). Cada máquina dice qué tan
   seguro es que exista en México: 'mx' confirmado en México, 'prob' probable (estándar de la cadena),
   'nv' no verificado en México. Las cantidades cambian por sucursal: el usuario marca lo que hay en
   la suya y, si algo no está, las rutinas usan sustitutos solas. */

const PF_CONF = { mx: 'Confirmado en México', prob: 'Probable', nv: 'No verificado en MX' };
const PF_MACHINES = [
  // Fuerza (selectorizadas y de discos)
  { id: 'prensa', sec: 'fuerza', name: 'Prensa de pierna', conf: 'mx', info: '2 en Plaza Satélite', ex: ['Prensa de piernas (máquina)', 'Prensa 45°', 'Elevación de talones en prensa'] },
  { id: 'peck', sec: 'fuerza', name: 'Pec deck / pectoral fly', conf: 'mx', info: '2 en Plaza Satélite; también sirve para deltoide posterior', ex: ['Pec deck (aperturas en máquina)', 'Aperturas en máquina / polea', 'Pájaro posterior (reverse pec deck)'] },
  { id: 'chest', sec: 'fuerza', name: 'Chest press (press de pecho)', conf: 'prob', info: 'Matrix, según reportes de socios', ex: ['Chest press (máquina)'] },
  { id: 'jalon', sec: 'fuerza', name: 'Jalón al pecho', conf: 'prob', ex: ['Jalón al pecho'] },
  { id: 'remo', sec: 'fuerza', name: 'Remo sentado', conf: 'prob', ex: ['Remo sentado (máquina)'] },
  { id: 'hombro', sec: 'fuerza', name: 'Press de hombro', conf: 'prob', ex: ['Shoulder press (máquina)'] },
  { id: 'extcuad', sec: 'fuerza', name: 'Extensión de pierna', conf: 'prob', ex: ['Extensión de cuádriceps'] },
  { id: 'curlfem', sec: 'fuerza', name: 'Curl femoral', conf: 'prob', ex: ['Curl femoral sentado', 'Curl femoral tumbado'] },
  { id: 'abd', sec: 'fuerza', name: 'Abductor y aductor', conf: 'prob', ex: ['Abductor (máquina)', 'Aductor (máquina)'] },
  { id: 'tri', sec: 'fuerza', name: 'Extensión de tríceps', conf: 'prob', ex: ['Extensión de tríceps (máquina)'] },
  { id: 'bic', sec: 'fuerza', name: 'Curl de bíceps', conf: 'prob', ex: ['Curl de bíceps (máquina)', 'Curl predicador'] },
  { id: 'crunch', sec: 'fuerza', name: 'Abdominal (crunch) y rotación', conf: 'prob', ex: ['Crunch abdominal (máquina)', 'Torso rotation (máquina)'] },
  { id: 'asist', sec: 'fuerza', name: 'Dominadas y fondos asistidos', conf: 'nv', ex: ['Dominadas asistidas (máquina)', 'Fondos asistidos (máquina)'] },
  { id: 'gluteo', sec: 'fuerza', name: 'Patada de glúteo (máquina)', conf: 'nv', ex: ['Patada de glúteo (máquina)'] },
  { id: 'lumbar', sec: 'fuerza', name: 'Extensión de espalda / hiperextensiones', conf: 'nv', ex: ['Extensión de espalda (máquina)', 'Hiperextensiones'] },
  { id: 'magnum', sec: 'fuerza', name: 'Matrix Magnum de discos: hack squat y pantorrilla sentado', conf: 'nv', info: 'Llegó a más de 1,700 clubes de EE. UU. en 2025', ex: ['Hack squat', 'Elevación de talones sentado'] },
  { id: 'smith', sec: 'libre', name: 'Máquinas Smith', conf: 'mx', info: '6 en Plaza Satélite', equip: 'smith' },
  { id: 'poleas', sec: 'libre', name: 'Torres de cable / polea doble ajustable', conf: 'prob', equip: 'polea' },
  { id: 'manc', sec: 'libre', name: 'Racks de mancuernas', conf: 'mx', info: 'Ampliados en Plaza Satélite', equip: 'manc' },
  { id: 'trx', sec: 'libre', name: 'TRX y zona funcional (kettlebells, bandas, balones)', conf: 'prob' },
  { id: 'circuito', sec: 'libre', name: 'Circuito Express de 30 minutos', conf: 'mx', info: 'Máquinas de fuerza y estaciones de step en intervalos' },
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
const PF_SECS = { fuerza: '💪 Máquinas de fuerza', libre: '🏋️ Peso libre, poleas y circuito', cardio: '🏃 Cardio', spa: '💆 Black Card (spa)' };

const isPF = () => DB.profile.gym === 'pf';
const pfMarks = () => DB.profile.pfMachines || {};
/** ¿Marcaste que esta máquina no está en tu club? (solo si entrenas en Planet Fitness) */
function pfMissing(name) {
  if (!isPF()) return false;
  const mk = pfMarks();
  return PF_MACHINES.some(m => m.ex && mk[m.id] === 'no' && m.ex.includes(name));
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
      <p class="small muted" style="margin-top:0">El equipo cambia por sucursal. Marca lo que hay en la tuya: si algo no está, tus rutinas lo cambian por un ejercicio parecido. Cada máquina dice qué tan seguro es que exista en México.</p>
      <label>Sucursal<input id="pf-club" value="${esc(p.pfClub || '')}" placeholder="Ej. Plaza Satélite"></label>
      <div class="rir-label"><span>Membresía</span></div>
      <div class="seg"><button data-pfm="classic" class="${p.pfMember !== 'black' ? 'on' : ''}">Classic</button><button data-pfm="black" class="${p.pfMember === 'black' ? 'on' : ''}">Black Card</button></div>
      <p class="small muted" style="margin:-6px 0 4px">El piso de cardio y fuerza es el mismo; la Black Card suma el spa (varía por club).</p>
      ${Object.keys(PF_SECS).filter(s => s !== 'spa' || p.pfMember === 'black').map(sec => `<div class="pf-sec">${PF_SECS[sec]}</div>` +
        PF_MACHINES.filter(x => x.sec === sec).map(x => `<div class="pf-item"><div class="grow"><b>${esc(x.name)}</b><small><span class="pf-conf ${x.conf}">${PF_CONF[x.conf]}</span>${x.info ? esc(x.info) : ''}</small></div>
          <div class="pf-yn" role="group" aria-label="¿Hay ${esc(x.name)} en tu club?"><button data-pf="${x.id}" data-v="si" class="${mk[x.id] === 'si' ? 'on' : ''}" aria-label="Sí hay">Sí</button><button data-pf="${x.id}" data-v="no" class="${mk[x.id] === 'no' ? 'on' : ''}" aria-label="No hay">No</button></div></div>`).join('')).join('')}
      <p class="small muted" style="margin:12px 0">Fuente: informe "Planet Fitness México: caminadoras y catálogo completo de máquinas". El modelo exacto de las caminadoras no está confirmado; la marca (Matrix) sí. Para confirmarlo, revisa la placa en la base frontal.</p>
      <button class="block" id="pf-ok">Listo</button>`;
    $$('[data-pf]', m).forEach(b => b.onclick = () => {
      const id = b.dataset.pf, v = b.dataset.v, x = PF_MACHINES.find(q => q.id === id);
      p.pfMachines = Object.assign({}, pfMarks());
      if (p.pfMachines[id] === v) delete p.pfMachines[id]; else p.pfMachines[id] = v;
      if (x.equip) { const set = new Set(p.equip); if (p.pfMachines[id] === 'no') set.delete(x.equip); else set.add(x.equip); p.equip = Array.from(set); }
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
