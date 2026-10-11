import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import type { BingoSize } from '../domain';
import { createMemoryStorage } from '../storage/memoryStorage';
import { EMPTY_DATA, type AppData } from '../storage/storage';

const SIZE_NAMES: Record<BingoSize, RegExp> = {
  '3x3': /3 × 3/,
  '5x5': /5 × 5/,
};

export function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

export function heading(name: string) {
  return screen.getByRole('heading', { level: 1, name });
}

/**
 * Muestra la web ya cargada, sin pasar por la carga inicial. Devuelve el
 * almacenamiento en memoria que usa, para inspeccionar lo guardado.
 */
export function renderApp(initialData: AppData = EMPTY_DATA) {
  const storage = createMemoryStorage();
  render(<App initialData={initialData} storage={storage} />);
  return storage;
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
  const storage = renderApp();
  fireEvent.click(button('Empezar ahora'));
  submitCreateForm(title, size);
  return storage;
}

/** Desde la pantalla de tablero, crea otro tablero a través de la colección. */
export function addBoard(title: string, size: BingoSize) {
  fireEvent.click(button('Mis tableros'));
  fireEvent.click(button('+ Nuevo tablero'));
  submitCreateForm(title, size);
}

/** Marca o desmarca las casillas «Objetivo N» indicadas. */
export function mark(...numbers: number[]) {
  for (const number of numbers) {
    fireEvent.click(button(`Objetivo ${number}`));
    // Si la casilla completa una línea, cierra la celebración.
    const celebration = screen.queryByRole('button', {
      name: 'Seguir jugando',
    });
    if (celebration) {
      fireEvent.click(celebration);
    }
  }
}

/** Pulsa el botón de confirmación del diálogo abierto. */
export function confirm(label: string) {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: label }),
  );
}

/** Desde la pantalla de tablero, archiva el tablero activo. */
export function archiveActiveBoard() {
  fireEvent.click(button('Ajustes'));
  fireEvent.click(button('Archivar tablero'));
  confirm('Archivar');
}

/** Valor de una estadística: el <dd> que acompaña al <dt> con ese nombre. */
export function stat(name: string) {
  return screen.getByText(name, { selector: 'dt' }).nextElementSibling
    ?.textContent;
}
