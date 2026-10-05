export const DEV_API_HOST = "http://127.0.0.1:8082";
export const DEV_WEB_ORIGIN = "http://localhost:6003";
export const PRODUCTION_API_HOST = "https://scout.joinedhq.com";
export const PRODUCTION_WEB_ORIGIN = "https://scout.joinedhq.com";

const LOCAL_DEV_HOST_MARKERS = ["localhost", "127.0.0.1", "[::1]"] as const;

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export function resolveHost(
  override: string | undefined,
  mode: string | undefined,
  productionHost: string,
  developmentHost: string,
): string {
  if (override) {
    return trimTrailingSlash(override);
  }
  return mode === "production" ? productionHost : developmentHost;
}

export function hostPermissionPattern(origin: string): string {
  return `${trimTrailingSlash(origin)}/*`;
}

export function uniqueHostPermissions(origins: string[]): string[] {
  return [...new Set(origins.map(hostPermissionPattern))];
}

export function containsLocalDevHost(value: string): boolean {
  const normalized = value.toLowerCase();
  return LOCAL_DEV_HOST_MARKERS.some((marker) => normalized.includes(marker));
}

export function isDevApiHost(value: string): boolean {
  const normalized = trimTrailingSlash(value);
  return (
    normalized === DEV_API_HOST || normalized === DEV_WEB_ORIGIN || containsLocalDevHost(value)
  );
}
