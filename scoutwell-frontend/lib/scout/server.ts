import { ApiError, parseProblem } from "@joined/scout";
import { sessionToken } from "@/lib/auth/cookie";
import { scoutwellApiUrl } from "@/lib/config";

/**
 * GET a scout endpoint as the signed-in person, from a Server Component.
 * Returns null when there is no valid session; throws on any other failure.
 */
export async function scoutGet<T>(path: string): Promise<T | null> {
  const token = await sessionToken();
  if (!token) return null;
  const response = await fetch(new URL(`/v1/scout${path}`, `${scoutwellApiUrl()}/`), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, parseProblem(text));
  return JSON.parse(text) as T;
}

/** The public rulebook; needs no session. */
export async function scoutMeta<T>(): Promise<T> {
  const response = await fetch(new URL("/v1/scout/meta", `${scoutwellApiUrl()}/`), {
    next: { revalidate: 300 },
  });
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, parseProblem(text));
  return JSON.parse(text) as T;
}
