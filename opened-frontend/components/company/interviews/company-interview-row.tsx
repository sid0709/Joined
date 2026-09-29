"use client";

import { Avatar, Badge, ClickableCard, HStack, Stack, Text } from "@openseat/design-system";
import { FACE_CHECK_META, INTERVIEW_STATUS_META, type CompanyInterview } from "@/lib/company";
import { formatTime } from "@/lib/dates";

const AVATAR_SIZE = 36;

/** One round on the team calendar: candidate, job, time, and where it stands. */
export function CompanyInterviewRow({
  interview,
  onOpen,
}: {
  interview: CompanyInterview;
  onOpen: () => void;
}) {
  const status = INTERVIEW_STATUS_META[interview.status];
  const face = FACE_CHECK_META[interview.faceCheck];

  return (
    <ClickableCard
      label={`${interview.candidate}, ${interview.round}`}
      onClick={onOpen}
      padding={4}
    >
      <HStack gap={3} vAlign="start">
        <Avatar name={interview.candidate} size={AVATAR_SIZE} tooltip={false} />
        <Stack gap={1}>
          <Text weight="semibold">{interview.candidate}</Text>
          <Text type="supporting" color="secondary">
            {interview.jobTitle} · {interview.round}
          </Text>
          <Text type="supporting" weight="medium">
            {interview.status === "awaiting"
              ? interview.proposedSlots && interview.proposedSlots.length > 0
                ? `${interview.proposedSlots.length} time${interview.proposedSlots.length === 1 ? "" : "s"} offered · slot not locked`
                : interview.selfScheduleUrl
                  ? "Self-schedule ready · slot not locked"
                  : "Waiting on candidate · slot not locked"
              : `${formatTime(interview.start)} – ${formatTime(interview.end)}`}
          </Text>
          <HStack gap={1.5} wrap="wrap">
            <Badge label={status.label} variant={status.badge} />
            {interview.status !== "awaiting" ? (
              <Badge label={face.label} variant={face.badge} />
            ) : null}
          </HStack>
        </Stack>
      </HStack>
    </ClickableCard>
  );
}
