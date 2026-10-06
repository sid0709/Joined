import { describe, expect, test } from "bun:test";

import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  analyticsAllowed,
  consentSetCookie,
  parseConsent,
  readConsentCookie,
  readConsentFromDocument,
  serializeConsent,
  writeConsent,
  type CookieConsent,
} from "@/lib/legal";

const choice: CookieConsent = { necessary: true, analytics: false, version: CONSENT_VERSION };

describe("cookie consent", () => {
  test("round-trips a stored choice", () => {
    const header = consentSetCookie(choice).split(";")[0] ?? "";
    expect(header.startsWith(`${CONSENT_COOKIE}=`)).toBe(true);
    expect(readConsentCookie(header)).toEqual(choice);
    expect(parseConsent(serializeConsent({ ...choice, analytics: true }))?.analytics).toBe(true);
  });

  test("a stale version asks again", () => {
    const stale = serializeConsent({
      necessary: true,
      analytics: true,
      version: CONSENT_VERSION + 1,
    });
    expect(parseConsent(stale)).toBeNull();
    expect(parseConsent("not-json")).toBeNull();
    expect(readConsentCookie("")).toBeNull();
  });

  test("reads and writes the cookie on the document", () => {
    const cookies: string[] = [];
    const documentCookie = {
      get cookie() {
        return cookies.join("; ");
      },
      set cookie(value: string) {
        cookies.push(value.split(";")[0] ?? "");
      },
    };
    const previous = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: documentCookie });
    try {
      expect(readConsentFromDocument()).toBeNull();
      expect(analyticsAllowed()).toBe(false);
      writeConsent(true);
      expect(readConsentFromDocument()?.analytics).toBe(true);
      expect(analyticsAllowed()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: previous });
    }
  });
});
