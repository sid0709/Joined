/// <reference types="vite/client" />
/// <reference types="@crxjs/vite-plugin/client" />

interface ImportMetaEnv {
  readonly VITE_SCOUT_VERSION: string;
  readonly VITE_SCOUT_API_HOST?: string;
  readonly VITE_SCOUTWELL_WEB_ORIGIN?: string;
}
