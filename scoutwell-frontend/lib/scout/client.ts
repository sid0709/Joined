import { ApiError, parseProblem } from "@openseat/scout";

const BASE = "/api/scout";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store", ...init });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, parseProblem(text));
  return (text ? JSON.parse(text) : undefined) as T;
}

/** GET from the scout API as the signed-in person. */
export function scoutFetch<T>(path: string, signal?: AbortSignal) {
  return request<T>(path, { signal });
}

/** Sends JSON to the scout API as the signed-in person. */
export function scoutSend<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  headers?: Record<string, string>,
) {
  return request<T>(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** POSTs multipart form data. The browser sets the multipart boundary. */
export function scoutUpload<T>(path: string, body: FormData) {
  return request<T>(path, { method: "POST", body });
}

/** POSTs to one of the auth routes, which set or clear the session cookie. */
export async function authSend<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, parseProblem(text));
  return (text ? JSON.parse(text) : undefined) as T;
}
