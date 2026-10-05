export const BRAND = "Acorn";

const JOINED_SIGN_IN_PATH = "/sign-in";

/** Joined's public site. Sign-in links out here; this app only reads the cookie. */
export function joinedWebUrl(): string {
  return (process.env.JOINED_WEB_URL ?? "").replace(/\/$/, "");
}

/** Chrome Web Store or sideload URL. Empty until a listing exists. */
export function extensionInstallUrl(): string | null {
  const url = process.env.ACORN_EXTENSION_INSTALL_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export function joinedSignInUrl(): string | null {
  const base = joinedWebUrl();
  if (!base) return null;
  return `${base}${JOINED_SIGN_IN_PATH}`;
}
