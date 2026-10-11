// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import { createSaveQueue } from './saveQueue';
import { EMPTY_DATA, type AppData, type BoardStorage } from './storage';

/** Almacenamiento cuyos guardados terminan cuando el test lo decide. */
function manualStorage() {
  const saves: { data: AppData; finish: (succeeded?: boolean) => void }[] = [];
  let active = 0;
  let maxActive = 0;

  const storage: BoardStorage = {
    load: async () => ({ status: 'empty' }),
    save(data) {
      active++;
      maxActive = Math.max(maxActive, active);
      return new Promise<void>((resolve, reject) => {
        saves.push({
          data,
          finish(succeeded = true) {
            active--;
            if (succeeded) {
              resolve();
            } else {
              reject(new Error('sin espacio'));
            }
          },
        });
      });
    },
  };

  return { storage, saves, maxConcurrent: () => maxActive };
}

/** Deja que se resuelvan las promesas pendientes. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

/** Datos distintos en cada llamada, para distinguir un guardado de otro. */
function data(label: string): AppData {
  return { ...EMPTY_DATA, history: [], label } as AppData;
}

describe('createSaveQueue', () => {
  test('guarda de inmediato si no hay otro guardado en curso', async () => {
    const { storage, saves } = manualStorage();
    const onResult = vi.fn();
    const save = createSaveQueue(storage, onResult);
    const first = data('primero');

    save(first);

    expect(saves.map((entry) => entry.data)).toEqual([first]);
    saves[0]!.finish();
    await settle();
    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('nunca hay dos guardados a la vez', async () => {
    const { storage, saves, maxConcurrent } = manualStorage();
    const save = createSaveQueue(storage, vi.fn());

    save(data('primero'));
    save(data('segundo'));
    save(data('tercero'));
    expect(saves).toHaveLength(1);

    saves[0]!.finish();
    await settle();
    expect(saves).toHaveLength(2);
    saves[1]!.finish();
    await settle();

    expect(maxConcurrent()).toBe(1);
  });

  test('de los que esperan solo se guarda el último, y queda el último', async () => {
    const { storage, saves } = manualStorage();
    const onResult = vi.fn();
    const save = createSaveQueue(storage, onResult);
    const [first, second, third] = [
      data('primero'),
      data('segundo'),
      data('tercero'),
    ];

    save(first);
    save(second);
    save(third);
    saves[0]!.finish();
    await settle();
    saves[1]!.finish();
    await settle();

    expect(saves.map((entry) => entry.data)).toEqual([first, third]);
    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('informa del fallo del último guardado', async () => {
    const { storage, saves } = manualStorage();
    const onResult = vi.fn();
    const save = createSaveQueue(storage, onResult);

    save(data('primero'));
    saves[0]!.finish(false);
    await settle();

    expect(onResult).toHaveBeenCalledExactlyOnceWith(false);
  });

  test('si falla uno y el siguiente funciona, el resultado es correcto', async () => {
    const { storage, saves } = manualStorage();
    const onResult = vi.fn();
    const save = createSaveQueue(storage, onResult);

    save(data('primero'));
    save(data('segundo'));
    saves[0]!.finish(false);
    await settle();
    saves[1]!.finish();
    await settle();

    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('tras terminar, un guardado nuevo vuelve a empezar de inmediato', async () => {
    const { storage, saves } = manualStorage();
    const save = createSaveQueue(storage, vi.fn());

    save(data('primero'));
    saves[0]!.finish();
    await settle();
    save(data('segundo'));

    expect(saves).toHaveLength(2);
  });
});
