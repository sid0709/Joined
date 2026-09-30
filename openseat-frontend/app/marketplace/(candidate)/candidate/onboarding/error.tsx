"use client";

import { Button, Card, PageBody, Stack } from "@/src/shared/marketplace-ui";

export default function BidderOnboardingError({ reset }: { reset: () => void }) {
  return (
    <PageBody>
      <Card
        title="Onboarding could not load"
        meta="Your progress is safe. Try loading the checklist again."
      >
        <Stack gap={4}>
          <p className="body-md text-ink-muted">
            The onboarding workflow is temporarily unavailable.
          </p>
          <Button type="button" variant="primary" onClick={reset}>
            Try again
          </Button>
        </Stack>
      </Card>
    </PageBody>
  );
}
