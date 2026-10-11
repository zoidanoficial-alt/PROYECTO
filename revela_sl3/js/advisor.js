// Asesor experto (sin conexión): revisa EXIF + análisis de la foto y "dicta"
// cómo mejorar la resolución y la calidad de fotos de huevos con la SL3.

import { SL3, isSL3, detectSize, formatShutter } from './sl3.js';
import { autoTone } from './analysis.js';

export const SUBJECTS = {
  blanco: 'Huevo blanco',
  rojo: 'Huevo rojo / marrón',
  comida: 'Huevo cocinado / platillo',
  general: 'Otro tema',
};

function nrForIso(iso) {
  if (!iso || iso <= 200) return { nrLuma: 0, nrColor: 10 };
  if (iso <= 400) return { nrLuma: 8, nrColor: 15 };
  if (iso <= 800) return { nrLuma: 15, nrColor: 20 };
  if (iso <= 1600) return { nrLuma: 25, nrColor: 25 };
  if (iso <= 3200) return { nrLuma: 38, nrColor: 30 };
  return { nrLuma: 50, nrColor: 40 };
}

/**
 * @param {object} ctx
 *   exif, analysis (de la foto original), fileSize, fileType ('cr3'|'jpeg'|'otro'),
 *   width, height (originales), subject (clave de SUBJECTS)
 */
