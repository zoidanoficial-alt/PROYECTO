/* ENTERGALACTIC móvil — hilo de procesado (Web Worker).
 * Todo el cálculo ocurre aquí para que la interfaz no se trabe.
 */
importScripts('eg-core.js', 'eg-filters.js');
var C = self.EGCore, E = self.EGFilters;
var byId = {}, src = null, cache = {};   // src: {w, h, rgba: Uint8ClampedArray}

function toFloat(rgba, w, h) {
  var a = C.img(w, h, 3), d = a.d;
  for (var i = 0, j = 0; j < d.length; i += 4, j += 3) { d[j] = rgba[i] / 255; d[j + 1] = rgba[i + 1] / 255; d[j + 2] = rgba[i + 2] / 255; }
  return a;
}
function toRGBA(a) {
  var out = new Uint8ClampedArray(a.w * a.h * 4), d = a.d;
  for (var i = 0, j = 0; j < d.length; i += 4, j += 3) {
    out[i] = d[j] * 255 + 0.5; out[i + 1] = d[j + 1] * 255 + 0.5; out[i + 2] = d[j + 2] * 255 + 0.5; out[i + 3] = 255;
  }
  return out;
}
// Imagen de trabajo reducida (se guarda en caché por tamaño).
function working(maxSide) {
  var key = 'm' + maxSide;
  if (cache[key]) return cache[key];
  var full = cache.full || (cache.full = toFloat(src.rgba, src.w, src.h));
  var s = Math.min(1, maxSide / Math.max(src.w, src.h));
  var w = Math.max(1, Math.round(src.w * s)), h = Math.max(1, Math.round(src.h * s));
  var a = s < 1 ? C.resize(full, w, h, 'area') : full;
  cache[key] = { img: a, k: w / src.w };
  return cache[key];
}
function process(work, recipe, intensity, progress) {
  var ctx = new C.Context(work.img.h, work.img.w, work.k, [0, 0, 1, 1], 1, [src.w, src.h]);
  var res = E.runStack(C.clone(work.img), recipe, ctx, byId, progress).img;
  var t = intensity / 100;
  if (t < 0.999 && res.w === work.img.w && res.h === work.img.h) res = C.mix(work.img, res, t);
  return res;
}

self.onmessage = function (ev) {
  var m = ev.data;
  try {
    if (m.type === 'init') {
      m.schema.filters.forEach(function (f) { byId[f.id] = f; });
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'load') {
      var c = new OffscreenCanvas(m.bitmap.width, m.bitmap.height), g = c.getContext('2d');
      g.drawImage(m.bitmap, 0, 0);
      src = { w: c.width, h: c.height, rgba: g.getImageData(0, 0, c.width, c.height).data };
      m.bitmap.close && m.bitmap.close();
      cache = {};
      self.postMessage({ type: 'loaded', w: src.w, h: src.h });
    } else if (m.type === 'preview') {
      if (!src) return;
      var t0 = Date.now(), work = working(m.size), out = process(work, m.recipe, m.intensity);
      var px = toRGBA(out);
      self.postMessage({ type: 'preview', id: m.id, draft: !!m.draft, w: out.w, h: out.h, rgba: px, ms: Date.now() - t0 }, [px.buffer]);
    } else if (m.type === 'original') {
      var wo = working(m.size), po = toRGBA(wo.img);
      self.postMessage({ type: 'original', w: wo.img.w, h: wo.img.h, rgba: po }, [po.buffer]);
    } else if (m.type === 'thumbs') {
      if (!src) return;
      var base = working(160);
      m.items.forEach(function (it) {
        var o = process(base, it.recipe, 100), p2 = toRGBA(o);
        self.postMessage({ type: 'thumb', key: it.key, w: o.w, h: o.h, rgba: p2 }, [p2.buffer]);
      });
    } else if (m.type === 'export') {
      if (!src) return;
      var full = cache.full || toFloat(src.rgba, src.w, src.h);
      cache = {};   // libera memoria antes del procesado grande
      var res = process({ img: full, k: 1 }, m.recipe, m.intensity, function (f, label) {
        self.postMessage({ type: 'progress', f: f, label: label });
      });
      var oc = new OffscreenCanvas(res.w, res.h);
      oc.getContext('2d').putImageData(new ImageData(toRGBA(res), res.w, res.h), 0, 0);
      res = null; full = null;
      oc.convertToBlob({ type: 'image/jpeg', quality: m.quality || 0.95 }).then(function (blob) {
        self.postMessage({ type: 'exported', blob: blob, w: oc.width, h: oc.height });
      });
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: m.id, message: e && e.message ? e.message : String(e) });
  }
};
