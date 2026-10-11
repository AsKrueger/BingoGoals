import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { BingoSize } from '@bingogoals/domain';
import { resizePhoto } from '../photos';
import { startApp } from '../test/helpers';

// jsdom no decodifica imágenes: la reducción se prueba en photos.test.ts.
vi.mock('../photos', () => ({
  resizePhoto: vi.fn(async () => 'data:image/jpeg;base64,REDUCIDA'),
}));

afterEach(cleanup);

function renderBoard(size: BingoSize) {
  startApp('Metas', size);
}

function cell(name: string) {
  return screen.getByRole('button', { name });
}

function isPressed(element: HTMLElement) {
  return element.getAttribute('aria-pressed') === 'true';
}

function mark(...numbers: number[]) {
  for (const number of numbers) {
    fireEvent.click(cell(`Objetivo ${number}`));
  }
}

function openEditor(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /Editar casillas/ }));
  fireEvent.click(cell(`Editar: ${name}`));
  return within(screen.getByRole('dialog'));
}

describe('tablero', () => {
  test.each([
    ['3x3', 9],
    ['5x5', 25],
  ] as const)(
    'en %s muestra %i casillas con nombre accesible',
    (size, count) => {
      renderBoard(size);

      const board = screen.getByRole('group', { name: 'Tablero de bingo' });
      expect(within(board).getAllByRole('button')).toHaveLength(count);
      expect(cell('Objetivo 1')).toBeTruthy();
    },
  );

  test('en 5x5 la estrella central aparece completada y se distingue', () => {
    renderBoard('5x5');

    const star = cell('ESTRELLA (estrella central)');
    expect(isPressed(star)).toBe(true);
    expect(star.textContent).toContain('⭐');
    expect(star.className).not.toBe(cell('Objetivo 1').className);
  });

  test('en 3x3 no hay estrella', () => {
    renderBoard('3x3');

    expect(
      screen.queryByRole('button', { name: /estrella central/ }),
    ).toBeNull();
  });
});

