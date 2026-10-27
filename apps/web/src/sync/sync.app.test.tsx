import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createFakeAccountApi, type FakeAccountApi } from '../account/fakeApi';
import { createMemorySessionStore } from '../account/sessionStore';
import { App } from '../App';
import {
  createMemoryStorage,
  type MemoryStorage,
} from '../storage/memoryStorage';
import { EMPTY_LOCAL_DATA } from '../storage/storage';
import { createBoardStore } from '../store/boardStore';
import { createFakeBoardsApi, type FakeBoardsApi } from './fakeBoardsApi';

// jsdom no decodifica imágenes: la reducción se prueba en photos.test.ts.
vi.mock('../photos', async (original) => ({
  ...(await original<typeof import('../photos')>()),
  resizePhoto: vi.fn(async () => ({
    type: 'image/jpeg',
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
  })),
}));

afterEach(cleanup);

const PASSWORD = 'correcta-caballo';

interface Server {
  accounts: FakeAccountApi;
  boards: FakeBoardsApi;
}

function server(): Server {
  const accounts = createFakeAccountApi();
  return { accounts, boards: createFakeBoardsApi(accounts) };
}

/**
 * Abre la web en su propio contenedor, como un dispositivo o una pestaña.
 * Devuelve las consultas de Testing Library limitadas a ese contenedor.
 */
async function open(
  api: Server,
  storage: MemoryStorage = createMemoryStorage(),
) {
  // Como al abrir la web: lo guardado en el dispositivo se carga primero.
  const result = await storage.load();
  const container = document.body.appendChild(document.createElement('div'));
  render(
    <App
      store={createBoardStore(
        storage,
        result.status === 'loaded' ? result.data : EMPTY_LOCAL_DATA,
      )}
      storage={storage}
      accountServices={{
        api: api.accounts,
        boardsApi: api.boards,
        sessionStore: createMemorySessionStore(),
      }}
    />,
    { container },
  );
  const view = within(container);
  const press = (name: string | RegExp) =>
    fireEvent.click(view.getByRole('button', { name }));
  return { view, press, storage };
}

type Device = Awaited<ReturnType<typeof open>>;

function createBoard(device: Device, title: string) {
  const start = device.view.queryByRole('button', { name: 'Empezar ahora' });
  if (start) {
    fireEvent.click(start);
  } else {
    device.press('Mis tableros');
    device.press('+ Nuevo tablero');
  }
  fireEvent.change(device.view.getByLabelText('Título del tablero'), {
    target: { value: title },
  });
  device.press('Crear tablero');
}

async function signIn(
  device: Device,
  mode: 'Crear cuenta' | 'Iniciar sesión',
  email = 'ana@example.com',
) {
  device.press('Cuenta');
  device.press(mode);
  fireEvent.change(device.view.getByLabelText('Correo'), {
    target: { value: email },
  });
  fireEvent.change(device.view.getByLabelText('Contraseña'), {
    target: { value: PASSWORD },
  });
  fireEvent.click(
    within(device.view.getByRole('main')).getByRole('button', { name: mode }),
  );
  await device.view.findByText('Sesión iniciada');
}

async function syncNow(device: Device) {
  device.press('Sincronizar ahora');
  await waitFor(() =>
    expect(device.view.getByText(/Sincronizado/)).toBeTruthy(),
  );
}

