"use client";

import { useState } from "react";
import { Avatar, Badge, Banner, Button, Card, Grid, HStack, Stack, Text, useToast } from "sid-ui";
import { disconnectGoogleCalendar, startGoogleCalendar } from "@/lib/me/pipeline";
import { CONNECTIONS, type Connection } from "@/lib/settings";

const LOGO_SIZE = 48;
const CARD_MIN_WIDTH = 280;
const GRID_MAX_COLUMNS = 2;
const GOOGLE_CALENDAR = "google-calendar";

function ConnectionCard({
  connection,
  account,
  onToggle,
}: {
  connection: Connection;
  account?: string;
  onToggle: () => void;
}) {
  const connected = account != null;
  return (
    <Card padding={5}>
      <Stack gap={4}>
        <HStack hAlign="between" vAlign="start" gap={3}>
          <Avatar name={connection.name} size={LOGO_SIZE} shape="rounded" tooltip={false} />
          {connected ? (
            <Badge label="Connected" variant="success" />
          ) : (
            <Badge label="Not connected" variant="neutral" />
          )}
        </HStack>
        <Stack gap={1}>
          <Text weight="semibold" display="block">
            {connection.name}
          </Text>
          <Text type="supporting" color="secondary" display="block">
            {connection.description}
          </Text>
        </Stack>
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <Text type="supporting" color={connected ? "primary" : "secondary"} maxLines={1}>
            {connected ? account : "—"}
          </Text>
          <Button
            label={connected ? "Disconnect" : "Connect"}
            variant={connected ? "ghost" : "secondary"}
            size="sm"
            onClick={onToggle}
          />
        </HStack>
      </Stack>
    </Card>
  );
}

const CANDIDATE_NOTICE = {
  title: "We never send email or post for you",
  description:
    "Google Calendar can add interviews and spot invites from companies you’ve applied to.",
};

/** Connected apps as cards. Google Calendar is live; other cards stay available for later. */
export function ConnectionSettings({
  connections = CONNECTIONS,
  notice = CANDIDATE_NOTICE,
  googleEmail,
  calendarResult,
}: {
  connections?: Connection[];
  notice?: { title: string; description: string };
  googleEmail?: string;
  calendarResult?: string;
}) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(
      connections.map((connection) => [
        connection.id,
        connection.id === GOOGLE_CALENDAR ? googleEmail : connection.account,
      ]),
    ),
  );

  const toggle = async (connection: Connection) => {
    if (connection.id !== GOOGLE_CALENDAR) {
      toast({ body: `${connection.name} isn’t available yet.` });
      return;
    }
    const connected = accounts[connection.id] != null;
    try {
      if (connected) {
        await disconnectGoogleCalendar();
        setAccounts((current) => ({ ...current, [connection.id]: undefined }));
        toast({ body: "Disconnected Google Calendar" });
        return;
      }
      const started = await startGoogleCalendar();
      window.location.assign(started.url);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not update Google Calendar.",
        type: "error",
      });
    }
  };

  const calendarNotice =
    calendarResult === "connected"
      ? {
          status: "success" as const,
          title: "Google Calendar connected",
          description: "We’ll add interviews you schedule and look for new invites.",
        }
      : calendarResult === "error"
        ? {
            status: "error" as const,
            title: "Couldn’t connect Google Calendar",
            description:
              "Try Connect again. If this keeps happening, check that Google Calendar is configured.",
          }
        : null;

  return (
    <Stack gap={6}>
      {calendarNotice ? (
        <Banner
          status={calendarNotice.status}
          title={calendarNotice.title}
          description={calendarNotice.description}
        />
      ) : (
        <Banner status="info" title={notice.title} description={notice.description} />
      )}
      <Grid columns={{ minWidth: CARD_MIN_WIDTH, max: GRID_MAX_COLUMNS }} gap={4}>
        {connections.map((connection) => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            account={accounts[connection.id]}
            onToggle={() => void toggle(connection)}
          />
        ))}
      </Grid>
    </Stack>
  );
}
