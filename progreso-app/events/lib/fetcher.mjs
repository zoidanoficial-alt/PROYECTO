// HTTP responsable: robots.txt, límite por host, caché con ETag, reintentos con backoff y log.
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const UA = 'HyroxLabEventsBot/1.0 (+https://github.com/zoidanoficial-alt/PROYECTO)';
export class Fetcher {
  constructor({ cacheDir, logFile, minIntervalMs = 2000, maxRetries = 3 } = {}) { Object.assign(this, { cacheDir, logFile, minIntervalMs, maxRetries }); this.last = new Map(); this.robots = new Map(); this.stats = { requests: 0, cached: 0, blocked: 0, errors: 0 }; }
  async log(o) { if (this.logFile) await appendFile(this.logFile, JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n').catch(() => {}); }
  async wait(host) { const prev = this.last.get(host) || 0, d = prev + this.minIntervalMs - Date.now(); if (d > 0) await new Promise(r => setTimeout(r, d)); this.last.set(host, Date.now()); }
  async allowed(url) {
    const u = new URL(url);
    if (!this.robots.has(u.host)) {
      let rules = [];
      try { const r = await fetch(`${u.protocol}//${u.host}/robots.txt`, { headers: { 'user-agent': UA } }); if (r.ok) rules = parseRobots(await r.text()); } catch {}
      this.robots.set(u.host, rules);
    }
    return robotsAllows(this.robots.get(u.host), u.pathname);
  }
  async get(url) {
    if (!(await this.allowed(url))) { this.stats.blocked++; await this.log({ url, skip: 'robots.txt' }); return null; }
    const key = createHash('sha1').update(url).digest('hex'), file = this.cacheDir && `${this.cacheDir}/${key}.json`;
    let cached = null; if (file) cached = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
    const host = new URL(url).host;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.wait(host); this.stats.requests++;
      try {
        const h = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/calendar,application/xml;q=0.9,*/*;q=0.5' };
        if (cached && cached.etag) h['if-none-match'] = cached.etag; if (cached && cached.lastModified) h['if-modified-since'] = cached.lastModified;
        const r = await fetch(url, { headers: h, redirect: 'follow' });
        if (r.status === 304 && cached) { this.stats.cached++; await this.log({ url, status: 304 }); return cached.body; }
        if (r.status === 429 || r.status >= 500) { const ra = Number(r.headers.get('retry-after')) || 0; await this.log({ url, status: r.status, attempt }); await new Promise(res => setTimeout(res, Math.max(ra * 1000, 1000 * 2 ** attempt))); continue; }
        if (!r.ok) { this.stats.errors++; await this.log({ url, status: r.status }); return null; }
        const body = await r.text();
        if (file) { await mkdir(this.cacheDir, { recursive: true }); await writeFile(file, JSON.stringify({ url, etag: r.headers.get('etag'), lastModified: r.headers.get('last-modified'), body })); }
        await this.log({ url, status: r.status, bytes: body.length });
        return body;
      } catch (e) { await this.log({ url, error: e.message, attempt }); await new Promise(res => setTimeout(res, 1000 * 2 ** attempt)); }
    }
    this.stats.errors++; return null;
  }
}
export function parseRobots(text) {
  const rules = []; let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'), v = rest.join(':').trim(), key = k.trim().toLowerCase();
    if (key === 'user-agent') applies = v === '*' || /hyroxlab/i.test(v);
    else if (applies && (key === 'disallow' || key === 'allow') && v) rules.push({ allow: key === 'allow', path: v });
  }
  return rules;
}
export function robotsAllows(rules, path) {
  let best = null;
  for (const r of rules || []) { const p = r.path.replace(/\*.*$/, ''); if (path.startsWith(p) && (!best || p.length > best.p.length)) best = { p, allow: r.allow }; }
  return !best || best.allow;
}
