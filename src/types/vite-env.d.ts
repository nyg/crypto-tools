/// <reference types="vite/client" />

interface ImportMetaEnv {
   // VITE_APP_VERSION is not a real environment variable: vite.config.ts substitutes it
   // at build time from package.json, so it is always defined in a built bundle.
   readonly VITE_APP_VERSION: string
   readonly VITE_MOCK_DATA?: string
   readonly VITE_API_BASE?: string
}

interface ImportMeta {
   readonly env: ImportMetaEnv
}
