"use client";

import { useState } from "react";
import {
  CheckboxInput,
  Grid,
  Stack,
  Switch,
  Table,
  Text,
  TimeField,
  type TableColumn,
} from "@openseat/design-system";
import {
  CHANNELS,
  NOTIFICATION_EVENTS,
  QUIET_HOURS,
  type NotificationChannel,
  type NotificationEvent,
} from "@/lib/settings";
import { SaveFooter } from "./save-footer";
import { SettingsGroup, SettingsRow } from "./settings-group";

type Matrix = Record<string, Record<NotificationChannel, boolean>>;

const INITIAL: Matrix = Object.fromEntries(
  NOTIFICATION_EVENTS.map((event) => [event.id, { ...event.defaults }]),
);
const TIME_COLUMNS = 2;

/** Each event × each channel as a checkbox grid, plus quiet hours. */
export function NotificationSettings() {
  const [matrix, setMatrix] = useState(INITIAL);
  const [quiet, setQuiet] = useState(true);
  const [quietStart, setQuietStart] = useState(QUIET_HOURS.start);
  const [quietEnd, setQuietEnd] = useState(QUIET_HOURS.end);

  const toggle = (eventId: string, channel: NotificationChannel, value: boolean) =>
    setMatrix((current) => ({ ...current, [eventId]: { ...current[eventId], [channel]: value } }));

  const columns: TableColumn<NotificationEvent>[] = [
    {
      key: "label",
      header: "Notify me when",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="medium">{row.label}</Text>
          <Text type="supporting" color="secondary">
            {row.description}
          </Text>
        </Stack>
      ),
    },
    ...CHANNELS.map<TableColumn<NotificationEvent>>((channel) => ({
      key: channel.id,
      header: channel.label,
      align: "center",
      render: (row) => (
        <CheckboxInput
          label={`${row.label} by ${channel.label}`}
          isLabelHidden
          value={matrix[row.id][channel.id]}
          onChange={(checked) => toggle(row.id, channel.id, checked)}
        />
      ),
    })),
  ];

  return (
    <Stack gap={6}>
      <SettingsGroup
        title="Where updates reach you"
        description="Tick a channel for each kind of update."
        footer={
          <SaveFooter
            hint="Texts go to the phone number on your account."
            message="Notification settings saved"
          />
        }
      >
        <Table
          caption="Notification channels"
          columns={columns}
          rows={NOTIFICATION_EVENTS}
          rowKey={(row) => row.id}
          variant="plain"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Quiet hours"
        description="Hold push and text notifications overnight."
        footer={
          <SaveFooter hint="Interview reminders always come through." message="Quiet hours saved" />
        }
      >
        <SettingsRow label="Pause notifications overnight" layout="inline">
          <Switch
            label="Pause notifications overnight"
            isLabelHidden
            value={quiet}
            onChange={setQuiet}
          />
        </SettingsRow>
        <SettingsRow label="Hours" description="In your time zone.">
          <Grid columns={TIME_COLUMNS} gap={3}>
            <Stack gap={1}>
              <Text type="supporting" color="secondary">
                From
              </Text>
              <TimeField
                value={quietStart}
                onChange={setQuietStart}
                label="Quiet from"
                disabled={!quiet}
              />
            </Stack>
            <Stack gap={1}>
              <Text type="supporting" color="secondary">
                Until
              </Text>
              <TimeField
                value={quietEnd}
                onChange={setQuietEnd}
                label="Quiet until"
                disabled={!quiet}
              />
            </Stack>
          </Grid>
        </SettingsRow>
      </SettingsGroup>
    </Stack>
  );
}
