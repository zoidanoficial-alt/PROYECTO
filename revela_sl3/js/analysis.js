// Análisis numérico de la imagen. Funciones puras (sin DOM) para poder
// probarlas en Node. Las imágenes son {data: RGBA, width, height}.

const LW = [0.2126, 0.7152, 0.0722];
const toLin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// --- Balance de blancos: mismas constantes que el shader ---
export function wbMultipliers(temperature, tint) {
  const T = temperature / 100;
  const Ti = tint / 100;
  const m = [1 + 0.35 * T, 1 - 0.25 * Ti, 1 - 0.35 * T];
  const n = m[0] * LW[0] + m[1] * LW[1] + m[2] * LW[2];
  return m.map((v) => v / n);
}

/** Temperatura/matiz que vuelven neutro un color sRGB (0-255) muestreado. */
export function wbFromNeutral(r, g, b) {
  const R = toLin(r);
  const G = Math.max(1e-4, toLin(g));
  const B = toLin(b);
  let T = (B - R) / (0.35 * Math.max(1e-4, R + B));
  T = Math.max(-1, Math.min(1, T));
  const mr = 1 + 0.35 * T;
  let Ti = (1 - (R * mr) / G) / 0.25;
  Ti = Math.max(-1, Math.min(1, Ti));
  return { temperature: Math.round(T * 100), tint: Math.round(Ti * 100) };
}

function grayscale(img) {
  const { data, width, height } = img;
  const g = new Float32Array(width * height);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    g[i] = data[j] * LW[0] + data[j + 1] * LW[1] + data[j + 2] * LW[2];
  }
  return g;
}

export function histogram(img) {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    r[d[i]]++; g[d[i + 1]]++; b[d[i + 2]]++;
    l[Math.round(d[i] * LW[0] + d[i + 1] * LW[1] + d[i + 2] * LW[2])]++;
  }
  return { r, g, b, l, total: d.length / 4 };
}

function percentile(hist, total, q) {
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= total * q) return i / 255;
  }
  return 1;
}

export function toneStats(img) {
  const h = histogram(img);
  const d = img.data;
  let sum = 0;
  let clipHigh = 0;
  for (let i = 0; i < d.length; i += 4) {
    const L = d[i] * LW[0] + d[i + 1] * LW[1] + d[i + 2] * LW[2];
    sum += L;
    if (d[i] >= 250 || d[i + 1] >= 250 || d[i + 2] >= 250) clipHigh++;
  }
  let clipLow = 0;
  for (let i = 0; i <= 4; i++) clipLow += h.l[i];
  return {
    mean: sum / h.total / 255,
    p01: percentile(h.l, h.total, 0.01),
    p25: percentile(h.l, h.total, 0.25),
    p50: percentile(h.l, h.total, 0.5),
    p99: percentile(h.l, h.total, 0.99),
    clipHigh: clipHigh / h.total,
    clipLow: clipLow / h.total,
    histogram: h,
  };
}

/**
 * Nitidez: varianza del laplaciano por mosaicos. La mejor zona representa
 * al sujeto enfocado; la mediana, a la foto completa.
 */
export function sharpness(img, grid = 6) {
  const { width: w, height: h } = img;
  const g = grayscale(img);
  const tw = Math.floor(w / grid);
  const th = Math.floor(h / grid);
  const tiles = [];
  for (let ty = 0; ty < grid; ty++) {
    for (let tx = 0; tx < grid; tx++) {
      let s = 0;
      let s2 = 0;
      let n = 0;
      const x0 = Math.max(1, tx * tw);
      const y0 = Math.max(1, ty * th);
      const x1 = Math.min(w - 1, (tx + 1) * tw);
      const y1 = Math.min(h - 1, (ty + 1) * th);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * w + x;
          const lap = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
          s += lap;
          s2 += lap * lap;
          n++;
        }
      }
      const v = n ? s2 / n - (s / n) ** 2 : 0;
      tiles.push({ x: tx, y: ty, v });
    }
  }
  const sorted = [...tiles].sort((a, b) => a.v - b.v);
  const best = sorted[sorted.length - 1];
  return { best: best.v, bestTile: { x: best.x, y: best.y, grid }, median: sorted[Math.floor(sorted.length / 2)].v };
}

