"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Drawer,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  ProgressBar,
  Rating,
  Selector,
  Stack,
  Text,
  TextArea,
  Token,
  Tokenizer,
  createStaticSource,
} from "@openseat/design-system";
import {
  APPLICANT_STAGES,
  ASSISTED_LABEL,
  REFERRAL_OPTIONS,
  STRONG_FIT,
  TAG_SUGGESTIONS,
  findDuplicateApplicants,
  mergeStageOptions,
  type Applicant,
  type ApplicantColumnId,
  type HiringProfile,
  type InterviewGuide,
  type ScorecardSubmission,
  type ScorecardSubmissionInput,
  type ScorecardTemplate,
  type TeamMember,
} from "@/lib/company";
import { FeedbackGateBanner, canAdvanceStage } from "@/components/company/pipeline/feedback-gate";
import { InterviewGuideView } from "@/components/company/pipeline/interview-guide-shell";
import { ScorecardSubmitShell } from "@/components/company/pipeline/scorecard-shell";
import {
  SchedulePanel,
  emptyScheduleDraft,
  scheduleDraftReady,
  type ScheduleDraft,
} from "@/components/company/interviews/schedule-panel";
import { formatShortDate } from "@/lib/dates";
import { formatCount } from "@/lib/jobs";
import {
  DEFAULT_FEEDBACK_GATE,
  type FeedbackGateConfig,
  type PipelineStageDef,
} from "@/lib/pipeline-eval";
import type { ScheduleMode, ProposedSlot } from "@/lib/schedule-join";
import type { OfferTemplate } from "@/lib/offer-hire";
import { OfferPanel, type OfferActionResult } from "@/components/company/offer/offer-panel";

const AVATAR_SIZE = 48;
const NOTE_ROWS = 3;
const REFERRAL_LABEL = Object.fromEntries(
  REFERRAL_OPTIONS.map((option) => [option.value, option.label]),
);

export type ApplicantScheduleRequest = {
  date: string;
  start: string;
  end: string;
  round: string;
  mode: ScheduleMode;
  proposedSlots: ProposedSlot[];
  interviewerIds: string[];
  interviewerNames: string[];
};