describe('dos dispositivos con la misma cuenta', () => {
  test('un tablero creado en A aparece en B', async () => {
    const api = server();
    const a = await open(api);
    createBoard(a, 'Metas de A');
    await signIn(a, 'Crear cuenta');
    await syncNow(a);

    const b = await open(api);
    await signIn(b, 'Iniciar sesión');
    await syncNow(b);
    b.press('Volver');

    expect(b.view.getByRole('heading', { name: 'Metas de A' })).toBeTruthy();
  });

  test('una casilla marcada en B aparece marcada en A', async () => {
    const api = server();
    const a = await open(api);
    await signIn(a, 'Crear cuenta');
    a.press('Volver');
    createBoard(a, 'Metas');
    a.press('Cuenta');
    await syncNow(a);

    const b = await open(api);
    await signIn(b, 'Iniciar sesión');
    await syncNow(b);
    b.press('Volver');
    b.press('Objetivo 1');
    b.press('Cuenta');
    await waitFor(() => expect(api.boards.calls.put).toBeGreaterThan(1));
    await syncNow(b);

    await syncNow(a);
    a.press('Volver');

    expect(
      a.view
        .getByRole('button', { name: 'Objetivo 1' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  test('con otra cuenta no se ven ni se reciben los tableros de la primera', async () => {
    const api = server();
    const a = await open(api);
    createBoard(a, 'De Ana');
    await signIn(a, 'Crear cuenta');
    await syncNow(a);

    const b = await open(api);
    await signIn(b, 'Crear cuenta', 'luis@example.com');
    await syncNow(b);
    b.press('Volver');

    expect(b.view.getByRole('heading', { name: 'BingoGoals' })).toBeTruthy();
  });
});

describe('indicador de estado', () => {
  test('sin sesión no se muestra', async () => {
    const device = await open(server());
    createBoard(device, 'Metas');

    expect(device.view.queryByText(/Sincroniza/)).toBeNull();
  });

  test('con sesión, el tablero indica que está sincronizado', async () => {
    const device = await open(server());
    createBoard(device, 'Metas');
    await signIn(device, 'Crear cuenta');
    await syncNow(device);
    device.press('Volver');

    expect(device.view.getByRole('status').textContent).toContain(
      'Sincronizado',
    );
  });

  test('con el servidor sin responder, la web sigue funcionando y lo indica', async () => {
    const api = server();
    const device = await open(api);
    createBoard(device, 'Metas');
    await signIn(device, 'Crear cuenta');
    await syncNow(device);
    api.accounts.isDown = true;
    device.press('Volver');

    device.press('Objetivo 1');

    expect(device.view.getByText('1 de 9 conseguidos')).toBeTruthy();
    await waitFor(
      () =>
        expect(device.view.getByRole('status').textContent).toMatch(
          /Conectando con el servidor|Sin conexión/,
        ),
      { timeout: 3000 },
    );
  });
});

describe('cerrar sesión', () => {
  async function signedInWithBoard() {
    const device = await open(server());
    createBoard(device, 'Metas');
    await signIn(device, 'Crear cuenta');
    await syncNow(device);
    device.press('Cerrar sesión');
    return device;
  }

  test('pregunta qué hacer con los tableros de la cuenta', async () => {
    const device = await signedInWithBoard();

    const dialog = device.view.getByRole('dialog', {
      name: '¿Cerrar sesión?',
    });
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Conservar aquí' }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Quitar de aquí' }),
    ).toBeTruthy();
  });

  test('«Conservar aquí» deja los tableros en el dispositivo', async () => {
    const device = await signedInWithBoard();

    device.press('Conservar aquí');
    await device.view.findByText('Sin cuenta');
    device.press('Volver');

    expect(device.view.getByRole('heading', { name: 'Metas' })).toBeTruthy();
  });

  test('«Quitar de aquí» los quita del dispositivo, pero no del servidor', async () => {
    const api = server();
    const device = await open(api);
    createBoard(device, 'Metas');
    await signIn(device, 'Crear cuenta');
    await syncNow(device);
    device.press('Cerrar sesión');

    device.press('Quitar de aquí');
    await device.view.findByText('Sin cuenta');
    device.press('Volver');

    expect(
      device.view.getByRole('heading', { name: 'BingoGoals' }),
    ).toBeTruthy();
    await waitFor(() => expect(device.storage.records.size).toBe(0));
    expect(api.boards.stored('usuario-1')).toHaveLength(1);
  });

  test('si hay cambios sin subir, avisa de que se perderían', async () => {
    const api = server();
    const device = await open(api);
    await signIn(device, 'Crear cuenta');
    api.accounts.isDown = true;
    device.press('Volver');
    createBoard(device, 'Sin subir');
    device.press('Cuenta');

    device.press('Cerrar sesión');

    expect(
      within(device.view.getByRole('dialog')).getByText(/se perderán/),
    ).toBeTruthy();
  });
});

describe('dos pestañas del mismo navegador', () => {
  test('los cambios de una aparecen en la otra', async () => {
    const api = server();
    const storage = createMemoryStorage();
    const first = await open(api, storage);
    const second = await open(api, storage.openTab());

    createBoard(first, 'Desde la primera');

    await waitFor(() =>
      expect(
        second.view.getByRole('heading', { name: 'Desde la primera' }),
      ).toBeTruthy(),
    );
  });

  test('una casilla marcada en cada pestaña: se conservan las dos', async () => {
    const api = server();
    const storage = createMemoryStorage();
    const first = await open(api, storage);
    createBoard(first, 'Metas');
    const second = await open(api, storage.openTab());
    await waitFor(() =>
      expect(second.view.getByRole('heading', { name: 'Metas' })).toBeTruthy(),
    );

    first.press('Objetivo 1');
    await waitFor(() =>
      expect(second.view.getByText('1 de 9 conseguidos')).toBeTruthy(),
    );
    second.press('Objetivo 2');

    await waitFor(() =>
      expect(first.view.getByText('2 de 9 conseguidos')).toBeTruthy(),
    );
    expect(storage.records.size).toBe(1);
  });
});

describe('datos que no se pudieron leer', () => {
  test('la cuenta los lista y permite descargarlos o intentar recuperarlos', async () => {
    const storage = createMemoryStorage({ version: 99, tableros: [] });
    const device = await open(server(), storage);
    // El primer cambio aparta los datos ilegibles como copia.
    createBoard(device, 'Nuevo');
    await waitFor(() => expect(storage.legacy()).toBeUndefined());

    device.press('Cuenta');

    expect(
      await device.view.findByText('Datos que no se pudieron leer'),
    ).toBeTruthy();
    expect(device.view.getByRole('button', { name: 'Descargar' })).toBeTruthy();

    device.press('Intentar recuperar');

    expect(device.view.getByText(/tampoco puede leer la copia/)).toBeTruthy();
  });
});

describe('fotos', () => {
  async function choosePhoto(device: Device, cell: string) {
    device.press(/Editar casillas/);
    device.press(`Editar: ${cell}`);
    const dialog = within(device.view.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText(/foto/), {
      target: { files: [new File(['foto'], 'foto.jpg')] },
    });
    await dialog.findByAltText('Foto elegida');
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));
    device.press(/Editar casillas/);
  }

  function photoOf(device: Device, cell: string) {
    return device.view.getByRole('button', { name: cell }).style
      .backgroundImage;
  }

  /** A con una foto en la casilla 1, ya subida, y B con la misma cuenta. */
  async function twoDevicesWithPhoto() {
    const api = server();
    const a = await open(api);
    createBoard(a, 'Metas');
    await signIn(a, 'Crear cuenta');
    a.press('Volver');
    await choosePhoto(a, 'Objetivo 1');
    await waitFor(() => expect(api.boards.photos('usuario-1').size).toBe(1));

    const b = await open(api);
    await signIn(b, 'Iniciar sesión');
    await syncNow(b);
    b.press('Volver');
    return { api, a, b };
  }

  test('una foto elegida en A aparece en B', async () => {
    const { b } = await twoDevicesWithPhoto();

    await waitFor(() => expect(photoOf(b, 'Objetivo 1')).toContain('blob:'));
  });

  test('cambiar la foto en A: B muestra la nueva y el servidor borra la anterior', async () => {
    const { api, a, b } = await twoDevicesWithPhoto();
    const [first] = api.boards.photos('usuario-1').keys();

    await choosePhoto(a, 'Objetivo 1');
    await waitFor(() =>
      expect([...api.boards.photos('usuario-1').keys()]).not.toContain(first),
    );
    b.press('Cuenta');
    await syncNow(b);
    b.press('Volver');

    const [second] = api.boards.photos('usuario-1').keys();
    expect(second).toBeDefined();
    await waitFor(() =>
      expect(b.storage.storedPhotos.has(second as string)).toBe(true),
    );
  });

  test('quitar la foto en A la quita en B y del servidor', async () => {
    const { api, a, b } = await twoDevicesWithPhoto();

    a.press(/Editar casillas/);
    a.press('Editar: Objetivo 1');
    a.press('Quitar foto');
    a.press('Guardar');
    await waitFor(() => expect(api.boards.photos('usuario-1').size).toBe(0));
    b.press('Cuenta');
    await syncNow(b);
    b.press('Volver');

    await waitFor(() => expect(photoOf(b, 'Objetivo 1')).toBe(''));
  });

  test('sin cuenta, las fotos funcionan y no se envían', async () => {
    const api = server();
    const device = await open(api);
    createBoard(device, 'Metas');

    await choosePhoto(device, 'Objetivo 1');

    expect(photoOf(device, 'Objetivo 1')).toContain('blob:');
    expect(device.storage.storedPhotos.size).toBe(1);
    expect(api.boards.calls.putPhoto).toBe(0);
  });
});
