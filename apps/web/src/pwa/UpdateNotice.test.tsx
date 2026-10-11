import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { UpdateNotice } from './UpdateNotice';

afterEach(cleanup);

/** Registro de mentira: devuelve cómo anunciar una versión nueva. */
function renderNotice() {
  let announce: (apply: () => void) => void = () => {};
  render(<UpdateNotice register={(onUpdate) => (announce = onUpdate)} />);
  return (apply: () => void) => act(() => announce(apply));
}

describe('aviso de versión nueva', () => {
  test('no se muestra mientras no haya una versión nueva', () => {
    renderNotice();

    expect(screen.queryByRole('status')).toBeNull();
  });

  test('anuncia la versión nueva y la aplica al aceptarla', () => {
    const apply = vi.fn();
    const announce = renderNotice();

    announce(apply);

    expect(screen.getByRole('status').textContent).toContain(
      'Hay una versión nueva de BingoGoals.',
    );
    expect(apply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(apply).toHaveBeenCalledOnce();
  });

  test('se puede posponer sin aplicar la versión nueva', () => {
    const apply = vi.fn();
    const announce = renderNotice();
    announce(apply);

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
