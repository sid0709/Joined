import { sessionToken } from "@/lib/auth/cookie";
import { openedApiUrl } from "@/lib/config";

export async function forwardOpened(request: Request, apiPath: string): Promise<Response> {
  const token = await sessionToken();
  if (!token) {
    return Response.json({ error: "sign in required" }, { status: 401 });
  }
  const dest = new URL(apiPath, `${openedApiUrl()}/`);
  dest.search = new URL(request.url).search;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;
  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const response = await fetch(dest, {
    method,
    headers,
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (location) return Response.redirect(location, response.status);
  }
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
