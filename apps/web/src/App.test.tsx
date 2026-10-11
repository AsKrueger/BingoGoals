import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';

afterEach(cleanup);

test('muestra un tablero de ejemplo de 5x5 con título y progreso', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Mis metas' })).toBeTruthy();

  const board = screen.getByRole('group', { name: 'Tablero de bingo' });
  expect(within(board).getAllByRole('button')).toHaveLength(25);

  expect(screen.getByText('1 de 25 conseguidos')).toBeTruthy();
});
