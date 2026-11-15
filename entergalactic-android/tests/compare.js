// Compara el motor JavaScript con el motor Python (casos de tools/make_fixtures.py).
const fs = require('fs'), path = require('path');
const C = require('../web/eg-core.js'), E = require('../web/eg-filters.js');
require('../web/eg-filters2.js');
const schema = require('../web/schema.json');
E.setData(schema);
const byId = {}; schema.filters.forEach(f => byId[f.id] = f);
const dir = process.argv[2];
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const read = f => new Float32Array(fs.readFileSync(path.join(dir, f)).buffer.slice(0));
const input = read('input.bin');
// Filtros con componentes aleatorios: el generador de Python (NumPy) no se puede replicar,
// así que se comparan por estadística (media y contraste), no píxel a píxel.
const RANDOM = /filtro:film_profile|filtro:cine_grain|filtro:film_breath|filtro:film_damage|filtro:particles|filtro:paper_sim|receta:(Noche de cine|Luz de día|Neones|Boda|Verano dorado|Diapositiva vívida|Cromo de revista|Reportaje B|B\/N brit|Proyección|Daguerrotipo|Autocromo|Instantánea de los 70|Rayos entre|Bokeh|Nieve|Brasas)|filtro:pop_silkscreen|filtro:pop_grid|receta:Pop · (?!Trama|Cuatri)|Deakins · Frontera|Doyle|Willis|Kamiński|Khondji|Figueroa|Sandgren|grain|dust|light_leak|texture|old_camera|lith_print|instant|Película caducada|Cámara de juguete|Verano|Desechable|Placa|Estenopeica|Negativo escaneado|Clásico 400|Alto contraste|Infrarrojo|Ortocromático|Grano|Cianotipia|Lith|Cine 35|Arkapaw · Juke|Ámbar retro|Crawley|Hoytema · Gran|Plata IMAX|Mar del Norte|Polvo|Fraser|Distopía|Fuego/;
let fails = 0, rows = [];
for (const c of idx) {
  const ref = read(c.file);
  const ctx = new C.Context(120, 160, 1, [0, 0, 1, 1], 1, [160, 120]);
  const t0 = Date.now();
  const out = E.runStack(C.img(160, 120, 3, new Float32Array(input)), c.recipe, ctx, byId).img;
  const ms = Date.now() - t0;
  if (out.w !== c.w || out.h !== c.h) { console.log('TAMAÑO', c.name, out.w, out.h, c.w, c.h); fails++; continue; }
  let mad = 0, mJ = 0, mP = 0;
  for (let i = 0; i < ref.length; i++) { mad += Math.abs(out.d[i] - ref[i]); mJ += out.d[i]; mP += ref[i]; }
  mad /= ref.length; mJ /= ref.length; mP /= ref.length;
  const sJ = C.std(out.d), sP = C.std(ref);
  const random = RANDOM.test(c.name);
  const ok = random ? (Math.abs(mJ - mP) < 0.03 && Math.abs(sJ - sP) < 0.04) : mad < 0.004;   // el desenfoque usa una aproximación de cajas (<0,05 % de error)
  if (!ok) fails++;
  rows.push([ok ? 'ok ' : 'MAL', c.name.padEnd(46), random ? 'estad.' : 'píxel ', 'dif=' + mad.toFixed(4), 'media ' + mJ.toFixed(3) + '/' + mP.toFixed(3), ms + 'ms'].join(' '));
}
rows.forEach(r => { if (process.argv[3] === '-v' || r.startsWith('MAL')) console.log(r); });
console.log(`${idx.length - fails}/${idx.length} casos coinciden con el motor Python`);
process.exit(fails ? 1 : 0);
