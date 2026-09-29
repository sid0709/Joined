import { forwardAuth } from "@/lib/auth/cookie";

type SignupBody = { name?: unknown; email?: unknown; password?: unknown };

/** Scouts sign up as individuals: no employer mode, no company. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;
  if (!body) return Response.json({ error: "invalid request" }, { status: 400 });
  return forwardAuth("/v1/auth/signup", {
    name: body.name,
    email: body.email,
    password: body.password,
    mode: "scout",
  });
}
