/** @typedef {"dev" | "start"} ServiceMode */

/**
 * Local apps and API — ports align with `bun run dev` (`tools/dev-all.mjs`).
 * `startExtraArgs` are passed after `bun --filter <workspace> start --`.
 */
export const LOCAL_SERVICES = [
  {
    id: "connected-frontend",
    shortName: "app",
    port: 3000,
    color: "\x1b[36m",
    workspace: "connected-frontend",
    startExtraArgs: [],
  },
  {
    id: "joined-theme",
    shortName: "theme",
    port: 3001,
    color: "\x1b[35m",
    workspace: "joined-theme",
    startExtraArgs: ["--port", "3001"],
  },
  {
    id: "joined-frontend",
    shortName: "joined",
    port: 3002,
    color: "\x1b[32m",
    workspace: "joined-frontend",
    startExtraArgs: ["--port", "3002"],
  },
  {
    id: "scoutwell-frontend",
    shortName: "scout",
    port: 3003,
    color: "\x1b[36m",
    workspace: "scoutwell-frontend",
    startExtraArgs: ["--port", "3003"],
  },
  {
    id: "joined-admin",
    shortName: "admin",
    port: 3010,
    color: "\x1b[33m",
    workspace: "joined-admin",
    startExtraArgs: [],
  },
];

export const API_SERVICE = {
  id: "joined-backend-api",
  shortName: "api",
  port: 8080,
  color: "\x1b[34m",
  url: "http://127.0.0.1:8080",
  command: "go",
  args: ["run", "-C", "joined-backend", "./cmd/server"],
};

/** Frontends audited by `bun run audit` (excludes theme). */
export const AUDIT_FRONTEND_IDS = [
  "connected-frontend",
  "joined-frontend",
  "scoutwell-frontend",
  "joined-admin",
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

export function serviceSite(service) {
  return `http://localhost:${service.port}`;
}
