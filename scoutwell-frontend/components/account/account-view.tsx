"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  Stack,
  Switch,
  Text,
  TextInput,
  useToast,
  PageHeader,
  SectionCard,
} from "@openseat/design-system";
import {
  ApiError,
  LEVEL_BADGE,
  VERIFICATION,
  type Profile,
  type ProfilePatch,
} from "@openseat/scout";
import { formatDay } from "@/lib/dates";
import { scoutSend } from "@/lib/scout/client";
import { RemoveAccount } from "./remove-account";

const AVATAR_SIZE = 48;

export function AccountView({ profile, levelLabel }: { profile: Profile; levelLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(profile.name);

  const patch = async (body: ProfilePatch, done: string) => {
    try {
      await scoutSend("/me", "PATCH", body);
      toast({ body: done });
      router.refresh();
    } catch (err) {
      toast({ body: err instanceof ApiError ? err.message : "Could not save.", type: "error" });
    }
  };
  const verification = VERIFICATION[profile.verification];

  return (
    <Stack gap={6}>
      <PageHeader title="Account" description="Your profile and what we tell you about." />
      <SectionCard title="Profile">
        <HStack gap={4} vAlign="center">
          <Avatar name={profile.name} size={AVATAR_SIZE} tooltip={false} />
          <Stack gap={1}>
            <Text weight="semibold">{profile.name}</Text>
            <HStack gap={1.5} wrap="wrap">
              <Badge label={levelLabel} variant={LEVEL_BADGE[profile.level]} />
              <Badge label={`Tier ${profile.verification_tier}`} variant="neutral" />
              <Badge label={verification.label} variant={verification.badge} />
            </HStack>
          </Stack>
        </HStack>
        <MetadataList columns={2}>
          <MetadataListItem label="Email">{profile.email}</MetadataListItem>
          <MetadataListItem label="Scout since">{formatDay(profile.created_at)}</MetadataListItem>
          <MetadataListItem label="Terms accepted">
            {profile.terms_accepted_at ? formatDay(profile.terms_accepted_at) : "Not yet"}
          </MetadataListItem>
        </MetadataList>
        <HStack gap={3} vAlign="end" wrap="wrap">
          <TextInput label="Display name" value={name} onChange={setName} />
          <Button
            label="Save name"
            variant="secondary"
            isDisabled={!name.trim() || name.trim() === profile.name}
            clickAction={() => patch({ name }, "Name saved.")}
          />
        </HStack>
      </SectionCard>
      <SectionCard
        title="Notifications"
        description="In-app notices. Level changes and payouts are always sent."
      >
        <Stack gap={4}>
          <Switch
            label="Decisions on my jobs"
            description="Approved, rejected, duplicate, or waiting on a moderator."
            value={profile.notify_decisions}
            changeAction={(checked) => patch({ notify_decisions: checked }, "Saved.")}
          />
          <Switch
            label="New rewards"
            description="Approval, interview, and hire rewards as they land."
            value={profile.notify_rewards}
            changeAction={(checked) => patch({ notify_rewards: checked }, "Saved.")}
          />
        </Stack>
      </SectionCard>
      <RemoveAccount />
    </Stack>
  );
}
