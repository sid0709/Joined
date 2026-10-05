import { Button, EmptyState } from "@joined/design-system";

import { ROUTES, signInHref } from "@/lib/routes";

/** Shown when the earnings endpoints return no session. */
export function EarningsSignedOut() {
  return (
    <EmptyState
      title="Sign in to see your earnings"
      description="Your rewards from jobs you submitted show up here after you sign in."
      actions={<Button label="Sign in" variant="primary" href={signInHref(ROUTES.earnings)} />}
    />
  );
}
