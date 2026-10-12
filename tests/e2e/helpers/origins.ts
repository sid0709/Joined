/** Origins and ports used by the step-14 smoke harness. Override via env in CI. */

const JOINED_FRONTEND_ORIGIN_KEY = "JOINED_FRONTEND_ORIGIN";
const JOINED_API_ORIGIN_KEY = "JOINED_API_ORIGIN";
const SCOUTWELL_FRONTEND_ORIGIN_KEY = "SCOUTWELL_FRONTEND_ORIGIN";
const ACORN_FRONTEND_ORIGIN_KEY = "ACORN_FRONTEND_ORIGIN";
const ACORN_API_ORIGIN_KEY = "ACORN_API_ORIGIN";
const JOINED_BACKEND_LOG_KEY = "JOINED_BACKEND_LOG";

export const DEFAULT_JOINED_FRONTEND_ORIGIN = "http://localhost:6002";
export const DEFAULT_JOINED_API_ORIGIN = "http://127.0.0.1:8080";
export const DEFAULT_SCOUTWELL_FRONTEND_ORIGIN = "http://localhost:6003";
export const DEFAULT_ACORN_FRONTEND_ORIGIN = "http://localhost:6005";
export const DEFAULT_ACORN_API_ORIGIN = "http://127.0.0.1:8083";
export const DEFAULT_JOINED_BACKEND_LOG_PATH = "/tmp/joined-backend-e2e.log";

export const JOINED_BACKEND_LOG_ENV = JOINED_BACKEND_LOG_KEY;

function envValue(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function envOrigin(key: string, fallback: string): string {
  return envValue(key, fallback).replace(/\/$/, "");
}

export const JOINED_FRONTEND_ORIGIN = envOrigin(
  JOINED_FRONTEND_ORIGIN_KEY,
  DEFAULT_JOINED_FRONTEND_ORIGIN,
);

export const JOINED_API_ORIGIN = envOrigin(JOINED_API_ORIGIN_KEY, DEFAULT_JOINED_API_ORIGIN);

export const SCOUTWELL_FRONTEND_ORIGIN = envOrigin(
  SCOUTWELL_FRONTEND_ORIGIN_KEY,
  DEFAULT_SCOUTWELL_FRONTEND_ORIGIN,
);

export const ACORN_FRONTEND_ORIGIN = envOrigin(
  ACORN_FRONTEND_ORIGIN_KEY,
  DEFAULT_ACORN_FRONTEND_ORIGIN,
);

export const ACORN_API_ORIGIN = envOrigin(ACORN_API_ORIGIN_KEY, DEFAULT_ACORN_API_ORIGIN);

export const JOINED_BACKEND_LOG_PATH = envValue(
  JOINED_BACKEND_LOG_KEY,
  DEFAULT_JOINED_BACKEND_LOG_PATH,
);
