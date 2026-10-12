import { EMAIL_MESSAGES } from "./email";

export const JSON_MEDIA_TYPE = "application/json";
export const SAME_ORIGIN_FETCH_SITE = "same-origin";
export const CSRF_FORBIDDEN_STATUS = 403;

const CONTENT_TYPE_HEADER = "Content-Type";
const ORIGIN_HEADER = "Origin";
const SEC_FETCH_SITE_HEADER = "Sec-Fetch-Site";
const HOST_HEADER = "Host";
const FORWARDED_HOST_HEADER = "X-Forwarded-Host";
const FORWARDED_PROTO_HEADER = "X-Forwarded-Proto";

export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === JSON_MEDIA_TYPE;
}

export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get(SEC_FETCH_SITE_HEADER);
  if (site !== null && site.toLowerCase() !== SAME_ORIGIN_FETCH_SITE) return false;
  const origin = request.headers.get(ORIGIN_HEADER);
  if (origin !== null && !originMatchesRequest(origin, request)) return false;
  return site !== null || origin !== null;
}

/** The first value of a proxy header, which may list one value per hop. */
function firstHeaderValue(request: Request, name: string): string | undefined {
  return request.headers.get(name)?.split(",", 1)[0]?.trim() || undefined;
}

/**
 * The origin the browser used. Behind nginx the app sees plain http on its own
 * port, so request.url alone never matches the public https origin. nginx sets
 * Host and X-Forwarded-Proto, and a browser cannot set either on a cross-site request.
 */
export function publicRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = firstHeaderValue(request, FORWARDED_PROTO_HEADER) ?? url.protocol.replace(/:$/, "");
  const host =
    firstHeaderValue(request, FORWARDED_HOST_HEADER) ??
    firstHeaderValue(request, HOST_HEADER) ??
    url.host;
  return `${proto}://${host}`;
}

function originMatchesRequest(origin: string, request: Request): boolean {
  try {
    return new URL(origin).origin === new URL(publicRequestOrigin(request)).origin;
  } catch {
    return false;
  }
}

/** 403 when the POST is not same-origin JSON — stops login CSRF via text/plain forms. */
export function emailAuthCsrfReject(request: Request): Response | null {
  if (!isJsonContentType(request.headers.get(CONTENT_TYPE_HEADER))) {
    return Response.json({ error: EMAIL_MESSAGES.forbidden }, { status: CSRF_FORBIDDEN_STATUS });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: EMAIL_MESSAGES.forbidden }, { status: CSRF_FORBIDDEN_STATUS });
  }
  return null;
}
