/** Session cookie facts, free of server-only imports so `proxy.ts` can read them too. */
export const SESSION_COOKIE = "joined_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
