import { joinedApiUrl } from "@/lib/config";

type Ctx = { params: Promise<{ key: string }> };

/** Public accept proxy — no session. Forwards to POST /v1/schedule/:key/accept. */
export async function POST(request: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  const trimmed = key?.trim();
  if (!trimmed) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const dest = new URL(`/v1/schedule/${encodeURIComponent(trimmed)}/accept`, `${joinedApiUrl()}/`);
  const response = await fetch(dest, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: await request.arrayBuffer(),
    cache: "no-store",
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
