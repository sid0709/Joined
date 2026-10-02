import { adminApiUrl, adminHeaders } from "@/lib/server/env";

type Ctx = { params: Promise<{ path: string[] }> };

/** Request headers the browser may pass through. */
const FORWARDED_REQUEST = ["Content-Type", "Accept", "Idempotency-Key"];
/** Response headers the browser needs, including image types for logos. */
const FORWARDED_RESPONSE = ["Content-Type", "Cache-Control"];

/**
 * Relays admin console calls to admin-backend and adds the admin token server-side,
 * so it never ships to the browser. Only /v1 paths are relayed.
 */
async function handle(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path[0] !== "v1") {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const dest = new URL(`${adminApiUrl()}/${path.map(encodeURIComponent).join("/")}`);
  dest.search = new URL(request.url).search;
  const headers = new Headers(await adminHeaders());
  for (const name of FORWARDED_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(dest, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });
  const out = new Headers();
  for (const name of FORWARDED_RESPONSE) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  const body = response.status === 204 ? null : await response.arrayBuffer();
  return new Response(body, { status: response.status, headers: out });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
