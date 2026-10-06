"use client";

import { useState, useSyncExternalStore } from "react";
import { Banner, Button, HStack, Stack, Text } from "sid-ui";
import {
  CONSENT_VERSION,
  readConsentFromDocument,
  writeConsent,
  type CookieConsent,
} from "@/lib/legal";
import { LegalLinks } from "./legal-links";

const CONSENT_UNKNOWN = "unknown" as const;

type StoredConsent = CookieConsent | null | typeof CONSENT_UNKNOWN;

function subscribe() {
  return () => {};
}

function readClient(): StoredConsent {
  return readConsentFromDocument();
}

function readServer(): StoredConsent {
  return CONSENT_UNKNOWN;
}

/** First visit asks. A stored choice for the current version stays hidden. */
export function CookieConsentBanner() {
  const stored = useSyncExternalStore(subscribe, readClient, readServer);
  const [picked, setPicked] = useState<CookieConsent | null>(null);
  const consent = picked ?? stored;
  if (consent !== null) return null;

  const choose = (analytics: boolean) => {
    writeConsent(analytics);
    setPicked({ necessary: true, analytics, version: CONSENT_VERSION });
  };

  return (
    <Stack gap={3}>
      <Banner status="info" title="Cookies" />
      <Text color="secondary" display="block">
        Necessary cookies stay on. Analytics stays off unless you allow it. This choice is a draft
        preference, not a legal agreement.
      </Text>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button
          label="Necessary only"
          variant="secondary"
          size="sm"
          onClick={() => choose(false)}
        />
        <Button label="Allow analytics" variant="primary" size="sm" onClick={() => choose(true)} />
        <LegalLinks />
      </HStack>
    </Stack>
  );
}
