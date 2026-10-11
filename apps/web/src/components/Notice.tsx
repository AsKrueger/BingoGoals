import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeAction {
  label: string;
  onClick: () => void;
}

interface NoticeProps {
  /** Un error interrumpe al lector de pantalla; un aviso normal, no. */
  kind: 'error' | 'info';
  children: ReactNode;
  actions?: NoticeAction[];
}

/** Aviso fijo en la parte inferior, por encima de cualquier pantalla. */
export function Notice({ kind, children, actions = [] }: NoticeProps) {
  return (
    <div
      className={styles.notice}
      data-kind={kind}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <p className={styles.message}>{children}</p>
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={styles.action}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NoticeStackProps {
  /** Los avisos van abajo; el de versión nueva, arriba, para no solaparse. */
  position?: 'top' | 'bottom';
  children: ReactNode;
}

/** Contenedor que apila los avisos visibles. */
export function NoticeStack({
  position = 'bottom',
  children,
}: NoticeStackProps) {
  return (
    <div className={styles.stack} data-position={position}>
      {children}
    </div>
  );
}
