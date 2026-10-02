/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Acorn's version, from extension/package.json (injected by vite.config.ts). */
  readonly VITE_ACORN_VERSION: string;
}
