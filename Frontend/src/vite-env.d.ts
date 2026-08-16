/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_PRODUCTION_BACKEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
