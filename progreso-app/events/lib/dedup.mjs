import { citySlug, nameTokens, jaccard, daysApart, canonicalUrl } from './normalize.mjs';
/*
 * Deduplicación conservadora:
 *  - Se fusiona automáticamente solo con un identificador fuerte: misma URL oficial canónica o mismo id externo.
 *  - Mismo deporte + misma ciudad (con alias) + fechas a ≤3 días + nombres parecidos → candidato a duplicado,
 *    que va a la cola de revisión y NO se fusiona solo.
 */
export function strongId(e) {
  const ids = [];
  if (e.officialEventUrl) ids.push('url:' + canonicalUrl(e.officialEventUrl));
  (e.externalIds || []).forEach(x => ids.push('ext:' + x));
  return ids;
}
export function similarity(a, b) {
  if (a.sport !== b.sport || citySlug(a.city) !== citySlug(b.city)) return 0;
  if (a.startDate && b.startDate && daysApart(a.startDate, b.startDate) > 3) return 0;
  return jaccard(nameTokens(a.eventName, a.city), nameTokens(b.eventName, b.city));
}
function mergeInto(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (out[k] == null || out[k] === '' || (Array.isArray(out[k]) && !out[k].length)) out[k] = v;
  out.evidence = [...(a.evidence || []), ...(b.evidence || [])].filter((x, i, arr) => arr.findIndex(y => y.url === x.url && y.method === x.method) === i);
  out.aliases = [...new Set([...(a.aliases || []), a.eventName, b.eventName, ...(b.aliases || [])])].filter(n => n !== out.eventName);
  out.externalIds = [...new Set([...(a.externalIds || []), ...(b.externalIds || [])])];
  out.firstDiscoveredAt = [a.firstDiscoveredAt, b.firstDiscoveredAt].filter(Boolean).sort()[0];
  return out;
}
export function dedupe(events) {
  const out = [], byId = new Map(), review = [];
  for (const e of events) {
    const hit = strongId(e).map(id => byId.get(id)).find(x => x != null);
    if (hit != null) { out[hit] = mergeInto(out[hit], e); strongId(out[hit]).forEach(id => byId.set(id, hit)); continue; }
    const same = out.findIndex(x => x.id === e.id);
    if (same >= 0) { out[same] = mergeInto(out[same], e); continue; }
    out.push(e); strongId(e).forEach(id => byId.set(id, out.length - 1));
  }
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const s = similarity(out[i], out[j]);
    if (s >= 0.5) review.push({ type: 'possible_duplicate', ids: [out[i].id, out[j].id], score: Math.round(s * 100) / 100, note: `${out[i].eventName} ↔ ${out[j].eventName}` });
  }
  return { events: out, review };
}
