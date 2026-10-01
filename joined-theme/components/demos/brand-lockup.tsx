"use client";

import { BrandLockup, Button, EmptyState, Stack } from "@joined/design-system";

import { Examples, Preview } from "./shared";

export default function BrandLockupDemo() {
  return (
    <Examples>
      <Preview
        label="Joined"
        description="The blue wordmark and a one-line tagline, above a sign-in form."
      >
        <BrandLockup tagline="Find the right people for meaningful work." />
      </Preview>

      <Preview
        label="A product"
        description="The app icon, the product name, and “by Joined” so every product reads as part of one family."
      >
        <Stack gap={6}>
          <BrandLockup product="Scoutwell" tagline="Find the jobs the big boards miss." />
          <BrandLockup product="Joined Admin" tagline="Staff sign-in." />
        </Stack>
      </Preview>

      <Preview label="Start-aligned" description="For split layouts with a form beside it.">
        <BrandLockup product="Scoutwell" align="start" tagline="Welcome back, scout." />
      </Preview>

      <Preview label="On an error page" description="The lockup tells people where they landed.">
        <Stack gap={4} hAlign="center">
          <BrandLockup />
          <EmptyState
            title="That page is not here"
            description="The link may be wrong, or the page moved."
            actions={<Button label="Go home" variant="primary" href="#" />}
          />
        </Stack>
      </Preview>
    </Examples>
  );
}
