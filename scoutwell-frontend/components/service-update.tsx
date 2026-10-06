"use client";

import Link from "next/link";
import { Heading, Stack, Text } from "sid-ui";
import { JoinedProvider, type ColorMode } from "sid-ui/theme";
import "./service-update.css";

export function ServiceUpdate({ brand, mode = "light" }: { brand: string; mode?: ColorMode }) {
  return (
    <JoinedProvider mode={mode} linkComponent={Link}>
      <main className="service-update">
        <div className="service-update-glow" aria-hidden />
        <Stack gap={4} className="service-update-card">
          <p className="service-update-kicker">{brand}</p>
          <Heading level={1}>We&apos;re updating our service</Heading>
          <Text>
            Please check back shortly. The rest of the site is paused while we finish this.
          </Text>
        </Stack>
      </main>
    </JoinedProvider>
  );
}
