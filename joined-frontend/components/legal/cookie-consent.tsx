"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, ConsentBanner, Link } from "sid-ui";
import { readConsentCookie, writeConsent } from "@/lib/legal";
import { BRAND, ROUTES } from "@/lib/routes";

/** The server cannot see the cookie, so it renders nothing until the client reads it. */
const SERVER_SNAPSHOT = null;

function subscribe() {
  return () => {};
}

// The snapshot is the raw cookie string: React compares snapshots with Object.is,
// so a freshly parsed object each read would never settle and loops.
function readClient(): string {
  return document.cookie;
}

function readServer(): string | null {
  return SERVER_SNAPSHOT;
}

/** First visit asks. A stored choice for the current version stays hidden. */
export function CookieConsentBanner() {
  const cookies = useSyncExternalStore(subscribe, readClient, readServer);
  // The cookie store has no change event, so an answer in this tab hides the banner directly.
  const [answered, setAnswered] = useState(false);
  if (cookies === SERVER_SNAPSHOT || answered || readConsentCookie(cookies)) return null;

  const choose = (analytics: boolean) => {
    writeConsent(analytics);
    setAnswered(true);
  };

  return (
    <ConsentBanner
      title={`Cookies on ${BRAND}`}
      description="Necessary cookies keep you signed in. Analytics cookies help us improve search, and they stay off unless you allow them."
      link={<Link href={ROUTES.cookies}>Cookie policy</Link>}
      actions={
        <>
          <Button label="Necessary only" variant="secondary" onClick={() => choose(false)} />
          <Button label="Allow analytics" variant="primary" onClick={() => choose(true)} />
        </>
      }
    />
  );
}
