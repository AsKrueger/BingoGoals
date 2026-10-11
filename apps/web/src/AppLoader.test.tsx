import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppLoader } from './AppLoader';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memoryStorage';
import { STORAGE_VERSION, toStoredData } from './storage/schema';
import storedV1 from './storage/fixtures/stored-v1.json';
import { sampleData } from './storage/testData';
import {
  archiveActiveBoard,
  button,
  fakeAccountServices,
  heading,
  mark,
  submitCreateForm,
} from './test/helpers';

vi.mock('./photos', () => ({
  resizePhoto: vi.fn(async () => 'data:image/jpeg;base64,REDUCIDA'),
}));

afterEach(cleanup);

/** Abre la web y espera a que termine la carga inicial. */
async function open(storage: MemoryStorage) {
  render(
    <AppLoader storage={storage} accountServices={fakeAccountServices()} />,
  );
  await waitFor(() => expect(screen.queryByText(/Cargando/)).toBeNull());
}

/** Cierra la web y la vuelve a abrir con el mismo almacenamiento. */
async function reload(storage: MemoryStorage) {
  // Espera a que el último guardado haya terminado, como haría el navegador.
  await Promise.resolve();
  cleanup();
  await open(storage);
}

function isPressed(name: string) {
  return button(name).getAttribute('aria-pressed') === 'true';
}

