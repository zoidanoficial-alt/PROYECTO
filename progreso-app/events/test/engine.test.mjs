import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, similarity } from '../lib/dedup.mjs';
import { verify, nextCheck } from '../lib/verify.mjs';
import { citySlug } from '../lib/normalize.mjs';
import { extractJsonLd, extractIcs } from '../lib/extract.mjs';
import { parseRobots, robotsAllows } from '../lib/fetcher.mjs';
import { classify, runDistance } from '../lib/classify.mjs';

const ev = (o) => ({ sport: 'hyrox', city: 'Ciudad de México', startDate: '2027-03-05', evidence: [], ...o });
test('alias de ciudad: CDMX, Ciudad de México y Mexico City son la misma', () => {
  assert.equal(citySlug('CDMX'), 'mexico-city'); assert.equal(citySlug('Ciudad de México'), 'mexico-city'); assert.equal(citySlug('Mexico City'), 'mexico-city');
});
test('HYROX Mexico City / HYROX CDMX / HYROX México: candidatos a duplicado, sin fusión automática', () => {
  const a = ev({ id: 'a', eventName: 'HYROX Mexico City' }), b = ev({ id: 'b', eventName: 'HYROX CDMX', city: 'CDMX' }), c = ev({ id: 'c', eventName: 'HYROX México', city: 'Mexico City', startDate: '2027-03-06' });
  assert.ok(similarity(a, b) >= 0.5); assert.ok(similarity(a, c) >= 0.5);
  const r = dedupe([a, b, c]);
  assert.equal(r.events.length, 3); assert.equal(r.review.filter(x => x.type === 'possible_duplicate').length, 3);
});
test('misma URL oficial: se fusiona y conserva alias y evidencia', () => {
  const a = ev({ id: 'a', eventName: 'HYROX Mexico City', officialEventUrl: 'https://hyrox.com/event/hyrox-mexico-city/', evidence: [{ url: 'https://x.com/1', method: 'secondary' }] });
  const b = ev({ id: 'b', eventName: 'COMMANDO HYROX CDMX', officialEventUrl: 'https://www.hyrox.com/event/hyrox-mexico-city', venue: 'Centro Citibanamex', evidence: [{ url: 'https://y.com/2', method: 'secondary' }] });
  const r = dedupe([a, b]);
  assert.equal(r.events.length, 1); assert.equal(r.events[0].venue, 'Centro Citibanamex'); assert.equal(r.events[0].evidence.length, 2); assert.ok(r.events[0].aliases.includes('COMMANDO HYROX CDMX'));
});
test('mismas ciudad y fecha pero otro deporte o fechas lejanas: no es duplicado', () => {
  assert.equal(similarity(ev({ eventName: 'HYROX Monterrey', city: 'Monterrey' }), ev({ eventName: 'HYROX Monterrey', city: 'Monterrey', startDate: '2027-05-20' })), 0);
  assert.equal(similarity(ev({ eventName: 'Maratón Monterrey', city: 'Monterrey' }), ev({ sport: 'running', eventName: 'Maratón Monterrey', city: 'Monterrey' })), 0);
});
test('verificación: solo la página oficial leída da "officially_confirmed"', () => {
  const base = ev({ eventName: 'HYROX X', startDate: '2027-04-01' });
  assert.equal(verify({ ...base, evidence: [{ url: 'https://blog.com/a', method: 'secondary', startDate: '2027-04-01' }] }, {}, '2026-11-19').verificationStatus, 'unconfirmed');
  assert.equal(verify({ ...base, evidence: [{ url: 'https://blog.com/a', method: 'secondary' }, { url: 'https://news.mx/b', method: 'secondary' }] }, {}, '2026-11-19').verificationStatus, 'partially_verified');
  assert.equal(verify({ ...base, officialEventUrl: 'https://hyrox.com/event/x', evidence: [{ url: 'https://hyrox.com/event/x', method: 'snippet' }] }, {}, '2026-11-19').verificationStatus, 'verified');
  assert.equal(verify({ ...base, evidence: [{ url: 'https://hyrox.com/event/x', method: 'jsonld', startDate: '2027-04-01' }] }, {}, '2026-11-19').verificationStatus, 'officially_confirmed');
});
test('fuentes con otra fecha bajan la confianza y fecha pasada = finalizado', () => {
  const v = verify(ev({ eventName: 'HYROX X', evidence: [{ url: 'https://a.com', method: 'secondary', startDate: '2027-03-05' }, { url: 'https://b.com', method: 'secondary', startDate: '2027-03-12' }] }), {}, '2026-11-19');
  assert.ok(v.confidenceScore < 35); assert.ok(v.verificationNotes.some(n => /otra fecha/.test(n)));
  assert.equal(verify(ev({ eventName: 'Y', startDate: '2026-01-01' }), {}, '2026-11-19').eventStatus, 'completed');
  assert.equal(verify(ev({ eventName: 'Y', startDate: '2026-01-01', dateType: 'historical' }), {}, '2026-11-19').eventStatus, 'completed');
});
test('frecuencia de revisión según estado', () => {
  const now = new Date('2026-11-19T12:00:00Z'), days = iso => Math.round((Date.parse(iso) - now) / 864e5);
  assert.equal(days(nextCheck({ startDate: '2026-11-25', eventStatus: 'scheduled' }, now)), 1);
  assert.equal(days(nextCheck({ startDate: '2027-06-01', registrationStatus: 'open' }, now)), 3);
  assert.equal(days(nextCheck({ startDate: '2027-06-01', verificationStatus: 'unconfirmed' }, now)), 7);
  assert.equal(days(nextCheck({ startDate: '2027-06-01', verificationStatus: 'officially_confirmed' }, now)), 14);
  assert.equal(nextCheck({ startDate: '2026-01-01', eventStatus: 'completed' }, now), null);
});
test('JSON-LD schema.org: evento, sede, precios y disponibilidad', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"SportsEvent","name":"HYROX Test","startDate":"2027-05-01T08:00","endDate":"2027-05-02","eventStatus":"https://schema.org/EventScheduled","location":{"@type":"Place","name":"Arena","address":{"addressLocality":"Monterrey","addressCountry":"MX"},"geo":{"latitude":25.6,"longitude":-100.3}},"offers":[{"price":"1500","priceCurrency":"MXN","availability":"https://schema.org/InStock","url":"https://t.com/buy"},{"price":"2500","priceCurrency":"MXN"}]}]}</script>`;
  const [e] = extractJsonLd(html, 'https://hyrox.com/event/test');
  assert.equal(e.startDate, '2027-05-01'); assert.equal(e.city, 'Monterrey'); assert.equal(e.priceMin, 1500); assert.equal(e.priceMax, 2500); assert.equal(e.registrationStatus, 'open'); assert.equal(e.registrationUrl, 'https://t.com/buy');
});
test('iCalendar y robots.txt', () => {
  const [e] = extractIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:42\nSUMMARY:10K Nocturna\nDTSTART;VALUE=DATE:20270320\nLOCATION:Puebla\nEND:VEVENT\nEND:VCALENDAR');
  assert.equal(e.startDate, '2027-03-20'); assert.deepEqual(e.externalIds, ['ics:42']);
  const rules = parseRobots('User-agent: *\nDisallow: /admin\nAllow: /admin/public\n\nUser-agent: Other\nDisallow: /');
  assert.equal(robotsAllows(rules, '/events'), true); assert.equal(robotsAllows(rules, '/admin/x'), false); assert.equal(robotsAllows(rules, '/admin/public/a'), true);
});
test('clasificación por disciplina en español e inglés', () => {
  assert.equal(classify('IRONMAN 70.3 Los Cabos'), 'triathlon'); assert.equal(classify('Medio Maratón de Guadalajara'), 'running');
  assert.equal(classify('NPC Wellness Classic'), 'bodybuilding'); assert.equal(classify('Spartan Super CDMX'), 'fitness_race'); assert.equal(classify('Powerlifting Open'), 'strength');
  assert.equal(runDistance('Medio Maratón'), '21K'); assert.equal(runDistance('Carrera 10K nocturna'), '10K');
});
