"use client";

import { useState } from "react";
import { Button, Card, EmptyState, HStack, Spinner, Stack, Text, type SpinnerShade, type SpinnerSize } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SIZES: SpinnerSize[] = ["sm", "md", "lg", "xl"];
const SHADES: SpinnerShade[] = ["default", "subtle", "inherit"];
const SEARCH_MS = 1400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SpinnerDemo() {
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<number | null>(null);

  const search = async () => {
    setSearching(true);
    setFound(null);
    await wait(SEARCH_MS);
    setSearching(false);
    setFound(7);
  };

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="sm for inline, md default, lg and xl for panels and pages.">
        <Row>
          {SIZES.map((size) => (
            <Stack key={size} gap={1} hAlign="center">
              <Spinner size={size} />
              <Caption>{size}</Caption>
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Shades" description="default uses the accent; subtle recedes; inherit follows the text color.">
        <Row>
          {SHADES.map((shade) => (
            <Stack key={shade} gap={1} hAlign="center">
              <Spinner shade={shade} size="lg" />
              <Caption>{shade}</Caption>
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="On media" description="shade=&quot;onMedia&quot; stays visible on colored and image surfaces.">
        <HStack gap={3}>
          {(["blue", "purple", "teal"] as const).map((variant) => (
            <Card key={variant} variant={variant} width={120}>
              <Stack hAlign="center">
                <Spinner shade="onMedia" size="lg" />
              </Stack>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="With a label" description="label names the wait for everyone, not only screen readers.">
        <Stack gap={3} hAlign="start">
          <Spinner label="Loading bids" />
          <Spinner size="lg" label="Checking availability…" />
        </Stack>
      </Preview>

      <Preview align="start" label="Inline" description="A small spinner beside the words it qualifies.">
        <HStack gap={2} vAlign="center">
          <Spinner size="sm" />
          <Text color="secondary">Saving draft…</Text>
        </HStack>
      </Preview>

      <Preview align="start" label="In buttons" description="Buttons own their spinner — use isLoading instead of placing one yourself.">
        <Row>
          <Button label="Saving" variant="primary" isLoading />
          <Button label="Syncing" isLoading />
        </Row>
      </Preview>

      <Preview label="Loading a region" description="A centered spinner while results load, then the content.">
        <Card minHeight={160}>
          <Stack gap={3}>
            <HStack>
              <Button label="Search rooms" size="sm" variant="primary" onClick={search} isDisabled={searching} />
            </HStack>
            {searching ? (
              <Stack hAlign="center" gap={2}>
                <Spinner size="lg" label="Searching rooms" />
              </Stack>
            ) : found === null ? (
              <EmptyState isCompact title="Nothing searched yet" description="Run a search to see matching rooms." />
            ) : (
              <Text>{found} rooms match “brand”.</Text>
            )}
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
