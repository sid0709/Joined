/** @typedef {"dev" | "start"} ServiceMode */

/**
 * Local apps — ports align with `bun run dev` (`tools/dev-all.mjs`).
 * `startExtraArgs` are passed after `bun --filter <workspace> start --`.
 */
export const LOCAL_SERVICES = [
  {
    id: "connected-frontend",
    shortName: "app",
    port: 6004,
    color: "\x1b[36m",
    workspace: "connected-frontend",
    startExtraArgs: ["--port", "6004"],
  },
  {
    id: "joined-theme",
    shortName: "theme",
    port: 6001,
    color: "\x1b[35m",
    workspace: "joined-theme",
    startExtraArgs: ["--port", "6001"],
  },
  {
    id: "joined-frontend",
    shortName: "joined",
    port: 6002,
    color: "\x1b[32m",
    workspace: "joined-frontend",
    startExtraArgs: ["--port", "6002"],
  },
  {
    id: "scoutwell-frontend",
    shortName: "scout",
    port: 6003,
    color: "\x1b[36m",
    workspace: "scoutwell-frontend",
    startExtraArgs: ["--port", "6003"],
  },
  {
    id: "admin-frontend",
    shortName: "admin",
    port: 6010,
    color: "\x1b[33m",
    workspace: "admin-frontend",
    startExtraArgs: [],
  },
  {
    id: "acorn-frontend",
    shortName: "acorn-web",
    port: 6005,
    color: "\x1b[95m",
    workspace: "acorn-frontend",
    startExtraArgs: ["--port", "6005"],
  },
];

/** A Go backend service. `go run -C <dir>` makes it read its own `<dir>/.env`. */
function goService({ id, shortName, port, color }) {
  return {
    id,
    shortName,
    port,
    color,
    url: `http://127.0.0.1:${port}`,
    command: "go",
    args: ["run", "-C", id, "./cmd/server"],
  };
}

/** Backend services, one per app — run by `bun run dev` and `bun run dev:api`. */
export const API_SERVICES = [
  goService({ id: "joined-backend", shortName: "joined-api", port: 8080, color: "\x1b[34m" }),
  goService({ id: "admin-backend", shortName: "admin-api", port: 8081, color: "\x1b[93m" }),
  goService({ id: "scoutwell-backend", shortName: "scout-api", port: 8082, color: "\x1b[96m" }),
  // Acorn's own server. Routes stay under /acorn; nginx publishes them at api.joinedhq.com.
  goService({ id: "acorn-backend", shortName: "acorn-api", port: 8083, color: "\x1b[94m" }),
];

/** Frontends audited by `bun run audit` (excludes theme). */
export const AUDIT_FRONTEND_IDS = [
  "connected-frontend",
  "joined-frontend",
  "scoutwell-frontend",
  "admin-frontend",
];

export function localService(idOrShortName) {
  const key = idOrShortName.trim().toLowerCase();
  const service = LOCAL_SERVICES.find((entry) => entry.id === key || entry.shortName === key);
  if (!service) {
    const known = LOCAL_SERVICES.map((entry) => `${entry.id} (${entry.shortName})`).join(", ");
    throw new Error(`Unknown service "${idOrShortName}". Expected one of: ${known}`);
  }
  return service;
}

export function apiService(idOrShortName) {
  const key = idOrShortName.trim().toLowerCase();
  const service = API_SERVICES.find((entry) => entry.id === key || entry.shortName === key);
  if (!service) {
    const known = API_SERVICES.map((entry) => `${entry.id} (${entry.shortName})`).join(", ");
    throw new Error(`Unknown API "${idOrShortName}". Expected one of: ${known}`);
  }
  return service;
}

export function serviceSite(service) {
  return `http://localhost:${service.port}`;
}
