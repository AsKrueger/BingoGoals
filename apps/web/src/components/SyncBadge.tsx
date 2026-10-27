import type { SyncStatus } from '../sync/syncEngine';
import styles from './SyncBadge.module.css';

export const SYNC_LABELS: Record<SyncStatus, { icon: string; text: string }> = {
  idle: { icon: '☁️', text: 'Preparando la sincronización' },
  syncing: { icon: '🔄', text: 'Sincronizando…' },
  synced: { icon: '✅', text: 'Sincronizado' },
  pending: { icon: '⏳', text: 'Cambios pendientes de subir' },
  offline: { icon: '📴', text: 'Sin conexión: los cambios se guardan aquí' },
  waiting: { icon: '⏳', text: 'Conectando con el servidor…' },
  error: { icon: '⚠️', text: 'No se ha podido sincronizar' },
};

/** Indicador del estado de la sincronización. */
export function SyncBadge({ status }: { status: SyncStatus }) {
  const { icon, text } = SYNC_LABELS[status];
  return (
    <p className={styles.badge} data-status={status} role="status">
      <span aria-hidden="true">{icon}</span> {text}
    </p>
  );
}
