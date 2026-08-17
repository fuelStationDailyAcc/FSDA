/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface Navigator {
  standalone?: boolean
}

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_PRODUCTION_BACKEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