export function advise(ctx) {
  const { exif = {}, analysis: a, subject = 'blanco' } = ctx;
  const items = [];
  const patch = {};
  const add = (level, area, title, text) => items.push({ level, area, title, text });
  const eggs = subject !== 'general';
  const sl3 = isSL3(exif);
  const W = Math.max(ctx.width, ctx.height);
  const H = Math.min(ctx.width, ctx.height);
  const mp = (W * H) / 1e6;

  // ---------------- Resolución ----------------
  const size = detectSize(W, H);
  if (size && size !== 'L') {
    add('alerta', 'Resolución', `Estás disparando en tamaño ${size} (${W}×${H}, ${mp.toFixed(1)} MP)`,
      'Pierdes resolución desde la cámara. En el Menú de disparo, en Calidad de imagen, elige L (6000×4000, 24 MP) o RAW+L. Ningún programa recupera los píxeles que la cámara no guardó.');
  } else if (!size && mp < 20) {
    add('mejora', 'Resolución', `La foto tiene ${mp.toFixed(1)} MP`,
      sl3 ? 'Parece recortada o reducida. Para máximo detalle dispara en L o RAW y encuadra en cámara en lugar de recortar después.'
        : 'Para máximo detalle usa el tamaño máximo de tu cámara (en la SL3: L, 24 MP).');
  } else {
    add('bien', 'Resolución', `Resolución completa (${W}×${H})`, 'Estás usando todos los píxeles del sensor de 24 MP.');
  }

  if (ctx.fileType === 'jpeg' && W * H > 0) {
    const bpp = ctx.fileSize / (W * H);
    if (bpp < 0.2) {
      add('mejora', 'Resolución', 'JPEG con compresión alta',
        'El archivo pesa poco para su tamaño: probablemente calidad "Normal" (icono escalonado). En Calidad de imagen usa la opción Fina (icono de cuarto de círculo liso) o RAW+L: la compresión borra la textura fina del cascarón.');
    }
  }
  if (ctx.fileType === 'cr3') {
    add('bien', 'Resolución', 'Archivo RAW (CR3)',
      'La app edita el JPEG de alta calidad que la cámara guarda dentro del CR3. Conserva el CR3: para revelados extremos puedes abrirlo también en Digital Photo Professional (gratuito de Canon).');
  }

  // Encuadre / magnificación: lo que más resolución da sobre el huevo.
  if (eggs && exif.focalLength) {
    const f = exif.focalLength;
    if (f < 40) {
      add('mejora', 'Resolución', `Focal de ${Math.round(f)} mm: el huevo ocupa pocos píxeles`,
        `Gira el zoom a 55 mm y acércate hasta la distancia mínima de enfoque (${SL3.kitLens.minFocusM * 100} cm desde el sensor con el ${SL3.kitLens.name}). Así un huevo casi llena el cuadro y los 24 MP quedan sobre el cascarón. Recortar después tira megapíxeles.`);
    } else {
      add('bien', 'Resolución', `Focal de ${Math.round(f)} mm (${Math.round(f * SL3.sensor.crop)} mm equiv.)`,
        'Buena distancia focal para producto. Llena el encuadre con el huevo en lugar de recortar después.');
    }
  }
  if (eggs) {
    add('mejora', 'Resolución', 'Para aún más detalle: lente macro',
      `Un ${SL3.macroLenses[0]} o ${SL3.macroLenses[1]} permite que un solo huevo llene el cuadro a 1:1 y muestre los poros del cascarón. Alternativa económica: tubos de extensión o un filtro de acercamiento (+2/+4) en el lente del kit.`);
  }

  // ---------------- Cámara ----------------
  const iso = exif.iso;
  if (iso) {
    if (iso > 1600) {
      add('alerta', 'Cámara', `ISO ${iso}: mucho ruido`,
        'El ruido se come el detalle fino. Un huevo no se mueve: usa tripié e ISO 100 y deja que la velocidad sea lenta.');
    } else if (iso > 400) {
      add('mejora', 'Cámara', `ISO ${iso}`, 'Con tripié baja a ISO 100–200 para la máxima limpieza y detalle.');
    } else {
      add('bien', 'Cámara', `ISO ${iso}`, 'ISO bajo: máxima calidad de imagen.');
    }
  }

  const t = exif.exposureTime;
  const f = exif.focalLength;
  const blurry = a && a.sharp.best < 60;
  const soft = a && a.sharp.best < 150;
  if (t && f) {
    const limit = 1 / (f * SL3.sensor.crop);
    if (t > limit) {
      add(blurry ? 'alerta' : 'mejora', 'Cámara', `Velocidad ${formatShutter(t)} a pulso es riesgosa`,
        `A ${Math.round(f)} mm la regla segura a pulso es ${formatShutter(limit)} o más rápido. Pon la cámara en tripié y usa el autodisparador de 2 s (Modo de avance) o dispara desde el celular con Camera Connect para no mover la cámara al presionar.`);
    }
  }

  const fn = exif.fNumber;
  if (fn) {
    if (fn > 11) {
      add('alerta', 'Cámara', `Abertura f/${fn}: difracción`,
        'A partir de f/11 la difracción ablanda el detalle en un sensor de 24 MP. Usa f/8 (el punto más nítido del lente del kit) y activa Corrección de difracción en Corrección de aberración del objetivo.');
    } else if (eggs && fn < 5.6) {
      add('mejora', 'Cámara', `Abertura f/${fn}: poca profundidad de campo`,
        'De cerca, a f/4–f/5.6 solo una franja del huevo queda nítida. Cierra a f/8 en modo Av para que el cascarón esté enfocado de frente a atrás.');
    } else {
      add('bien', 'Cámara', `Abertura f/${fn}`, 'Buen punto de nitidez para producto.');
    }
  }

  if (a) {
    if (blurry) {
      add('alerta', 'Cámara', 'La foto está desenfocada o movida',
        'Ni la zona más nítida tiene detalle. Usa Visión directa (Live View), cambia a enfoque manual (MF) y amplía la imagen 5x/10x en pantalla para enfocar justo en el borde del cascarón. Con AF: elige "AF de punto único" y apúntalo al huevo, no al fondo.');
    } else if (soft) {
      add('mejora', 'Cámara', 'Nitidez justa',
        'El enfoque es aceptable pero mejorable: tripié, f/8, autodisparador de 2 s y enfoque manual ampliado en Visión directa.');
    } else {
      add('bien', 'Cámara', 'Enfoque nítido', 'La zona principal tiene buen detalle.');
    }
  }

  // ---------------- Luz y exposición ----------------
  const tone = a && a.tone;
  if (tone) {
    if (tone.clipHigh > 0.005) {
      add('alerta', 'Luz', `Luces quemadas (${(tone.clipHigh * 100).toFixed(1)}% de la foto)`,
        'En el cascarón blanco eso es detalle perdido para siempre en JPEG. En cámara: compensación de exposición −1/3 a −2/3 y activa Prioridad a tonos altas luces (ojo: sube el ISO mínimo a 200). Usa luz difusa (ventana con cortina o caja de luz) en lugar de luz directa.');
      patch.highlights = -Math.round(Math.min(60, 30 + tone.clipHigh * 600));
    } else if (eggs && subject === 'blanco' && tone.mean < 0.4) {
      add('mejora', 'Luz', 'El huevo blanco salió grisáceo',
        'El exposímetro "cree" que todo es gris medio y subexpone los objetos blancos. Compensa +2/3 a +1 EV (sin llegar a quemar: mira el histograma) o revisa con la Visualización de histograma de la cámara.');
    } else {
      add('bien', 'Luz', 'Exposición equilibrada', 'Sin luces quemadas importantes.');
    }
    if (tone.clipLow > 0.05) {
      add('mejora', 'Luz', 'Sombras empastadas', 'Pon un rebotador blanco (cartulina) del lado opuesto a la luz para abrir las sombras del huevo.');
    }
    Object.assign(patch, { ...autoTone(tone), ...patch });
  }

  if (a && a.cast.fromNeutral && (Math.abs(a.cast.temperature) > 12 || Math.abs(a.cast.tint) > 12)) {
    const warm = a.cast.temperature < 0 ? 'cálida (amarilla)' : 'fría (azul)';
    const green = a.cast.tint > 0 ? 'verdosa' : 'magenta';
    const which = Math.abs(a.cast.temperature) >= Math.abs(a.cast.tint) ? warm : green;
    add('mejora', 'Luz', `Dominante de color ${which}`,
      'En cámara: Balance de blancos personalizado fotografiando una hoja blanca con la misma luz, y no mezcles luz de foco con luz de ventana. Aquí: aplica la corrección sugerida o usa el gotero de balance de blancos sobre el fondo blanco.');
    // Corrección conservadora: un fondo crema puede ser intencional.
    patch.temperature = Math.round(a.cast.temperature * 0.7);
    patch.tint = Math.round(a.cast.tint * 0.7);
  }

  // ---------------- Edición (detalle) ----------------
  const nr = nrForIso(iso);
  if (a && a.noise > 3) {
    nr.nrLuma = Math.max(nr.nrLuma, Math.round(Math.min(60, a.noise * 8)));
    nr.nrColor = Math.max(nr.nrColor, 30);
  }
  Object.assign(patch, nr);
  const noisy = nr.nrLuma >= 25;
  Object.assign(patch, {
    sharpenAmount: noisy ? 40 : 55,
    sharpenRadius: 0.8,
    sharpenMasking: eggs ? 35 : 20,
    texture: eggs ? (subject === 'comida' ? 10 : 22) : 10,
    clarity: eggs ? 8 : 5,
  });
  if (subject === 'rojo') patch.vibrance = 10;
  if (subject === 'comida') patch.vibrance = 18;
  add('mejora', 'Edición', 'Detalle del cascarón',
    `Sugerido: Textura +${patch.texture}, Enfoque ${patch.sharpenAmount} con radio 0.8 y Máscara ${patch.sharpenMasking} (protege el cascarón liso del ruido), Ruido luminancia ${patch.nrLuma}. Presiona "Aplicar sugerencias".`);

  if (mp < 16) {
    add('mejora', 'Resolución', 'Usa Súper resolución al exportar',
      'Al exportar elige 2x: re-muestreo bicúbico + nitidez adaptativa (CAS). No inventa detalle como la IA generativa, pero da bordes limpios para imprimir o ampliar.');
  } else {
    add('bien', 'Resolución', 'Para web o catálogo',
      'Exporta a 2048 px de lado largo con "Nitidez de salida" 25–35: se verá más nítido que subir la foto completa y dejar que la plataforma la reduzca.');
  }

  if (eggs) {
    add('bien', 'Receta', 'Receta SL3 para fotos de huevos',
      'Modo Av, f/8, ISO 100, tripié, autodisparador 2 s, RAW+L, Estilo de imagen "Detalle fino", balance de blancos personalizado, Auto Lighting Optimizer desactivado, enfoque manual ampliado 10x en Visión directa, luz de ventana difusa a un lado y cartulina blanca del otro.');
  }

  let score = 100;
  for (const it of items) score -= it.level === 'alerta' ? 15 : it.level === 'mejora' ? 4 : 0;
  return { score: Math.max(0, score), items, patch, camera: sl3 ? 'Canon EOS Rebel SL3 / 250D' : (exif.model || 'Cámara desconocida') };
}

/** Texto para leer en voz alta (primero lo urgente). */
export function speechText(result) {
  const order = { alerta: 0, mejora: 1, bien: 2 };
  const items = [...result.items].filter((i) => i.level !== 'bien' || i.area === 'Receta')
    .sort((x, y) => order[x.level] - order[y.level]);
  const intro = `Calificación de la foto: ${result.score} de 100.`;
  return [intro, ...items.map((i) => `${i.title}. ${i.text}`)].join('\n');
}
