import { describe, expect, test, vi } from 'vitest';
import { watchForUpdates } from './serviceWorker';

/** Service worker de mentira al que se le puede cambiar el estado. */
function fakeWorker(state: ServiceWorkerState = 'installing') {
  const target = new EventTarget();
  const worker = Object.assign(target, {
    state,
    setState(next: ServiceWorkerState) {
      worker.state = next;
      target.dispatchEvent(new Event('statechange'));
    },
  });
  return worker as typeof worker & ServiceWorker;
}

function fakeRegistration(waiting: ServiceWorker | null = null) {
  const target = new EventTarget();
  const registration = Object.assign(target, {
    waiting,
    installing: null as ServiceWorker | null,
    /** Simula que el navegador ha encontrado una versión nueva. */
    findUpdate(worker: ServiceWorker) {
      registration.installing = worker;
      target.dispatchEvent(new Event('updatefound'));
    },
  });
  return registration as typeof registration & ServiceWorkerRegistration;
}

describe('watchForUpdates', () => {
  test('avisa si ya había una versión nueva esperando', () => {
    const waiting = fakeWorker('installed');
    const onUpdate = vi.fn();

    watchForUpdates(fakeRegistration(waiting), () => true, onUpdate);

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(waiting);
  });

  test('avisa cuando una versión nueva termina de instalarse', () => {
    const registration = fakeRegistration();
    const worker = fakeWorker();
    const onUpdate = vi.fn();
    watchForUpdates(registration, () => true, onUpdate);

    registration.findUpdate(worker);
    expect(onUpdate).not.toHaveBeenCalled();

    worker.setState('installed');
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(worker);
  });

  test('no avisa en la primera instalación, cuando no hay versión anterior', () => {
    const registration = fakeRegistration();
    const worker = fakeWorker();
    const onUpdate = vi.fn();
    watchForUpdates(registration, () => false, onUpdate);

    registration.findUpdate(worker);
    worker.setState('installed');
    worker.setState('activated');

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test('no avisa en los demás cambios de estado', () => {
    const registration = fakeRegistration();
    const worker = fakeWorker();
    const onUpdate = vi.fn();
    watchForUpdates(registration, () => true, onUpdate);
    registration.findUpdate(worker);

    worker.setState('redundant');

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test('sin nada esperando ni instalándose no avisa', () => {
    const onUpdate = vi.fn();

    watchForUpdates(fakeRegistration(), () => true, onUpdate);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
