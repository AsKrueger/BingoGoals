import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAccountApi } from './account/api';
import { createLocalSessionStore } from './account/sessionStore';
import { createBoardsApi } from './sync/boardsApi';
import { AppLoader } from './AppLoader';
import './index.css';
import { UpdateNotice } from './pwa/UpdateNotice';
import { createIndexedDbStorage } from './storage/indexedDbStorage';

// Único punto donde se elige el almacenamiento real: el resto de la web solo
// conoce la interfaz BoardStorage.
const storage = createIndexedDbStorage();

// La dirección de la API se fija al compilar, con VITE_API_URL.
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const accountServices = {
  api: createAccountApi(apiUrl),
  boardsApi: createBoardsApi(apiUrl),
  sessionStore: createLocalSessionStore(),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoader storage={storage} accountServices={accountServices} />
    <UpdateNotice />
  </StrictMode>,
);
