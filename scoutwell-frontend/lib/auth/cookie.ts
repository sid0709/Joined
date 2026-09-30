import { cookies } from "next/headers";
import { openedApiUrl } from "@/lib/config";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";
import type { AuthSession } from "./types";

type Issued = {
  token?: string;
  session: AuthSession;
};

/** Signs in or up against the API and keeps the token in an httpOnly cookie. */
export async function forwardAuth(path: string, body: unknown): Promise<Response> {
  const response = await fetch(new URL(path, `${openedApiUrl()}/`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const issued = (await response.json()) as Issued;
  if (issued.token) await writeSessionCookie(issued.token);
  return Response.json(issued.session);
}

export async function writeSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}
