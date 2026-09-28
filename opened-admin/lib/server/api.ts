import { ApiError, parseProblem } from "@openseat/scout";
import { adminApiUrl, adminHeaders } from "./env";

/** GET an admin endpoint from a Server Component. Throws ApiError on failure. */
export async function adminGet<T>(path: string): Promise<T> {
  const response = await fetch(`${adminApiUrl()}${path}`, {
    headers: { Accept: "application/json", ...adminHeaders() },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, parseProblem(text));
  return JSON.parse(text) as T;
}
