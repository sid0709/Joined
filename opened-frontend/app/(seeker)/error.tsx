"use client";

import { Button, EmptyState } from "@openseat/design-system";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      title="This page didn’t load"
      description="Try again. Nothing was changed."
      actions={<Button label="Try again" variant="secondary" onClick={reset} />}
    />
  );
}
