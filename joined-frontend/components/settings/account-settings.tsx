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
  TextInput,
} from "sid-ui";
import type { AuthSession } from "@/lib/auth/types";
import { LANGUAGES, TIME_ZONES, WEEK_STARTS } from "@/lib/settings";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { SignInSecurity } from "./sign-in-security";

const AVATAR_SIZE = 60;
const DEFAULT_TIME_ZONE = "America/Chicago";

export function AccountSettings({ session }: { session: AuthSession | null }) {
  const [name, setName] = useState(session?.user.name ?? "");
  const email = session?.user.email ?? "";
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const [weekStart, setWeekStart] = useState(WEEK_STARTS[0].value);

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
          <TextInput label="Email" isLabelHidden type="email" value={email} isReadOnly />
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

      <SignInSecurity />
    </Stack>
  );
}
