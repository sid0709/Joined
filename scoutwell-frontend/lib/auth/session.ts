import { cache } from "react";
import { openedApiUrl } from "@/lib/config";
import { sessionToken } from "./cookie";
import type { AuthSession } from "./types";

const SESSION_PATH = "/v1/auth/session";

/** One backend call per request, however many layouts and pages ask for the session. */
export const loadSession = cache(async function loadSession(): Promise<AuthSession | null> {
  const token = await sessionToken();
  if (!token) return null;
  const response = await fetch(new URL(SESSION_PATH, `${openedApiUrl()}/`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthSession;
});