/** A candidate’s profile, intake answers, tags, the team’s read, and the next move. */
export function ApplicantDrawer({
  applicant,
  allApplicants,
  teamMembers,
  hiringProfile,
  scorecardTemplate,
  interviewGuide,
  feedbackGate,
  customStages,
  scorecards,
  offerTemplates,
  onScorecard,
  onClose,
  onChange,
  onSchedule,
  onOffer,
}: {
  applicant: Applicant | null;
  allApplicants: Applicant[];
  teamMembers: TeamMember[];
  hiringProfile: HiringProfile | null;
  scorecardTemplate: ScorecardTemplate | null;
  interviewGuide: InterviewGuide | null;
  feedbackGate: FeedbackGateConfig;
  customStages?: PipelineStageDef[];
  scorecards: ScorecardSubmission[];
  offerTemplates: OfferTemplate[];
  onScorecard: (input: ScorecardSubmissionInput) => void | Promise<void>;
  onClose: () => void;
  onChange: (next: Applicant, message?: string) => void;
  onSchedule: (applicant: Applicant, slot: ApplicantScheduleRequest) => void;
  onOffer: (result: OfferActionResult) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<ScheduleDraft>(emptyScheduleDraft());
  const tagSource = useMemo(
    () => createStaticSource(TAG_SUGGESTIONS.map((label) => ({ id: label, label }))),
    [],
  );
  const [gateError, setGateError] = useState<ReturnType<typeof canAdvanceStage> | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- reset on candidate id */
  useEffect(() => {
    if (!applicant) return;
    setDraft({
      ...emptyScheduleDraft(),
      interviewerIds: applicant.interviewerIds ?? [],
    });
    setGateError(null);
  }, [applicant?.id]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  if (!applicant) return null;

  const applicantScorecards = scorecards.filter((item) => item.applicantId === applicant.id);
  const stageOptions = mergeStageOptions(APPLICANT_STAGES, customStages).map((stage) => ({
    value: stage.id,
    label: stage.title,
  }));
  const tryMove = (stage: ApplicantColumnId, message?: string) => {
    const nextNotes = notes[applicant.id] ?? applicant.notes;
    const check = canAdvanceStage({
      fromStage: applicant.columnId,
      toStage: stage,
      notes: nextNotes,
      rating: applicant.rating,
      hasScorecard: applicantScorecards.length > 0,
      gate: feedbackGate ?? DEFAULT_FEEDBACK_GATE,
      customStages,
    });
    if (!check.ok) {
      setGateError(check);
      return;
    }
    setGateError(null);
    onChange({ ...applicant, columnId: stage, notes: nextNotes }, message);
  };
  const move = (stage: ApplicantColumnId, message: string) => tryMove(stage, message);
  const slotReady = scheduleDraftReady(draft);
  const duplicates = findDuplicateApplicants(applicant, allApplicants);
  const answers = applicant.screeningAnswers ?? [];
  const knockedOut = answers.some((answer) => answer.knockedOut);
  const tags = (applicant.tags ?? []).map((label) => ({ id: label, label }));

  const submitSchedule = () => {
    const names = draft.interviewerIds
      .map((id) => teamMembers.find((member) => member.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    onSchedule(applicant, {
      date: draft.date,
      start: draft.start,
      end: draft.end,
      round: draft.round,
      mode: draft.mode,
      proposedSlots: draft.proposedSlots,
      interviewerIds: draft.interviewerIds,
      interviewerNames: names,
    });
  };

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={applicant.name}
      subtitle={applicant.headline}
      headerStart={<Avatar name={applicant.name} size={AVATAR_SIZE} tooltip={false} />}
      footer={
        <HStack gap={2} hAlign="between" wrap="wrap">
          <HStack gap={2}>
            <Button
              label="Reject"
              variant="ghost"
              onClick={() => move("rejected", `${applicant.name} rejected`)}
            />
            {applicant.assisted !== "direct" ? (
              <Button
                label="Not relevant"
                variant="ghost"
                onClick={() => move("rejected", "Marked not relevant — not billed")}
              />
            ) : null}
          </HStack>
          <HStack gap={2}>
            <Button
              label="Shortlist"
              variant="secondary"
              onClick={() => move("screening", `${applicant.name} shortlisted`)}
            />
            {applicant.columnId === "interview" || applicant.columnId === "screening" ? (
              <Button
                label="Move to offer"
                variant="secondary"
                onClick={() => move("offer", `${applicant.name} moved to offer`)}
              />
            ) : null}
            {applicant.columnId === "offer" ? (
              <Button
                label="Mark hired"
                variant="primary"
                onClick={() => move("hired", `${applicant.name} hired`)}
              />
            ) : (
              <Button
                label={
                  draft.mode === "propose"
                    ? "Offer times"
                    : draft.mode === "self_schedule"
                      ? "Send self-schedule"
                      : "Schedule interview"
                }
                variant="primary"
                isDisabled={!slotReady}
                onClick={submitSchedule}
              />
            )}
          </HStack>
        </HStack>
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          {applicant.verified ? (
            <Badge label="Verified identity" variant="blue" />
          ) : (
            <Badge label="Unverified" variant="warning" />
          )}
          <Badge
            label={ASSISTED_LABEL[applicant.assisted]}
            variant={applicant.assisted === "direct" ? "neutral" : "purple"}
          />
          {knockedOut ? <Badge label="Knockout answer" variant="error" /> : null}
          {applicant.consentAt ? <Badge label="Consent captured" variant="success" /> : null}
        </HStack>

        {duplicates.length > 0 ? (
          <Banner
            status="warning"
            title={applicant.userId ? "Same account on another job" : "Possible duplicate"}
            description={
              applicant.userId
                ? `This seeker also applied to ${duplicates
                    .map((item) => item.jobTitle)
                    .join(", ")}.`
                : `Same name also applied to ${duplicates
                    .map((item) => item.jobTitle)
                    .join(", ")}. Confirm it is not the same person before advancing.`
            }
          />
        ) : null}

        <Stack gap={2}>
          <HStack hAlign="between" vAlign="end">
            <Text type="label">Fit for {applicant.jobTitle}</Text>
            <Heading level={3} type="display-3">
              {`${applicant.fit}%`}
            </Heading>
          </HStack>
          <ProgressBar
            label="Fit"
            isLabelHidden
            value={applicant.fit}
            variant={applicant.fit >= STRONG_FIT ? "success" : "accent"}
          />
        </Stack>

        <MetadataList columns={2}>
          <MetadataListItem label="Experience">
            {formatCount(applicant.experienceYears, "year")}
          </MetadataListItem>
          <MetadataListItem label="Most recent">{applicant.lastCompany}</MetadataListItem>
          <MetadataListItem label="Location">{applicant.location}</MetadataListItem>
          <MetadataListItem label="Applied">
            {formatShortDate(applicant.appliedOn)}
          </MetadataListItem>
          <MetadataListItem label="Resume">{applicant.resume}</MetadataListItem>
          <MetadataListItem label="Referral">
            {applicant.referralSource
              ? (REFERRAL_LABEL[applicant.referralSource] ?? applicant.referralSource)
              : "—"}
          </MetadataListItem>
          <MetadataListItem label="Consent">
            {applicant.consentAt ? formatShortDate(new Date(applicant.consentAt)) : "—"}
          </MetadataListItem>
        </MetadataList>

        {answers.length > 0 ? (
          <Stack gap={3}>
            <Heading level={3}>Screening answers</Heading>
            <Stack gap={2}>
              {answers.map((answer) => (
                <Stack key={answer.questionId} gap={1}>
                  <Text type="supporting" color="secondary">
                    {answer.prompt || answer.questionId}
                  </Text>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Text weight="medium">{answer.value || "—"}</Text>
                    {answer.knockedOut ? <Badge label="Knockout" variant="error" /> : null}
                  </HStack>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : null}

        <Stack gap={2}>
          <Text type="label">Skills</Text>
          <HStack gap={2} wrap="wrap">
            {applicant.skills.map((skill) => (
              <Token key={skill} label={skill} size="sm" />
            ))}
          </HStack>
        </Stack>

        <Stack gap={2}>
          <Tokenizer
            label="Pools / tags"
            description="Employer-side pools for this candidate."
            searchSource={tagSource}
            value={tags}
            onChange={(next) => onChange({ ...applicant, tags: next.map((item) => item.label) })}
            hasCreate
            hasEntriesOnFocus
            placeholder="Add a tag"
          />
        </Stack>

        <Banner
          status="info"
          title="Contact details stay hidden"
          description="Email and phone unlock once an interview is scheduled here."
        />

        <SchedulePanel
          hiringProfile={hiringProfile}
          teamMembers={teamMembers}
          interviewerIds={draft.interviewerIds}
          onInterviewersChange={(interviewerIds) => {
            setDraft((current) => ({ ...current, interviewerIds }));
            onChange({ ...applicant, interviewerIds });
          }}
          draft={draft}
          onDraftChange={setDraft}
        />

        <Stack gap={3}>
          <Heading level={3}>Interview guide</Heading>
          <InterviewGuideView guide={interviewGuide} />
        </Stack>

        <ScorecardSubmitShell
          key={applicant.id}
          template={scorecardTemplate}
          applicantId={applicant.id}
          existing={applicantScorecards}
          onSubmit={onScorecard}
        />

        <OfferPanel
          applicant={applicant}
          templates={offerTemplates}
          teamMembers={teamMembers}
          onApply={onOffer}
        />

        <Stack gap={4}>
          <Heading level={3}>Team review</Heading>
          <FeedbackGateBanner result={gateError} />
          <Rating
            value={applicant.rating ?? 0}
            onChange={(rating) => onChange({ ...applicant, rating })}
            label="Your score"
          />
          <Selector
            label="Stage"
            options={stageOptions}
            value={applicant.columnId}
            onChange={(value) => tryMove(value)}
          />
          <TextArea
            label="Notes for the team"
            value={notes[applicant.id] ?? applicant.notes ?? ""}
            onChange={(value) => setNotes((current) => ({ ...current, [applicant.id]: value }))}
            rows={NOTE_ROWS}
            placeholder="Strengths, concerns, what to probe in the interview…"
          />
        </Stack>
      </Stack>
    </Drawer>
  );
}
