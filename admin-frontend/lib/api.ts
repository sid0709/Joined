import { ApiError, parseProblem } from "@joined/scout";
import { API_PROXY } from "@/lib/config";

/** Calls the Joined API from the browser through the admin proxy. */
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

/** Downloads a JSON file from the admin API. */
export async function adminDownload(path: string, filename: string) {
  const response = await fetch(`${API_PROXY}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, parseProblem(text));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
