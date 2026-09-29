"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Banner,
  Button,
  Drawer,
  Heading,
  HStack,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
  TextArea,
  useToast,
} from "@openseat/design-system";
import { SelfScheduleShare } from "@/components/company/interviews/self-schedule-share";
import { ScorecardSubmitShell } from "@/components/company/pipeline/scorecard-shell";
import {
  FACE_CHECK_META,
  INTERVIEW_STATUS_META,
  type CompanyInterview,
  type HiringProfile,
} from "@/lib/company";
import type {
  ScorecardSubmission,
  ScorecardSubmissionInput,
  ScorecardTemplate,
} from "@/lib/pipeline-eval";
import { formatDay, formatTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import {
  MAX_PROPOSED_SLOTS,
  openJoinUrl,
  proposeSlotsFromAvailability,
  resolveJoinUrl,
  slotLabel,
  type ProposedSlot,
} from "@/lib/schedule-join";

const AVATAR_SIZE = 48;
const PANEL_SIZE = 32;
const NOTE_ROWS = 3;
const FORMAT_LABEL: Record<CompanyInterview["format"], string> = {
  video: "Video room",
  onsite: "On-site",
  phone: "Phone",
};

/** One round: logistics, panel, join, attendance, and post-interview feedback. */
export function CompanyInterviewDrawer({
  interview,
  priceCents,
  currency,
  meetingLink,
  hiringProfile,
  scorecardTemplate,
  scorecards,
  onScorecard,
  onClose,
  onChange,
  onLockSlot,
  onReofferSlots,
}: {
  interview: CompanyInterview | null;
  priceCents: number;
  currency: string;
  meetingLink?: string | null;
  hiringProfile?: HiringProfile | null;
  scorecardTemplate?: ScorecardTemplate | null;
  scorecards?: ScorecardSubmission[];
  onScorecard?: (input: ScorecardSubmissionInput) => void | Promise<void>;
  onClose: () => void;
  onChange: (next: CompanyInterview, message: string) => void;
  onLockSlot?: (slot: ProposedSlot) => void;
  onReofferSlots?: (slots: ProposedSlot[]) => void;
}) {
  const toast = useToast();
  const [feedbackPrompt, setFeedbackPrompt] = useState(false);
  const [quickNotes, setQuickNotes] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- remount-equivalent reset on id change */
  useEffect(() => {
    setFeedbackPrompt(false);
    setQuickNotes("");
  }, [interview?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!interview) return null;
  const status = INTERVIEW_STATUS_META[interview.status];
  const face = FACE_CHECK_META[interview.faceCheck];
  const isPast = interview.status === "attended" || interview.status === "no-show";
  const isAwaiting = interview.status === "awaiting";
  const joinUrl = resolveJoinUrl(interview, meetingLink);
  const applicantScorecards = (scorecards ?? []).filter(
    (item) => item.applicantId === interview.applicantId,
  );

  const markAttended = () => {
    onChange(
      { ...interview, status: "attended", faceCheck: "passed" },
      `Attended — ${formatCents(interview.chargedCents || priceCents, currency)} stays on this round`,
    );
    setFeedbackPrompt(true);
  };

  const join = () => {
    if (!joinUrl) {
      toast({
        body: "No meeting link yet. Add one on your hiring profile or set meetingUrl on this round.",
        type: "error",
      });
      return;
    }
    openJoinUrl(joinUrl);
  };

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={interview.candidate}
      subtitle={`${interview.jobTitle} · ${interview.round}`}
      headerStart={<Avatar name={interview.candidate} size={AVATAR_SIZE} tooltip={false} />}
      footer={
        isPast || feedbackPrompt ? (
          <HStack gap={2} hAlign="between" wrap="wrap">
            {feedbackPrompt ? (
              <Text type="supporting" color="secondary">
                Leave a quick score before you go.
              </Text>
            ) : (
              <span />
            )}
            <Button
              label="Done"
              variant="primary"
              onClick={() => {
                setFeedbackPrompt(false);
                onClose();
              }}
            />
          </HStack>
        ) : isAwaiting ? (
          <HStack gap={2} hAlign="end" wrap="wrap">
            <Button label="Close" variant="ghost" onClick={onClose} />
            <Button
              label="Copy self-schedule"
              variant="secondary"
              onClick={() => {
                const url =
                  interview.selfScheduleUrl ||
                  (typeof window !== "undefined"
                    ? `${window.location.origin}/schedule/${interview.id}`
                    : "");
                void navigator.clipboard.writeText(url).then(
                  () => toast({ body: "Self-schedule link copied." }),
                  () => toast({ body: "Could not copy link.", type: "error" }),
                );
              }}
            />
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
                <Button
                  label="Join room"
                  variant="secondary"
                  isDisabled={!joinUrl}
                  onClick={join}
                />
              ) : null}
              <Button label="Mark attended" variant="primary" onClick={markAttended} />
            </HStack>
          </HStack>
        )
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          <Badge label={status.label} variant={status.badge} />
          {!isAwaiting ? <Badge label={face.label} variant={face.badge} /> : null}
        </HStack>

        {isAwaiting ? (
          <Banner
            status="warning"
            title="Waiting on the candidate to pick a time"
            description="Offer times from your availability or share a self-schedule link. Needs Attention surfaces these until a slot is locked."
          />
        ) : null}

        <MetadataList>
          <MetadataListItem label="When">
            {isAwaiting
              ? "Slot not locked yet"
              : `${formatDay(interview.date)}, ${formatTime(interview.start)} – ${formatTime(interview.end)}`}
          </MetadataListItem>
          <MetadataListItem label="Format">{FORMAT_LABEL[interview.format]}</MetadataListItem>
          {interview.format === "video" ? (
            <MetadataListItem label="Join">
              {joinUrl ? (
                <Text weight="medium" color="accent">
                  {joinUrl}
                </Text>
              ) : (
                <Text type="supporting" color="secondary">
                  No Meet/Zoom link on this round yet
                </Text>
              )}
            </MetadataListItem>
          ) : interview.where ? (
            <MetadataListItem label="Where">{interview.where}</MetadataListItem>
          ) : null}
          <MetadataListItem label="Panel">
            <HStack gap={2} vAlign="center">
              <AvatarGroup size={PANEL_SIZE}>
                {interview.interviewers.map((name) => (
                  <Avatar key={name} name={name} />
                ))}
              </AvatarGroup>
              <Text type="supporting" color="secondary">
                {interview.interviewers.join(", ") || "—"}
              </Text>
            </HStack>
          </MetadataListItem>
        </MetadataList>

        {isAwaiting ? (
          <Stack gap={4}>
            <Heading level={3}>Offered times</Heading>
            {(interview.proposedSlots ?? []).length > 0 ? (
              <Stack gap={2}>
                {(interview.proposedSlots as ProposedSlot[]).map((slot) => (
                  <HStack
                    key={slotLabel(slot)}
                    gap={2}
                    vAlign="center"
                    hAlign="between"
                    wrap="wrap"
                  >
                    <Text weight="medium">{slotLabel(slot)}</Text>
                    {onLockSlot ? (
                      <Button
                        label="Lock this time"
                        variant="secondary"
                        size="sm"
                        onClick={() => onLockSlot(slot)}
                      />
                    ) : null}
                  </HStack>
                ))}
              </Stack>
            ) : (
              <Text type="supporting" color="secondary">
                No proposed times yet. Re-offer from your availability, or share the self-schedule
                link.
              </Text>
            )}
            {onReofferSlots && hiringProfile ? (
              <Button
                label="Re-offer from availability"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const slots = proposeSlotsFromAvailability(hiringProfile, {
                    count: MAX_PROPOSED_SLOTS,
                  });
                  if (slots.length === 0) {
                    toast({
                      body: "No availability slots on your hiring profile yet.",
                      type: "error",
                    });
                    return;
                  }
                  onReofferSlots(slots);
                }}
              />
            ) : null}
            <SelfScheduleShare
              interviewId={interview.id}
              url={interview.selfScheduleUrl}
              candidate={interview.candidate}
            />
          </Stack>
        ) : null}

        {!isAwaiting ? (
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
        ) : null}

        {feedbackPrompt || interview.status === "attended" ? (
          <Stack gap={3}>
            <Banner
              status="info"
              title="How did it go?"
              description={
                scorecardTemplate
                  ? "Submit a scorecard while the round is fresh. Required when this job’s feedback gate asks for one."
                  : "Leave a quick note while the round is fresh. Add a scorecard template on the job to capture criteria."
              }
            />
            {scorecardTemplate && onScorecard ? (
              <ScorecardSubmitShell
                key={interview.applicantId}
                template={scorecardTemplate}
                applicantId={interview.applicantId}
                existing={applicantScorecards}
                onSubmit={onScorecard ?? (async () => undefined)}
              />
            ) : null}
            <TextArea
              label="Quick notes"
              value={quickNotes}
              onChange={setQuickNotes}
              rows={NOTE_ROWS}
              placeholder="Strengths, concerns, next step…"
            />
          </Stack>
        ) : null}
      </Stack>
    </Drawer>
  );
}
