// Extractores sin dependencias: JSON-LD schema.org (Event/SportsEvent) e iCalendar (VEVENT).
const EVENT_TYPES = /(^|:)(Event|SportsEvent|ExerciseEvent)$/;
function* walk(node) {
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  if (!node || typeof node !== 'object') return;
  yield node;
  if (node['@graph']) yield* walk(node['@graph']);
}
const txt = v => typeof v === 'string' ? v : v && (v.name || v['@value']) || null;
export function extractJsonLd(html, pageUrl) {
  const out = [], re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
    for (const n of walk(data)) {
      const types = [].concat(n['@type'] || []);
      if (!types.some(t => EVENT_TYPES.test(t)) || !n.startDate) continue;
      const loc = [].concat(n.location || [])[0] || {}, addr = loc.address || {};
      const offers = [].concat(n.offers || []);
      const prices = offers.map(o => Number(o.price ?? o.lowPrice)).filter(isFinite);
      const status = String(n.eventStatus || '').split('/').pop();
      const avail = offers.map(o => String(o.availability || '').split('/').pop());
      out.push({
        eventName: txt(n.name), startDate: String(n.startDate).slice(0, 10), endDate: n.endDate ? String(n.endDate).slice(0, 10) : null,
        venue: txt(loc), city: typeof addr === 'string' ? null : addr.addressLocality || null, country: typeof addr === 'string' ? null : txt(addr.addressCountry),
        latitude: loc.geo ? Number(loc.geo.latitude) : null, longitude: loc.geo ? Number(loc.geo.longitude) : null,
        officialEventUrl: n.url || pageUrl, registrationUrl: offers[0] && offers[0].url || null,
        priceMin: prices.length ? Math.min(...prices) : null, priceMax: prices.length ? Math.max(...prices) : null, currency: offers[0] && offers[0].priceCurrency || null,
        organizer: txt([].concat(n.organizer || [])[0]),
        eventStatus: { EventCancelled: 'cancelled', EventPostponed: 'postponed', EventRescheduled: 'scheduled', EventScheduled: 'scheduled' }[status] || null,
        registrationStatus: avail.includes('SoldOut') ? 'sold_out' : avail.includes('InStock') || avail.includes('LimitedAvailability') ? 'open' : avail.includes('PreOrder') ? 'upcoming' : null,
        description: txt(n.description), imageUrl: txt([].concat(n.image || [])[0]),
      });
    }
  }
  return out;
}
export function extractIcs(ics) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, ''), out = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = k => { const m = block.match(new RegExp('^' + k + '(;[^:]*)?:(.*)$', 'm')); return m ? m[2].trim() : null; };
    const d = v => v ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null;
    const s = get('DTSTART'); if (!s) continue;
    out.push({ eventName: get('SUMMARY'), startDate: d(s), endDate: d(get('DTEND')), venue: get('LOCATION'), officialEventUrl: get('URL'), externalIds: get('UID') ? ['ics:' + get('UID')] : [] });
  }
  return out;
}
export function extractSitemapUrls(xml, pattern) { return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]).filter(u => !pattern || new RegExp(pattern).test(u)); }
