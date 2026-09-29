import { openedApiUrl } from "@/lib/config";
import { sessionToken } from "@/lib/auth/cookie";

export async function POST(request: Request) {
  const token = await sessionToken();
  if (!token) return Response.json({ error: "sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "invalid request" }, { status: 400 });
  const response = await fetch(new URL("/v1/auth/company", `${openedApiUrl()}/`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
