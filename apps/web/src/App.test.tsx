import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { App } from './App';
import { BINGO_THEMES } from './domain';
import { addBoard, button, startApp, submitCreateForm } from './test/helpers';
import { THEMES } from './themes';

afterEach(cleanup);

function heading(name: string) {
  return screen.getByRole('heading', { level: 1, name });
}

function cells() {
  const board = screen.getByRole('group', { name: 'Tablero de bingo' });
  return within(board).getAllByRole('button');
}

function currentTheme() {
  return heading(screen.getByRole('heading', { level: 1 }).textContent)
    .closest('[data-theme]')
    ?.getAttribute('data-theme');
}

function chooseTheme(label: string) {
  fireEvent.click(button('Cambiar tema'));
  fireEvent.click(button(label));
  fireEvent.click(button('Cerrar'));
}

describe('bienvenida', () => {
  test('sin tableros, la web muestra la bienvenida y ningún tablero', () => {
    render(<App />);

    expect(heading('BingoGoals')).toBeTruthy();
    expect(button('Empezar ahora')).toBeTruthy();
    expect(
      screen.queryByRole('group', { name: 'Tablero de bingo' }),
    ).toBeNull();
  });

  test('cancelar la creación sin tableros vuelve a la bienvenida', () => {
    render(<App />);
    fireEvent.click(button('Empezar ahora'));

    fireEvent.click(button('Volver'));

    expect(heading('BingoGoals')).toBeTruthy();
  });
});

