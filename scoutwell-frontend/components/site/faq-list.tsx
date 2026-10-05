"use client";

import { Card, Collapsible, CollapsibleGroup, Text } from "@joined/design-system";
import type { FaqItem } from "@/lib/site-copy";

/** Expandable answers. Interactive, so this file stays a client island. */
export function FaqList({ items }: { items: readonly FaqItem[] }) {
  return (
    <Card padding={2}>
      <CollapsibleGroup type="multiple" hasDividers>
        {items.map((item) => (
          <Collapsible key={item.id} value={item.id} trigger={item.question}>
            <Text color="secondary" display="block">
              {item.answer}
            </Text>
          </Collapsible>
        ))}
      </CollapsibleGroup>
    </Card>
  );
}
