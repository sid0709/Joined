"use client";

import type { ReactNode } from "react";
import { Card, HStack, Stack, Text } from "@openseat/design-system";

export const SEARCH_ITEMS = [
  { id: "button", label: "Button" },
  { id: "dialog", label: "Dialog" },
  { id: "input", label: "Text Input" },
  { id: "table", label: "Table" },
];

export function Row({ children }: { children: ReactNode }) {
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      {children}
    </HStack>
  );
}

export function Preview({
  label,
  description,
  align = "stretch",
  children,
}: {
  label: string;
  description?: string;
  /** start keeps controls at their natural width; stretch lets tables, toolbars, and cards fill. */
  align?: "start" | "stretch";
  children: ReactNode;
}) {
  return (
    <Card>
      <Stack gap={3} hAlign={align}>
        <Stack gap={0.5}>
          <Text type="label" color="secondary">
            {label}
          </Text>
          {description && (
            <Text type="supporting" color="secondary">
              {description}
            </Text>
          )}
        </Stack>
        {children}
      </Stack>
    </Card>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Text type="supporting" color="secondary" display="block">
      {children}
    </Text>
  );
}

export function Examples({ children }: { children: ReactNode }) {
  return <Stack gap={5}>{children}</Stack>;
}

/** Local sample images from /public, so image demos never depend on a remote host. */
export const SAMPLE_IMAGES = {
  globe: "/globe.svg",
  window: "/window.svg",
  file: "/file.svg",
  missing: "/missing-image.png",
} as const;

export const PEOPLE = [
  { name: "Jordan Miles", role: "Room owner" },
  { name: "Alex Rivera", role: "Designer" },
  { name: "Dana Kim", role: "Copywriter" },
  { name: "Riley Chen", role: "Engineer" },
  { name: "Sam Okafor", role: "Producer" },
  { name: "Priya Nair", role: "Strategist" },
  { name: "Morgan Lee", role: "Illustrator" },
];
