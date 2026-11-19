'use strict';
/* =====================================================================
 *  27.0 · Eventos: motor de inteligencia de competiciones (lado de la app)
 *  El catálogo lo construye el pipeline de progreso-app/events (descubrimiento, verificación,
 *  deduplicación y agenda de revisión). La app trae una copia offline (data/events.json) y,
 *  si el usuario lo pide, descarga la versión publicada. Solo se descarga el catálogo público:
 *  no se envía ningún dato del usuario. Nada de lo que se muestra se infiere: sin dato, no se muestra.
 * ===================================================================== */

const EV_REMOTE = 'https://raw.githubusercontent.com/zoidanoficial-alt/PROYECTO/claude/wizardly-carson-nqao7c/progreso-app/assets/www/data/events.json';
// Registro extensible: un deporte nuevo = una entrada aquí y en events/lib/disciplines.mjs.
const EV_SPORTS = {
  hyrox: { n: 'HYROX', ico: 'timer', prep: 16, min: 8, rec: 14, taper: 1, sim: 3, syn: ['hyrox', 'hirox'] },
  running: { n: 'Running', ico: 'footprints', prep: 16, min: 8, rec: 21, taper: 2, sim: 0, syn: ['maraton', 'marathon', 'medio maraton', 'half marathon', 'carrera', 'carreras', 'running', 'correr', 'trail', 'ultra', '5k', '10k', '15k', '21k', '42k', 'cross country'] },
  triathlon: { n: 'Triatlón', ico: 'bike', prep: 20, min: 12, rec: 21, taper: 2, sim: 2, syn: ['triatlon', 'triathlon', 'ironman', '70.3', 'duatlon', 'duathlon', 'acuatlon', 'aquathlon'] },
  bodybuilding: { n: 'Fisicoculturismo', ico: 'trophy', prep: 16, min: 12, rec: 14, taper: 1, sim: 0, syn: ['bodybuilding', 'fisicoculturismo', 'culturismo', 'wellness', 'bikini', 'physique', 'figure', 'classic physique', 'mens physique', 'npc', 'ifbb', 'wnbf', 'natural'] },
  strength: { n: 'Fuerza', ico: 'dumbbell', prep: 12, min: 8, rec: 10, taper: 1, sim: 0, syn: ['powerlifting', 'weightlifting', 'halterofilia', 'strongman', 'strongwoman', 'fuerza', 'calistenia', 'calisthenics'] },
  fitness_race: { n: 'Fitness competitivo', ico: 'zap', prep: 10, min: 6, rec: 10, taper: 1, sim: 2, syn: ['spartan', 'deka', 'ocr', 'obstaculos', 'obstacle', 'crossfit', 'ninja', 'functional fitness', 'hybrid'] },
  other: { n: 'Otro', ico: 'calendar', prep: 12, min: 6, rec: 10, taper: 1, sim: 0, syn: [] }
};
const EV_VER = { officially_confirmed: ['Oficial', 'ok', 'Fecha leída de la página oficial del organizador.'], verified: ['Verificado', 'ok', 'Visto en la página oficial y respaldado por otra fuente.'], partially_verified: ['Parcialmente verificado', 'warn', 'Fuentes secundarias coinciden; falta leer la página oficial.'], unconfirmed: ['Sin confirmar', 'bad', 'Una sola fuente secundaria. Puede cambiar o no ocurrir.'] };
const EV_REG = { open: 'Inscripción abierta', closed: 'Inscripción cerrada', sold_out: 'Agotado', not_open: 'Inscripción aún no abre', upcoming: 'Inscripción próxima', qualification: 'Solo por clasificación' };
const EV_STATUS = { scheduled: 'Programado', postponed: 'Pospuesto', cancelled: 'Cancelado', completed: 'Finalizado' };
const EV_DATE = { official: 'Fecha publicada', estimated: 'Fecha estimada', historical: 'Fecha histórica (edición pasada)' };
const EV_COUNTRIES = { mx: ['mexico', 'méxico'], us: ['usa', 'estados unidos', 'eeuu', 'united states', 'eua'], es: ['espana', 'españa', 'spain'], hk: ['hong kong'], gb: ['reino unido', 'uk', 'inglaterra', 'united kingdom'], de: ['alemania', 'germany'], ca: ['canada', 'canadá'] };
const EV_COUNTRY_N = { mx: 'México', us: 'Estados Unidos', es: 'España', hk: 'Hong Kong', gb: 'Reino Unido', de: 'Alemania', ca: 'Canadá' };
const EV_MONTHS = [['enero', 'january', 'jan', 'ene'], ['febrero', 'february', 'feb'], ['marzo', 'march', 'mar'], ['abril', 'april', 'apr', 'abr'], ['mayo', 'may'], ['junio', 'june', 'jun'], ['julio', 'july', 'jul'], ['agosto', 'august', 'aug', 'ago'], ['septiembre', 'september', 'sep', 'sept'], ['octubre', 'october', 'oct'], ['noviembre', 'november', 'nov'], ['diciembre', 'december', 'dec', 'dic']];
const EV_MONTH_N = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let EV_BUNDLED = null, evView = 'list', evQuery = '', evChips = new Set(['foryou']), evMonth = null, evMapView = null, evCalMode = 'month';
const evNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Estado y catálogo ---------- */
function evState() {
  if (!DB.ev) DB.ev = { cat: null, fetchedAt: null, saved: [], follow: { sports: [], cities: [], orgs: [] }, goal: null, results: [], snap: {}, inbox: [], loc: null, prefs: { alerts: true, radiusKm: 600 } };
  return DB.ev;
}
async function evLoadBundled() {
  if (EV_BUNDLED) return EV_BUNDLED;
  try { const r = await fetch('data/events.json'); if (r.ok) EV_BUNDLED = await r.json(); } catch (e) {}
  return EV_BUNDLED;
}
function evCatalog() {
  const s = evState(), b = EV_BUNDLED, c = s.cat;
  if (c && (!b || c.generatedAt > b.generatedAt)) return c;
  return b || c || { events: [], changes: [], review: [], generatedAt: null };
}
const evAll = () => evCatalog().events || [];
const evById = id => evAll().find(e => e.id === id) || null;
/** Descarga el catálogo publicado (GET público, sin datos del usuario). */
async function evSync(manual) {
  const s = evState();
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(EV_REMOTE + '?t=' + Date.now(), { signal: ctl.signal, cache: 'no-store', credentials: 'omit' });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const cat = await r.json();
    if (!cat || !Array.isArray(cat.events)) throw new Error('formato');
    const newer = !evCatalog().generatedAt || cat.generatedAt > evCatalog().generatedAt;
    if (newer) s.cat = cat;
    s.fetchedAt = Date.now();
    const n = evDetectChanges();
    saveData();
    if (manual) toast(newer ? `Catálogo actualizado${n ? ` · ${n} novedad${n > 1 ? 'es' : ''} en tus eventos` : ''}` : 'Ya tienes la versión más reciente');
    return true;
  } catch (e) {
    if (manual) toast('Sin conexión al catálogo. Sigues viendo la copia guardada.');
    return false;
  }
}
/** Novedades en eventos guardados o seguidos: fecha, inscripción, estado y eventos nuevos. */
function evDetectChanges() {
  const s = evState(), inbox = s.inbox, snap = s.snap, at = todayStr();
  let n = 0;
  const push = (id, text) => { if (!inbox.some(x => x.id === id && x.text === text)) { inbox.unshift({ id, text, at, read: false }); n++; } };
  evAll().forEach(e => {
    const p = snap[e.id], mine = s.saved.includes(e.id);
    if (mine && p) {
      if (p.startDate !== e.startDate) {
        push(e.id, `Cambió la fecha de ${e.eventName}: ${longDate(p.startDate)} → ${longDate(e.startDate)}.${s.goal === e.id ? ' Tu plan ya se ajustó.' : ''}`);
        if (s.goal === e.id) evSetGoal(e);
      }
      if (p.registrationStatus !== e.registrationStatus && e.registrationStatus) push(e.id, `${e.eventName}: ${EV_REG[e.registrationStatus] || e.registrationStatus}.`);
      if (p.eventStatus !== e.eventStatus && ['cancelled', 'postponed'].includes(e.eventStatus)) push(e.id, `${e.eventName} fue ${EV_STATUS[e.eventStatus].toLowerCase()}.`);
      if (!p.regulationsUrl && e.regulationsUrl) push(e.id, `${e.eventName}: el organizador publicó el reglamento.`);
    }
    if (!p && Object.keys(snap).length && evFollowed(e) && e.eventStatus !== 'completed') push(e.id, `Nuevo evento que sigues: ${e.eventName} · ${e.city} · ${shortDate(e.startDate)}.`);
    snap[e.id] = { startDate: e.startDate, registrationStatus: e.registrationStatus || null, eventStatus: e.eventStatus, regulationsUrl: e.regulationsUrl || null };
  });
  s.inbox = inbox.slice(0, 50);
  return n;
}
function evFollowed(e) { const f = evState().follow; return f.sports.includes(e.sport) || f.cities.includes(evNorm(e.city)) || (e.organizer && f.orgs.includes(evNorm(e.organizer))); }

