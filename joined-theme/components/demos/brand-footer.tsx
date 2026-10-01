"use client";

import { BrandFooter, Stack } from "@joined/design-system";

import { Examples, Preview } from "./shared";

export default function BrandFooterDemo() {
  return (
    <Examples>
      <Preview label="Default" description="Under landing and auth pages.">
        <BrandFooter />
      </Preview>

      <Preview
        label="From a product"
        description="Name the product in the lead; link the wordmark home when there is one."
      >
        <Stack gap={2}>
          <BrandFooter lead="Joined Admin is part of" />
          <BrandFooter lead="Scoutwell is part of" href="#" />
        </Stack>
      </Preview>

      <Preview label="Start-aligned" description="Under a left-aligned page.">
        <BrandFooter align="start" />
      </Preview>
    </Examples>
  );
}
