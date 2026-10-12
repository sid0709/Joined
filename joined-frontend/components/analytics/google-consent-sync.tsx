"use client";

import { useEffect } from "react";

import { CONSENT_CHANGED_EVENT } from "@/lib/analytics/consent-events";
import { analyticsAllowed } from "@/lib/legal";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function syncGoogleConsent() {
  if (typeof window.gtag !== "function") return;
  const granted = analyticsAllowed() ? "granted" : "denied";
  window.gtag("consent", "update", {
    analytics_storage: granted,
    ad_storage: granted,
    ad_user_data: granted,
    ad_personalization: granted,
  });
}

/** Keeps GA4 consent mode aligned with the cookie banner after the first paint. */
export function GoogleConsentSync() {
  useEffect(() => {
    syncGoogleConsent();
    const onConsent = () => syncGoogleConsent();
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent);
  }, []);

  return null;
}
