export const RESTRICTED_URL_PROTOCOLS = [
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "devtools:",
  "view-source:",
] as const;

export const CHROME_WEBSTORE_HOST = "chromewebstore.google.com";
export const CHROME_WEBSTORE_LEGACY_HOST = "chrome.google.com";
export const CHROME_WEBSTORE_LEGACY_PATH = "/webstore";

export function canInjectIntoUrl(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if ((RESTRICTED_URL_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
      return false;
    }
    if (parsed.hostname === CHROME_WEBSTORE_HOST) {
      return false;
    }
    if (
      parsed.hostname === CHROME_WEBSTORE_LEGACY_HOST &&
      parsed.pathname.startsWith(CHROME_WEBSTORE_LEGACY_PATH)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
