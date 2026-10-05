const DEFAULT_API_HOST = "http://127.0.0.1:8082";

export function getApiHost(): string {
  return import.meta.env.VITE_SCOUT_API_HOST || DEFAULT_API_HOST;
}

export function getSignInUrl(): string {
  const host = getApiHost();
  if (host.includes("127.0.0.1") || host.includes("localhost")) {
    return "http://localhost:3002/scout/signin";
  }
  return `${host}/scout/signin`;
}
