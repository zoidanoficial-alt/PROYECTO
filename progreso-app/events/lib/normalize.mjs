// Normalización de nombres, ciudades y países para comparar eventos escritos de forma distinta.
export const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Alias de ciudades: la clave es el slug canónico.
export const CITY_ALIASES = {
  'mexico-city': ['cdmx', 'ciudad de mexico', 'mexico city', 'mexico df', 'df', 'mexico d f', 'ciudad de mexico cdmx', 'mexico'],
  'monterrey': ['monterrey', 'mty', 'monterrey nuevo leon'],
  'guadalajara': ['guadalajara', 'gdl', 'zapopan'],
  'cancun': ['cancun', 'cancun quintana roo'],
  'merida': ['merida', 'merida yucatan'],
  'los-cabos': ['los cabos', 'cabo san lucas', 'san jose del cabo'],
  'hong-kong': ['hong kong', 'hongkong'],
  'new-york': ['new york', 'nyc', 'new york city'],
};
const CITY_INDEX = Object.fromEntries(Object.entries(CITY_ALIASES).flatMap(([k, vs]) => vs.map(v => [v, k])));
export function citySlug(city) { const s = strip(city); return CITY_INDEX[s] || s.replace(/ /g, '-'); }

// Palabras que no identifican al evento (patrocinadores, años, ediciones).
const NOISE = new Set(['puma', 'commando', 'smart', 'fit', 'telcel', 'the', 'el', 'la', 'de', 'del', 'of', 'season', 'temporada', 'edicion', 'edition', 'race', 'carrera', 'weekend']);
export function nameTokens(name, city) {
  const cityWords = new Set(strip(city).split(' '));
  (CITY_ALIASES[citySlug(city)] || []).forEach(a => a.split(' ').forEach(w => cityWords.add(w)));
  return strip(name).split(' ').filter(w => w && !NOISE.has(w) && !cityWords.has(w)
    && !/^\d{4}$/.test(w) && !/^\d{2}$/.test(w) && !(/^[a-z0-9]{6}$/.test(w) && /\d/.test(w) && /[a-z]/.test(w)));
}
export function jaccard(a, b) { const A = new Set(a), B = new Set(b); if (!A.size && !B.size) return 1; let i = 0; A.forEach(x => B.has(x) && i++); return i / (A.size + B.size - i); }
export const daysApart = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);
export function eventKey(e) { return [e.sport, citySlug(e.city), (e.startDate || '').slice(0, 7), nameTokens(e.eventName, e.city).sort().join('-')].join('|'); }
export function canonicalUrl(u) { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase(); } catch { return null; } }
export function domainOf(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } }
