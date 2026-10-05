"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  SectionCard,
  Selector,
  Stack,
  Text,
  TextArea,
  useToast,
} from "sid-ui";
import {
  ApiError,
  type AdminScoutDetail,
  type LevelRule,
  type ScoutLevel,
  type ScoutPatch,
} from "@joined/scout";
import { adminSend } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/** Staff changes to a scout: set or release the level, decide on identity. */
export function ScoutActions({
  detail,
  levels,
}: {
  detail: AdminScoutDetail;
  levels: LevelRule[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { profile } = detail;
  const [level, setLevel] = useState<ScoutLevel>(profile.level);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const patch = async (body: ScoutPatch, done: string) => {
    setError("");
    try {
      await adminSend(
        `/v1/admin/scout/scouts/${encodeURIComponent(profile.user_id)}`,
        "PATCH",
        body,
      );
      toast({ body: done });
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the change.");
    }
  };

  return (
    <Stack gap={6}>
      {error ? <Banner status="error" title={error} /> : null}
      {profile.verification === "pending" ? (
        <SectionCard
          title="Identity check"
          description="Tier 2 unlocks payouts. Compare against the ID the scout sent through support."
        >
          <MetadataList columns="single">
            <MetadataListItem label="Legal name">{profile.legal_name || "—"}</MetadataListItem>
            <MetadataListItem label="Country">{profile.country || "—"}</MetadataListItem>
            <MetadataListItem label="Requested">
              {formatDateTime(profile.verification_updated_at)}
            </MetadataListItem>
          </MetadataList>
          <TextArea
            label="Note"
            value={note}
            onChange={setNote}
            isOptional
            description="Sent to the scout when you decline."
          />
          <HStack gap={2} wrap="wrap">
            <Button
              label="Verify identity"
              variant="primary"
              clickAction={() => patch({ verification: "verified", note }, "Scout verified.")}
            />
            <Button
              label="Decline"
              variant="destructive"
              clickAction={() =>
                patch({ verification: "rejected", note }, "Verification declined.")
              }
            />
          </HStack>
        </SectionCard>
      ) : null}
      <SectionCard
        title="Level"
        description={
          profile.level_pinned
            ? "Set by staff: quality changes no longer move this scout."
            : "Follows the scout's quality. Setting it here pins it."
        }
      >
        <Selector
          label="Level"
          options={levels.map((rule) => ({
            value: rule.id,
            label: `${rule.label} · ${rule.daily_limit} a day`,
          }))}
          value={level}
          onChange={(value) => setLevel(value as ScoutLevel)}
        />
        <HStack gap={2} wrap="wrap">
          <Button
            label="Set level"
            variant="secondary"
            isDisabled={level === profile.level && profile.level_pinned}
            clickAction={() => patch({ level, note }, "Level set.")}
          />
          {profile.level_pinned ? (
            <Button
              label="Let quality decide"
              variant="ghost"
              clickAction={() => patch({ level_pinned: false, note }, "Level released.")}
            />
          ) : null}
        </HStack>
        <Text type="supporting" color="secondary" display="block">
          Every change is written to the audit log.
        </Text>
      </SectionCard>
    </Stack>
  );
}