describe('carga inicial', () => {
  test('muestra un estado de carga hasta tener los datos', async () => {
    render(
      <AppLoader
        storage={createMemoryStorage()}
        accountServices={fakeAccountServices()}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain(
      'Cargando tus tableros…',
    );
    expect(screen.queryByRole('heading')).toBeNull();

    expect(
      await screen.findByRole('heading', { name: 'BingoGoals' }),
    ).toBeTruthy();
    expect(screen.queryByText(/Cargando/)).toBeNull();
  });

  test('sin datos guardados arranca en la bienvenida', async () => {
    await open(createMemoryStorage());

    expect(heading('BingoGoals')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('con datos guardados abre el tablero activo', async () => {
    await open(createMemoryStorage(toStoredData(sampleData())));

    expect(heading('Segundo')).toBeTruthy();
    expect(screen.getByText('2 de 25 conseguidos')).toBeTruthy();
  });

  test.each([
    ['corruptos', 'esto no son datos'],
    ['a medias', { version: STORAGE_VERSION, collection: { boards: 3 } }],
    [
      'de una versión desconocida',
      { ...toStoredData(sampleData()), version: 99 },
    ],
  ])('con datos %s arranca vacía y no falla', async (_, raw) => {
    await open(createMemoryStorage(raw));

    expect(heading('BingoGoals')).toBeTruthy();
    expect(button('Empezar ahora')).toBeTruthy();
  });

  test('si no se puede leer el almacenamiento arranca vacía y avisa', async () => {
    const storage = createMemoryStorage();
    storage.failOnLoad = true;

    await open(storage);

    expect(heading('BingoGoals')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'No se han podido leer los datos guardados',
    );
    // No es el aviso de datos ilegibles: aquí no se sabe si hay datos.
    expect(screen.getByRole('alert').textContent).not.toContain('dañados');

    fireEvent.click(button('Entendido'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // Hallazgo 1 de la revisión de la fase 1.
  test.each([
    ['corruptos', 'esto no son datos'],
    [
      'de una versión más nueva',
      { ...toStoredData(sampleData()), version: 99 },
    ],
  ])('con datos %s avisa de que no se pueden leer', async (_, raw) => {
    await open(createMemoryStorage(raw));

    expect(screen.getByRole('alert').textContent).toContain(
      'no se pueden leer',
    );
  });

  test('tras el aviso, el primer cambio conserva una copia de lo ilegible', async () => {
    const raw = { ...toStoredData(sampleData()), version: 99 };
    const storage = createMemoryStorage(raw);
    await open(storage);
    fireEvent.click(button('Entendido'));
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');

    await waitFor(() =>
      expect(storage.raw).toMatchObject({ version: STORAGE_VERSION }),
    );
    expect(storage.unreadableCopies).toEqual([raw]);
  });

  test('con datos legibles no se hacen copias', async () => {
    const storage = createMemoryStorage(toStoredData(sampleData()));
    await open(storage);

    mark(1);
    await waitFor(() =>
      expect(storage.raw).not.toEqual(toStoredData(sampleData())),
    );

    expect(storage.unreadableCopies).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('sin datos guardados no avisa de nada', async () => {
    await open(createMemoryStorage());

    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('abrir la web no guarda nada por sí solo', async () => {
    const raw = { ...toStoredData(sampleData()), version: 99 };
    const storage = createMemoryStorage(raw);

    await open(storage);
    await Promise.resolve();

    // Unos datos de una versión más nueva no se pisan solo por abrir la web.
    expect(storage.raw).toBe(raw);
  });
});

describe('datos de la versión 1', () => {
  test('los tableros siguen ahí, sin aviso', async () => {
    await open(createMemoryStorage(structuredClone(storedV1)));

    expect(heading('Segundo')).toBeTruthy();
    expect(screen.getByText('2 de 25 conseguidos')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(button('Mis tableros'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(button('Abrir Primero'));
    expect(heading('Primero').closest('[data-theme]')).toHaveProperty(
      'dataset.theme',
      'sakura',
    );
    expect(button('Correr 10 km').style.backgroundImage).toContain(
      'data:image/jpeg;base64,AAAA',
    );
  });

  test('el historial también se conserva', async () => {
    await open(createMemoryStorage(structuredClone(storedV1)));

    fireEvent.click(button('Historial'));

    expect(button('Ver Archivado')).toBeTruthy();
  });

  test('al abrir la web quedan guardados en la versión actual, sin copias', async () => {
    const storage = createMemoryStorage(structuredClone(storedV1));

    await open(storage);

    expect(storage.raw).toMatchObject({ version: STORAGE_VERSION });
    expect(JSON.stringify(storage.raw)).not.toMatch(/primaryColor|fontFamily/);
    expect(storage.unreadableCopies).toEqual([]);
  });
});

describe('guardado automático', () => {
  test('los datos guardados llevan número de versión', async () => {
    const storage = createMemoryStorage();
    await open(storage);

    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');

    await waitFor(() =>
      expect(storage.raw).toMatchObject({
        version: STORAGE_VERSION,
        collection: { boards: [{ title: 'Metas', size: '3x3' }] },
        history: [],
      }),
    );
  });

  test('tableros, tablero activo y casillas marcadas siguen al recargar', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Primero', '3x3');
    mark(1, 5);
    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('+ Nuevo tablero'));
    submitCreateForm('Segundo', '5x5');
    mark(2);
    // Se deja activo el primero, que no es el último creado.
    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('Abrir Primero'));

    await reload(storage);

    expect(heading('Primero')).toBeTruthy();
    expect(screen.getByText('2 de 9 conseguidos')).toBeTruthy();
    expect(isPressed('Objetivo 1')).toBe(true);
    expect(isPressed('Objetivo 5')).toBe(true);
    expect(isPressed('Objetivo 2')).toBe(false);

    fireEvent.click(button('Mis tableros'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(button('Abrir Segundo'));
    expect(screen.getByText('2 de 25 conseguidos')).toBeTruthy();
    expect(isPressed('Objetivo 2')).toBe(true);
  });

  test('texto, icono, color y foto de una casilla siguen al recargar', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    fireEvent.click(button(/Editar casillas/));

    fireEvent.click(button('Editar: Objetivo 1'));
    let dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Texto del objetivo'), {
      target: { value: 'Correr 10 km' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Deporte' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Azul' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    fireEvent.click(button('Editar: Objetivo 2'));
    dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Elegir foto'), {
      target: { files: [new File(['foto'], 'foto.png')] },
    });
    await dialog.findByAltText('Foto elegida');
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await reload(storage);

    const edited = button('Correr 10 km');
    expect(edited.textContent).toContain('🏋️');
    expect(edited.style.getPropertyValue('--cell-color')).toBe('#2196F3');
    expect(button('Objetivo 2').style.backgroundImage).toContain(
      'data:image/jpeg;base64,REDUCIDA',
    );
  });

  test('el tema de cada tablero sigue al recargar', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    fireEvent.click(button('Cambiar tema'));
    fireEvent.click(button('Sakura'));
    fireEvent.click(button('Cerrar'));

    await reload(storage);

    expect(heading('Metas').closest('[data-theme]')).toHaveProperty(
      'dataset.theme',
      'sakura',
    );
  });

  test('un tablero archivado sigue en el historial al recargar', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    mark(1, 2);
    archiveActiveBoard();

    await reload(storage);

    expect(heading('BingoGoals')).toBeTruthy();
    fireEvent.click(button('Ver historial'));
    expect(screen.getByRole('listitem').textContent).toContain(
      '3 × 3 · 2 de 9 conseguidos',
    );
  });

  test('eliminar un tablero también se guarda', async () => {
    const storage = createMemoryStorage(toStoredData(sampleData()));
    await open(storage);
    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('Eliminar Segundo'));
    fireEvent.click(button('Eliminar'));

    await reload(storage);

    expect(heading('Primero')).toBeTruthy();
    fireEvent.click(button('Mis tableros'));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('error al guardar', () => {
  test('se muestra al usuario y no se pierde el estado en pantalla', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    await waitFor(() => expect(storage.raw).toBeDefined());

    storage.failOnSave = true;
    mark(1);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se han podido guardar los últimos cambios.',
    );
    expect(isPressed('Objetivo 1')).toBe(true);
    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();
  });

  test('reintentar guarda los cambios y quita el aviso', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    storage.failOnSave = true;
    mark(1);
    await screen.findByRole('alert');

    storage.failOnSave = false;
    fireEvent.click(button('Reintentar'));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await reload(storage);
    expect(isPressed('Objetivo 1')).toBe(true);
  });

  test('el aviso desaparece cuando un guardado posterior funciona', async () => {
    const storage = createMemoryStorage();
    await open(storage);
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    storage.failOnSave = true;
    mark(1);
    await screen.findByRole('alert');

    storage.failOnSave = false;
    mark(2);

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
