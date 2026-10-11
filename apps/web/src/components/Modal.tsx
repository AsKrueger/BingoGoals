import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  /** Id del elemento que da nombre al diálogo. */
  labelledBy: string;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  children: ReactNode;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled)';

/** Diálogo modal: cierra con Escape o al tocar fuera y mantiene el foco dentro. */
export function Modal({
  labelledBy,
  onClose,
  className = '',
  backdropClassName = '',
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Al cerrar, el foco vuelve al elemento que abrió el diálogo.
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);

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
        className={`${styles.dialog} ${className}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
