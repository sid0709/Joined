"use client";

import { useState } from "react";
import { Card, Divider, HStack, Heading, Icon, Stack, Switch, Text, icons } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SAVE_MS = 800;
const FAIL_MS = 600;
const SETTINGS = [
  { id: "bids", label: "New bids", description: "Each time an invitee submits.", icon: icons.mail },
  { id: "questions", label: "Questions", description: "When someone asks about the brief.", icon: "info" as const },
  { id: "closing", label: "Closing soon", description: "24 hours before the deadline.", icon: icons.clock },
  { id: "digest", label: "Weekly digest", description: "A Monday summary of every room.", icon: icons.bell },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SwitchDemo() {
  const [sm, setSm] = useState(true);
  const [md, setMd] = useState(true);
  const [dark, setDark] = useState(false);
  const [settings, setSettings] = useState<Record<string, boolean>>({ bids: true, questions: true, closing: false, digest: false });
  const [master, setMaster] = useState(true);
  const [sync, setSync] = useState(false);
  const [risky, setRisky] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="sm for dense panels; md is the default.">
        <Stack gap={3}>
          <Switch size="sm" label="Small" value={sm} onChange={setSm} />
          <Switch size="md" label="Medium" value={md} onChange={setMd} />
        </Stack>
      </Preview>

      <Preview align="start" label="Label position" description="Label after the switch by default, or before it.">
        <Stack gap={3}>
          <Switch label="Label at the end" value={dark} onChange={setDark} />
          <Switch label="Label at the start" labelPosition="start" value={dark} onChange={setDark} />
        </Stack>
      </Preview>

      <Preview align="start" label="Description and icon">
        <Switch
          label="Dark mode"
          description="Easier on the eyes at night."
          labelIcon={<Icon icon={icons.sparkle} size="sm" />}
          value={dark}
          onChange={setDark}
        />
      </Preview>

      <Preview label="Settings panel" description="labelSpacing=&quot;spread&quot; pushes switches to the right edge — the classic settings list.">
        <Card maxWidth={480}>
          <Stack gap={3}>
            <Heading level={4}>Notifications</Heading>
            <Switch label="Email notifications" description="Turn everything off at once." value={master} onChange={setMaster} labelSpacing="spread" width="100%" />
            <Divider />
            {SETTINGS.map((s) => (
              <Switch
                key={s.id}
                label={s.label}
                description={s.description}
                labelIcon={<Icon icon={s.icon} size="sm" />}
                value={master && settings[s.id]}
                isDisabled={!master}
                disabledMessage="Turn on email notifications first."
                onChange={(v) => setSettings((c) => ({ ...c, [s.id]: v }))}
                labelSpacing="spread"
                width="100%"
              />
            ))}
          </Stack>
        </Card>
      </Preview>

      <Preview align="start" label="Async save" description="changeAction shows a spinner and blocks repeat toggles until the save finishes.">
        <Stack gap={1}>
          <Switch
            label="Sync with Google Calendar"
            value={sync}
            changeAction={async (v) => {
              await wait(SAVE_MS);
              setSync(v);
            }}
          />
          <Caption>{sync ? "Deadlines appear on your calendar." : "Not syncing."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Failed save" description="Roll back and show an error when the change doesn’t stick.">
        <Switch
          label="Make room public"
          value={risky}
          status={error ? { type: "error", message: "Couldn’t update visibility. Try again." } : undefined}
          changeAction={async () => {
            setError(false);
            await wait(FAIL_MS);
            setRisky(false);
            setError(true);
          }}
        />
      </Preview>

      <Preview align="start" label="Disabled and required">
        <Stack gap={3}>
          <Switch label="Two-factor sign-in" value isDisabled disabledMessage="Required by your workspace admin." />
          <Switch label="Accept the new terms" isRequired value={false} onChange={() => undefined} />
        </Stack>
      </Preview>

      <Preview align="start" label="Hidden label" description="When a heading nearby already names the switch.">
        <HStack gap={3} vAlign="center">
          <Text weight="semibold">Accepting bids</Text>
          <Switch label="Accepting bids" isLabelHidden value={md} onChange={setMd} />
        </HStack>
      </Preview>
    </Examples>
  );
}