describe('marcar', () => {
  test('un toque marca la casilla y actualiza el progreso', () => {
    renderBoard('3x3');
    expect(screen.getByText('0 de 9 conseguidos')).toBeTruthy();

    mark(1);

    expect(isPressed(cell('Objetivo 1'))).toBe(true);
    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();
    expect(screen.getByText('11%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '1',
    );
  });

  test('otro toque la desmarca', () => {
    renderBoard('3x3');

    mark(1, 1);

    expect(isPressed(cell('Objetivo 1'))).toBe(false);
    expect(screen.getByText('0 de 9 conseguidos')).toBeTruthy();
  });
});

describe('editar', () => {
  test('en modo edición un toque abre el diálogo y no marca la casilla', () => {
    renderBoard('3x3');

    const dialog = openEditor('Objetivo 1');

    expect(
      dialog.getByRole('heading', { name: 'Editar objetivo' }),
    ).toBeTruthy();
    expect(screen.getByText('0 de 9 conseguidos')).toBeTruthy();
  });

  test('guarda texto, icono y color', () => {
    renderBoard('3x3');
    const dialog = openEditor('Objetivo 1');

    fireEvent.change(dialog.getByLabelText('Texto del objetivo'), {
      target: { value: 'Correr 10 km' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Deporte' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Azul' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    const edited = cell('Editar: Correr 10 km');
    expect(edited.textContent).toContain('🏋️');
    expect(edited.style.getPropertyValue('--cell-color')).toBe('#2196F3');
  });

  test('guarda una foto elegida de la galería y permite quitarla', async () => {
    renderBoard('3x3');
    let dialog = openEditor('Objetivo 1');

    fireEvent.change(dialog.getByLabelText('Elegir foto'), {
      target: {
        files: [new File(['foto'], 'foto.png', { type: 'image/png' })],
      },
    });
    await dialog.findByAltText('Foto elegida');
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(cell('Editar: Objetivo 1').style.backgroundImage).toContain(
      'data:image/jpeg;base64,REDUCIDA',
    );
    expect(resizePhoto).toHaveBeenCalledWith(expect.any(File));

    fireEvent.click(cell('Editar: Objetivo 1'));
    dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Quitar foto' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(cell('Editar: Objetivo 1').style.backgroundImage).toBe('');
  });

  test('avisa si el archivo elegido no se puede leer como foto', async () => {
    vi.mocked(resizePhoto).mockRejectedValueOnce(new Error('no es una imagen'));
    renderBoard('3x3');
    const dialog = openEditor('Objetivo 1');

    fireEvent.change(dialog.getByLabelText('Elegir foto'), {
      target: { files: [new File(['texto'], 'notas.txt')] },
    });

    expect((await dialog.findByRole('alert')).textContent).toBe(
      'No se ha podido leer la foto. Prueba con otra imagen.',
    );
    expect(dialog.queryByAltText('Foto elegida')).toBeNull();
  });

  test('permite quitar el icono y el color', () => {
    renderBoard('3x3');
    let dialog = openEditor('Objetivo 1');
    fireEvent.click(dialog.getByRole('button', { name: 'Música' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Verde' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    fireEvent.click(cell('Editar: Objetivo 1'));
    dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Sin icono' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Sin color' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    const edited = cell('Editar: Objetivo 1');
    expect(edited.textContent).not.toContain('🎵');
    expect(edited.style.getPropertyValue('--cell-color')).toBe('');
  });

  test.each(['botón', 'Escape'])(
    'cancelar con %s no cambia la casilla',
    (how) => {
      renderBoard('3x3');
      const dialog = openEditor('Objetivo 1');

      fireEvent.change(dialog.getByLabelText('Texto del objetivo'), {
        target: { value: 'Otro texto' },
      });
      fireEvent.click(dialog.getByRole('button', { name: 'Arte' }));
      if (how === 'botón') {
        fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));
      } else {
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      }

      expect(screen.queryByRole('dialog')).toBeNull();
      const untouched = cell('Editar: Objetivo 1');
      expect(untouched.textContent).toBe('Objetivo 1');
    },
  );

  test('la estrella central también se puede personalizar', () => {
    renderBoard('5x5');

    const dialog = openEditor('ESTRELLA (estrella central)');

    expect(
      dialog.getByRole('heading', { name: 'Personalizar estrella' }),
    ).toBeTruthy();
  });
});

describe('celebrar', () => {
  test('completar una línea muestra la celebración de línea', () => {
    renderBoard('3x3');

    mark(1, 2);
    expect(screen.queryByRole('dialog')).toBeNull();
    mark(3);

    expect(screen.getByRole('dialog', { name: '¡LÍNEA!' })).toBeTruthy();
  });

  test('la celebración se cierra y el juego continúa', () => {
    renderBoard('3x3');
    mark(1, 2, 3);

    fireEvent.click(screen.getByRole('button', { name: 'Seguir jugando' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    mark(4);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('desmarcar y volver a completar una línea la celebra de nuevo', () => {
    renderBoard('3x3');
    mark(1, 2, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Seguir jugando' }));

    mark(3);
    expect(screen.queryByRole('dialog')).toBeNull();
    mark(3);

    expect(screen.getByRole('dialog', { name: '¡LÍNEA!' })).toBeTruthy();
  });

  test('completar el tablero muestra la celebración de bingo', () => {
    renderBoard('3x3');

    for (let number = 1; number <= 9; number++) {
      mark(number);
      const celebration = screen.queryByRole('button', {
        name: 'Seguir jugando',
      });
      if (number < 9 && celebration) {
        fireEvent.click(celebration);
      }
    }

    expect(screen.getByRole('dialog', { name: '¡BINGO!' })).toBeTruthy();
    expect(screen.getByText('9 de 9 conseguidos')).toBeTruthy();
  });

  test('en 5x5 la estrella cuenta para completar su fila', () => {
    renderBoard('5x5');

    mark(11, 12, 14, 15);

    expect(screen.getByRole('dialog', { name: '¡LÍNEA!' })).toBeTruthy();
  });
});
