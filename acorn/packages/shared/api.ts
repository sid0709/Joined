/**
 * Where Acorn's clients find their servers. Every route lives under `/acorn` on the
 * API, and so does the Socket.IO gateway. A build overrides either host with
 * VITE_ACORN_API_URL / VITE_ACORN_WEB_URL.
 */

/** Engine.IO path of Acorn's Socket.IO gateway, on the API host. */
export const ACORN_SOCKET_PATH = "/acorn/socket.io";

/** Cookie acorn-frontend sets and the extension reads. The API accepts it as a bearer token. */
export const ACORN_SESSION_COOKIE = "acorn_session";

export type AcornHosts = {
  /** acorn-backend. */
  api: string;
  /** acorn-frontend, whose session cookie Acorn signs in with. */
  web: string;
};

/** Development builds talk to the local servers (`bun run dev`); every other build to production. */
export const ACORN_HOSTS = {
  development: { api: "http://127.0.0.1:8083", web: "http://localhost:6005" },
  production: { api: "https://api.joinedhq.com", web: "https://acorn.joinedhq.com" },
} as const satisfies Record<string, AcornHosts>;

/** The hosts for a Vite build mode (`import.meta.env.MODE`). */
export function acornHosts(mode: string): AcornHosts {
  return mode === "development" ? ACORN_HOSTS.development : ACORN_HOSTS.production;
}
