/** Lo mínimo de un registro de service worker que hace falta para vigilarlo. */
type Registration = Pick<
  ServiceWorkerRegistration,
  'waiting' | 'installing' | 'addEventListener'
>;

/**
 * Llama a `onUpdate` cuando hay una versión nueva instalada y esperando.
 * La primera instalación no cuenta: sin versión anterior no hay nada que
 * actualizar.
 */
export function watchForUpdates(
  registration: Registration,
  hasController: () => boolean,
  onUpdate: (worker: ServiceWorker) => void,
) {
  if (registration.waiting && hasController()) {
    onUpdate(registration.waiting);
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && hasController()) {
        onUpdate(worker);
      }
    });
  });
}

/**
 * Registra el service worker, que deja la web disponible sin conexión.
 * `onUpdate` recibe la función que aplica una versión nueva cuando la hay.
 * Solo actúa en la versión compilada.
 */
export function registerServiceWorker(onUpdate: (apply: () => void) => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  const { serviceWorker } = navigator;
  let isUpdating = false;

  // Al aceptar la actualización, el service worker nuevo toma el control y
  // la página se recarga para usar sus archivos.
  serviceWorker.addEventListener('controllerchange', () => {
    if (isUpdating) {
      window.location.reload();
    }
  });

  serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((registration) => {
      watchForUpdates(
        registration,
        () => serviceWorker.controller !== null,
        (worker) =>
          onUpdate(() => {
            isUpdating = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          }),
      );

      // Una web instalada puede pasar días abierta: se busca una versión
      // nueva cada vez que vuelve a primer plano.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    })
    // Sin service worker la web funciona igual, solo que no sin conexión.
    .catch(() => {});
}
