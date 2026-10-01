import { cookies } from "next/headers";
import { joinedApiUrl } from "@/lib/config";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export async function joinedMe<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const response = await fetch(new URL(path, `${joinedApiUrl()}/`), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "Request failed";
  } catch {
    return "Request failed";
  }
}
