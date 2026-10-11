import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';

afterEach(cleanup);

test('muestra el título de la aplicación', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'BingoGoals' })).toBeTruthy();
});
