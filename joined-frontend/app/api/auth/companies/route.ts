import { joinedApiUrl } from "@/lib/config";
import { sessionToken } from "@/lib/auth/cookie";

export async function GET() {
  const token = await sessionToken();
  if (!token) return Response.json({ error: "sign in required" }, { status: 401 });
  const response = await fetch(new URL("/v1/auth/companies", `${joinedApiUrl()}/`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
