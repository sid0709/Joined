import { forwardAuth } from "@/lib/auth/cookie";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "invalid request" }, { status: 400 });
  return forwardAuth("/v1/auth/signup", body);
}
