// Asesor con IA (Claude). Opcional: requiere una clave de API de Anthropic que
// el usuario guarda en su propio navegador. Se envía una versión reducida de
// la foto (máx. 1568 px) + EXIF + métricas; nunca el archivo original.

import { ALL_SLIDER_KEYS } from './params.js';

const SDK_URLS = [
  'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm',
  'https://esm.sh/@anthropic-ai/sdk@0.128.0',
];
export const MODEL = 'claude-opus-5-5';

let clientPromise = null;
let clientKey = null;

async function loadSdk() {
  let last;
  for (const url of SDK_URLS) {
    try {
      return (await import(url)).default;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`No se pudo cargar el SDK de Anthropic (¿sin internet?): ${last?.message || last}`);
}

async function client(apiKey) {
  if (!clientPromise || clientKey !== apiKey) {
    clientKey = apiKey;
    clientPromise = loadSdk().then((Anthropic) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true }));
    clientPromise.catch(() => { clientPromise = null; });
  }
  return clientPromise;
}

const SYSTEM = `Eres un fotógrafo de producto y retocador experto, especializado en fotografiar huevos (blancos, rojos/marrones y cocinados) con la Canon EOS Rebel SL3 (EOS 250D / 200D II): sensor APS-C de 24 MP (6000x4000), factor 1.6x, ISO 100-25600, Dual Pixel AF, lente de kit EF-S 18-55mm f/4-5.6 IS STM (enfoque mínimo 25 cm).
Hablas español de México, claro y directo, como un instructor que va dictando pasos.
Tu prioridad es que el usuario consiga MÁS RESOLUCIÓN Y DETALLE REAL en sus fotos de huevos: encuadre/magnificación, enfoque, abertura (difracción), estabilidad, ISO, compresión, luz difusa, y después la edición.
Cuando menciones ajustes de la cámara usa los nombres de los menús de la SL3 en español (Calidad de imagen, Estilo de imagen, Prioridad a tonos altas luces, Auto Lighting Optimizer, Modo de avance, Visión directa, Corrección de aberración del objetivo, Balance de blancos personalizado).
Los "ajustes" que devuelves son valores ABSOLUTOS para los controles de la app (como Lightroom): exposure en EV (-5 a 5); sharpenAmount 0-150; sharpenRadius 0.5-3; sharpenMasking, nrLuma, nrColor 0-100; outputSharpen 0-100; el resto de -100 a 100 (0 = sin cambio). Los ajustes actuales vienen en el mensaje: parte de ellos y la imagen enviada YA los tiene aplicados.`;

const NUM = { type: 'number' };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'calificacion', 'pasos_camara', 'pasos_edicion', 'ajustes'],
  properties: {
    resumen: { type: 'string', description: 'Diagnóstico en 2-3 frases.' },
    calificacion: { type: 'integer', description: 'Calidad técnica 0-100.' },
    pasos_camara: { type: 'array', items: { type: 'string' }, description: 'Qué hacer en la próxima toma con la SL3, en orden de impacto.' },
    pasos_edicion: { type: 'array', items: { type: 'string' }, description: 'Qué ajustar en la app y por qué.' },
    ajustes: {
      type: 'object',
      additionalProperties: false,
      required: ALL_SLIDER_KEYS,
      properties: Object.fromEntries(ALL_SLIDER_KEYS.map((k) => [k, NUM])),
    },
  },
};

function textOf(message) {
  if (message.stop_reason === 'refusal') throw new Error('La IA no pudo responder a esta solicitud.');
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function context({ exif, analysis, subject, params, width, height, fileType }) {
  const t = analysis?.tone;
  return JSON.stringify({
    tema: subject,
    archivo: { tipo: fileType, ancho: width, alto: height },
    exif: {
      camara: exif.model, lente: exif.lensModel, iso: exif.iso, velocidad_s: exif.exposureTime,
      abertura: exif.fNumber, focal_mm: exif.focalLength, compensacion_ev: exif.exposureBias,
      programa: exif.exposureProgram, flash: exif.flash,
    },
    medicion_original: analysis ? {
      luminancia_media: +t.mean.toFixed(3), p1: t.p01, p99: t.p99,
      luces_quemadas_pct: +(t.clipHigh * 100).toFixed(2), sombras_negras_pct: +(t.clipLow * 100).toFixed(2),
      nitidez_mejor_zona: Math.round(analysis.sharp.best), nitidez_mediana: Math.round(analysis.sharp.median),
      ruido_sigma: +analysis.noise.toFixed(2),
      dominante_sugerida: { temperatura: analysis.cast.temperature, matiz: analysis.cast.tint },
    } : null,
    ajustes_actuales: Object.fromEntries(ALL_SLIDER_KEYS.map((k) => [k, params[k]])),
  });
}

/** Diagnóstico estructurado con ajustes aplicables. */
export async function aiReview(apiKey, imageBase64, ctx) {
  const anthropic = await client(apiKey);
  const message = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: `Analiza esta foto y dime cómo mejorar su resolución y calidad. Datos:\n${context(ctx)}` },
      ],
    }],
  });
  return JSON.parse(textOf(message));
}

/** Pregunta libre sobre la foto actual. */
export async function aiAsk(apiKey, imageBase64, ctx, question) {
  const anthropic = await client(apiKey);
  const message = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: `${SYSTEM}\nResponde en texto plano breve (máximo 8 viñetas cortas con "- "), sin encabezados.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: `Datos de la foto: ${context(ctx)}\n\nPregunta: ${question}` },
      ],
    }],
  });
  return textOf(message);
}