/** Estimación de ruido (Immerkær 1996) ignorando bordes. Sigma en niveles 0-255. */
export function noiseSigma(img) {
  const { width: w, height: h } = img;
  const g = grayscale(img);
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      const gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
      if (Math.abs(gx) + Math.abs(gy) > 40) continue; // borde: no es ruido
      const v = g[i - w - 1] - 2 * g[i - w] + g[i - w + 1] - 2 * g[i - 1] + 4 * g[i] - 2 * g[i + 1] +
        g[i + w - 1] - 2 * g[i + w] + g[i + w + 1];
      sum += Math.abs(v);
      n++;
    }
  }
  if (!n) return 0;
  return Math.sqrt(Math.PI / 2) * (sum / n) / 6;
}

/**
 * Dominante de color con el método de "parche blanco": entre los píxeles casi
 * neutros y no quemados, se usan los más claros (el cascarón blanco suele ser
 * lo más claro y neutro de la escena; un fondo crema queda por debajo).
 */
export function colorCast(img) {
  const d = img.data;
  const cand = [];
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let total = 0;
  for (let i = 0; i < d.length; i += 16) {
    const R = d[i];
    const G = d[i + 1];
    const B = d[i + 2];
    ar += R; ag += G; ab += B; total++;
    const mx = Math.max(R, G, B);
    const mn = Math.min(R, G, B);
    const L = (R * LW[0] + G * LW[1] + B * LW[2]) / 255;
    if (L > 0.35 && mx < 250 && mx > 0 && (mx - mn) / mx < 0.2) cand.push([L, R, G, B]);
  }
  const useNeutral = cand.length > total * 0.01;
  let rgb;
  if (useNeutral) {
    cand.sort((x, y) => y[0] - x[0]);
    const top = cand.slice(0, Math.max(1, Math.floor(cand.length * 0.15)));
    rgb = [1, 2, 3].map((k) => top.reduce((acc, c) => acc + c[k], 0) / top.length);
  } else {
    rgb = [ar / total, ag / total, ab / total];
  }
  const suggestion = wbFromNeutral(...rgb);
  return { rgb, fromNeutral: useNeutral, coverage: cand.length / total, ...suggestion };
}

export function analyze(img) {
  return {
    tone: toneStats(img),
    sharp: sharpness(img),
    noise: noiseSigma(img),
    cast: colorCast(img),
    width: img.width,
    height: img.height,
  };
}

/**
 * Ajuste automático de tonos a partir de las estadísticas de la foto original.
 * Respeta las escenas claras (huevo blanco sobre fondo blanco): no las lleva a
 * gris medio, que es justo el error del exposímetro que queremos evitar.
 */
export function autoTone(tone) {
  const patch = { exposure: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, contrast: 0 };
  const highKey = tone.p50 > 0.6;
  let ev = 0;
  if (tone.p50 < 0.42) {
    const meanLin = Math.max(1e-3, toLin(tone.p50 * 255));
    ev = Math.log2(toLin(0.46 * 255) / meanLin) * 0.75;
    const headroom = Math.log2(1 / Math.max(0.05, toLin(tone.p99 * 255)));
    ev = Math.min(ev, headroom + 0.3);
  }
  if (tone.clipHigh > 0.01) ev = Math.min(ev, tone.clipHigh > 0.05 ? -0.3 : -0.1);
  patch.exposure = Math.round(Math.max(-2, Math.min(2, ev)) * 100) / 100;
  if (tone.clipHigh > 0.002 || tone.p99 > 0.96) patch.highlights = -Math.round(Math.min(60, 25 + tone.clipHigh * 600));
  if (tone.p25 < 0.2) patch.shadows = Math.round(Math.min(45, (0.2 - tone.p25) * 220 + 10));
  const p99after = toSrgb(Math.min(1, toLin(tone.p99 * 255) * 2 ** patch.exposure));
  if (p99after < 0.9) patch.whites = Math.round(Math.min(40, (0.95 - p99after) * 180));
  if (!highKey && tone.p01 > 0.06) patch.blacks = -Math.round(Math.min(30, (tone.p01 - 0.03) * 250));
  if (!highKey && tone.p50 > 0.2 && tone.p99 - tone.p01 < 0.6) {
    patch.contrast = Math.round(Math.min(25, (0.6 - (tone.p99 - tone.p01)) * 60));
  }
  return patch;
}
