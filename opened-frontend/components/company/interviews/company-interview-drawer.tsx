"use client";

import {
  Avatar,
  AvatarGroup,
  Badge,
  Banner,
  Button,
  Drawer,
  HStack,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "@openseat/design-system";
import { FACE_CHECK_META, INTERVIEW_STATUS_META, type CompanyInterview } from "@/lib/company";
import { formatDay, formatTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";

const AVATAR_SIZE = 48;
const PANEL_SIZE = 32;
const FORMAT_LABEL: Record<CompanyInterview["format"], string> = {
  video: "Video room",
  onsite: "On-site",
  phone: "Phone",
};

/** One round: logistics, panel, and the attendance call that drives billing. */
export function CompanyInterviewDrawer({
  interview,
  priceCents,
  currency,
  onClose,
  onChange,
}: {
  interview: CompanyInterview | null;
  priceCents: number;
  currency: string;
  onClose: () => void;
  onChange: (next: CompanyInterview, message: string) => void;
}) {
  if (!interview) return null;
  const status = INTERVIEW_STATUS_META[interview.status];
  const face = FACE_CHECK_META[interview.faceCheck];
  const isPast = interview.status === "attended" || interview.status === "no-show";

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={interview.candidate}
      subtitle={`${interview.jobTitle} · ${interview.round}`}
      headerStart={<Avatar name={interview.candidate} size={AVATAR_SIZE} tooltip={false} />}
      footer={
        isPast ? (
          <HStack hAlign="end">
            <Button label="Done" variant="primary" onClick={onClose} />
          </HStack>
        ) : (
          <HStack gap={2} hAlign="between" wrap="wrap">
            <Button
              label="No-show"
              variant="ghost"
              onClick={() =>
                onChange(
                  { ...interview, status: "no-show", faceCheck: "failed" },
                  "Marked no-show — price returned to your balance",
                )
              }
            />
            <HStack gap={2}>
              {interview.format === "video" ? (
                <Button label="Join room" variant="secondary" />
              ) : null}
              <Button
                label="Mark attended"
                variant="primary"
                onClick={() =>
                  onChange(
                    { ...interview, status: "attended", faceCheck: "passed" },
                    `Attended — ${formatCents(interview.chargedCents || priceCents, currency)} stays on this round`,
                  )
                }
              />
            </HStack>
          </HStack>
        )
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          <Badge label={status.label} variant={status.badge} />
          <Badge label={face.label} variant={face.badge} />
        </HStack>

        <MetadataList>
          <MetadataListItem label="When">
            {formatDay(interview.date)}, {formatTime(interview.start)} – {formatTime(interview.end)}
          </MetadataListItem>
          <MetadataListItem label="Format">{FORMAT_LABEL[interview.format]}</MetadataListItem>
          <MetadataListItem label="Panel">
            <HStack gap={2} vAlign="center">
              <AvatarGroup size={PANEL_SIZE}>
                {interview.interviewers.map((name) => (
                  <Avatar key={name} name={name} />
                ))}
              </AvatarGroup>
              <Text type="supporting" color="secondary">
                {interview.interviewers.join(", ")}
              </Text>
            </HStack>
          </MetadataListItem>
        </MetadataList>

        <Banner
          status={interview.status === "no-show" ? "warning" : "info"}
          title={
            interview.status === "attended"
              ? `Held ${formatCents(interview.chargedCents || priceCents, currency)} from your balance`
              : interview.status === "no-show"
                ? "Returned to your balance"
                : `${formatCents(priceCents, currency)} held from your balance`
          }
          description="A no-show returns the price. The hold stays once they attend."
        />
      </Stack>
    </Drawer>
  );
}