/* ---------- Perfil del atleta ---------- */
function evInterests() {
  const s = evState(), set = new Set(s.follow.sports);
  if (typeof hxOn === 'function' && hxOn()) set.add('hyrox');
  if (DB.profile.trainMode === 'running' || DB.runPlan) set.add('running');
  if (DB.profile.comp) set.add('bodybuilding');
  s.saved.forEach(id => { const e = evById(id); if (e) set.add(e.sport); });
  return set;
}
function evKm(e) {
  const l = evState().loc; if (!l || e.latitude == null) return null;
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(e.latitude - l.lat), dLo = r(e.longitude - l.lon);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(r(l.lat)) * Math.cos(r(e.latitude)) * Math.sin(dLo / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}
function evLocate(after) {
  if (!navigator.geolocation) { toast('Tu teléfono no da la ubicación'); return; }
  navigator.geolocation.getCurrentPosition(p => {
    // Solo se guarda redondeada (~1 km) y en el teléfono.
    evState().loc = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, at: todayStr() }; saveData(); after && after();
  }, () => toast('No se pudo obtener tu ubicación'), { timeout: 10000, maximumAge: 6 * 3600e3 });
}
/** Recomendación: solo disciplinas que te interesan; por qué se recomienda va en el texto. */
function evRecommend(limit) {
  const int = evInterests(), t = todayStr(), out = [];
  if (!int.size) return [];
  evAll().forEach(e => {
    if (e.eventStatus === 'completed' || e.eventStatus === 'cancelled' || e.startDate < t) return;
    let sc = 0, why = [];
    const days = daysBetween(t, e.startDate), km = evKm(e);
    if (int.has(e.sport)) { sc += 50; why.push('es tu disciplina'); }
    else if (int.has('hyrox') && e.sport === 'running') { sc += 20; why.push('carrera útil como prueba para HYROX'); }
    else if (int.has('triathlon') && e.sport === 'running') { sc += 15; why.push('sirve de preparación'); }
    else return;
    const sp = EV_SPORTS[e.sport] || EV_SPORTS.other;
    if (days >= sp.min * 7 && days <= 40 * 7) { sc += 20; why.push(`te da ${Math.floor(days / 7)} semanas para prepararte`); }
    else if (days < sp.min * 7) { sc -= 10; why.push('poco tiempo de preparación'); }
    if (km != null) { if (km <= 300) { sc += 20; why.push(`a ${km} km`); } else if (km <= evState().prefs.radiusKm) sc += 8; }
    sc += { officially_confirmed: 10, verified: 8, partially_verified: 3, unconfirmed: -8 }[e.verificationStatus] || 0;
    out.push({ e, sc, why });
  });
  return out.sort((a, b) => b.sc - a.sc).slice(0, limit || 3);
}

/* ---------- Búsqueda en lenguaje natural (español e inglés) ---------- */
function evParse(q) {
  let s = ' ' + evNorm(q).replace(/[^a-z0-9.\s]/g, ' ') + ' ';
  const f = { text: [], why: [] }, take = re => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
  if (take(/\b(cerca de mi|cerca|near me|nearby)\b/)) { f.near = true; f.why.push('cerca de ti'); }
  if (take(/\b(inscripcion(es)? abierta(s)?|registration open|open registration)\b/)) { f.reg = 'open'; f.why.push('inscripción abierta'); }
  if (take(/\b(campeonato(s)?|championship(s)?|mundial|world championship(s)?)\b/)) { f.champ = true; f.why.push('campeonatos'); }
  if (take(/\b(clasificatorio(s)?|qualifier(s)?|qualifying)\b/)) { f.qual = true; f.why.push('clasificatorios'); }
  if (take(/\b(internacional(es)?|international)\b/)) { f.intl = true; f.why.push('internacional'); }
  if (take(/\b(este fin de semana|this weekend|fin de semana)\b/)) {
    const d = parseDate(todayStr()), dow = (d.getDay() + 6) % 7, sat = addDays(todayStr(), 5 - dow);
    f.from = dow >= 5 ? todayStr() : sat; f.to = addDays(todayStr(), 6 - dow); f.why.push('este fin de semana');
  }
  if (take(/\b(este mes|this month)\b/)) { f.from = todayStr(); f.to = todayStr().slice(0, 8) + '31'; f.why.push('este mes'); }
  if (take(/\b(proximo mes|next month)\b/)) { const n = addDays(todayStr().slice(0, 8) + '28', 7).slice(0, 7); f.from = n + '-01'; f.to = n + '-31'; f.why.push('el próximo mes'); }
  const y = take(/\b(20\d\d)\b/); if (y) { f.year = y[1]; f.why.push(y[1]); }
  EV_MONTHS.forEach((names, i) => { if (f.month == null && names.some(n => new RegExp('\\b' + n + '\\b').test(s))) { names.forEach(n => { s = s.replace(new RegExp('\\b' + n + '\\b'), ' '); }); f.month = i; f.why.push(EV_MONTH_N[i]); } });
  for (const [k, sp] of Object.entries(EV_SPORTS)) {
    const re = w => new RegExp('\\b' + w.replace('.', '\\.') + '(es|s)?\\b');
    const hit = sp.syn.slice().sort((a, b) => b.length - a.length).find(w => re(w).test(s));
    if (hit) {
      f.sport = k; f.why.push(sp.n);
      const dist = { 'medio maraton': '21K', 'half marathon': '21K', '21k': '21K', maraton: '42K', marathon: '42K', '42k': '42K' }[hit];
      if (dist) { f.dist = dist; f.why.push(dist); s = s.replace(re(hit), ' '); break; }
      if (['5k', '10k', '15k', '70.3', 'wellness', 'bikini', 'physique', 'figure', 'classic physique', 'natural', 'spartan', 'deka', 'crossfit', 'powerlifting', 'strongman', 'trail', 'ultra', 'ironman'].includes(hit)) f.text.push(hit); s = s.replace(re(hit), ' '); break;
    }
  }
  for (const [cc, names] of Object.entries(EV_COUNTRIES)) { const n = names.find(w => s.includes(' ' + evNorm(w) + ' ')); if (n) { f.country = cc.toUpperCase(); s = s.replace(evNorm(n), ' '); f.why.push(EV_COUNTRY_N[cc] || cc.toUpperCase()); break; } }
  const cities = [...new Set(evAll().map(e => e.city).filter(Boolean))];
  const aliases = { 'ciudad de mexico': ['cdmx', 'mexico city', 'df'], monterrey: ['mty'], guadalajara: ['gdl'] };
  for (const c of cities) { const cn = evNorm(c), al = [cn].concat(aliases[cn] || []); const hit = al.find(a => s.includes(' ' + a + ' ')); if (hit) { f.city = cn; s = s.replace(hit, ' '); f.why.push(c); break; } }
  const STOP = new Set(['en', 'de', 'del', 'la', 'el', 'los', 'las', 'in', 'on', 'of', 'the', 'y', 'and', 'para', 'for', 'competencias', 'competencia', 'competiciones', 'competitions', 'competition', 'eventos', 'evento', 'events', 'event', 'carreras', 'races', 'race', 'a', 'que', 'hay', 'quiero', 'buscar']);
  s.split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 1).forEach(w => f.text.push(w));
  return f;
}
function evMatch(e, f) {
  const t = todayStr(), hay = evNorm([e.eventName, e.organizer, e.discipline, e.city, e.country, e.venue, (e.categories || []).join(' '), (e.divisions || []).join(' '), (e.aliases || []).join(' ')].join(' '));
  if (f.sport && e.sport !== f.sport) return false;
  if (f.dist && e.discipline !== f.dist) return false;
  if (f.country && e.countryCode !== f.country) return false;
  if (f.intl && e.countryCode === (evState().home || 'MX')) return false;
  if (f.city && evNorm(e.city) !== f.city) return false;
  if (f.year && !e.startDate.startsWith(f.year)) return false;
  if (f.month != null && parseDate(e.startDate).getMonth() !== f.month) return false;
  if (f.from && (e.endDate || e.startDate) < f.from) return false;
  if (f.to && e.startDate > f.to) return false;
  if (f.reg && e.registrationStatus !== f.reg) return false;
  if (f.champ && !e.championshipLevel || f.champ && e.championshipLevel === 'season') return false;
  if (f.qual && !e.qualifyingEvent) return false;
  if (f.near) { const km = evKm(e); if (km == null || km > evState().prefs.radiusKm) return false; }
  if (f.text.length && !f.text.every(w => hay.includes(w))) return false;
  if (!f.past && (e.eventStatus === 'completed' || (e.endDate || e.startDate) < t)) return false;
  return true;
}
function evFiltered() {
  const f = evQuery ? evParse(evQuery) : { text: [], why: [] }, int = evInterests();
  if (evChips.has('near')) f.near = true;
  if (evChips.has('open')) f.reg = 'open';
  if (evChips.has('champ')) f.champ = true;
  if (evChips.has('qual')) f.qual = true;
  if (evChips.has('past')) f.past = true;
  [...evChips].filter(c => c.startsWith('s:')).forEach(c => { f.sport = c.slice(2); });
  let list = evAll().filter(e => evMatch(e, f));
  if (evChips.has('foryou') && !evQuery && int.size && ![...evChips].some(c => c.startsWith('s:'))) list = list.filter(e => int.has(e.sport) || (int.has('hyrox') && e.sport === 'running'));
  if (f.past) list = list.filter(e => e.eventStatus === 'completed' || (e.endDate || e.startDate) < todayStr());
  return { list: list.sort((a, b) => f.past ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)), f };
}

