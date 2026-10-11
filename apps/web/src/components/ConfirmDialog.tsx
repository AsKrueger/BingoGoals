import { useId } from 'react';
import styles from './ConfirmDialog.module.css';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmación de una acción que no se puede deshacer. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} onClose={onCancel} className={styles.dialog}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancel}
          autoFocus
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
