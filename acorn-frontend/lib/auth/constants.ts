import { ACORN_SESSION_COOKIE } from "@acorn/shared/api";

/** Same cookie the extension reads from this site. */
export const SESSION_COOKIE = ACORN_SESSION_COOKIE;

/** Matches acorn-backend's session lifetime. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const AUTH_SIGN_IN_PATH = "/acorn/auth/signin";
export const AUTH_SIGN_UP_PATH = "/acorn/auth/signup";
export const AUTH_SIGN_OUT_PATH = "/acorn/auth/signout";
export const AUTH_ME_PATH = "/acorn/auth/me";
