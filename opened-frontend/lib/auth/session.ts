import { cookies } from "next/headers";
import { openedApiUrl } from "@/lib/config";
import type { AuthSession } from "./types";

export const SESSION_COOKIE = "opened_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SESSION_PATH = "/v1/auth/session";

export async function loadSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const response = await fetch(new URL(SESSION_PATH, `${openedApiUrl()}/`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthSession;
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
