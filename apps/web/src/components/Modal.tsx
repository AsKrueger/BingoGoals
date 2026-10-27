import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  /** Id del elemento que da nombre al diálogo. */
  labelledBy: string;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  children: ReactNode;
}

/** Todo lo que puede recibir el foco con Tab dentro de un diálogo. */
const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Diálogo modal: cierra con Escape o al tocar fuera y mantiene el foco dentro. */
export function Modal({
  labelledBy,
  onClose,
  className = '',
  backdropClassName = '',
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Se anota durante el primer render, antes de que el diálogo robe el foco.
  const [opener] = useState(() => document.activeElement);
  // Elemento del diálogo que tenía el foco la última vez que se desmontó.
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    // Al abrirse, el foco tiene que estar dentro. Normalmente ya lo ha puesto
    // un autoFocus, pero no siempre lo hay; y el modo estricto de React
    // desmonta y vuelve a montar este efecto, lo que saca el foco del diálogo.
    if (dialog && !dialog.contains(document.activeElement)) {
      const target =
        lastFocused.current ??
        dialog.querySelector<HTMLElement>(FOCUSABLE) ??
        dialog;
      target.focus();
    }

    // Al cerrarse, el foco vuelve al elemento que abrió el diálogo.
    return () => {
      const active = document.activeElement;
      lastFocused.current =
        active instanceof HTMLElement && dialog?.contains(active)
          ? active
          : null;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, [opener]);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusable =
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div
      className={`${styles.backdrop} ${backdropClassName}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // Permite enfocar el propio diálogo si no contiene nada enfocable.
        tabIndex={-1}
        className={`${styles.dialog} ${className}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
