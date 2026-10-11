// Integración con Android (Capacitor). En el navegador todo esto queda inactivo
// y la app usa las APIs web normales.

const Cap = window.Capacitor;
export const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

const plugin = (name) => (isNative ? Cap.registerPlugin(name) : null);
const Filesystem = plugin('Filesystem');
const Share = plugin('Share');
const TTS = plugin('TextToSpeech');

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Guarda una foto exportada. En Android va a Documentos/RevelaSL3 (o a la
 * caché si no hay permiso) y devuelve su URI para poder compartirla.
 */
export async function saveNative(blob, name) {
  const data = await blobToBase64(blob);
  try {
    const r = await Filesystem.writeFile({ path: `RevelaSL3/${name}`, data, directory: 'DOCUMENTS', recursive: true });
    return { uri: r.uri, where: 'Documentos/RevelaSL3' };
  } catch {
    const r = await Filesystem.writeFile({ path: `export/${name}`, data, directory: 'CACHE', recursive: true });
    return { uri: r.uri, where: null };
  }
}

/** Abre el menú "Compartir" de Android (Galería/Fotos, WhatsApp, Drive…). */
export async function shareFiles(uris) {
  if (!Share || !uris.length) return;
  try {
    await Share.share({ title: 'Fotos de Revela SL3', files: uris, dialogTitle: 'Guardar o compartir' });
  } catch {
    // El usuario cerró el menú sin elegir: no es un error.
  }
}

export const nativeSpeech = isNative && TTS ? {
  async speak(lines, onDone) {
    for (const text of lines) {
      if (nativeSpeech.cancelled) break;
      await TTS.speak({ text, lang: 'es-MX', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
    }
    onDone();
  },
  async stop() {
    nativeSpeech.cancelled = true;
    try { await TTS.stop(); } catch { /* nada */ }
  },
  cancelled: false,
  speaking: false,
} : null;
