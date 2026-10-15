import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, acceptDownloads: true, permissions: ['geolocation'], geolocation: { latitude: 19.4326, longitude: -99.1332, accuracy: 5 } });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(300);
await page.click('nav button[data-tab=train]'); await page.click('[data-tmode="running"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'v16-running-empty.png', fullPage: true });
// 1) Real geolocation wiring
await page.click('#rn-free'); await page.waitForTimeout(1500);
await ctx.setGeolocation({ latitude: 19.43266, longitude: -99.1332, accuracy: 5 }); await page.waitForTimeout(1500);
console.log('watchPosition points received:', await page.evaluate(() => RUN.st.pts.length), '| acc:', await page.evaluate(() => RUN.st.acc));
await page.evaluate(() => discardRun());
// 2) Synthetic 3.2 km track with noise, an outlier and weak points
const track = await page.evaluate(() => {
  startRun({ title: 'Prueba' }); const st = RUN.st; const lat0 = 19.4, lon0 = -99.1, mPerDegLat = 111320;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const pts = [];
  for (let s = 0; s <= 1067; s += 1) {   // 3 m/s * 1067 s ≈ 3200 m, a 1 Hz
    const m = s * 3, lat = lat0 + (m + gauss() * 2) / mPerDegLat, lon = lon0 + gauss() * 2 / (mPerDegLat * Math.cos(lat0 * Math.PI / 180));
    let acc = 5; if (s % 97 === 0 && s) acc = 40;   // puntos débiles
    let la = lat; if (s === 500) la += 250 / mPerDegLat;   // salto de 250 m
    pts.push({ lat: la, lon, acc, t: st.start + s * 1000 });
  }
  pts.forEach(p => ingestPoint(p));
  return { dist: st.dist, splits: st.splits.slice(), weak: st.weak, n: st.pts.length, raw: pts };
});
console.log('synthetic: dist', Math.round(track.dist), 'm (expected 3201, err', (Math.abs(track.dist - 3201) / 3201 * 100).toFixed(1) + '%) | splits', JSON.stringify(track.splits), '| weak discarded', track.weak);
await page.screenshot({ path: 'v16-live.png' });
// 3) Reload during run -> recovery
await page.reload(); await page.waitForTimeout(500);
console.log('recovered after reload:', await page.evaluate(() => !!RUN.st && RUN.st.title), '| live view:', await page.isVisible('.run-live'));
// 4) Finish -> summary, records
await page.click('#rl-stop'); await page.waitForTimeout(400);
await page.screenshot({ path: 'v16-summary.png' });
await page.click('#rs-ok'); await page.waitForTimeout(200);
console.log('saved run:', await page.evaluate(() => JSON.stringify({ km: DB.runs[0].km, splits: DB.runs[0].splits.length, best1: DB.runs[0].best[1], dur: DB.runs[0].dur })));
// 5) GPX import of the same raw track (clean, no noise extras)
const gpx = '<?xml version="1.0"?><gpx version="1.1"><trk><name>Desde reloj</name><trkseg>' + track.raw.filter(p => p.acc < 25).map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.t).toISOString()}</time></trkpt>`).join('') + '</trkseg></trk></gpx>';
fs.writeFileSync('run.gpx', gpx);
await page.click('nav button[data-tab=train]'); await page.waitForTimeout(200);
await page.setInputFiles('#rn-gpx-file', 'run.gpx'); await page.waitForTimeout(400);
console.log('gpx import:', await page.evaluate(() => JSON.stringify({ km: DB.runs[1].km, title: DB.runs[1].title, splits: DB.runs[1].splits.length })));
await page.click('#rs-ok'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
await page.screenshot({ path: 'v16-running.png', fullPage: true });
await page.locator('[data-run]').first().click(); await page.waitForTimeout(400);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rd-gpx')]);
const out = fs.readFileSync(await dl.path(), 'utf8');
console.log('gpx export points:', (out.match(/<trkpt/g) || []).length);
await page.screenshot({ path: 'v16-detail.png' });
console.log('active days include run:', await page.evaluate(() => activeDates().has(todayStr())));
console.log('ERRORS', JSON.stringify(errors)); await b.close();
