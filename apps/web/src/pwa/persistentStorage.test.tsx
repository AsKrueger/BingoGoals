import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from '../App';
import { createMemoryStorage } from '../storage/memoryStorage';
import { fromAppData } from '../storage/records';
import { EMPTY_DATA } from '../storage/storage';
import { createBoardStore } from '../store/boardStore';
import { button, fakeAccountServices, submitCreateForm } from '../test/helpers';
import {
  requestPersistentStorage,
  type Persistence,
} from './persistentStorage';

afterEach(cleanup);

function manager(persisted: boolean, grants: boolean) {
  return {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => grants),
  };
}

describe('pedir almacenamiento persistente', () => {
  test('si ya se concedió, no lo vuelve a pedir', async () => {
    const storage = manager(true, false);

    expect(await requestPersistentStorage(storage)).toBe('persisted');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  test('lo pide y devuelve lo que responde el navegador', async () => {
    expect(await requestPersistentStorage(manager(false, true))).toBe(
      'persisted',
    );
    expect(await requestPersistentStorage(manager(false, false))).toBe(
      'denied',
    );
  });

  test('sin la función en el navegador, o si falla, no está disponible', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
    expect(
      await requestPersistentStorage({
        persisted: async () => false,
        persist: async () => {
          throw new Error('No.');
        },
      }),
    ).toBe('unsupported');
  });
});

const NOTICE = /puede borrar los datos de la web/;

function renderApp(request: () => Promise<Persistence>) {
  const storage = createMemoryStorage();
  render(
    <App
      store={createBoardStore(storage, fromAppData(EMPTY_DATA))}
      storage={storage}
      accountServices={fakeAccountServices()}
      requestPersistence={request}
    />,
  );
}

async function createFirstBoard() {
  fireEvent.click(button('Empezar ahora'));
  submitCreateForm('Metas', '3x3');
  await screen.findByRole('heading', { name: 'Metas' });
}

/** Deja que termine la petición al navegador. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

function openAccount() {
  fireEvent.click(button('Cuenta'));
}

describe('aviso de almacenamiento', () => {
  test('no se pide nada hasta que hay un tablero', async () => {
    const request = vi.fn(async (): Promise<Persistence> => 'denied');
    renderApp(request);

    expect(request).not.toHaveBeenCalled();

    await createFirstBoard();
    expect(request).toHaveBeenCalledOnce();
  });

  test('si el navegador no lo concede, la cuenta lo avisa', async () => {
    renderApp(async () => 'denied');
    await createFirstBoard();
    await settle();

    openAccount();

    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  test('con la sesión iniciada no avisa: los tableros están en la cuenta', async () => {
    renderApp(async () => 'denied');
    await createFirstBoard();
    await settle();
    openAccount();

    fireEvent.click(button('Crear cuenta'));
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'correcta-caballo' },
    });
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', {
        name: 'Crear cuenta',
      }),
    );
    await screen.findByText('Sesión iniciada');

    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  test.each<Persistence>(['persisted', 'unsupported'])(
    'si responde «%s», no avisa',
    async (result) => {
      renderApp(async () => result);
      await createFirstBoard();
      await settle();

      openAccount();

      expect(screen.queryByText(NOTICE)).toBeNull();
    },
  );
});
