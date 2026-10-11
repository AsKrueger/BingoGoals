import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { formatDate } from '../format';
import {
  addBoard,
  archiveActiveBoard,
  button,
  confirm,
  heading,
  mark,
  renderApp,
  startApp,
} from '../test/helpers';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function titles() {
  return screen
    .getAllByRole('listitem')
    .map((item) => within(item).getAllByRole('button')[0]?.textContent);
}

describe('archivar', () => {
  test('pide confirmación y cancelar no archiva nada', () => {
    startApp('Metas', '3x3');
    fireEvent.click(button('Ajustes'));

    fireEvent.click(button('Archivar tablero'));

    const dialog = within(
      screen.getByRole('dialog', { name: '¿Archivar tablero?' }),
    );
    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

    expect(heading('Ajustes')).toBeTruthy();
    fireEvent.click(button('Volver al tablero'));
    fireEvent.click(button('Historial'));
    expect(screen.getByText('Aún no tienes tableros archivados.')).toBeTruthy();
  });

  test('mueve el tablero de la colección al historial', () => {
    startApp('Primero', '3x3');
    addBoard('Segundo', '3x3');

    archiveActiveBoard();

    // Se activa el que queda y el archivado ya no está en la colección.
    expect(heading('Primero')).toBeTruthy();
    fireEvent.click(button('Mis tableros'));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Abrir Segundo' })).toBeNull();

    fireEvent.click(button('Historial'));
    expect(titles()).toEqual([expect.stringContaining('Segundo')]);
  });

  test('al archivar el último tablero vuelve la bienvenida, con acceso al historial', () => {
    startApp('Metas', '3x3');

    archiveActiveBoard();

    expect(heading('BingoGoals')).toBeTruthy();
    fireEvent.click(button('Ver historial'));
    expect(button('Ver Metas')).toBeTruthy();

    fireEvent.click(button('Volver'));
    expect(heading('BingoGoals')).toBeTruthy();
  });

  test('sin tableros archivados la bienvenida no ofrece el historial', () => {
    renderApp();

    expect(screen.queryByRole('button', { name: 'Ver historial' })).toBeNull();
  });
});

describe('historial', () => {
  test('sin tableros archivados muestra un mensaje de lista vacía', () => {
    startApp('Metas', '3x3');

    fireEvent.click(button('Historial'));

    expect(heading('Historial')).toBeTruthy();
    expect(screen.getByText('Aún no tienes tableros archivados.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  test('se abre desde el tablero y desde la colección, y vuelve a su origen', () => {
    startApp('Metas', '3x3');

    fireEvent.click(button('Historial'));
    fireEvent.click(button('Volver'));
    expect(heading('Metas')).toBeTruthy();

    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('Historial'));
    fireEvent.click(button('Volver'));
    expect(heading('Mis tableros')).toBeTruthy();
  });

  test('muestra título, fecha de archivo y progreso final', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00'));
    startApp('Metas', '3x3');
    mark(1, 2, 3, 4);

    archiveActiveBoard();
    fireEvent.click(button('Ver historial'));

    const item = screen.getByRole('listitem');
    expect(item.textContent).toContain('Metas');
    expect(item.textContent).toContain('Archivado el 11 de octubre de 2026');
    expect(item.textContent).toContain('3 × 3 · 4 de 9 conseguidos (44 %)');
    expect(
      screen
        .getByRole('progressbar', { name: 'Progreso de Metas' })
        .getAttribute('aria-valuenow'),
    ).toBe('4');
  });

  test('lista del más reciente al más antiguo', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00'));
    startApp('Antiguo', '3x3');
    addBoard('Intermedio', '3x3');
    addBoard('Reciente', '3x3');

    // Se archivan en este orden: Reciente (día 5), Antiguo (día 2)… con
    // fechas que no siguen el orden de archivado.
    vi.setSystemTime(new Date('2026-10-05T12:00:00'));
    archiveActiveBoard();
    vi.setSystemTime(new Date('2026-10-07T12:00:00'));
    archiveActiveBoard();
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
    archiveActiveBoard();

    fireEvent.click(button('Ver historial'));

    expect(
      screen
        .getAllByRole('listitem')
        .map((item) => item.textContent.match(/Archivado el (\d+)/)?.[1]),
    ).toEqual(['7', '6', '5']);
  });

  test('eliminar pide confirmación y cancelar no borra nada', () => {
    startApp('Metas', '3x3');
    archiveActiveBoard();
    fireEvent.click(button('Ver historial'));

    fireEvent.click(button('Eliminar Metas del historial'));

    const dialog = within(
      screen.getByRole('dialog', { name: '¿Eliminar del historial?' }),
    );
    expect(
      dialog.getByText(
        'Se borrará «Metas» del historial y no se podrá recuperar.',
      ),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  test('al confirmar elimina solo ese tablero del historial', () => {
    startApp('Primero', '3x3');
    addBoard('Segundo', '3x3');
    archiveActiveBoard();
    archiveActiveBoard();
    fireEvent.click(button('Ver historial'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(button('Eliminar Primero del historial'));
    confirm('Eliminar');

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(button('Ver Segundo')).toBeTruthy();

    fireEvent.click(button('Eliminar Segundo del historial'));
    confirm('Eliminar');

    expect(screen.getByText('Aún no tienes tableros archivados.')).toBeTruthy();
  });
});

describe('tablero archivado', () => {
  function openArchived() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00'));
    startApp('Metas', '5x5');
    mark(1, 2);
    fireEvent.click(button('Cambiar tema'));
    fireEvent.click(button('Sakura'));
    fireEvent.click(button('Cerrar'));
    archiveActiveBoard();
    fireEvent.click(button('Ver historial'));
    fireEvent.click(button('Ver Metas'));
  }

  test('se ve completo, con su tema, fecha y progreso final', () => {
    openArchived();

    expect(heading('Metas').closest('[data-theme]')).toHaveProperty(
      'dataset.theme',
      'sakura',
    );
    expect(
      screen.getByText(
        `Archivado el ${formatDate('2026-10-11T12:00:00')} · Solo lectura`,
        { exact: false },
      ),
    ).toBeTruthy();
    expect(screen.getByText('3 de 25 conseguidos (12 %)')).toBeTruthy();

    const board = within(
      screen.getByRole('group', { name: 'Tablero de bingo' }),
    );
    expect(board.getAllByRole('img')).toHaveLength(25);
    expect(
      board.getByRole('img', { name: 'Objetivo 1: conseguida' }),
    ).toBeTruthy();
    expect(
      board.getByRole('img', { name: 'Objetivo 3: pendiente' }),
    ).toBeTruthy();
    expect(
      board.getByRole('img', {
        name: 'ESTRELLA (estrella central): conseguida',
      }),
    ).toBeTruthy();
  });

  test('no se puede marcar ni editar', () => {
    openArchived();

    const board = screen.getByRole('group', { name: 'Tablero de bingo' });
    expect(within(board).queryAllByRole('button')).toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: /Editar casillas/ }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cambiar tema' })).toBeNull();

    fireEvent.click(within(board).getByRole('img', { name: /Objetivo 3/ }));

    expect(screen.getByText('3 de 25 conseguidos (12 %)')).toBeTruthy();
  });

  test('volver regresa al historial', () => {
    openArchived();

    fireEvent.click(button('Volver al historial'));

    expect(heading('Historial')).toBeTruthy();
  });
});
