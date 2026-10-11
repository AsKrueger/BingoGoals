import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLoader } from './AppLoader';
import './index.css';
import { UpdateNotice } from './pwa/UpdateNotice';
import { createIndexedDbStorage } from './storage/indexedDbStorage';

// Único punto donde se elige el almacenamiento real: el resto de la web solo
// conoce la interfaz BoardStorage.
const storage = createIndexedDbStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoader storage={storage} />
    <UpdateNotice />
  </StrictMode>,
);