describe('creación', () => {
  test('crea un tablero de 3x3 con 9 casillas y sin estrella', () => {
    startApp('Metas de verano', '3x3');

    expect(heading('Metas de verano')).toBeTruthy();
    expect(cells()).toHaveLength(9);
    expect(
      screen.queryByRole('button', { name: /estrella central/ }),
    ).toBeNull();
  });

  test('crea un tablero de 5x5 con 25 casillas y estrella central', () => {
    startApp('Metas del año', '5x5');

    expect(cells()).toHaveLength(25);
    expect(button('ESTRELLA (estrella central)')).toBeTruthy();
    expect(screen.getByText('1 de 25 conseguidos')).toBeTruthy();
  });

  test.each(['', '   '])('no crea un tablero con el título "%s"', (title) => {
    render(<App />);
    fireEvent.click(button('Empezar ahora'));

    submitCreateForm(title, '3x3');

    expect(screen.getByRole('alert').textContent).toBe(
      'Escribe un título para el tablero.',
    );
    expect(heading('Nuevo tablero')).toBeTruthy();
  });

  test('el aviso desaparece al escribir un título', () => {
    render(<App />);
    fireEvent.click(button('Empezar ahora'));
    fireEvent.click(button('Crear tablero'));

    fireEvent.change(screen.getByLabelText('Título del tablero'), {
      target: { value: 'Metas' },
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('quita los espacios sobrantes del título', () => {
    startApp('  Metas  ', '3x3');

    expect(heading('Metas')).toBeTruthy();
  });

  test('el tablero recién creado pasa a ser el activo', () => {
    startApp('Primero', '3x3');

    addBoard('Segundo', '5x5');

    expect(heading('Segundo')).toBeTruthy();
    fireEvent.click(button('Mis tableros'));
    expect(button('Abrir Segundo').getAttribute('aria-current')).toBe('true');
    expect(button('Abrir Primero').getAttribute('aria-current')).toBeNull();
  });

  test('cancelar la creación con tableros vuelve a la colección', () => {
    startApp('Primero', '3x3');
    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('+ Nuevo tablero'));

    fireEvent.click(button('Volver'));

    expect(heading('Mis tableros')).toBeTruthy();
  });
});

describe('colección', () => {
  test('lista todos los tableros con su tamaño y progreso', () => {
    startApp('Primero', '3x3');
    fireEvent.click(button('Objetivo 1'));
    addBoard('Segundo', '5x5');

    fireEvent.click(button('Mis tableros'));

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('Primero');
    expect(items[0]?.textContent).toContain('3 × 3 · 1 de 9 conseguidos');
    expect(items[1]?.textContent).toContain('Segundo');
    expect(items[1]?.textContent).toContain('5 × 5 · 1 de 25 conseguidos');
    expect(
      screen
        .getByRole('progressbar', { name: 'Progreso de Primero' })
        .getAttribute('aria-valuenow'),
    ).toBe('1');
  });

  test('cambiar de tablero conserva las casillas marcadas de cada uno', () => {
    startApp('Primero', '3x3');
    fireEvent.click(button('Objetivo 1'));
    addBoard('Segundo', '3x3');
    fireEvent.click(button('Objetivo 2'));
    fireEvent.click(button('Objetivo 3'));

    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('Abrir Primero'));

    expect(heading('Primero')).toBeTruthy();
    expect(button('Objetivo 1').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();

    fireEvent.click(button('Mis tableros'));
    fireEvent.click(button('Abrir Segundo'));

    expect(button('Objetivo 1').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('2 de 9 conseguidos')).toBeTruthy();
  });

  test('volver al tablero no cambia el activo', () => {
    startApp('Primero', '3x3');
    addBoard('Segundo', '3x3');
    fireEvent.click(button('Mis tableros'));

    fireEvent.click(button('Volver al tablero'));

    expect(heading('Segundo')).toBeTruthy();
  });

  test('eliminar pide confirmación y cancelar no borra nada', () => {
    startApp('Primero', '3x3');
    fireEvent.click(button('Mis tableros'));

    fireEvent.click(button('Eliminar Primero'));

    const dialog = within(
      screen.getByRole('dialog', { name: '¿Eliminar tablero?' }),
    );
    expect(
      dialog.getByText('Se borrará «Primero» y no se podrá recuperar.'),
    ).toBeTruthy();

    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  test('al eliminar el activo se activa el primero que queda', () => {
    startApp('Primero', '3x3');
    addBoard('Segundo', '3x3');
    addBoard('Tercero', '3x3');
    fireEvent.click(button('Mis tableros'));

    fireEvent.click(button('Eliminar Tercero'));
    fireEvent.click(button('Eliminar'));

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(button('Abrir Primero').getAttribute('aria-current')).toBe('true');
    fireEvent.click(button('Volver al tablero'));
    expect(heading('Primero')).toBeTruthy();
  });

  test('al eliminar otro tablero el activo no cambia', () => {
    startApp('Primero', '3x3');
    addBoard('Segundo', '3x3');
    fireEvent.click(button('Mis tableros'));

    fireEvent.click(button('Eliminar Primero'));
    fireEvent.click(button('Eliminar'));

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(button('Abrir Segundo').getAttribute('aria-current')).toBe('true');
  });

  test('al eliminar el último tablero vuelve la bienvenida', () => {
    startApp('Primero', '3x3');
    fireEvent.click(button('Mis tableros'));

    fireEvent.click(button('Eliminar Primero'));
    fireEvent.click(button('Eliminar'));

    expect(heading('BingoGoals')).toBeTruthy();
    expect(button('Empezar ahora')).toBeTruthy();
  });
});

describe('temas', () => {
  test('un tablero nuevo usa el tema clásico', () => {
    startApp('Metas', '3x3');

    expect(currentTheme()).toBe('classic');
  });

  test('el selector ofrece los seis temas y marca el actual', () => {
    startApp('Metas', '3x3');

    fireEvent.click(button('Cambiar tema'));

    const dialog = within(
      screen.getByRole('dialog', { name: 'Elige tu estilo' }),
    );
    const options = BINGO_THEMES.map((theme) =>
      dialog.getByRole('button', { name: THEMES[theme].label }),
    );
    expect(options).toHaveLength(6);
    expect(
      options.map((option) => option.getAttribute('aria-pressed')),
    ).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
  });

  test.each(BINGO_THEMES)('aplica el tema %s al tablero', (theme) => {
    startApp('Metas', '3x3');

    chooseTheme(THEMES[theme].label);

    expect(currentTheme()).toBe(theme);
  });

  test('el tema se guarda por tablero', () => {
    startApp('Primero', '3x3');
    chooseTheme('Sakura');
    addBoard('Segundo', '3x3');
    expect(currentTheme()).toBe('classic');
    chooseTheme('Navidad');

    fireEvent.click(button('Mis tableros'));

    const [first, second] = screen.getAllByRole('listitem');
    expect(first?.getAttribute('data-theme')).toBe('sakura');
    expect(second?.getAttribute('data-theme')).toBe('christmas');

    fireEvent.click(button('Abrir Primero'));
    expect(currentTheme()).toBe('sakura');
  });

  test('cambiar de tema no altera las casillas', () => {
    startApp('Metas', '3x3');
    fireEvent.click(button('Objetivo 1'));

    chooseTheme('Primavera');

    expect(button('Objetivo 1').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('foco', () => {
  test.each([
    ['Cambiar tema', 'botón Cerrar'],
    ['Cambiar tema', 'Escape'],
  ])(
    'al cerrar el diálogo de %s con %s vuelve a quien lo abrió',
    (name, how) => {
      startApp('Metas', '3x3');
      const opener = button(name);
      opener.focus();
      fireEvent.click(opener);
      expect(document.activeElement).not.toBe(opener);

      if (how === 'Escape') {
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      } else {
        fireEvent.click(button('Cerrar'));
      }

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(opener);
    },
  );

  test('al cancelar la edición de una casilla vuelve a la casilla', () => {
    startApp('Metas', '3x3');
    fireEvent.click(button(/Editar casillas/));
    const opener = button('Editar: Objetivo 4');
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(document.activeElement).toBe(opener);
  });

  test('al cancelar la eliminación vuelve al botón de eliminar', () => {
    startApp('Metas', '3x3');
    fireEvent.click(button('Mis tableros'));
    const opener = button('Eliminar Metas');
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(document.activeElement).toBe(opener);
  });

  test('al cambiar de pantalla el foco pasa al título', () => {
    startApp('Metas', '3x3');
    expect(document.activeElement).toBe(heading('Metas'));

    fireEvent.click(button('Mis tableros'));

    expect(document.activeElement).toBe(heading('Mis tableros'));
  });

  test('la pantalla de creación enfoca el campo del título', () => {
    render(<App />);

    fireEvent.click(button('Empezar ahora'));

    expect(document.activeElement).toBe(
      screen.getByLabelText('Título del tablero'),
    );
  });
});
