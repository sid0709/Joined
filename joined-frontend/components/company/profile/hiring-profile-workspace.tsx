"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Grid,
  GridColumn,
  GridSystem,
  HStack,
  Selector,
  Stack,
  Sticky,
  Switch,
  Text,
  TextArea,
  TextInput,
  TimeField,
  ToggleButton,
  ToggleButtonGroup,
  useToast,
} from "@joined/design-system";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import type { AuthSession } from "@/lib/auth/types";
import {
  ABOUT_MAX_LENGTH,
  EMPTY_HIRING_PROFILE,
  INTERVIEW_BUFFERS,
  INTERVIEW_LENGTHS,
  WEEKDAYS,
  type HiringProfile,
} from "@/lib/company";
import { fetchHiringProfile, saveHiringProfile } from "@/lib/company/api";
import { TIME_ZONES } from "@/lib/settings";
import { HiringProfilePreview } from "./hiring-profile-preview";

const AVATAR_SIZE = 60;
const ABOUT_ROWS = 4;
const SIGNATURE_ROWS = 2;
const TIME_COLUMNS = 2;

/**
 * You as a hiring person: the card candidates meet, how you like to interview,
 * and how your messages sign off — with a live preview beside the form.
 */
export function HiringProfileWorkspace({ session }: { session: AuthSession }) {
  const toast = useToast();
  const [name, setName] = useState(session.user.name);
  const [profile, setProfile] = useState<HiringProfile>(EMPTY_HIRING_PROFILE);
  const company = session.company?.name ?? "";

  useEffect(() => {
    let active = true;
    fetchHiringProfile()
      .then((loaded) => {
        if (!active) return;
        if (loaded.name) setName(loaded.name);
        setProfile(loaded);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const set = <K extends keyof HiringProfile>(key: K, value: HiringProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const save = (message: string) => {
    saveHiringProfile({ ...profile, name })
      .then((saved) => {
        if (saved.name) setName(saved.name);
        setProfile(saved);
        toast({ body: message });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  return (
    <GridSystem gap={6} responsiveTo="viewport">
      <GridColumn span="full" lg={8}>
        <Stack gap={6}>
          <SettingsGroup
            title="Public profile"
            description="Shown on your messages, interview invites, and the jobs you own."
            footer={
              <SaveFooter
                hint="Teammates always see your full profile."
                message="Profile saved"
                action={
                  <Button
                    label="Save"
                    variant="primary"
                    size="sm"
                    onClick={() => save("Profile saved")}
                  />
                }
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
            <SettingsRow label="Full name">
              <TextInput label="Full name" isLabelHidden value={name} onChange={setName} />
            </SettingsRow>
            <SettingsRow
              label="Job title"
              description="Your title at the company, not the job you’re hiring for."
            >
              <TextInput
                label="Job title"
                isLabelHidden
                value={profile.title}
                onChange={(value) => set("title", value)}
              />
            </SettingsRow>
            <SettingsRow
              label="About you"
              description="A line or two candidates read before talking to you."
            >
              <TextArea
                label="About you"
                isLabelHidden
                rows={ABOUT_ROWS}
                maxLength={ABOUT_MAX_LENGTH}
                value={profile.about}
                onChange={(value) => set("about", value)}
              />
            </SettingsRow>
            <SettingsRow
              label="Show my name and photo to candidates"
              description="Off shows the company’s hiring team instead."
              layout="inline"
            >
              <Switch
                label="Show my name and photo to candidates"
                isLabelHidden
                value={profile.isVisibleToCandidates}
                onChange={(value) => set("isVisibleToCandidates", value)}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup
            title="How you interview"
            description="Scheduling offers candidates times that fit these, on any interview you’re part of."
            footer={
              <SaveFooter
                hint="Busy times on your connected calendar are always skipped."
                message="Interview preferences saved"
                action={
                  <Button
                    label="Save"
                    variant="primary"
                    size="sm"
                    onClick={() => save("Interview preferences saved")}
                  />
                }
              />
            }
          >
            <SettingsRow label="Default length">
              <Selector
                label="Default length"
                isLabelHidden
                options={INTERVIEW_LENGTHS}
                value={profile.interviewLength}
                onChange={(value) => set("interviewLength", value)}
              />
            </SettingsRow>
            <SettingsRow label="Break between interviews">
              <Selector
                label="Break between interviews"
                isLabelHidden
                options={INTERVIEW_BUFFERS}
                value={profile.buffer}
                onChange={(value) => set("buffer", value)}
              />
            </SettingsRow>
            <SettingsRow label="Interview days">
              <ToggleButtonGroup
                type="multiple"
                label="Interview days"
                value={profile.interviewDays}
                onChange={(value) => set("interviewDays", value)}
                size="sm"
              >
                {WEEKDAYS.map((day) => (
                  <ToggleButton key={day.value} value={day.value} label={day.label} />
                ))}
              </ToggleButtonGroup>
            </SettingsRow>
            <SettingsRow label="Hours">
              <Grid columns={TIME_COLUMNS} gap={3}>
                <Stack gap={1}>
                  <Text type="supporting" color="secondary">
                    From
                  </Text>
                  <TimeField
                    label="Interviews from"
                    value={profile.dayStart}
                    onChange={(value) => set("dayStart", value)}
                  />
                </Stack>
                <Stack gap={1}>
                  <Text type="supporting" color="secondary">
                    Until
                  </Text>
                  <TimeField
                    label="Interviews until"
                    value={profile.dayEnd}
                    onChange={(value) => set("dayEnd", value)}
                  />
                </Stack>
              </Grid>
            </SettingsRow>
            <SettingsRow label="Time zone">
              <Selector
                label="Time zone"
                isLabelHidden
                options={TIME_ZONES}
                value={profile.timeZone}
                onChange={(value) => set("timeZone", value)}
              />
            </SettingsRow>
            <SettingsRow
              label="Personal meeting link"
              description="Used when a round has no video link of its own."
            >
              <TextInput
                label="Personal meeting link"
                isLabelHidden
                value={profile.meetingLink}
                onChange={(value) => set("meetingLink", value)}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup
            title="Messages"
            description="How your messages to candidates sign off."
            footer={
              <SaveFooter
                hint="Added under your name on every message."
                message="Signature saved"
                action={
                  <Button
                    label="Save"
                    variant="primary"
                    size="sm"
                    onClick={() => save("Signature saved")}
                  />
                }
              />
            }
          >
            <SettingsRow label="Signature">
              <TextArea
                label="Signature"
                isLabelHidden
                rows={SIGNATURE_ROWS}
                value={profile.signature}
                onChange={(value) => set("signature", value)}
              />
            </SettingsRow>
          </SettingsGroup>
        </Stack>
      </GridColumn>

      <GridColumn span="full" lg={4}>
        <Sticky offset={CONTENT_PADDING}>
          <HiringProfilePreview name={name} company={company} profile={profile} />
        </Sticky>
      </GridColumn>
    </GridSystem>
  );
}
