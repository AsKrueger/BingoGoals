import { useEffect, useState } from 'react';
import { Notice, NoticeStack } from '../components/Notice';
import { registerServiceWorker } from './serviceWorker';

interface UpdateNoticeProps {
  /** Se puede sustituir en los tests; por defecto registra el service worker. */
  register?: typeof registerServiceWorker;
}

/** Anuncia que hay una versión nueva y la aplica cuando el usuario acepta. */
export function UpdateNotice({
  register = registerServiceWorker,
}: UpdateNoticeProps) {
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    // setState con una función la ejecutaría: por eso va envuelta.
    register((apply) => setApplyUpdate(() => apply));
  }, [register]);

  return (
    <NoticeStack position="top">
      {applyUpdate && (
        <Notice
          kind="info"
          actions={[
            { label: 'Actualizar', onClick: applyUpdate },
            { label: 'Ahora no', onClick: () => setApplyUpdate(null) },
          ]}
        >
          Hay una versión nueva de BingoGoals.
        </Notice>
      )}
    </NoticeStack>
  );
}
