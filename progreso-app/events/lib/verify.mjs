import { domainOf } from './normalize.mjs';
import { sportOf } from './disciplines.mjs';
/*
 * Nivel de verificación según la evidencia (nunca según lo que "suele pasar"):
 *  officially_confirmed  la fecha se leyó de la página oficial del organizador (extracción automática o revisión humana).
 *  verified              el texto de la página oficial se vio por otra vía (p. ej. extracto del buscador) y otra fuente coincide.
 *  partially_verified    dos fuentes secundarias coinciden, o una secundaria más la URL oficial conocida sin leer.
 *  unconfirmed           una sola fuente secundaria.
 * La fecha de una edición pasada es "historical" y nunca se muestra como futura.
 */
export function isOfficial(url, e, sources = {}) {
  const d = domainOf(url); if (!d) return false;
  const doms = sportOf(e.sport).officialDomains.concat(e.officialDomains || []);
  return doms.some(x => d === x || d.endsWith('.' + x)) || !!(sources[d] && sources[d].official);
}
export function verify(e, sources = {}, today = new Date().toISOString().slice(0, 10)) {
  const ev = e.evidence || [];
  const agree = ev.filter(x => !x.startDate || x.startDate === e.startDate);
  const offRead = agree.some(x => isOfficial(x.url, e, sources) && (x.method === 'jsonld' || x.method === 'reviewed'));
  const offSeen = agree.some(x => isOfficial(x.url, e, sources) && x.method === 'snippet');
  const offKnown = !!e.officialEventUrl;
  const secondary = new Set(agree.filter(x => !isOfficial(x.url, e, sources)).map(x => domainOf(x.url))).size;
  const conflicts = ev.filter(x => x.startDate && x.startDate !== e.startDate).length;
  let v = 'unconfirmed';
  if (offRead) v = 'officially_confirmed';
  else if (offSeen && (secondary >= 1 || offKnown)) v = 'verified';
  else if (secondary >= 2 || (secondary >= 1 && offKnown) || offSeen) v = 'partially_verified';
  let score = { officially_confirmed: 95, verified: 80, partially_verified: 60, unconfirmed: 35 }[v] - conflicts * 15;
  const notes = [];
  if (conflicts) notes.push(`${conflicts} fuente(s) con otra fecha`);
  if (!offKnown) notes.push('sin URL oficial del evento');
  // Estado del evento: finalizado solo por fecha; cancelado/pospuesto solo si la evidencia lo dice.
  let eventStatus = e.eventStatus || 'scheduled';
  const end = e.endDate || e.startDate;
  if (e.dateType === 'historical' || (end && end < today && !['cancelled', 'postponed'].includes(eventStatus))) eventStatus = 'completed';
  return { ...e, verificationStatus: v, confidenceScore: Math.max(5, Math.min(100, score)), verificationNotes: notes, eventStatus };
}
/** Siguiente revisión según el estado: no consultar una fuente de más. */
export function nextCheck(e, now = new Date()) {
  const day = 864e5, t = now.getTime(), d = n => new Date(t + n * day).toISOString();
  const start = e.startDate ? Date.parse(e.startDate) : null, toStart = start ? (start - t) / day : null;
  if (e.eventStatus === 'completed') return e.resultsUrl || (toStart != null && toStart < -30) ? null : d(3);   // buscar resultados 30 días
  if (e.eventStatus === 'cancelled') return null;
  if (toStart != null && toStart <= 14) return d(1);
  if (e.registrationStatus === 'open') return d(3);
  if (e.registrationOpenDate && (Date.parse(e.registrationOpenDate) - t) / day <= 30) return d(2);
  if (e.verificationStatus === 'unconfirmed' || e.verificationStatus === 'partially_verified') return d(7);
  return d(14);
}
