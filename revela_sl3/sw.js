// Service worker: guarda la app para que funcione sin conexión (las fotos
// nunca pasan por aquí; solo los archivos de la aplicación).
const CACHE = 'revela-sl3-v1';
const FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/main.js', 'js/engine.js', 'js/shaders.js', 'js/params.js', 'js/curve.js', 'js/curve-editor.js',
  'js/crop.js', 'js/loader.js', 'js/cr3.js', 'js/tiff.js', 'js/analysis.js', 'js/advisor.js',
  'js/sl3.js', 'js/claude.js', 'js/platform.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones), caché como respaldo sin conexión.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request)),
  );
});
