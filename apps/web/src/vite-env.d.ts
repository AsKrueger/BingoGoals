/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dirección de la API. Sin ella se usa http://localhost:3000. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