/* ---------- Componentes ---------- */
const evSport = e => (EV_SPORTS[e.sport] || EV_SPORTS.other);
function evDateRange(e) {
  const a = parseDate(e.startDate), b = e.endDate && e.endDate !== e.startDate ? parseDate(e.endDate) : null;
  if (!b) return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}
function evBadge(e) { const v = EV_VER[e.verificationStatus] || EV_VER.unconfirmed; return `<span class="ev-ver ${v[1]}" title="${esc(v[2])}"><i></i>${v[0]}</span>`; }
function evCard(e) {
  const km = evKm(e), days = daysBetween(todayStr(), e.startDate), saved = evState().saved.includes(e.id), goal = evState().goal === e.id;
  const reg = e.registrationStatus ? EV_REG[e.registrationStatus] : null, d = parseDate(e.startDate);
  return `<button class="ev-card${goal ? ' goal' : ''}" data-ev="${esc(e.id)}">
    <span class="ev-date"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small></span>
    <span class="ev-body"><small class="ev-sport">${esc(evSport(e).n)}${e.discipline ? ' · ' + esc(e.discipline) : ''}${goal ? ' · TU OBJETIVO' : saved ? ' · GUARDADO' : ''}</small>
      <b>${esc(e.eventName)}</b>
      <small>${esc(e.city)}${e.countryCode && e.countryCode !== 'MX' ? ' · ' + esc(e.country) : ''}${km != null ? ` · ${km.toLocaleString('es-MX')} km` : ''}${days >= 0 && e.eventStatus !== 'completed' ? ` · en ${days} días` : ''}</small>
      <span class="ev-meta">${evBadge(e)}${e.eventStatus === 'completed' ? '<span class="ev-reg">Finalizado</span>' : reg ? `<span class="ev-reg ${e.registrationStatus}">${reg}</span>` : ''}</span></span>
    ${ico('chevron-right', 16)}</button>`;
}

