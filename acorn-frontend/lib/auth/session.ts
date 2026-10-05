import { cache } from "react";
import { acornApiUrl } from "@/lib/config";
import { AUTH_ME_PATH } from "./constants";
import { sessionToken } from "./cookie";

export type AcornAccount = {
  name: string;
  email: string;
};

/** The Acorn account behind this browser's session cookie, or null when signed out. */
export const currentAccount = cache(async (): Promise<AcornAccount | null> => {
  const token = await sessionToken();
  if (!token) return null;
  const response = await fetch(`${acornApiUrl()}${AUTH_ME_PATH}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json()) as {
    session?: { displayName?: string; email?: string };
  };
  const name = body.session?.displayName?.trim();
  const email = body.session?.email?.trim();
  if (!name || !email) return null;
  return { name, email };
});
