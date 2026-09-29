import { cache } from "react";
import { cookies } from "next/headers";
import { openedApiUrl } from "@/lib/config";
import { SESSION_COOKIE } from "./constants";
import type { AuthSession } from "./types";

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";

const SESSION_PATH = "/v1/auth/session";

/** One backend call per request, however many layouts and pages ask for the session. */
export const loadSession = cache(async function loadSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const response = await fetch(new URL(SESSION_PATH, `${openedApiUrl()}/`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthSession;
});

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
