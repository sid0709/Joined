import { clearSessionCookie, sessionToken } from "@/lib/auth/cookie";
import { openedApiUrl } from "@/lib/config";

export async function POST() {
  const token = await sessionToken();
  if (token) {
    await fetch(new URL("/v1/auth/signout", `${openedApiUrl()}/`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
  }
  await clearSessionCookie();
  return new Response(null, { status: 204 });
}
