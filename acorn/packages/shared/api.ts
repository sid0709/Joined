/**
 * Where Acorn's clients find their servers. Acorn's API is backend-core's server: every
 * route lives under `/acorn` on it (api.joinedhq.com/acorn/...), and so does the Socket.IO
 * gateway. A build overrides either host with VITE_ACORN_API_URL / VITE_JOINED_URL.
 */

/** Engine.IO path of Acorn's Socket.IO gateway, on the API host. */
export const ACORN_SOCKET_PATH = "/acorn/socket.io";

export type AcornHosts = {
  /** backend-core's server. */
  api: string;
  /** joined-frontend, whose session cookie Acorn signs in with. */
  joined: string;
};

/** Development builds talk to the local servers (`bun run dev`); every other build to production. */
export const ACORN_HOSTS = {
  development: { api: "http://127.0.0.1:8083", joined: "http://localhost:3002" },
  production: { api: "https://api.joinedhq.com", joined: "https://joinedhq.com" },
} as const satisfies Record<string, AcornHosts>;

/** The hosts for a Vite build mode (`import.meta.env.MODE`). */
export function acornHosts(mode: string): AcornHosts {
  return mode === "development" ? ACORN_HOSTS.development : ACORN_HOSTS.production;
}
