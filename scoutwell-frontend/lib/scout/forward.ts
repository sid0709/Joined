import { sessionToken } from "@/lib/auth/cookie";
import { openedApiUrl } from "@/lib/config";

/** Headers a browser call may carry through to the API. */
const FORWARDED_REQUEST = ["Content-Type", "Idempotency-Key"];
/** Headers the API sends that the browser should see. */
const FORWARDED_RESPONSE = [
  "Content-Type",
  "Location",
  "RateLimit-Limit",
  "RateLimit-Remaining",
  "RateLimit-Reset",
  "Retry-After",
  "Idempotent-Replayed",
];

/** Relays a browser request to /v1/scout/* with the session token from the cookie. */
export async function forwardScout(request: Request, apiPath: string): Promise<Response> {
  const token = await sessionToken();
  if (!token) {
    return Response.json(
      {
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        code: "unauthorized",
        detail: "Sign in again.",
      },
      { status: 401 },
    );
  }
  const dest = new URL(apiPath, `${openedApiUrl()}/`);
  dest.search = new URL(request.url).search;
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  for (const name of FORWARDED_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(dest, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });
  const out = new Headers();
  for (const name of FORWARDED_RESPONSE) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  const body = response.status === 204 ? null : await response.text();
  return new Response(body, { status: response.status, headers: out });
}
