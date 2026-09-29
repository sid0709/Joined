import { clearSessionCookie, sessionToken } from "@/lib/auth/cookie";
import { openedApiUrl } from "@/lib/config";

export async function DELETE() {
  const token = await sessionToken();
  if (!token) return Response.json({ error: "sign in required" }, { status: 401 });
  const response = await fetch(new URL("/v1/auth/account", `${openedApiUrl()}/`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  await clearSessionCookie();
  return new Response(null, { status: 204 });
}