/* ---------- Pantalla principal de Eventos ---------- */
async function openEvents() {
  await evLoadBundled();
  const s = evState();
  if (!s.fetchedAt || Date.now() - s.fetchedAt > 864e5) evSync(false).then(ok => { if (ok && $('#ev-root')) evRender(); });
  if (!Object.keys(s.snap).length) { evDetectChanges(); saveData(); }
  openModal(`<div id="ev-root"></div>`, m => { evRender(); });
}
function evRender() {
  const root = $('#ev-root'); if (!root) return;
  const s = evState(), { list, f } = evFiltered(), rec = !evQuery && evChips.has('foryou') ? evRecommend(3) : [], cat = evCatalog();
  const unread = s.inbox.filter(x => !x.read).length, goal = s.goal && evById(s.goal);
  const chips = [['foryou', 'Para ti'], ['near', 'Cerca de mí'], ['open', 'Inscripción abierta'], ['champ', 'Campeonatos'], ['qual', 'Clasificatorios'], ...Object.entries(EV_SPORTS).filter(([k]) => k !== 'other').map(([k, v]) => ['s:' + k, v.n]), ['past', 'Finalizados']];
  root.innerHTML = `<div class="hx-eyebrow">HYROX LAB · EVENTS</div>
    <div class="row spread" style="align-items:flex-end"><h3 style="margin:4px 0 10px">Competiciones</h3><div class="row" style="gap:6px">
      <button class="icon-btn ev-ib" id="ev-inbox" aria-label="Novedades">${ico('bell', 18)}${unread ? `<span class="ev-dot">${unread}</span>` : ''}</button>
      <button class="icon-btn ev-ib" id="ev-sync" aria-label="Actualizar catálogo">${ico('refresh-cw', 18)}</button></div></div>
    ${goal ? `<button class="ev-goal" data-ev="${esc(goal.id)}"><small>TU COMPETICIÓN OBJETIVO</small><b>${esc(goal.eventName)}</b><span class="t-metric">${Math.max(0, daysBetween(todayStr(), goal.startDate))}</span><em>días</em></button>` : ''}
    <div class="ev-search">${ico('target', 18)}<input id="ev-q" placeholder="“HYROX cerca de mí”, “maratones en México en enero”…" value="${esc(evQuery)}" autocomplete="off"></div>
    ${evQuery && f.why.length ? `<p class="small muted ev-why">Entendí: <b>${esc(f.why.join(' · '))}</b>${f.text.length ? ` · texto: “${esc(f.text.join(' '))}”` : ''}</p>` : ''}
    <div class="ev-chips">${chips.map(([k, n]) => `<button class="chip${evChips.has(k) ? ' on' : ''}" data-chip="${k}">${n}</button>`).join('')}</div>
    <div class="seg ev-views">${[['list', 'Lista'], ['cal', 'Calendario'], ['map', 'Mapa'], ['plan', 'Mi temporada']].map(([k, n]) => `<button data-evv="${k}" class="${evView === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div id="ev-body"></div>
    <p class="small muted" style="margin-top:14px">Catálogo del ${cat.generatedAt ? longDate(cat.generatedAt.slice(0, 10)) : '—'} · ${evAll().length} eventos · ${s.fetchedAt ? 'actualizado ' + new Date(s.fetchedAt).toLocaleDateString('es-MX') : 'copia incluida en la app'}. Cada evento muestra su fuente y su nivel de verificación. Sin afiliación con los organizadores.</p>
    <div class="row" style="gap:8px"><button class="ghost" id="ev-qa">Control de calidad</button><span class="grow"></span><button class="ghost" id="ev-x">Cerrar</button></div>`;
  const body = $('#ev-body', root);
  if (evView === 'list') body.innerHTML = evListHtml(list, rec);
  else if (evView === 'cal') body.innerHTML = evCalendarHtml(list);
  else if (evView === 'map') body.innerHTML = evMapHtml(list);
  else body.innerHTML = evSeasonHtml();
  const q = $('#ev-q', root);
  q.onkeydown = e => { if (e.key === 'Enter') { evQuery = q.value.trim(); if (evQuery) evChips.delete('foryou'); evRender(); } };
  q.onchange = () => { evQuery = q.value.trim(); if (evQuery) evChips.delete('foryou'); evRender(); };
  $$('[data-chip]', root).forEach(b => b.onclick = () => {
    const k = b.dataset.chip;
    if (k === 'near' && !s.loc) { evLocate(() => { evChips.add('near'); evRender(); }); return; }
    if (k.startsWith('s:')) [...evChips].filter(c => c.startsWith('s:') && c !== k).forEach(c => evChips.delete(c));
    evChips.has(k) ? evChips.delete(k) : evChips.add(k); evRender();
  });
  $$('[data-evv]', root).forEach(b => b.onclick = () => { evView = b.dataset.evv; evRender(); });
  $$('[data-ev]', root).forEach(b => b.onclick = () => openEvent(b.dataset.ev));
  $('#ev-sync', root).onclick = () => evSync(true).then(() => evRender());
  $('#ev-inbox', root).onclick = openEvInbox;
  $('#ev-qa', root).onclick = openEvQA;
  $('#ev-x', root).onclick = () => { closeModal(); if (typeof render === 'function') render(currentTab); };
  if (evView === 'map') evBindMap(root, list);
  if (evView === 'cal') evBindCal(root);
  if (evView === 'plan') evBindSeason(root);
}
function evListHtml(list, rec) {
  if (!evAll().length) return '<div class="status info"><b>Sin catálogo</b>Toca actualizar para descargar las competiciones.</div>';
  const recIds = new Set(rec.map(r => r.e.id));
  const groups = {};
  list.filter(e => !recIds.has(e.id)).forEach(e => { const k = e.startDate.slice(0, 7); (groups[k] = groups[k] || []).push(e); });
  return `${rec.length ? `<div class="rir-label"><span>Recomendados para ti</span></div>${rec.map(r => `${evCard(r.e)}<p class="ev-rwhy">${esc(r.why.join(' · '))}</p>`).join('')}` : ''}
    ${Object.keys(groups).length ? Object.entries(groups).map(([k, es]) => `<div class="ev-month">${EV_MONTH_N[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}</div>${es.map(evCard).join('')}`).join('')
      : rec.length ? '' : `<div class="status info"><b>Sin resultados</b>No encontré competiciones con esos filtros en el catálogo. No invento eventos: si sabes de uno, mándalo como sugerencia con su página oficial.</div>`}`;
}

/* ---------- Calendario de eventos ---------- */
function evCalendarHtml(list) {
  const m = evMonth || todayStr().slice(0, 7), first = parseDate(m + '-01'), lead = (first.getDay() + 6) % 7;
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), byDay = {};
  list.forEach(e => { let d = e.startDate; const end = e.endDate || e.startDate; for (let i = 0; i < 7 && d <= end; i++, d = addDays(d, 1)) if (d.startsWith(m)) (byDay[d] = byDay[d] || []).push(e); });
  const cells = Array(lead).fill('<span></span>').concat(Array.from({ length: dim }, (_, i) => { const d = m + '-' + String(i + 1).padStart(2, '0'), es = byDay[d] || []; return `<button class="ev-cd${es.length ? ' has' : ''}${d === todayStr() ? ' today' : ''}" ${es.length ? `data-evd="${d}"` : 'disabled'}>${i + 1}${es.length ? `<i>${es.length}</i>` : ''}</button>`; }));
  const inMonth = list.filter(e => e.startDate.startsWith(m) || (e.endDate || '').startsWith(m));
  return `<div class="ev-calh"><button class="icon-btn" id="ev-pm">‹</button><b>${EV_MONTH_N[first.getMonth()]} ${first.getFullYear()}</b><button class="icon-btn" id="ev-nm">›</button></div>
    <div class="ev-cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<small>${x}</small>`).join('')}${cells.join('')}</div>
    ${inMonth.length ? inMonth.map(evCard).join('') : '<p class="small muted">Sin competiciones este mes con tus filtros.</p>'}`;
}
function evBindCal(root) {
  const step = n => { const d = parseDate((evMonth || todayStr().slice(0, 7)) + '-01'); d.setMonth(d.getMonth() + n); evMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); evRender(); };
  $('#ev-pm', root).onclick = () => step(-1); $('#ev-nm', root).onclick = () => step(1);
  $$('[data-evd]', root).forEach(b => b.onclick = () => { const c = $$('.ev-card', root).find(x => evById(x.dataset.ev) && evById(x.dataset.ev).startDate <= b.dataset.evd); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
}

/* ---------- Mapa global (offline, con agrupación) ---------- */
const EV_REGIONS = { world: [0, 40, 1000, 400, 'Mundo'], na: [80, 80, 260, 150, 'N. América'], mx: [150, 135, 115, 65, 'México'], eu: [470, 70, 120, 80, 'Europa'], as: [700, 80, 230, 160, 'Asia'] };
const evXY = e => [(e.longitude + 180) / 360 * 1000, (90 - e.latitude) / 180 * 500];
function evMapHtml(list) {
  const geo = list.filter(e => e.latitude != null);
  if (!evMapView) { const mx = geo.filter(e => e.countryCode === 'MX').length; evMapView = mx && mx >= geo.length / 2 ? 'mx' : 'world'; }
  const [x, y, w, h] = EV_REGIONS[evMapView], cell = w / 14, clusters = [];
  geo.forEach(e => { const [px, py] = evXY(e); const c = clusters.find(c => Math.abs(c.x - px) < cell && Math.abs(c.y - py) < cell); if (c) { c.es.push(e); c.x = (c.x * (c.es.length - 1) + px) / c.es.length; c.y = (c.y * (c.es.length - 1) + py) / c.es.length; } else clusters.push({ x: px, y: py, es: [e] }); });
  const r = w / 75, l = evState().loc, me = l ? [(l.lon + 180) / 360 * 1000, (90 - l.lat) / 180 * 500] : null;
  return `<div class="seg ev-regions">${Object.entries(EV_REGIONS).map(([k, v]) => `<button data-reg="${k}" class="${evMapView === k ? 'on' : ''}">${v[4]}</button>`).join('')}</div>
    <div class="ev-map"><svg viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de competiciones">
      <path d="${typeof WORLD_LAND === 'string' ? WORLD_LAND : ''}" class="ev-land" vector-effect="non-scaling-stroke"/>
      ${me ? `<circle cx="${me[0]}" cy="${me[1]}" r="${r * 0.7}" class="ev-me"/>` : ''}
      ${clusters.map((c, i) => `<g class="ev-pin${c.es.some(e => e.id === evState().goal) ? ' goal' : ''}" data-cl="${i}" tabindex="0"><circle cx="${c.x}" cy="${c.y}" r="${c.es.length > 1 ? r * 1.5 : r}"/>${c.es.length > 1 ? `<text x="${c.x}" y="${c.y}" font-size="${r * 1.4}" dy=".35em">${c.es.length}</text>` : ''}</g>`).join('')}
    </svg></div>
    <p class="small muted">${geo.length} eventos con ubicación${list.length > geo.length ? ` · ${list.length - geo.length} sin coordenadas` : ''}. Los números agrupan eventos cercanos: tócalos o acerca la región.</p>
    <div id="ev-mapsel"></div>`;
}
function evBindMap(root, list) {
  $$('[data-reg]', root).forEach(b => b.onclick = () => { evMapView = b.dataset.reg; evRender(); });
  const geo = list.filter(e => e.latitude != null), [, , w] = EV_REGIONS[evMapView], cell = w / 14, clusters = [];
  geo.forEach(e => { const [px, py] = evXY(e); const c = clusters.find(c => Math.abs(c.x - px) < cell && Math.abs(c.y - py) < cell); if (c) { c.es.push(e); c.x = (c.x * (c.es.length - 1) + px) / c.es.length; c.y = (c.y * (c.es.length - 1) + py) / c.es.length; } else clusters.push({ x: px, y: py, es: [e] }); });
  $$('[data-cl]', root).forEach(g => g.onclick = () => {
    const c = clusters[Number(g.dataset.cl)], sel = $('#ev-mapsel', root);
    sel.innerHTML = c.es.map(evCard).join('');
    $$('[data-ev]', sel).forEach(b => b.onclick = () => openEvent(b.dataset.ev));
  });
}

/* ---------- Detalle ---------- */
function openEvent(id) {
  const e = evById(id); if (!e) return;
  const s = evState(), saved = s.saved.includes(id), goal = s.goal === id, t = todayStr();
  const days = daysBetween(t, e.startDate), done = e.eventStatus === 'completed' || (e.endDate || e.startDate) < t;
  const facts = [
    ['Sede', e.venue], ['Disciplina', e.discipline], ['Divisiones', (e.divisions || []).join(' · ')], ['Categorías', (e.categories || []).join(' · ')],
    ['Requisitos', e.requirements], ['Precio', e.priceMin != null ? `${e.priceMin === e.priceMax || e.priceMax == null ? '' : 'desde '}${e.priceMin.toLocaleString('es-MX')} ${esc(e.currency || '')}` : null],
    ['Abre inscripción', e.registrationOpenDate && longDate(e.registrationOpenDate)], ['Cierra inscripción', e.registrationCloseDate && longDate(e.registrationCloseDate)], ['Organizador', e.organizer]
  ].filter(x => x[1]);
  const links = [['Página oficial', e.officialEventUrl], ['Inscripción', e.registrationUrl], ['Reglamento', e.regulationsUrl], ['Resultados', e.resultsUrl], ['Organizador', e.organizerUrl]].filter(x => x[1]);
  const plan = !done ? evPhases(e) : null, an = !done ? evAnalyzeOne(e) : [];
  const myRes = s.results.find(r => r.id === id);
  openModal(`<div class="hx-eyebrow">${esc(evSport(e).n.toUpperCase())}${e.discipline ? ' · ' + esc(e.discipline.toUpperCase()) : ''}</div>
    <h3 class="ev-title">${esc(e.eventName)}</h3>
    <p class="ev-place">${esc((e.city || '').toUpperCase())}${e.country ? ' · ' + esc(e.country.toUpperCase()) : ''}</p>
    <div class="ev-hero"><div><small>${esc(EV_DATE[e.dateType] || 'Fecha')}</small><b>${evDateRange(e)}</b></div>${!done && days >= 0 ? `<div class="ev-cd-big"><b class="t-display-m">${days}</b><small>días</small></div>` : ''}</div>
    <div class="ev-badges">${evBadge(e)}<span class="ev-st ${e.eventStatus}">${EV_STATUS[e.eventStatus] || ''}</span>${e.registrationStatus ? `<span class="ev-reg ${e.registrationStatus}">${EV_REG[e.registrationStatus]}</span>` : '<span class="ev-reg">Inscripción: sin dato verificado</span>'}</div>
    <p class="small muted">${esc((EV_VER[e.verificationStatus] || EV_VER.unconfirmed)[2])}</p>
    ${e.verificationNotes && e.verificationNotes.length ? `<div class="status info"><b>Notas</b>${e.verificationNotes.map(esc).join(' · ')}</div>` : ''}
    ${facts.length ? `<table class="small hx-tbl ev-facts"><tbody>${facts.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${e.latitude != null ? `<div class="ev-mini"><svg viewBox="${evXY(e)[0] - 60} ${evXY(e)[1] - 30} 120 60"><path d="${typeof WORLD_LAND === 'string' ? WORLD_LAND : ''}" class="ev-land" vector-effect="non-scaling-stroke"/><circle cx="${evXY(e)[0]}" cy="${evXY(e)[1]}" r="1.6" class="ev-pin-dot"/></svg><small>${e.geoPrecision === 'venue' ? 'Ubicación de la sede' : 'Ubicación aproximada (ciudad)'}</small></div>` : ''}
    <div class="ev-actions">
      ${done ? `<button class="block" id="evd-res">${myRes ? 'Ver mi resultado' : 'Registrar mi resultado'}</button>` : `<button class="block" id="evd-goal">${goal ? 'Es tu objetivo · ver plan' : 'Hacerlo mi objetivo'}</button>`}
      <div class="row" style="gap:8px"><button class="secondary" id="evd-save" style="flex:1">${saved ? 'Guardado ✓' : 'Guardar'}</button>${!done ? `<button class="secondary" id="evd-ics" style="flex:1">Al calendario</button>` : ''}<button class="secondary" id="evd-share" style="flex:1">Compartir</button></div>
      ${e.registrationUrl && !done ? `<a class="ev-link-btn" href="${esc(e.registrationUrl)}" target="_blank" rel="noopener">Inscribirme en el sitio oficial ↗</a>` : ''}
    </div>
    ${an.length ? `<div class="rir-label"><span>Análisis para ti</span></div>${an.map(x => `<div class="pg-rec"><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div>`).join('')}` : ''}
    ${plan ? `<div class="rir-label"><span>Si lo haces tu objetivo</span></div>${evPhasesHtml(plan)}` : ''}
    ${links.length ? `<div class="rir-label"><span>Enlaces</span></div><div class="ev-links">${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}</div>` : ''}
    <div class="rir-label"><span>Fuentes</span></div>
    <ul class="ev-src">${(e.evidence || []).map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a><small>${{ jsonld: 'Datos estructurados de la página', snippet: 'Texto de la página oficial (vía buscador)', secondary: 'Fuente secundaria', reviewed: 'Revisado por una persona' }[x.method] || x.method}${x.seenAt || x.fetchedAt ? ' · ' + esc((x.seenAt || x.fetchedAt).slice(0, 10)) : ''}${x.note ? ' · “' + esc(x.note) + '”' : ''}</small></li>`).join('')}</ul>
    <p class="small muted">Última verificación: ${e.lastVerifiedAt ? esc(e.lastVerifiedAt.slice(0, 10)) : '—'} · confianza ${e.confidenceScore}/100. Confirma siempre en el sitio oficial antes de pagar o viajar.</p>
    <div class="row" style="gap:8px;margin-top:6px"><button class="ghost" id="evd-follow">${evFollowed(e) ? 'Dejar de seguir' : 'Seguir'} ${esc(evSport(e).n)} en ${esc(e.city)}</button><span class="grow"></span><button class="ghost" id="evd-x">← Volver</button></div>`, m => {
    const again = () => openEvent(id);
    $('#evd-x', m).onclick = () => openModal('<div id="ev-root"></div>', () => evRender());
    $('#evd-save', m).onclick = () => { evToggleSave(id); if (!saved && !s.goal && !done) { evAskGoal(e); return; } again(); };
    const g = $('#evd-goal', m); if (g) g.onclick = () => goal ? openEvGoalPlan(e) : evAskGoal(e);
    const ic = $('#evd-ics', m); if (ic) ic.onclick = () => evIcs(e);
    $('#evd-share', m).onclick = () => evShare(e);
    const r = $('#evd-res', m); if (r) r.onclick = () => openEvResult(e);
    $('#evd-follow', m).onclick = () => { const f = s.follow, on = evFollowed(e); if (on) { f.sports = f.sports.filter(x => x !== e.sport); f.cities = f.cities.filter(x => x !== evNorm(e.city)); } else { f.sports.push(e.sport); f.cities.push(evNorm(e.city)); } saveData(); toast(on ? 'Ya no lo sigues' : 'Te avisaré de eventos nuevos así cuando actualices el catálogo'); again(); };
  });
}
function evToggleSave(id) { const s = evState(); s.saved = s.saved.includes(id) ? s.saved.filter(x => x !== id) : s.saved.concat(id); if (!s.saved.includes(id) && s.goal === id) s.goal = null; saveData(); }
function evAskGoal(e) {
  const ph = evPhases(e), sp = evSport(e);
  openModal(`<h3>¿Quieres convertir este evento en tu objetivo?</h3>
    <p class="small">${esc(e.eventName)} · ${evDateRange(e)} · faltan <b>${ph.weeks} semanas</b>.</p>
    ${ph.short ? `<div class="status warn"><b>Tiempo corto</b>Para ${esc(sp.n)} se recomiendan al menos ${sp.min} semanas; el plan se comprime y la meta debe ser terminar con buenas sensaciones.</div>` : ''}
    ${evPhasesHtml(ph)}
    <p class="small muted">${e.sport === 'hyrox' ? 'HYROX Lab usará esta fecha para tus fases, tu misión diaria y el taper.' : e.sport === 'bodybuilding' ? 'El kit del competidor usará esta fecha para tu preparación.' : 'Verás las fases en tu calendario y en Hoy.'}</p>
    <div class="row"><button class="secondary" id="ag-no" style="flex:1">Solo guardar</button><button id="ag-yes" style="flex:1">Sí, es mi objetivo</button></div>`, m => {
    $('#ag-no', m).onclick = () => { if (!evState().saved.includes(e.id)) evToggleSave(e.id); openEvent(e.id); };
    $('#ag-yes', m).onclick = () => { evSetGoal(e); openEvGoalPlan(e); };
  });
}
/** Integración real con los motores de entrenamiento existentes. */
function evSetGoal(e) {
  const s = evState();
  if (!s.saved.includes(e.id)) s.saved.push(e.id);
  s.goal = e.id;
  if (e.sport === 'hyrox' && typeof hx === 'function') {
    const p = hx().profile || { cat: 'open', sex: DB.profile.sex === 'f' || DB.profile.sex === 'mujer' ? 'f' : 'm', equip: 'gym', days: 4, exp: 'nuevo' };
    hx().profile = Object.assign(p, { date: e.startDate, eventId: e.id });
  } else if (e.sport === 'bodybuilding') {
    DB.profile.comp = Object.assign(DB.profile.comp || { cat: typeof fem === 'function' && fem() ? 'bikini' : 'classic' }, { date: e.startDate, eventId: e.id });
  }
  if (typeof track === 'function') track('event_goal');
  saveData();
  if (typeof syncReminders === 'function') syncReminders();
}
/** Periodización según disciplina y tiempo disponible (no un plan rígido de 16 semanas). */
function evPhases(e, from) {
  const t = from || todayStr(), sp = evSport(e), days = Math.max(0, daysBetween(t, e.startDate)), weeks = Math.floor(days / 7);
  const taper = Math.min(sp.taper, Math.max(0, weeks - 2)), sim = weeks >= 8 ? sp.sim : Math.min(sp.sim, 1);
  const rest = Math.max(0, weeks - 1 - taper - sim), base = Math.round(rest * 0.4), dev = Math.round(rest * 0.35), spec = rest - base - dev;
  const out = []; let d = t;
  const add = (k, n, w, why) => { if (w <= 0) return; const to = addDays(d, w * 7 - 1); out.push({ k, n, from: d, to: to > e.startDate ? addDays(e.startDate, -1) : to, w, why }); d = addDays(to, 1); };
  add('eval', 'Evaluación', weeks >= 3 ? 1 : 0, 'Medir dónde estás para decidir, no adivinar.');
  add('base', 'Base', base, 'Capacidad aeróbica, fuerza y técnica.');
  add('dev', 'Desarrollo', dev, 'Umbral y trabajo específico por partes.');
  add('spec', 'Preparación específica', spec, 'Ritmo de competencia y demandas del evento.');
  add('sim', e.sport === 'bodybuilding' ? 'Ensayo de poses y peak' : 'Simulaciones', sim, 'Ensayar ritmo, transiciones y estrategia.');
  if (d < e.startDate) out.push({ k: 'taper', n: e.sport === 'bodybuilding' ? 'Semana del show' : 'Taper', from: d, to: addDays(e.startDate, -1), w: Math.ceil(daysBetween(d, e.startDate) / 7), why: 'Menos volumen para llegar fresco.' });
  out.push({ k: 'race', n: 'Competencia', from: e.startDate, to: e.endDate || e.startDate, w: 0, why: '' });
  out.push({ k: 'rec', n: 'Recuperación', from: addDays(e.endDate || e.startDate, 1), to: addDays(e.endDate || e.startDate, sp.rec), w: Math.round(sp.rec / 7), why: 'Suave antes del siguiente bloque.' });
  return { phases: out, weeks, short: weeks < sp.min };
}
function evPhasesHtml(p) {
  const total = Math.max(1, p.phases.filter(x => x.k !== 'race' && x.k !== 'rec').reduce((a, x) => a + Math.max(1, daysBetween(x.from, x.to) + 1), 0));
  return `<div class="ev-phbar">${p.phases.filter(x => x.k !== 'race' && x.k !== 'rec').map(x => `<i class="ph-${x.k}" style="flex:${Math.max(1, daysBetween(x.from, x.to) + 1) / total}"></i>`).join('')}</div>
    <div class="ev-phl">${p.phases.map(x => `<div><i class="ph-${x.k}"></i><b>${x.n}</b><small>${shortDate(x.from)}${x.to !== x.from ? ' – ' + shortDate(x.to) : ''}</small></div>`).join('')}</div>`;
}
function openEvGoalPlan(e) {
  const p = evPhases(e), t = todayStr(), cur = p.phases.find(x => x.from <= t && x.to >= t);
  openModal(`<div class="hx-eyebrow">TU COMPETICIÓN OBJETIVO</div><h3 style="margin-top:4px">${esc(e.eventName)}</h3>
    <div class="hx-count"><b class="t-display-l">${Math.max(0, daysBetween(t, e.startDate))}</b><span>días · ${p.weeks} semanas<br>${cur ? 'fase: ' + esc(cur.n) : ''}</span></div>
    ${evPhasesHtml(p)}${cur && cur.why ? `<p class="small">${esc(cur.why)}</p>` : ''}
    ${e.sport === 'hyrox' ? '<button class="block" id="gp-lab">Abrir HYROX Lab</button>' : e.sport === 'bodybuilding' && typeof openCompete === 'function' ? '<button class="block" id="gp-kit">Abrir kit del competidor</button>' : ''}
    <button class="ghost block" id="gp-drop" style="color:var(--bad)">Dejar de tenerlo como objetivo</button><button class="ghost block" id="gp-x">← Volver al evento</button>`, m => {
    const lab = $('#gp-lab', m); if (lab) lab.onclick = () => openHyrox();
    const kit = $('#gp-kit', m); if (kit) kit.onclick = () => openCompete();
    $('#gp-drop', m).onclick = () => { evState().goal = null; if (typeof hx === 'function' && hx().profile && hx().profile.eventId === e.id) delete hx().profile.eventId; saveData(); openEvent(e.id); };
    $('#gp-x', m).onclick = () => openEvent(e.id);
  });
}

/* ---------- Inteligencia entre eventos ---------- */
function evAnalyzeOne(e) {
  const s = evState(), t = todayStr(), sp = evSport(e), out = [], days = daysBetween(t, e.startDate), km = evKm(e);
  if (days < sp.min * 7) out.push(['Poco tiempo de preparación', `Faltan ${Math.floor(days / 7)} semanas y para ${sp.n} se recomiendan ${sp.min}+. Sirve como experiencia o prueba, no para buscar tu mejor marca.`]);
  const goal = s.goal && s.goal !== e.id ? evById(s.goal) : null;
  if (goal) {
    const gap = daysBetween(e.endDate || e.startDate, goal.startDate);
    if (gap > 0 && gap < 21) out.push(['Demasiado cerca de tu objetivo', `Está ${gap} días antes de ${goal.eventName}. Te quitaría frescura en el taper: mejor no competir a tope o elegir otro.`]);
    else if (gap >= 21 && gap <= 70) out.push(['Buena prueba de preparación', `Está ${Math.round(gap / 7)} semanas antes de ${goal.eventName}: puede ser tu simulación real en la fase de desarrollo o específica. Compítelo al 90 %.`]);
    else if (gap < 0 && -gap < evSport(goal).rec) out.push(['Poco después de tu objetivo', `Está ${-gap} días después de ${goal.eventName}; la recuperación recomendada es de ${evSport(goal).rec} días.`]);
  }
  s.saved.filter(id => id !== e.id && id !== s.goal).map(evById).filter(x => x && x.startDate >= t).forEach(o => {
    const gap = Math.abs(daysBetween(o.startDate, e.startDate));
    if (gap < Math.max(sp.rec, evSport(o).rec)) out.push(['Choca con otro evento guardado', `${o.eventName} está a ${gap} días; entre ambos no alcanzas a recuperarte.`]);
  });
  if (km != null && km > 800) out.push(['Requiere viajar', `Está a ${km.toLocaleString('es-MX')} km. Llega al menos 1–2 días antes${km > 3000 ? ' y considera el cambio de horario' : ''}.`]);
  if (e.verificationStatus === 'unconfirmed' || e.verificationStatus === 'partially_verified') out.push(['Confírmalo antes de pagar', 'La fecha aún no se ha leído de la página oficial del organizador.']);
  return out;
}
function evSeasonHtml() {
  const s = evState(), t = todayStr(), mine = s.saved.map(evById).filter(Boolean).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const fut = mine.filter(e => (e.endDate || e.startDate) >= t), past = mine.filter(e => (e.endDate || e.startDate) < t);
  if (!mine.length) return '<div class="status info"><b>Tu temporada está vacía</b>Guarda competiciones y aquí verás conflictos, tiempos de recuperación, viajes y cuál conviene como objetivo.</div>';
  const notes = [];
  for (let i = 1; i < fut.length; i++) { const a = fut[i - 1], b = fut[i], gap = daysBetween(a.endDate || a.startDate, b.startDate), need = evSport(a).rec; if (gap < need) notes.push(`${a.eventName} → ${b.eventName}: ${gap} días entre ambos (se recomiendan ${need}).`); }
  const prices = fut.filter(e => e.priceMin != null);
  return `${fut.map(e => `${evCard(e)}${evAnalyzeOne(e).slice(0, 2).map(x => `<p class="ev-rwhy">${esc(x[0])}: ${esc(x[1])}</p>`).join('')}`).join('')}
    ${notes.length ? `<div class="status warn"><b>Calendario apretado</b>${notes.map(esc).join('<br>')}</div>` : fut.length > 1 ? '<p class="small muted">Sin conflictos de recuperación entre tus eventos.</p>' : ''}
    <p class="small muted">Inscripciones con precio publicado: ${prices.length} de ${fut.length}${prices.length ? ` · suma ${prices.reduce((a, e) => a + e.priceMin, 0).toLocaleString('es-MX')} ${esc(prices[0].currency || '')} (sin viaje)` : ''}.</p>
    ${past.length ? `<div class="rir-label"><span>Competidos</span></div>${past.map(evCard).join('')}` : ''}
    <button class="secondary block" id="ev-mycal" style="margin-top:8px">${ico('calendar', 18, 'lead')}Mi calendario</button>`;
}
function evBindSeason(root) { const b = $('#ev-mycal', root); if (b) b.onclick = () => openMyCalendar(); }

/* ---------- Calendario personal: entrenos, eventos, fases ---------- */
function evAgenda(from, to) {
  const s = evState(), items = [], goal = s.goal && evById(s.goal);
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = (parseDate(d).getDay() + 6) % 7, w = typeof workoutById === 'function' ? workoutById((DB.plan || [])[wd]) : null;
    const doneLift = DB.sessions.some(x => x.end && x.date === d), doneHx = DB.hyrox && DB.hyrox.sessions.some(x => x.date === d);
    if (doneLift || doneHx) items.push({ d, k: 'done', t: doneHx ? 'Sesión HYROX hecha' : 'Entreno hecho' });
    else if (w && d >= todayStr()) items.push({ d, k: w.hyrox ? 'hyrox' : 'train', t: w.hyrox ? 'HYROX Lab' : w.name });
  }
  s.saved.map(evById).filter(Boolean).forEach(e => {
    if (e.startDate >= from && e.startDate <= to) items.push({ d: e.startDate, k: e.id === s.goal ? 'goal' : 'event', t: e.eventName, id: e.id });
    if (e.registrationCloseDate && e.registrationCloseDate >= from && e.registrationCloseDate <= to) items.push({ d: e.registrationCloseDate, k: 'reg', t: 'Cierra inscripción: ' + e.eventName, id: e.id });
  });
  if (goal) evPhases(goal).phases.forEach(p => { if (p.from >= from && p.from <= to && p.k !== 'race') items.push({ d: p.from, k: 'phase', t: 'Empieza: ' + p.n }); });
  return items.sort((a, b) => a.d.localeCompare(b.d));
}
function openMyCalendar() {
  const t = todayStr(), m = (evMonth || t.slice(0, 7)), first = parseDate(m + '-01'), lead = (first.getDay() + 6) % 7, dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const goal = evState().goal && evById(evState().goal), ph = goal ? evPhases(goal).phases : [];
  const phaseOf = d => (ph.find(p => p.from <= d && p.to >= d) || {}).k;
  const items = evAgenda(m + '-01', m + '-' + String(dim).padStart(2, '0')), by = {};
  items.forEach(x => (by[x.d] = by[x.d] || []).push(x));
  const agenda = evAgenda(t, addDays(t, evCalMode === 'week' ? 6 : 45));
  openModal(`<div class="hx-eyebrow">MI CALENDARIO</div><h3 style="margin-top:4px">Entrenos y competiciones</h3>
    <div class="seg ev-views">${[['month', 'Mes'], ['week', 'Semana'], ['agenda', 'Agenda']].map(([k, n]) => `<button data-cm="${k}" class="${evCalMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    ${evCalMode === 'month' ? `<div class="ev-calh"><button class="icon-btn" id="mc-pm">‹</button><b>${EV_MONTH_N[first.getMonth()]} ${first.getFullYear()}</b><button class="icon-btn" id="mc-nm">›</button></div>
    <div class="ev-cal my">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<small>${x}</small>`).join('')}${Array(lead).fill('<span></span>').join('')}${Array.from({ length: dim }, (_, i) => { const d = m + '-' + String(i + 1).padStart(2, '0'), xs = by[d] || [], pk = phaseOf(d); return `<span class="ev-cd${d === t ? ' today' : ''}${pk ? ' ph-bg-' + pk : ''}">${i + 1}<em>${xs.map(x => `<u class="k-${x.k}"></u>`).join('')}</em></span>`; }).join('')}</div>
    <div class="ev-legend"><span><u class="k-train"></u>Entreno</span><span><u class="k-hyrox"></u>HYROX</span><span><u class="k-done"></u>Hecho</span><span><u class="k-event"></u>Evento</span><span><u class="k-goal"></u>Objetivo</span><span><u class="k-reg"></u>Inscripción</span></div>` : ''}
    <div class="ev-agenda">${(evCalMode === 'month' ? items.filter(x => x.k !== 'train' && x.k !== 'hyrox' && x.k !== 'done') : agenda).map(x => `<div class="ev-ag k-${x.k}"${x.id ? ` data-ev="${esc(x.id)}"` : ''}><small>${shortDate(x.d)}</small><span>${esc(x.t)}</span></div>`).join('') || '<p class="small muted">Nada en este periodo.</p>'}</div>
    <button class="ghost block" id="mc-x">Cerrar</button>`, mm => {
    $$('[data-cm]', mm).forEach(b => b.onclick = () => { evCalMode = b.dataset.cm; openMyCalendar(); });
    const step = n => { const d = parseDate(m + '-01'); d.setMonth(d.getMonth() + n); evMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); openMyCalendar(); };
    const p = $('#mc-pm', mm); if (p) { p.onclick = () => step(-1); $('#mc-nm', mm).onclick = () => step(1); }
    $$('[data-ev]', mm).forEach(b => b.onclick = () => openEvent(b.dataset.ev));
    $('#mc-x', mm).onclick = closeModal;
  });
}

/* ---------- Resultados ---------- */
function openEvResult(e) {
  const s = evState(), r = s.results.find(x => x.id === e.id) || {}, hyroxE = e.sport === 'hyrox';
  const splits = hyroxE ? ['Run 1', 'SkiErg', 'Run 2', 'Sled push', 'Run 3', 'Sled pull', 'Run 4', 'Burpee broad jumps', 'Run 5', 'Row', 'Run 6', 'Farmers carry', 'Run 7', 'Sandbag lunges', 'Run 8', 'Wall balls'] : [];
  openModal(`<h3>Mi resultado</h3><p class="small muted" style="margin-top:0">${esc(e.eventName)} · ${evDateRange(e)}${e.resultsUrl ? ` · <a href="${esc(e.resultsUrl)}" target="_blank" rel="noopener">resultados oficiales ↗</a>` : ''}</p>
    <label>Tiempo final (h:mm:ss)<input id="er-t" value="${r.sec ? hxT(r.sec) : ''}" placeholder="1:24:30"></label>
    <div class="row" style="gap:8px"><label style="flex:1">Posición general<input id="er-pos" inputmode="numeric" value="${r.pos || ''}"></label><label style="flex:1">Posición en categoría<input id="er-cpos" inputmode="numeric" value="${r.cpos || ''}"></label></div>
    <label>Categoría<input id="er-cat" value="${esc(r.cat || '')}" placeholder="${hyroxE ? 'Men Open 30-34' : ''}"></label>
    ${splits.length ? `<details ${r.splits ? 'open' : ''}><summary class="small"><b>Parciales (opcional)</b> · alimentan tu HYROX Lab</summary><div class="ev-splits">${splits.map((n, i) => `<label>${n}<input data-sp="${i}" value="${r.splits && r.splits[i] ? hxT(r.splits[i]) : ''}" placeholder="m:ss"></label>`).join('')}</div></details>` : ''}
    <label>Sensaciones y aprendizajes<input id="er-n" value="${esc(r.note || '')}" placeholder="Qué funcionó, qué te frenó"></label>
    <div class="row"><button class="secondary" id="er-c" style="flex:1">← Volver</button><button id="er-s" style="flex:1">Guardar</button></div>`, m => {
    $('#er-c', m).onclick = () => openEvent(e.id);
    $('#er-s', m).onclick = () => {
      const sec = hxParse($('#er-t', m).value);
      if (!sec) { toast('Escribe tu tiempo final'); return; }
      const sp = $$('[data-sp]', m).map(i => hxParse(i.value));
      const prev = s.results.filter(x => x.sport === e.sport && x.id !== e.id && x.sec).sort((a, b) => a.sec - b.sec)[0];
      const res = { id: e.id, sport: e.sport, name: e.eventName, date: e.startDate, sec, pos: num($('#er-pos', m).value), cpos: num($('#er-cpos', m).value), cat: $('#er-cat', m).value.trim(), note: $('#er-n', m).value.trim(), splits: sp.some(Boolean) ? sp : null, pr: !prev || sec < prev.sec };
      s.results = s.results.filter(x => x.id !== e.id).concat(res);
      if (hyroxE && typeof hx === 'function') {   // la carrera real cuenta como simulación medida y sus estaciones como pruebas
        hx().results = hx().results.filter(x => x.eventId !== e.id);
        hx().results.push({ id: 'ev' + Date.now(), kind: 'sim', sec, date: e.startDate, t: Date.now(), rpe: 10, note: 'Carrera oficial: ' + e.eventName, eventId: e.id });
        if (res.splits) HX_STATIONS.forEach((st, k) => { const v = res.splits[k * 2 + 1]; if (v) hx().results.push({ id: 'ev' + st.k + Date.now(), kind: 'st', st: st.k, sec: v / 1.08, date: e.startDate, t: Date.now(), rpe: 10, std: true, eventId: e.id, note: 'Parcial de carrera (÷1.08 para compararlo con pruebas aisladas)' }); });
      }
      saveData();
      openModal(`<div class="hx-eyebrow">${res.pr ? 'NUEVO RÉCORD PERSONAL' : 'RESULTADO GUARDADO'}</div><h3 style="margin-top:4px">${hxT(sec)}</h3>
        ${prev ? `<p class="small">${sec < prev.sec ? `${hxT(prev.sec - sec)} más rápido que ${esc(prev.name)}.` : `Tu mejor marca sigue siendo ${hxT(prev.sec)} (${esc(prev.name)}).`}</p>` : '<p class="small">Tu primera marca en esta disciplina: el punto de partida.</p>'}
        ${hyroxE ? '<p class="small muted">Se agregó a HYROX Lab como simulación medida' + (res.splits ? ' y con tus parciales por estación' : '') + '. Tu predicción y tu cuello de botella ya lo usan.</p>' : ''}
        <button class="block" id="er-ok">Listo</button>`, mm => { $('#er-ok', mm).onclick = () => openEvent(e.id); });
    };
  });
}

/* ---------- Exportar y compartir ---------- */
function evIcs(e) {
  const d = x => x.replace(/-/g, ''), end = addDays(e.endDate || e.startDate, 1);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HYROX LAB//Mi Progreso//ES', 'BEGIN:VEVENT', 'UID:' + e.id + '@miprogreso', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    'DTSTART;VALUE=DATE:' + d(e.startDate), 'DTEND;VALUE=DATE:' + d(end), 'SUMMARY:' + e.eventName.replace(/[,;]/g, ' '), 'LOCATION:' + [e.venue, e.city, e.country].filter(Boolean).join(' - '),
    'DESCRIPTION:' + ((EV_VER[e.verificationStatus] || EV_VER.unconfirmed)[0] + '. ' + (e.officialEventUrl || e.sourceUrl || '')).replace(/[,;]/g, ' '), 'END:VEVENT', 'END:VCALENDAR'];
  try { saveBinary(e.id + '.ics', 'text/calendar', new TextEncoder().encode(lines.join('\r\n'))); toast('Archivo de calendario guardado: ábrelo para agregarlo'); } catch (err) { toast('No se pudo crear el archivo'); }
}
function evShare(e) {
  const text = `${e.eventName} · ${evDateRange(e)} · ${e.city}. ${(EV_VER[e.verificationStatus] || EV_VER.unconfirmed)[0]}. ${e.officialEventUrl || e.sourceUrl || ''}`.trim();
  if (navigator.share) navigator.share({ title: e.eventName, text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copiado para compartir')).catch(() => toast(text));
  else toast(text);
}

/* ---------- Novedades y control de calidad ---------- */
function openEvInbox() {
  const s = evState();
  openModal(`<h3>Novedades</h3><p class="small muted" style="margin-top:0">Cambios en tus eventos guardados y eventos nuevos que sigues. Se detectan al actualizar el catálogo.</p>
    ${s.inbox.length ? s.inbox.map(x => `<div class="pg-rec${x.read ? '' : ' ev-unread'}" data-ev="${esc(x.id)}"><b>${esc(x.text)}</b><small>${shortDate(x.at)}</small></div>`).join('') : '<p class="small">Sin novedades por ahora.</p>'}
    <button class="ghost block" id="ib-x">← Volver</button>`, m => {
    s.inbox.forEach(x => { x.read = true; }); saveData();
    $$('[data-ev]', m).forEach(b => b.onclick = () => openEvent(b.dataset.ev));
    $('#ib-x', m).onclick = () => openModal('<div id="ev-root"></div>', () => evRender());
  });
}
function openEvQA() {
  const c = evCatalog(), stats = c.stats || {}, rv = c.review || [], ch = (c.changes || []).slice(0, 20);
  const label = { possible_duplicate: 'Posible duplicado', low_confidence: 'Baja confianza', date_conflict: 'Fechas en conflicto', stale: 'Verificación vieja', incomplete: 'Información incompleta' };
  openModal(`<h3>Control de calidad</h3><p class="small muted" style="margin-top:0">Lo que el motor no publica como oficial sin revisión. Generado el ${c.generatedAt ? esc(c.generatedAt.slice(0, 10)) : '—'}.</p>
    <div class="hx-kpis">${Object.entries(stats.byVerification || {}).map(([k, v]) => `<div><b>${v}</b><small>${(EV_VER[k] || [k])[0]}</small></div>`).join('')}</div>
    <div class="rir-label"><span>Pendientes (${rv.length})</span></div>
    ${rv.length ? rv.map(r => `<div class="pg-rec"${r.id ? ` data-ev="${esc(r.id)}"` : ''}><b>${label[r.type] || r.type}</b><small>${esc(r.note || '')}</small></div>`).join('') : '<p class="small">Sin pendientes.</p>'}
    <div class="rir-label"><span>Historial de cambios</span></div>
    ${ch.length ? ch.map(x => `<div class="pg-rec"><b>${esc(x.name)}</b><small>${x.type === 'new_event' ? 'Evento nuevo' : `${esc(x.field)}: ${esc(String(x.from))} → ${esc(String(x.to))}`} · ${esc(x.at)}</small></div>`).join('') : '<p class="small muted">Aún sin cambios registrados.</p>'}
    <button class="ghost block" id="qa-x">← Volver</button>`, m => {
    $$('[data-ev]', m).forEach(b => b.onclick = () => openEvent(b.dataset.ev));
    $('#qa-x', m).onclick = () => openModal('<div id="ev-root"></div>', () => evRender());
  });
}

/* ---------- Recordatorios (se suman a la agenda de notif.js) ---------- */
function evReminders(date) {
  const s = DB.ev, out = []; if (!s) return out;
  const goal = s.goal && evById(s.goal);
  if (goal) { const d = daysBetween(date, goal.startDate); if ([90, 30, 14, 7, 1].includes(d)) out.push(['🏁 ' + goal.eventName, `Tu competición objetivo es en ${d} día${d > 1 ? 's' : ''}.`]); }
  s.saved.map(evById).filter(Boolean).forEach(e => {
    if (e.registrationCloseDate && daysBetween(date, e.registrationCloseDate) === 7) out.push(['📝 Cierra la inscripción', `${e.eventName}: la fecha límite es en 7 días.`]);
    if (e.id !== s.goal && daysBetween(date, e.startDate) === 7) out.push(['📅 ' + e.eventName, 'Es en una semana.']);
  });
  return out;
}

/* ---------- Tarjeta para Hoy / Plan ---------- */
function evGoalCard() {
  const s = DB.ev; if (!s || !s.goal) return '';
  const e = evById(s.goal); if (!e || e.startDate < todayStr()) return '';
  const p = evPhases(e), cur = p.phases.find(x => x.from <= todayStr() && x.to >= todayStr());
  return `<button class="card keep ev-goalcard" data-evgoal="${esc(e.id)}"><div class="hx-eyebrow">TU OBJETIVO · ${esc(evSport(e).n.toUpperCase())}</div><div class="row spread"><b>${esc(e.eventName)}</b><span><b class="t-metric">${daysBetween(todayStr(), e.startDate)}</b> <small class="muted">días</small></span></div>${cur ? `<small class="muted">Fase: ${esc(cur.n)}</small>` : ''}${evPhasesHtml(p).split('<div class="ev-phl">')[0]}</button>`;
}
function bindEvGoalCard(root) { const b = $('[data-evgoal]', root); if (b) b.onclick = () => { evLoadBundled().then(() => openEvent(b.dataset.evgoal)); }; }
evLoadBundled().then(() => { try { if (typeof DB !== 'undefined' && DB && DB.ev && DB.ev.goal && typeof render === 'function' && typeof currentTab !== 'undefined' && currentTab === 'home') render('home'); } catch (e) {} });
