import { ROUTES } from "@/lib/routes";

/** Bump when consent categories change so older cookies ask again. */
export const CONSENT_VERSION = 1;

export const CONSENT_COOKIE = "joined_cookie_consent";

export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export const LEGAL_DRAFT_BANNER =
  "Draft for review. This is not counsel-approved and it is not legal advice.";

export const LEGAL_LINKS = [
  { href: ROUTES.terms, label: "Terms" },
  { href: ROUTES.privacy, label: "Privacy" },
  { href: ROUTES.cookies, label: "Cookies" },
  { href: ROUTES.premiumTerms, label: "Premium terms" },
] as const;

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  version: number;
};

export function serializeConsent(consent: CookieConsent): string {
  return encodeURIComponent(JSON.stringify(consent));
}

export function parseConsent(raw: string | null | undefined): CookieConsent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<CookieConsent>;
    if (value.version !== CONSENT_VERSION) return null;
    if (value.necessary !== true || typeof value.analytics !== "boolean") return null;
    return { necessary: true, analytics: value.analytics, version: CONSENT_VERSION };
  } catch {
    return null;
  }
}

export function readConsentCookie(cookieHeader: string): CookieConsent | null {
  const match = cookieHeader.split("; ").find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  return parseConsent(match.slice(CONSENT_COOKIE.length + 1));
}

export function consentSetCookie(consent: CookieConsent): string {
  return `${CONSENT_COOKIE}=${serializeConsent(consent)}; path=/; max-age=${CONSENT_MAX_AGE_SECONDS}; samesite=lax`;
}

export function readConsentFromDocument(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  return readConsentCookie(document.cookie);
}

export function writeConsent(analytics: boolean) {
  const consent: CookieConsent = { necessary: true, analytics, version: CONSENT_VERSION };
  document.cookie = consentSetCookie(consent);
}

/** Later vendors call this before loading. Declined or missing consent stays off. */
export function analyticsAllowed(): boolean {
  return readConsentFromDocument()?.analytics === true;
}
