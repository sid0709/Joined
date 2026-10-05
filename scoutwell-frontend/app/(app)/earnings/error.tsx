"use client";

import { Button, EmptyState } from "@joined/design-system";

import { ROUTES } from "@/lib/routes";

export default function EarningsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      title="Earnings didn’t load"
      description="Try again. Nothing was changed."
      actions={
        <>
          <Button label="Try again" variant="secondary" onClick={reset} />
          <Button label="Overview" variant="ghost" href={ROUTES.dashboard} />
        </>
      }
    />
  );
}
