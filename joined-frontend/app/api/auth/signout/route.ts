import { joinedApiUrl } from "@/lib/config";
import { clearSessionCookie, sessionToken } from "@/lib/auth/cookie";

export async function POST() {
  const token = await sessionToken();
  if (token) {
    await fetch(new URL("/v1/auth/signout", `${joinedApiUrl()}/`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearSessionCookie();
  return new Response(null, { status: 204 });
}
