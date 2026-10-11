import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../App';
import type { BingoSize } from '../domain';

const SIZE_NAMES: Record<BingoSize, RegExp> = {
  '3x3': /3 × 3/,
  '5x5': /5 × 5/,
};

export function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

/** Rellena y envía el formulario de la pantalla de creación. */
export function submitCreateForm(title: string, size: BingoSize) {
  fireEvent.change(screen.getByLabelText('Título del tablero'), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole('radio', { name: SIZE_NAMES[size] }));
  fireEvent.click(button('Crear tablero'));
}

/** Abre la web y crea el primer tablero desde la bienvenida. */
export function startApp(title: string, size: BingoSize) {
  render(<App />);
  fireEvent.click(button('Empezar ahora'));
  submitCreateForm(title, size);
}

/** Desde la pantalla de tablero, crea otro tablero a través de la colección. */
export function addBoard(title: string, size: BingoSize) {
  fireEvent.click(button('Mis tableros'));
  fireEvent.click(button('+ Nuevo tablero'));
  submitCreateForm(title, size);
}
