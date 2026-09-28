"use client";

import { useState } from "react";
import { Badge, Button, HStack, Stack, Switch, Text, useToast } from "@openseat/design-system";
import { SESSIONS } from "@/lib/settings";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

/** Password, two-step sign-in, and devices — the same for every account. */
export function SignInSecurity() {
  const toast = useToast();
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessions, setSessions] = useState(SESSIONS);
  const others = sessions.filter((session) => !session.isCurrent);

  return (
    <SettingsGroup title="Sign-in & security" description="Keep your account yours.">
      <SettingsRow label="Password" description="Last changed 3 months ago." layout="inline">
        <Button label="Change password" variant="secondary" size="sm" />
      </SettingsRow>
      <SettingsRow
        label="Two-step verification"
        description="Ask for a code from your phone on new devices."
        layout="inline"
      >
        <Switch
          label="Two-step verification"
          isLabelHidden
          value={twoFactor}
          onChange={setTwoFactor}
        />
      </SettingsRow>
      <Stack gap={4}>
        <SettingsRow
          label="Where you’re signed in"
          description={`${sessions.length} active sessions`}
          layout="inline"
        >
          <Button
            label="Sign out other devices"
            variant="ghost"
            size="sm"
            isDisabled={others.length === 0}
            onClick={() => {
              setSessions((current) => current.filter((session) => session.isCurrent));
              toast({ body: `Signed out ${others.length} other devices` });
            }}
          />
        </SettingsRow>
        <Stack gap={3}>
          {sessions.map((session) => (
            <HStack key={session.id} hAlign="between" vAlign="center" gap={3} wrap="wrap">
              <Stack gap={0.5}>
                <HStack gap={2} vAlign="center">
                  <Text weight="medium">{session.device}</Text>
                  {session.isCurrent ? <Badge label="This device" variant="blue" /> : null}
                </HStack>
                <Text type="supporting" color="secondary">
                  {session.place} · {session.lastActive}
                </Text>
              </Stack>
            </HStack>
          ))}
        </Stack>
      </Stack>
    </SettingsGroup>
  );
}
