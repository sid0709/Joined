"use client";

import { useState } from "react";
import { Button, Heading, Stack, Text } from "sid-ui";
import { originalDescription } from "@/lib/jobs/original-description";

/** The posting as the employer or scout wrote it, cut short until "Show more" is pressed. */
export function OriginalDescription({ text }: { text?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { paragraphs, isTruncatable } = originalDescription(text, isOpen);
  if (paragraphs.length === 0) return null;

  return (
    <Stack gap={3} as="section">
      <Heading level={3}>Original job description</Heading>
      <Stack gap={3}>
        {paragraphs.map((paragraph, index) => (
          <Text key={`${index}-${paragraph.slice(0, 24)}`} display="block">
            {paragraph}
          </Text>
        ))}
      </Stack>
      {isTruncatable ? (
        <Stack hAlign="start">
          <Button
            label={isOpen ? "Show less" : "Show more"}
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen((open) => !open)}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
