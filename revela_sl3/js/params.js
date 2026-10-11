// Ajustes de revelado: valores por defecto, rangos de los controles y ajustes
// preestablecidos (estilos de imagen de Canon y recetas para fotos de huevos).

export const HSL_RANGES = [
  { key: 'red', label: 'Rojo', hue: 0 },
  { key: 'orange', label: 'Naranja', hue: 30 },
  { key: 'yellow', label: 'Amarillo', hue: 60 },
  { key: 'green', label: 'Verde', hue: 120 },
  { key: 'aqua', label: 'Aqua', hue: 180 },
  { key: 'blue', label: 'Azul', hue: 225 },
  { key: 'purple', label: 'Púrpura', hue: 275 },
  { key: 'magenta', label: 'Magenta', hue: 320 },
];

const IDENTITY = () => [[0, 0], [1, 1]];

export function defaultParams() {
  return {
    exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
    temperature: 0, tint: 0,
    texture: 0, clarity: 0, dehaze: 0, vibrance: 0, saturation: 0,
    monochrome: false,
    hslHue: [0, 0, 0, 0, 0, 0, 0, 0],
    hslSat: [0, 0, 0, 0, 0, 0, 0, 0],
    hslLum: [0, 0, 0, 0, 0, 0, 0, 0],
    curve: { master: IDENTITY(), r: IDENTITY(), g: IDENTITY(), b: IDENTITY() },
    sharpenAmount: 0, sharpenRadius: 1.0, sharpenMasking: 0,
    nrLuma: 0, nrColor: 0,
    vignette: 0, vignetteMid: 50, grain: 0,
    outputSharpen: 0,
    crop: { x: 0, y: 0, w: 1, h: 1, angle: 0, aspect: 'free' },
    rotate: 0, // cuartos de vuelta (90°) en sentido horario
  };
}

// Controles deslizantes por panel. `scale` = cómo se muestra el número.
export const SLIDERS = {
  basic: [
    { key: 'temperature', label: 'Temperatura', min: -100, max: 100, step: 1, cls: 'temp' },
    { key: 'tint', label: 'Matiz', min: -100, max: 100, step: 1, cls: 'tint' },
    { key: 'exposure', label: 'Exposición', min: -5, max: 5, step: 0.01, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2) },
    { key: 'contrast', label: 'Contraste', min: -100, max: 100, step: 1 },
    { key: 'highlights', label: 'Iluminaciones', min: -100, max: 100, step: 1 },
    { key: 'shadows', label: 'Sombras', min: -100, max: 100, step: 1 },
    { key: 'whites', label: 'Blancos', min: -100, max: 100, step: 1 },
    { key: 'blacks', label: 'Negros', min: -100, max: 100, step: 1 },
  ],
  presence: [
    { key: 'texture', label: 'Textura', min: -100, max: 100, step: 1 },
    { key: 'clarity', label: 'Claridad', min: -100, max: 100, step: 1 },
    { key: 'dehaze', label: 'Neblina', min: -100, max: 100, step: 1 },
    { key: 'vibrance', label: 'Intensidad', min: -100, max: 100, step: 1 },
    { key: 'saturation', label: 'Saturación', min: -100, max: 100, step: 1 },
  ],
  detail: [
    { key: 'sharpenAmount', label: 'Enfoque · Cantidad', min: 0, max: 150, step: 1 },
    { key: 'sharpenRadius', label: 'Enfoque · Radio', min: 0.5, max: 3, step: 0.1, fmt: (v) => v.toFixed(1) },
    { key: 'sharpenMasking', label: 'Enfoque · Máscara', min: 0, max: 100, step: 1 },
    { key: 'nrLuma', label: 'Ruido · Luminancia', min: 0, max: 100, step: 1 },
    { key: 'nrColor', label: 'Ruido · Color', min: 0, max: 100, step: 1 },
    { key: 'outputSharpen', label: 'Nitidez de salida (CAS)', min: 0, max: 100, step: 1 },
  ],
  effects: [
    { key: 'vignette', label: 'Viñeta', min: -100, max: 100, step: 1 },
    { key: 'vignetteMid', label: 'Viñeta · Punto medio', min: 0, max: 100, step: 1 },
    { key: 'grain', label: 'Grano', min: 0, max: 100, step: 1 },
  ],
};

export const ALL_SLIDER_KEYS = Object.values(SLIDERS).flat().map((s) => s.key);

function hsl(entries) {
  const out = { hslHue: [0, 0, 0, 0, 0, 0, 0, 0], hslSat: [0, 0, 0, 0, 0, 0, 0, 0], hslLum: [0, 0, 0, 0, 0, 0, 0, 0] };
  for (const [range, h, s, l] of entries) {
    const i = HSL_RANGES.findIndex((r) => r.key === range);
    out.hslHue[i] = h; out.hslSat[i] = s; out.hslLum[i] = l;
  }
  return out;
}

