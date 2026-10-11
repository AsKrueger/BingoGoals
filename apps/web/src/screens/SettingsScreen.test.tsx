import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import {
  addBoard,
  button,
  confirm,
  heading,
  mark,
  startApp,
} from '../test/helpers';

afterEach(cleanup);

function openSettings() {
  fireEvent.click(button('Ajustes'));
}

function titleInput() {
  return screen.getByLabelText<HTMLInputElement>('Título del tablero');
}

function rename(title: string) {
  fireEvent.change(titleInput(), { target: { value: title } });
  fireEvent.click(button('Guardar nombre'));
}

function isPressed(name: string) {
  return button(name).getAttribute('aria-pressed') === 'true';
}

describe('renombrar', () => {
  test('el campo empieza con el título actual', () => {
    startApp('Metas', '3x3');

    openSettings();

    expect(heading('Ajustes')).toBeTruthy();
    expect(titleInput().value).toBe('Metas');
    expect(button('Guardar nombre')).toHaveProperty('disabled', true);
  });

  test('el título cambia en el tablero y en la colección', () => {
    startApp('Metas', '3x3');
    openSettings();

    rename('  Metas de otoño  ');

    expect(screen.getByRole('status').textContent).toBe('Nombre guardado.');
    expect(titleInput().value).toBe('Metas de otoño');

    fireEvent.click(button('Volver al tablero'));
    expect(heading('Metas de otoño')).toBeTruthy();

    fireEvent.click(button('Mis tableros'));
    expect(button('Abrir Metas de otoño')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir Metas' })).toBeNull();
  });

  test.each(['', '   '])('no admite el título "%s"', (title) => {
    startApp('Metas', '3x3');
    openSettings();

    rename(title);

    expect(screen.getByRole('alert').textContent).toBe(
      'Escribe un título para el tablero.',
    );
    expect(screen.getByRole('status').textContent).toBe('');
    fireEvent.click(button('Volver al tablero'));
    expect(heading('Metas')).toBeTruthy();
  });

  test('renombrar no altera las casillas ni el tema', () => {
    startApp('Metas', '3x3');
    mark(1);
    openSettings();

    rename('Otro nombre');

    fireEvent.click(button('Volver al tablero'));
    expect(isPressed('Objetivo 1')).toBe(true);
    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();
  });

  test('solo renombra el tablero activo', () => {
    startApp('Primero', '3x3');
    addBoard('Segundo', '3x3');
    openSettings();

    rename('Cambiado');

    fireEvent.click(button('Volver al tablero'));
    fireEvent.click(button('Mis tableros'));
    expect(button('Abrir Primero')).toBeTruthy();
    expect(button('Abrir Cambiado')).toBeTruthy();
  });
});

describe('tema', () => {
  test('se puede cambiar desde ajustes con el mismo selector', () => {
    startApp('Metas', '3x3');
    openSettings();
    expect(screen.getByText('Clásico', { exact: false })).toBeTruthy();

    fireEvent.click(button('Cambiar tema'));
    const dialog = within(
      screen.getByRole('dialog', { name: 'Elige tu estilo' }),
    );
    fireEvent.click(dialog.getByRole('button', { name: 'Primavera' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Cerrar' }));

    expect(heading('Ajustes').closest('[data-theme]')).toHaveProperty(
      'dataset.theme',
      'spring',
    );
    expect(screen.getByText('Primavera', { exact: false })).toBeTruthy();

    fireEvent.click(button('Volver al tablero'));
    expect(heading('Metas').closest('[data-theme]')).toHaveProperty(
      'dataset.theme',
      'spring',
    );
  });
});

describe('reiniciar', () => {
  test('pide confirmación y cancelar no desmarca nada', () => {
    startApp('Metas', '3x3');
    mark(1, 2);
    openSettings();

    fireEvent.click(button('Reiniciar tablero'));

    const dialog = within(
      screen.getByRole('dialog', { name: '¿Reiniciar tablero?' }),
    );
    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(button('Volver al tablero'));
    expect(screen.getByText('2 de 9 conseguidos')).toBeTruthy();
  });

  test('en 3x3 desmarca todas las casillas y vuelve al tablero', () => {
    startApp('Metas', '3x3');
    mark(1, 2, 5);
    openSettings();

    fireEvent.click(button('Reiniciar tablero'));
    confirm('Reiniciar');

    expect(heading('Metas')).toBeTruthy();
    expect(screen.getByText('0 de 9 conseguidos')).toBeTruthy();
    expect(isPressed('Objetivo 1')).toBe(false);
  });

  test('en 5x5 la estrella central sigue completada', () => {
    startApp('Metas', '5x5');
    mark(1, 2, 25);
    openSettings();

    fireEvent.click(button('Reiniciar tablero'));
    confirm('Reiniciar');

    expect(screen.getByText('1 de 25 conseguidos')).toBeTruthy();
    expect(isPressed('ESTRELLA (estrella central)')).toBe(true);
    expect(isPressed('Objetivo 25')).toBe(false);
  });

  test('conserva los textos e iconos de las casillas', () => {
    startApp('Metas', '3x3');
    fireEvent.click(button(/Editar casillas/));
    fireEvent.click(button('Editar: Objetivo 1'));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Texto del objetivo'), {
      target: { value: 'Correr 10 km' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Deporte' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));
    fireEvent.click(button(/Editar casillas/));
    fireEvent.click(button('Correr 10 km'));
    openSettings();

    fireEvent.click(button('Reiniciar tablero'));
    confirm('Reiniciar');

    const cell = button('Correr 10 km');
    expect(cell.getAttribute('aria-pressed')).toBe('false');
    expect(cell.textContent).toContain('🏋️');
  });

  test('tras reiniciar se puede volver a celebrar una línea', () => {
    startApp('Metas', '3x3');
    mark(1, 2, 3);
    openSettings();
    fireEvent.click(button('Reiniciar tablero'));
    confirm('Reiniciar');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(button('Objetivo 1'));
    fireEvent.click(button('Objetivo 2'));
    fireEvent.click(button('Objetivo 3'));

    expect(screen.getByRole('dialog', { name: '¡LÍNEA!' })).toBeTruthy();
  });
});
