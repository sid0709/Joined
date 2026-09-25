"use client";

import { useState } from "react";
import { Button, Card, EmptyState, HStack, Heading, Icon, Stack, Text, icons } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const COMPACT_WIDTH = 280;

export default function EmptyStateDemo() {
  const [invited, setInvited] = useState(false);
  const [failed, setFailed] = useState(true);

  return (
    <Examples>
      <Preview label="Title only" description="The minimum: say what is missing.">
        <EmptyState title="No rooms yet" />
      </Preview>

      <Preview label="With a description" description="Say what will fill this space and when.">
        <EmptyState title="No bids yet" description="Invited people can see this room. Their bids show up here once they respond." />
      </Preview>

      <Preview label="With an icon" description="The icon is decorative and hidden from assistive tech.">
        <Stack gap={4}>
          <EmptyState icon={<Icon icon={icons.mail} size="lg" />} title="Inbox zero" description="You’re all caught up." />
          <EmptyState icon={<Icon icon={icons.folder} size="lg" color="secondary" />} title="This folder is empty" description="Drop files here or upload from your computer." />
          <EmptyState icon={<Icon icon={icons.bell} size="lg" color="accent" />} title="No notifications" description="We’ll let you know when a bid comes in." />
        </Stack>
      </Preview>

      <Preview label="With actions" description="One clear next step, or a primary and a secondary.">
        <Stack gap={4}>
          <EmptyState
            icon={<Icon icon={icons.seat} size="lg" />}
            title="Post your first room"
            description="Describe the job, invite people, and collect sealed bids."
            actions={<Button label="Post a room" variant="primary" icon={<Icon icon={icons.plus} />} />}
          />
          <EmptyState
            icon={<Icon icon={icons.upload} size="lg" />}
            title="No files attached"
            description="Add a brief so bidders know what you need."
            actions={
              <>
                <Button label="Upload a file" variant="primary" icon={<Icon icon={icons.upload} />} />
                <Button label="Write a brief" variant="secondary" />
              </>
            }
          />
        </Stack>
      </Preview>

      <Preview label="Search with no results" description="Name the query and offer a way out.">
        <EmptyState
          icon={<Icon icon={icons.search} size="lg" color="secondary" />}
          title="No results for “logo refresh”"
          description="Try fewer words, or clear your filters."
          actions={
            <>
              <Button label="Clear filters" variant="secondary" icon={<Icon icon={icons.filter} />} />
              <Button label="Clear search" variant="ghost" />
            </>
          }
        />
      </Preview>

      <Preview label="Error with retry" description="Empty because something failed — say so, then let people try again.">
        {failed ? (
          <EmptyState
            icon={<Icon icon="warning" size="lg" color="warning" />}
            title="Couldn’t load bids"
            description="Check your connection and try again."
            actions={<Button label="Retry" variant="secondary" icon={<Icon icon={icons.refresh} />} onClick={() => setFailed(false)} />}
          />
        ) : (
          <Stack gap={2} hAlign="start">
            <Text display="block">3 bids loaded.</Text>
            <Button label="Simulate failure" size="sm" variant="ghost" onClick={() => setFailed(true)} />
          </Stack>
        )}
      </Preview>

      <Preview label="Compact" description="isCompact tightens spacing and stacks actions for side panels and narrow cards.">
        <HStack gap={3} wrap="wrap" vAlign="stretch">
          <Card width={COMPACT_WIDTH}>
            <EmptyState
              isCompact
              icon={<Icon icon={icons.user} size="md" />}
              title="No invitees"
              description="Invite people to bid."
              actions={
                <>
                  <Button label="Invite" variant="primary" size="sm" />
                  <Button label="Import list" variant="ghost" size="sm" />
                </>
              }
            />
          </Card>
          <Card width={COMPACT_WIDTH}>
            <EmptyState isCompact icon={<Icon icon={icons.star} size="md" />} title="No favorites" description="Star a room to pin it here." />
          </Card>
        </HStack>
      </Preview>

      <Preview label="Inside a region" description="Fill the body of a card or panel; keep its header in place.">
        <Card>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>Invitees</Heading>
              <Button label={invited ? "Reset" : "Invite"} size="sm" variant="secondary" onClick={() => setInvited((v) => !v)} />
            </HStack>
            {invited ? (
              <Text display="block">Jordan Miles, Alex Rivera, and Dana Kim were invited.</Text>
            ) : (
              <EmptyState headingLevel={5} title="Nobody invited yet" description="Invitees appear here with their bid status." />
            )}
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