const softS = { master: [[0, 0], [0.25, 0.22], [0.75, 0.79], [1, 1]] };

// Los ajustes preestablecidos solo indican lo que cambian; el resto vuelve al
// valor por defecto (igual que los ajustes preestablecidos de Lightroom).
export const PRESETS = [
  {
    group: 'Huevos',
    name: 'Huevo blanco · catálogo (fondo claro)',
    patch: {
      exposure: 0.3, highlights: -45, whites: 12, shadows: 15, blacks: -6,
      temperature: -4, texture: 20, clarity: 8, saturation: -5,
      sharpenAmount: 50, sharpenRadius: 0.8, sharpenMasking: 35, nrLuma: 10, nrColor: 15,
    },
  },
  {
    group: 'Huevos',
    name: 'Huevo rojo / marrón · cálido',
    patch: {
      temperature: 8, highlights: -30, shadows: 20, texture: 25, clarity: 10, vibrance: 12,
      ...hsl([['orange', 0, 10, 5], ['red', 2, -5, 0]]),
      sharpenAmount: 45, sharpenRadius: 0.9, sharpenMasking: 30, nrLuma: 8, nrColor: 15,
    },
  },
  {
    group: 'Huevos',
    name: 'Cascarón · textura máxima (macro)',
    patch: {
      highlights: -30, contrast: 6, texture: 40, clarity: 20,
      sharpenAmount: 70, sharpenRadius: 0.7, sharpenMasking: 20, nrLuma: 15, nrColor: 20,
      outputSharpen: 25,
    },
  },
  {
    group: 'Huevos',
    name: 'Yema brillante (huevo frito / platillo)',
    patch: {
      contrast: 10, highlights: -35, shadows: 10, vibrance: 20, texture: 10, clarity: 5, dehaze: 5,
      ...hsl([['yellow', -3, 20, 0], ['orange', 0, 10, 3]]),
      sharpenAmount: 40, sharpenRadius: 1.0, sharpenMasking: 25, nrColor: 15,
    },
  },
  {
    group: 'Huevos',
    name: 'Charola / mayoreo (producto en lote)',
    patch: {
      contrast: 12, highlights: -25, shadows: 12, clarity: 12, dehaze: 8, vibrance: 8,
      sharpenAmount: 45, sharpenRadius: 1.0, sharpenMasking: 25, nrColor: 15,
    },
  },
  // Emulaciones aproximadas de los Estilos de imagen de la SL3. Ojo: el JPEG
  // de la cámara ya trae aplicado el estilo con el que se disparó.
  { group: 'Estilos Canon', name: 'Normal (Standard)', patch: { contrast: 10, vibrance: 10, sharpenAmount: 30 } },
  { group: 'Estilos Canon', name: 'Retrato', patch: { contrast: 5, texture: -10, ...hsl([['orange', 0, -5, 5], ['red', 0, -5, 3]]), sharpenAmount: 20 } },
  { group: 'Estilos Canon', name: 'Paisaje', patch: { contrast: 15, vibrance: 25, clarity: 10, ...hsl([['green', 0, 15, 0], ['blue', 0, 15, -5]]), sharpenAmount: 40 } },
  { group: 'Estilos Canon', name: 'Detalle fino', patch: { texture: 25, clarity: 5, sharpenAmount: 55, sharpenRadius: 0.6, sharpenMasking: 15 } },
  { group: 'Estilos Canon', name: 'Neutro', patch: { contrast: -15, saturation: -10, sharpenAmount: 0 } },
  { group: 'Estilos Canon', name: 'Fiel', patch: { contrast: -8, saturation: -5, temperature: -2 } },
  { group: 'Estilos Canon', name: 'Monocromo', patch: { monochrome: true, contrast: 15, curve: softS } },
];

export function clone(p) {
  return JSON.parse(JSON.stringify(p));
}

export function applyPatch(base, patch) {
  const out = clone(base);
  for (const k of Object.keys(patch || {})) {
    if (k === 'curve') out.curve = { ...out.curve, ...clone(patch.curve) };
    else if (k === 'crop') out.crop = { ...out.crop, ...patch.crop };
    else out[k] = clone(patch[k]);
  }
  return out;
}

export function presetParams(current, preset) {
  // Conserva el recorte: un ajuste preestablecido no debe deshacer el encuadre.
  const p = applyPatch(defaultParams(), preset.patch);
  p.crop = clone(current.crop);
  p.rotate = current.rotate || 0;
  return p;
}

/** Limita cada valor numérico al rango de su control (útil para datos de la IA). */
export function clampToSliders(patch) {
  const out = {};
  const defs = Object.values(SLIDERS).flat();
  for (const [k, v] of Object.entries(patch || {})) {
    const d = defs.find((s) => s.key === k);
    if (!d || typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = Number(Math.min(d.max, Math.max(d.min, Math.round(v / d.step) * d.step)).toFixed(4));
  }
  return out;
}
