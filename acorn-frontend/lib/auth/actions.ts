"use server";

import { acornApiUrl } from "@/lib/config";
import { AUTH_SIGN_IN_PATH, AUTH_SIGN_OUT_PATH, AUTH_SIGN_UP_PATH } from "./constants";
import { clearSessionCookie, sessionToken, writeSessionCookie } from "./cookie";

export type AuthResult = { ok: true } | { ok: false; message: string };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  return openSession(AUTH_SIGN_IN_PATH, { email, password });
}

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  return openSession(AUTH_SIGN_UP_PATH, { name, email, password });
}

export async function signOut(): Promise<void> {
  const token = await sessionToken();
  if (token) {
    await fetch(`${acornApiUrl()}${AUTH_SIGN_OUT_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearSessionCookie();
}

async function openSession(path: string, body: Record<string, string>): Promise<AuthResult> {
  const response = await fetch(`${acornApiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
  if (!response) {
    return { ok: false, message: "Couldn’t reach Acorn. Check that the API is running." };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
    error?: string;
  };
  if (!response.ok || !payload.token) {
    return { ok: false, message: payload.message || payload.error || "Couldn’t sign in." };
  }
  await writeSessionCookie(payload.token);
  return { ok: true };
}
