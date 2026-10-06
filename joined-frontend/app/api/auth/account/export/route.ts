import { sessionToken } from "@/lib/auth/cookie";
import { joinedApiUrl } from "@/lib/config";

/** Session → joined-backend GET /v1/auth/account/export. The body is the download. */
export async function GET() {
  const token = await sessionToken();
  if (!token) return Response.json({ error: "sign in required" }, { status: 401 });
  const response = await fetch(new URL("/v1/auth/account/export", `${joinedApiUrl()}/`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}
