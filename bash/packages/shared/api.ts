/**
 * Where Bash's clients find their servers. Bash's API is backend-core's server: every
 * route lives under `/bash` on it (api.joinedhq.com/bash/...), and so does the Socket.IO
 * gateway. A build overrides either host with VITE_BASH_API_URL / VITE_JOINED_URL.
 */

/** Engine.IO path of Bash's Socket.IO gateway, on the API host. */
export const BASH_SOCKET_PATH = "/bash/socket.io";

export type BashHosts = {
  /** backend-core's server. */
  api: string;
  /** joined-frontend, whose session cookie Bash signs in with. */
  joined: string;
};

/** Development builds talk to the local servers (`bun run dev`); every other build to production. */
export const BASH_HOSTS = {
  development: { api: "http://127.0.0.1:8083", joined: "http://localhost:3002" },
  production: { api: "https://api.joinedhq.com", joined: "https://joinedhq.com" },
} as const satisfies Record<string, BashHosts>;

/** The hosts for a Vite build mode (`import.meta.env.MODE`). */
export function bashHosts(mode: string): BashHosts {
  return mode === "development" ? BASH_HOSTS.development : BASH_HOSTS.production;
}
