// Service worker de BingoGoals. Deja la web disponible sin conexión guardando
// solo los archivos de la propia web; todavía no hay llamadas a la API.
//
// Es una plantilla: al compilar, serviceWorkerPlugin.ts sustituye la versión
// y la lista de archivos, y escribe el resultado en dist/sw.js.

const VERSION = '__SW_VERSION__';
const FILES = JSON.parse('__SW_FILES__');

const CACHE_PREFIX = 'bingogoals-';
const CACHE = CACHE_PREFIX + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      // La primera visita ya queda controlada, sin tener que recargar.
      await self.clients.claim();
    })(),
  );
});

// Una versión nueva espera hasta que el usuario acepta actualizar.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cualquier navegación abre la misma página: la web es de una sola.
      // Se busca solo por dirección, sin mirar la cabecera Vary: los archivos
      // se guardaron sin `Origin` y la página los pide con ella, así que con
      // un servidor que responde `Vary: Origin` no coincidirían nunca.
      const cached = await cache.match(
        request.mode === 'navigate' ? 'index.html' : request,
        { ignoreVary: true },
      );
      return cached ?? fetch(request);
    })(),
  );
});
