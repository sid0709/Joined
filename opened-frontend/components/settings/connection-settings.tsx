"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Grid,
  HStack,
  Stack,
  Text,
  useToast,
} from "@openseat/design-system";
import { CONNECTIONS, type Connection } from "@/lib/settings";

const LOGO_SIZE = 48;
const CARD_MIN_WIDTH = 280;
const GRID_MAX_COLUMNS = 2;
const JUST_CONNECTED = "Connected just now";

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

export function ConnectionSettings() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(CONNECTIONS.map((connection) => [connection.id, connection.account])),
  );

  const toggle = (connection: Connection) => {
    const connected = accounts[connection.id] != null;
    setAccounts((current) => ({
      ...current,
      [connection.id]: connected ? undefined : (connection.account ?? JUST_CONNECTED),
    }));
    toast({ body: connected ? `Disconnected ${connection.name}` : `Connected ${connection.name}` });
  };

  return (
    <Stack gap={6}>
      <Banner
        status="info"
        title="We never send email or post for you"
        description="Connections are read-only and limited to companies you’ve applied to."
      />
      <Grid columns={{ minWidth: CARD_MIN_WIDTH, max: GRID_MAX_COLUMNS }} gap={4}>
        {CONNECTIONS.map((connection) => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            account={accounts[connection.id]}
            onToggle={() => toggle(connection)}
          />
        ))}
      </Grid>
    </Stack>
  );
}
