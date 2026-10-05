/** Local acorn-backend. Override with ACORN_API_URL. */
const DEFAULT_API_URL = "http://127.0.0.1:8083";

export const BRAND = "Acorn";

export function acornApiUrl(): string {
  return (process.env.ACORN_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

/** Chrome Web Store or sideload URL. Empty until a listing exists. */
export function extensionInstallUrl(): string | null {
  const url = process.env.ACORN_EXTENSION_INSTALL_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** A packed build (.zip) for sideloading while there is no store listing. */
export function extensionDownloadUrl(): string | null {
  const url = process.env.ACORN_EXTENSION_DOWNLOAD_URL?.trim();
  return url || null;
}
