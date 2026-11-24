#!/usr/bin/env node
// Construye el catálogo publicado: fuentes manuales + descubiertas → dedup → verificación → agenda → cambios → QA.
// Uso: node events/build.mjs [--today 2026-11-19]
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dedupe } from './lib/dedup.mjs';
import { verify, nextCheck } from './lib/verify.mjs';
import { citySlug, strip, domainOf } from './lib/normalize.mjs';
const DIR = new URL('.', import.meta.url).pathname, OUT = DIR + '../assets/www/data/events.json';
const i = process.argv.indexOf('--today'), today = i > 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
const now = new Date(today + 'T12:00:00Z');
const cfg = JSON.parse(await readFile(DIR + 'sources.json', 'utf8'));
const sourcesByDomain = Object.fromEntries(cfg.officialDomains.map(d => [d, { official: true }]));
const prev = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{"events":[],"changes":[]}'));
const prevById = new Map(prev.events.map(e => [e.id, e]));

const raw = [];
for (const f of (await readdir(DIR + 'manual')).filter(f => f.endsWith('.json'))) raw.push(...JSON.parse(await readFile(DIR + 'manual/' + f, 'utf8')).events.map(e => ({ ...e, sourceName: 'manual:' + f })));
const disc = JSON.parse(await readFile(DIR + '.state/discovered.json', 'utf8').catch(() => '[]'));
raw.push(...disc.map(e => ({ ...e, id: e.id || [e.sport, citySlug(e.city || ''), (e.startDate || '').slice(0, 7), strip(e.eventName).replace(/ /g, '-')].join('-'), dateType: 'official' })));

const review = [];
const valid = raw.filter(e => { const bad = !e.eventName || !e.startDate || !e.sport; if (bad) review.push({ type: 'incomplete', id: e.id, note: 'Falta nombre, fecha o disciplina' }); return !bad; });
const d = dedupe(valid); review.push(...d.review);
const events = d.events.map(e => {
  let v = verify(e, sourcesByDomain, today);
  const sourceUrl = (v.evidence.find(x => x.method !== 'secondary') || v.evidence[0] || {}).url || null;
  v = { ...v, sourceUrl, sourceName: domainOf(sourceUrl), lastVerifiedAt: v.evidence.map(x => x.fetchedAt || x.seenAt).filter(Boolean).sort().pop() || null,
    firstDiscoveredAt: (prevById.get(e.id) || {}).firstDiscoveredAt || e.firstDiscoveredAt || today, verificationNotes: [...new Set([...(e.verificationNotes || []), ...v.verificationNotes])] };
  v.nextCheckAt = nextCheck(v, now);
  if (v.confidenceScore < 50) review.push({ type: 'low_confidence', id: v.id, note: `${v.eventName}: ${v.verificationStatus} (${v.confidenceScore})` });
  if (v.verificationNotes.some(n => /otra fecha/.test(n))) review.push({ type: 'date_conflict', id: v.id, note: v.eventName });
  if (v.lastVerifiedAt && (now - Date.parse(v.lastVerifiedAt)) / 864e5 > 30 && v.eventStatus !== 'completed') review.push({ type: 'stale', id: v.id, note: `Última verificación ${v.lastVerifiedAt}` });
  return v;
}).sort((a, b) => a.startDate.localeCompare(b.startDate));

// Historial de cambios contra la versión publicada anterior.
const changes = [], WATCH = ['startDate', 'endDate', 'venue', 'city', 'registrationStatus', 'eventStatus', 'verificationStatus', 'regulationsUrl', 'resultsUrl', 'priceMin'];
for (const e of events) {
  const p = prevById.get(e.id);
  if (!p) { if (prev.events.length) changes.push({ id: e.id, at: today, type: 'new_event', name: e.eventName }); continue; }
  for (const k of WATCH) if ((p[k] ?? null) !== (e[k] ?? null)) changes.push({ id: e.id, at: today, type: 'field', field: k, from: p[k] ?? null, to: e[k] ?? null, name: e.eventName });
}
const sig = es => JSON.stringify(es.map(({ nextCheckAt, ...x }) => x));
const same = sig(prev.events) === sig(events) && !changes.length;   // sin cambios: no se republica
const catalog = {
  version: 1, generatedAt: same && prev.generatedAt ? prev.generatedAt : now.toISOString(), today: same && prev.today ? prev.today : today,
  disclaimer: 'Catálogo con fuentes. officially_confirmed = leído de la página oficial; verified = visto en la página oficial por otra vía y respaldado; partially_verified = fuentes secundarias coincidentes; unconfirmed = una sola fuente. Las fechas históricas no son fechas futuras.',
  events, review, changes: [...changes, ...(prev.changes || [])].slice(0, 300),
  stats: { events: events.length, bySport: events.reduce((a, e) => (a[e.sport] = (a[e.sport] || 0) + 1, a), {}), byVerification: events.reduce((a, e) => (a[e.verificationStatus] = (a[e.verificationStatus] || 0) + 1, a), {}), review: review.length }
};
await mkdir(DIR + '../assets/www/data', { recursive: true });
await writeFile(OUT, JSON.stringify(catalog));
await writeFile(DIR + 'review.md', `# Cola de control de calidad (${today})\n\n${review.length ? review.map(r => `- **${r.type}** · ${r.note}${r.ids ? ' (' + r.ids.join(', ') + ')' : r.id ? ' (' + r.id + ')' : ''}`).join('\n') : 'Sin pendientes.'}\n`);
console.log(JSON.stringify(catalog.stats), changes.length ? changes.length + ' cambios' : '');
