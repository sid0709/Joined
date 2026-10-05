import { EMAIL_MESSAGES } from "./email";

export const JSON_MEDIA_TYPE = "application/json";
export const SAME_ORIGIN_FETCH_SITE = "same-origin";
export const CSRF_FORBIDDEN_STATUS = 403;

const CONTENT_TYPE_HEADER = "Content-Type";
const ORIGIN_HEADER = "Origin";
const SEC_FETCH_SITE_HEADER = "Sec-Fetch-Site";

export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === JSON_MEDIA_TYPE;
}

export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get(SEC_FETCH_SITE_HEADER);
  if (site !== null && site.toLowerCase() !== SAME_ORIGIN_FETCH_SITE) return false;
  const origin = request.headers.get(ORIGIN_HEADER);
  if (origin !== null && !originMatchesRequest(origin, request.url)) return false;
  return site !== null || origin !== null;
}

function originMatchesRequest(origin: string, requestUrl: string): boolean {
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
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
