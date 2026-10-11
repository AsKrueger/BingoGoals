import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { button, heading, mark, startApp, stat } from '../test/helpers';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function openStats() {
  fireEvent.click(button('Estadísticas'));
}

describe('estadísticas', () => {
  test('un 3x3 recién creado no tiene nada completado', () => {
    startApp('Metas', '3x3');

    openStats();

    expect(heading('Estadísticas')).toBeTruthy();
    expect(screen.getByRole('img', { name: '0 % completado' })).toBeTruthy();
    expect(stat('Completadas')).toBe('0');
    expect(stat('Pendientes')).toBe('9');
    expect(stat('Total')).toBe('0 de 8');
    expect(stat('Filas')).toBe('0 de 3');
    expect(stat('Columnas')).toBe('0 de 3');
    expect(stat('Diagonales')).toBe('0 de 2');
  });

  test('un 5x5 recién creado cuenta la estrella central', () => {
    startApp('Metas', '5x5');

    openStats();

    expect(screen.getByRole('img', { name: '4 % completado' })).toBeTruthy();
    expect(stat('Completadas')).toBe('1');
    expect(stat('Pendientes')).toBe('24');
    expect(stat('Total')).toBe('0 de 12');
    expect(stat('Filas')).toBe('0 de 5');
  });

  test('coinciden con las casillas y líneas del tablero', () => {
    startApp('Metas', '3x3');
    // Fila 1 y columna 1.
    mark(1, 2, 3, 4, 7);

    openStats();

    expect(screen.getByRole('img', { name: '56 % completado' })).toBeTruthy();
    expect(stat('Completadas')).toBe('5');
    expect(stat('Pendientes')).toBe('4');
    expect(stat('Total')).toBe('2 de 8');
    expect(stat('Filas')).toBe('1 de 3');
    expect(stat('Columnas')).toBe('1 de 3');
    expect(stat('Diagonales')).toBe('0 de 2');
  });

  test('se actualizan al marcar y desmarcar una casilla', () => {
    startApp('Metas', '3x3');
    mark(1, 2);
    openStats();
    expect(stat('Completadas')).toBe('2');
    expect(stat('Total')).toBe('0 de 8');

    fireEvent.click(button('Volver al tablero'));
    mark(3);
    openStats();

    expect(stat('Completadas')).toBe('3');
    expect(stat('Pendientes')).toBe('6');
    expect(stat('Total')).toBe('1 de 8');

    fireEvent.click(button('Volver al tablero'));
    mark(3);
    openStats();

    expect(stat('Completadas')).toBe('2');
    expect(stat('Total')).toBe('0 de 8');
  });

  test('muestran el resumen del tablero y los días desde su creación', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00'));
    startApp('Metas de otoño', '5x5');

    vi.setSystemTime(new Date('2026-10-11T18:00:00'));
    openStats();

    expect(stat('Nombre')).toBe('Metas de otoño');
    expect(stat('Tamaño')).toBe('5 × 5');
    expect(stat('Fecha de creación')).toBe('1 de octubre de 2026');
    expect(stat('Días desde su creación')).toBe('10');
  });

  test('usan el tema del tablero y vuelven al tablero', () => {
    startApp('Metas', '3x3');
    fireEvent.click(button('Cambiar tema'));
    fireEvent.click(button('Navidad'));
    fireEvent.click(button('Cerrar'));

    openStats();

    expect(heading('Estadísticas').closest('[data-theme]')).toHaveProperty(
      'dataset.theme',
      'christmas',
    );

    fireEvent.click(button('Volver al tablero'));
    expect(heading('Metas')).toBeTruthy();
  });
});
