"use client";

import { Banner, Button, HStack, Stack, Text, TextInput, useToast } from "@openseat/design-system";
import { scaffoldSelfScheduleUrl } from "@/lib/schedule-join";

/** Share (or scaffold) a candidate self-schedule link while awaiting a slot. */
export function SelfScheduleShare({
  interviewId,
  url,
  candidate,
}: {
  interviewId?: string;
  url?: string | null;
  candidate?: string;
}) {
  const toast = useToast();
  const live = Boolean(url && url.trim());
  const display = live
    ? url!.trim()
    : interviewId
      ? scaffoldSelfScheduleUrl(interviewId)
      : "https://openseat.app/schedule/…";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      toast({
        body: live ? "Self-schedule link copied." : "Scaffold link copied — Einstein mint pending.",
      });
    } catch {
      toast({ body: "Could not copy link.", type: "error" });
    }
  };

  return (
    <Stack gap={3}>
      {!live ? (
        <Banner
          status="info"
          title="Self-schedule link not minted yet"
          description="UI is ready. Einstein should return selfScheduleUrl on awaiting interviews (see lib/schedule-join.ts)."
        />
      ) : null}
      <Text type="supporting" color="secondary">
        {candidate
          ? `Share a link so ${candidate} can pick a time that fits your availability.`
          : "Share a link so the candidate can pick a time that fits your availability."}
      </Text>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <TextInput
          label="Self-schedule link"
          value={display}
          onChange={() => undefined}
          isReadOnly
        />
        <Button label="Copy link" variant="secondary" size="sm" onClick={() => void copy()} />
      </HStack>
    </Stack>
  );
}
