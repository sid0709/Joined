import { openedApiUrl } from "@/lib/config";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const upstream = new URL("/v1/auth/companies", `${openedApiUrl()}/`);
  upstream.searchParams.set("q", query);
  const response = await fetch(upstream, { cache: "no-store" });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
