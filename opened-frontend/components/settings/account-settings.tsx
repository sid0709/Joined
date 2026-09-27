"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Switch,
  Text,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { PROFILE } from "@/lib/profile";
import { LANGUAGES, SESSIONS, TIME_ZONES, WEEK_STARTS } from "@/lib/settings";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

const AVATAR_SIZE = 60;
const DEFAULT_TIME_ZONE = "America/Chicago";

export function AccountSettings() {
  const toast = useToast();
  const [name, setName] = useState(PROFILE.name);
  const [email, setEmail] = useState(PROFILE.email);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const [weekStart, setWeekStart] = useState(WEEK_STARTS[0].value);
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessions, setSessions] = useState(SESSIONS);
  const others = sessions.filter((session) => !session.isCurrent);

  return (
    <Stack gap={6}>
      <SettingsGroup
        title="Profile"
        description="How you appear to companies you apply to."
        footer={
          <SaveFooter
            hint="Changing your email sends a confirmation link."
            message="Profile saved"
          />
        }
      >
        <SettingsRow label="Photo" description="Square, at least 400 × 400 px." layout="inline">
          <HStack gap={3} vAlign="center">
            <Avatar name={name} size={AVATAR_SIZE} tooltip={false} />
            <Button label="Upload" variant="secondary" size="sm" />
            <Button label="Remove" variant="ghost" size="sm" />
          </HStack>
        </SettingsRow>
        <SettingsRow label="Full name" description="Use the name on your resume.">
          <TextInput label="Full name" isLabelHidden value={name} onChange={setName} />
        </SettingsRow>
        <SettingsRow
          label="Email"
          description={
            <HStack gap={2} vAlign="center" wrap="wrap">
              <span>Where recruiters reply.</span>
              <Badge label="Verified" variant="success" />
            </HStack>
          }
        >
          <TextInput label="Email" isLabelHidden type="email" value={email} onChange={setEmail} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Language & region"
        description="Used for interview times, reminders, and dates."
        footer={
          <SaveFooter
            hint="Interview times always show in your time zone."
            message="Region saved"
          />
        }
      >
        <SettingsRow label="Time zone">
          <Selector
            label="Time zone"
            isLabelHidden
            options={TIME_ZONES}
            value={timeZone}
            onChange={setTimeZone}
          />
        </SettingsRow>
        <SettingsRow label="Language">
          <Selector
            label="Language"
            isLabelHidden
            options={LANGUAGES}
            value={language}
            onChange={setLanguage}
          />
        </SettingsRow>
        <SettingsRow label="Week starts on" description="For the interview calendar.">
          <SegmentedControl label="Week starts on" value={weekStart} onChange={setWeekStart}>
            {WEEK_STARTS.map((option) => (
              <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
            ))}
          </SegmentedControl>
        </SettingsRow>
      </SettingsGroup>

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
    </Stack>
  );
}
