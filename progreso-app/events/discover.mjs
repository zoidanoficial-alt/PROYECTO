#!/usr/bin/env node
// Descubrimiento: calendarios oficiales, enlaces a eventos y búsqueda web autorizada (opcional, con API key).
// Uso: node events/discover.mjs [--max-pages 60] [--max-queries 20]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Fetcher } from './lib/fetcher.mjs';
import { extractJsonLd, extractIcs, extractSitemapUrls } from './lib/extract.mjs';
import { classify } from './lib/classify.mjs';
import { domainOf } from './lib/normalize.mjs';
const DIR = new URL('.', import.meta.url).pathname, STATE = DIR + '.state/';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MAX_PAGES = arg('--max-pages', 60), MAX_Q = arg('--max-queries', 20);
await mkdir(STATE, { recursive: true });
const cfg = JSON.parse(await readFile(DIR + 'sources.json', 'utf8'));
const load = async (f, d) => JSON.parse(await readFile(STATE + f, 'utf8').catch(() => JSON.stringify(d)));
const seen = await load('seen.json', {}), found = await load('discovered.json', []);
const catalog = JSON.parse(await readFile(DIR + '../assets/www/data/events.json', 'utf8').catch(() => '{"events":[]}'));
const F = new Fetcher({ cacheDir: STATE + 'cache', logFile: STATE + 'fetch.log' });
const now = new Date().toISOString(), queue = [];
const enqueue = (url, why) => { if (url && !queue.some(q => q.url === url)) queue.push({ url, why }); };
const offDom = new Set(cfg.officialDomains);
const isOff = u => { const d = domainOf(u); return !!d && [...offDom].some(x => d === x || d.endsWith('.' + x)); };

function addEvents(list, url, sourceId, sportHint) {
  for (const x of list) {
    if (!x.startDate || !x.eventName) continue;
    const sport = sportHint && classify(x.eventName) === 'other' ? sportHint : classify(x.eventName + ' ' + (x.description || ''));
    found.push({ ...x, sport, sourceId, sourceUrl: url, firstDiscoveredAt: now, evidence: [{ url, method: 'jsonld', fetchedAt: now, startDate: x.startDate, official: isOff(url) }] });
  }
}
// 1) Fuentes registradas
for (const s of cfg.sources) {
  const body = await F.get(s.url);
  if (!body) continue;
  if (s.kind === 'ics') addEvents(extractIcs(body), s.url, s.id, s.sport);
  else if (s.kind === 'sitemap') extractSitemapUrls(body, s.linkPattern).forEach(u => enqueue(u, s.id));
  else {
    addEvents(extractJsonLd(body, s.url), s.url, s.id, s.sport);
    for (const m of body.matchAll(/href=["']([^"'#]+)["']/g)) { try { const u = new URL(m[1], s.url).href; if (new RegExp(s.linkPattern).test(u)) enqueue(u, s.id); } catch {} }
  }
}
// 2) Re-verificación de eventos cuya revisión ya toca
for (const e of catalog.events || []) if (e.officialEventUrl && e.nextCheckAt && e.nextCheckAt <= now) enqueue(e.officialEventUrl, 'recheck:' + e.id);
// 3) Búsqueda web autorizada (Brave Search API). Sin clave no se busca: no se raspan buscadores.
if (process.env.BRAVE_API_KEY) {
  const year = new Date().getFullYear(), queries = [];
  for (const t of cfg.searchTemplates) for (const p of cfg.searchPlaces) for (const y of [year, year + 1]) {
    if (t.includes('{city}')) p.cities.forEach(c => queries.push(t.replace('{city}', c).replace('{year}', y).replace('{country}', p.country)));
    else queries.push(t.replace('{country}', p.country).replace('{year}', y));
  }
  // Rotación: cada corrida toma las consultas menos recientes.
  const qs = queries.sort((a, b) => (seen['q:' + a] || '').localeCompare(seen['q:' + b] || '')).slice(0, MAX_Q);
  for (const q of qs) {
    try {
      const r = await fetch('https://api.search.brave.com/res/v1/web/search?count=10&q=' + encodeURIComponent(q), { headers: { accept: 'application/json', 'x-subscription-token': process.env.BRAVE_API_KEY } });
      seen['q:' + q] = now;
      if (!r.ok) { await F.log({ search: q, status: r.status }); continue; }
      const j = await r.json();
      for (const res of (j.web && j.web.results) || []) enqueue(res.url, 'search:' + q);
      await new Promise(res => setTimeout(res, 1100));   // límite del plan gratuito: 1 consulta/s
    } catch (e) { await F.log({ search: q, error: e.message }); }
  }
} else await F.log({ search: 'skipped', reason: 'BRAVE_API_KEY no configurada' });
// 4) Páginas de evento: JSON-LD
let n = 0;
for (const q of queue) {
  if (n >= MAX_PAGES) break;
  if (!q.why.startsWith('recheck') && seen[q.url] && Date.parse(seen[q.url]) > Date.now() - 7 * 864e5) continue;
  n++; const body = await F.get(q.url); seen[q.url] = now;
  if (body) addEvents(extractJsonLd(body, q.url), q.url, q.why);
}
// Conserva solo la última evidencia por (URL, evento)
const uniq = found.filter((x, i) => found.findLastIndex(y => y.sourceUrl === x.sourceUrl && y.eventName === x.eventName && y.startDate === x.startDate) === i);
await writeFile(STATE + 'discovered.json', JSON.stringify(uniq, null, 1));
await writeFile(STATE + 'seen.json', JSON.stringify(seen));
console.log(JSON.stringify({ queue: queue.length, pages: n, events: uniq.length, ...F.stats }));
