import { openedApiUrl } from "@/lib/config";

const LOGO_PATH = "/v1/search/companies";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upstream = new URL(`${LOGO_PATH}/${encodeURIComponent(id)}/logo`, `${openedApiUrl()}/`);
  const response = await fetch(upstream, { cache: "no-store" });
  if (!response.ok || !response.body) {
    return new Response(null, { status: response.status === 404 ? 404 : 502 });
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
