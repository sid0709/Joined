import { ApiError, parseProblem } from "@openseat/scout";
import { API_PROXY } from "@/lib/config";

/** Calls the Opened API from the browser through the admin proxy. */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PROXY}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, parseProblem(text));
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Sends JSON and parses the JSON answer. Extra headers (e.g. Idempotency-Key) are forwarded. */
export function adminSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  headers?: Record<string, string>,
) {
  return adminFetch<T>(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
