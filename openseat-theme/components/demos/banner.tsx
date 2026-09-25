"use client";

import { useState } from "react";
import { Banner, Button, Card, HStack, Heading, Icon, Link, Stack, Text, icons, type BannerStatus } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const STATUSES: { status: BannerStatus; title: string; description: string }[] = [
  { status: "info", title: "Bids are sealed", description: "Nobody sees a bid until the room closes on Friday." },
  { status: "success", title: "Room published", description: "Three invitees were notified by email." },
  { status: "warning", title: "Closing in 2 hours", description: "Two invitees haven’t bid yet." },
  { status: "error", title: "Payment failed", description: "Update your card to keep escrow active." },
];

const ISSUES = ["Budget is missing", "Deadline is in the past", "Add at least one invitee"];

export default function BannerDemo() {
  const [dismissed, setDismissed] = useState<BannerStatus[]>([]);
  const [cookie, setCookie] = useState(true);

  return (
    <Examples>
      <Preview label="Statuses" description="info, success, warning, and error — each with its own icon and role.">
        <Stack gap={3}>
          {STATUSES.map((b) => (
            <Banner key={b.status} {...b} />
          ))}
        </Stack>
      </Preview>

      <Preview label="Title only" description="Short messages need no description.">
        <Stack gap={3}>
          <Banner status="info" title="You’re viewing a sample room." />
          <Banner status="success" title="All changes saved." />
        </Stack>
      </Preview>

      <Preview label="Dismissable" description="isDismissable adds a close button; onDismiss removes it from your state.">
        <Stack gap={3}>
          {STATUSES.filter((b) => !dismissed.includes(b.status)).map((b) => (
            <Banner key={b.status} {...b} isDismissable onDismiss={() => setDismissed((all) => [...all, b.status])} />
          ))}
          {dismissed.length > 0 && (
            <HStack>
              <Button label={`Restore ${dismissed.length}`} size="sm" variant="ghost" onClick={() => setDismissed([])} />
            </HStack>
          )}
        </Stack>
      </Preview>

      <Preview label="With actions" description="endContent holds the next step — a button or a link.">
        <Stack gap={3}>
          <Banner
            status="warning"
            title="Your trial ends in 3 days"
            description="Pick a plan to keep your rooms open."
            endContent={<Button label="Choose a plan" size="sm" variant="primary" />}
          />
          <Banner
            status="error"
            title="Couldn’t reach the server"
            description="We’ll retry automatically."
            endContent={<Button label="Retry now" size="sm" icon={<Icon icon={icons.refresh} />} />}
          />
          <Banner status="info" title="New: escrow payments" endContent={<Link href="#escrow">Learn more</Link>} />
        </Stack>
      </Preview>

      <Preview label="Custom icon" description="Swap the default icon when a specific one says more.">
        <Stack gap={3}>
          <Banner status="info" title="Scheduled maintenance tonight" description="Bidding pauses 1–2 AM." icon={<Icon icon={icons.settings} />} />
          <Banner status="success" title="You won the room!" description="Dana Kim awarded you Brand refresh." icon={<Icon icon={icons.sparkle} />} />
        </Stack>
      </Preview>

      <Preview label="Collapsible details" description="Keep long lists folded under a short title.">
        <Banner status="error" title={`Fix ${ISSUES.length} issues before publishing`} collapsible>
          <Stack gap={1}>
            {ISSUES.map((issue) => (
              <Text key={issue} display="block">
                • {issue}
              </Text>
            ))}
          </Stack>
        </Banner>
      </Preview>

      <Preview label="Container" description="card floats on its own; section sits flush inside a surface.">
        <Stack gap={3}>
          <Banner status="info" container="card" title="container=&quot;card&quot;" description="Rounded, bordered — for page-level messages." />
          <Card padding={0}>
            <Banner status="warning" container="section" title="container=&quot;section&quot;" description="Flush with the card edges." />
            <Stack gap={2} padding={4}>
              <Heading level={4}>Brand refresh</Heading>
              <Text color="secondary">The banner above belongs to this card only.</Text>
            </Stack>
          </Card>
        </Stack>
      </Preview>

      <Preview label="Elevation" description="Lift a banner that floats over content — a sticky notice or cookie bar.">
        {cookie ? (
          <Banner
            status="info"
            elevation="med"
            title="We use cookies to keep you signed in."
            endContent={
              <HStack gap={2}>
                <Button label="Accept" size="sm" variant="primary" onClick={() => setCookie(false)} />
                <Button label="Settings" size="sm" variant="ghost" />
              </HStack>
            }
          />
        ) : (
          <Button label="Show again" size="sm" variant="ghost" onClick={() => setCookie(true)} />
        )}
      </Preview>
    </Examples>
  );
}
