// Datos de la Canon EOS Rebel SL3 (EOS 250D / 200D II / Kiss X10) que usa el
// asesor. Fuente: manual de instrucciones de la cámara y ficha técnica.

export const SL3 = {
  names: ['EOS Rebel SL3', 'EOS 250D', 'EOS 200D II', 'EOS 200D Mark II', 'EOS Kiss X10'],
  sensor: { width: 6000, height: 4000, mp: 24.1, crop: 1.6, pixelPitchUm: 3.72 },
  // Tamaños de "Calidad de imagen" (3:2).
  sizes: {
    L: [6000, 4000],
    M: [3984, 2656],
    S1: [2976, 1984],
    S2: [2400, 1600],
  },
  isoNative: [100, 25600],
  isoExpanded: 51200,
  // A partir de f/8 aprox. la difracción empieza a ablandar el detalle a 24 MP
  // en APS-C (límite ~f/6 por tamaño de píxel; f/8 es buen compromiso).
  diffractionF: 8,
  kitLens: { name: 'EF-S 18-55mm f/4-5.6 IS STM', minFocusM: 0.25, maxMag: 0.38 },
  macroLenses: ['EF-S 35mm f/2.8 Macro IS STM', 'EF-S 60mm f/2.8 Macro USM', 'EF 100mm f/2.8L Macro IS USM'],
};

export function isSL3(exif = {}) {
  const m = `${exif.make || ''} ${exif.model || ''}`.toUpperCase();
  return /SL3|250D|200D II|200D MARK II|KISS X10\b/.test(m);
}

export function detectSize(width, height) {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  for (const [k, [w, h]] of Object.entries(SL3.sizes)) {
    if (Math.abs(long - w) <= 16 && Math.abs(short - h) <= 16) return k;
  }
  return null;
}

export function formatShutter(t) {
  if (!t) return '—';
  if (t >= 0.3) return `${Number(t.toFixed(1))}"`;
  return `1/${Math.round(1 / t)}`;
}

export const PROGRAMS = {
  0: '—', 1: 'Manual (M)', 2: 'Programa (P)', 3: 'Prioridad a la abertura (Av)', 4: 'Prioridad al obturador (Tv)',
  5: 'Creativo', 6: 'Acción', 7: 'Retrato', 8: 'Paisaje',
};
