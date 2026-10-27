import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { Modal } from './Modal';

afterEach(cleanup);

function Harness({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir
      </button>
      {isOpen && (
        <Modal labelledBy="titulo" onClose={() => setIsOpen(false)}>
          <h2 id="titulo">Diálogo</h2>
          {children}
        </Modal>
      )}
    </>
  );
}

const withAutoFocus = (
  <>
    <button type="button">Primero</button>
    <input aria-label="Campo" autoFocus />
    <button type="button">Último</button>
  </>
);

const withoutAutoFocus = (
  <>
    <button type="button">Primero</button>
    <button type="button">Último</button>
  </>
);

// Un diálogo que empieza y acaba con elementos que no son ni botones ni
// campos de texto.
const withOtherControls = (
  <>
    <a href="https://example.com/ayuda">Ayuda</a>
    <select aria-label="Opción">
      <option>Una</option>
    </select>
    <input type="hidden" name="oculto" />
    <button type="button" disabled>
      Desactivado
    </button>
    <span tabIndex={0}>Enfocable</span>
    <textarea aria-label="Comentario" />
  </>
);

/** Abre el diálogo como lo haría un usuario: con el foco en el botón. */
function openDialog() {
  const opener = screen.getByRole('button', { name: 'Abrir' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

// El modo estricto de React monta, desmonta y vuelve a montar cada efecto en
// desarrollo: así es como se usa la web con `npm run dev`.
describe.each([
  ['sin modo estricto', false],
  ['con modo estricto, como en npm run dev', true],
])('Modal %s', (_, strict) => {
  function renderHarness(children: ReactNode) {
    const harness = <Harness>{children}</Harness>;
    render(strict ? <StrictMode>{harness}</StrictMode> : harness);
  }

  test('al abrirse, el foco entra en el elemento con autoFocus', () => {
    renderHarness(withAutoFocus);

    openDialog();

    expect(document.activeElement).toBe(screen.getByLabelText('Campo'));
  });

  test('sin autoFocus, el foco entra en el primer elemento del diálogo', () => {
    renderHarness(withoutAutoFocus);

    openDialog();

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Primero' }),
    );
  });

  test('Escape lo cierra desde el elemento enfocado', () => {
    renderHarness(withAutoFocus);
    openDialog();

    // La tecla se pulsa donde está el foco, no directamente en el diálogo.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('al cerrarse, el foco vuelve a quien lo abrió', () => {
    renderHarness(withAutoFocus);
    const opener = openDialog();

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

    expect(document.activeElement).toBe(opener);
  });

  test('Tab no sale del diálogo: del último pasa al primero y al revés', () => {
    renderHarness(withAutoFocus);
    openDialog();
    const first = screen.getByRole('button', { name: 'Primero' });
    const last = screen.getByRole('button', { name: 'Último' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  test('Tab tampoco sale con enlaces, desplegables y áreas de texto', () => {
    renderHarness(withOtherControls);
    openDialog();
    const link = screen.getByRole('link', { name: 'Ayuda' });
    const textarea = screen.getByLabelText('Comentario');

    // Sin autoFocus, el foco entra en el primer elemento: el enlace.
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(link, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(textarea);

    fireEvent.keyDown(textarea, { key: 'Tab' });
    expect(document.activeElement).toBe(link);
  });

  test('en medio del diálogo, Tab sigue su curso normal', () => {
    renderHarness(withOtherControls);
    openDialog();
    const select = screen.getByLabelText('Opción');
    select.focus();

    // El diálogo no interviene: no cancela la tecla ni mueve el foco.
    expect(fireEvent.keyDown(select, { key: 'Tab' })).toBe(true);
    expect(document.activeElement).toBe(select);
  });

  test('tocar fuera lo cierra; tocar dentro, no', () => {
    renderHarness(withAutoFocus);
    openDialog();

    fireEvent.click(screen.getByRole('heading', { name: 'Diálogo' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
