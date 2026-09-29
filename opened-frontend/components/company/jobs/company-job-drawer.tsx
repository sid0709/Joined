"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Drawer,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "@openseat/design-system";
import {
  DEFAULT_FEEDBACK_GATE,
  JOB_STATUS_META,
  POLICY_META,
  STRONG_FIT,
  newInterviewGuide,
  newScorecardTemplate,
  type Applicant,
  type CompanyJob,
  type FeedbackGateConfig,
  type InterviewGuide,
  type PipelineStageDef,
  type ScorecardTemplate,
  type OfferTemplate,
} from "@/lib/company";
import { CustomStagesEditor } from "@/components/company/pipeline/custom-stages-editor";
import { FeedbackGateEditor } from "@/components/company/pipeline/feedback-gate";
import { InterviewGuideShell } from "@/components/company/pipeline/interview-guide-shell";
import { ScorecardTemplateEditor } from "@/components/company/pipeline/scorecard-shell";
import { OfferTemplateEditor } from "@/components/company/offer/offer-template-editor";
import { formatShortDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { PipelineBar } from "../pipeline-bar";
import type { JobAction } from "./company-job-table";
import { CandidateViewButton } from "@/components/company/candidate-view-button";

const TOP_CANDIDATES = 3;
const PERSON_SIZE = 32;

/** One job: funnel, settings, and its strongest candidates. */
export function CompanyJobDrawer({
  job,
  applicants,
  onClose,
  onAction,
}: {
  job: CompanyJob | null;
  applicants: Applicant[];
  onClose: () => void;
  onAction: (job: CompanyJob, action: JobAction) => void;
}) {
  const [customStages, setCustomStages] = useState<PipelineStageDef[]>([]);
  const [feedbackGate, setFeedbackGate] = useState<FeedbackGateConfig>(DEFAULT_FEEDBACK_GATE);
  const [scorecardTemplate, setScorecardTemplate] =
    useState<ScorecardTemplate>(newScorecardTemplate());
  const [interviewGuide, setInterviewGuide] = useState<InterviewGuide>(newInterviewGuide());
  const [offerTemplates, setOfferTemplates] = useState<OfferTemplate[]>([]);

  useEffect(() => {
    if (!job) return;
    setCustomStages(job.customStages ?? []);
    setFeedbackGate(job.feedbackGate ?? DEFAULT_FEEDBACK_GATE);
    setScorecardTemplate(job.scorecardTemplate ?? newScorecardTemplate());
    setInterviewGuide(job.interviewGuide ?? newInterviewGuide());
    setOfferTemplates(job.offerTemplates ?? []);
  }, [job]);

  if (!job) return null;
  const status = JOB_STATUS_META[job.status];
  const top = applicants
    .filter((person) => person.jobId === job.id && person.columnId !== "rejected")
    .sort((a, b) => b.fit - a.fit)
    .slice(0, TOP_CANDIDATES);

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={job.title}
      subtitle={`${job.team} · ${job.location}`}
      footer={
        <HStack gap={2} hAlign="between" wrap="wrap">
          {job.status === "open" ? (
            <Button label="Pause job" variant="ghost" onClick={() => onAction(job, "pause")} />
          ) : job.status === "paused" ? (
            <Button label="Resume job" variant="ghost" onClick={() => onAction(job, "resume")} />
          ) : (
            <span />
          )}
          <HStack gap={2}>
            {job.status !== "closed" ? (
              <Button label="Edit" variant="secondary" href={ROUTES.companyJobEdit(job.id)} />
            ) : null}
            {job.jobId ? (
              <CandidateViewButton label="View posting" href={ROUTES.job(job.jobId)} />
            ) : null}
            <Button label="Review applicants" variant="primary" href={ROUTES.companyApplicants} />
          </HStack>
        </HStack>
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          <Badge label={status.label} variant={status.badge} />
          <Badge label={POLICY_META[job.policy].label} variant="neutral" />
        </HStack>

        <Stack gap={3}>
          <Heading level={3}>Pipeline</Heading>
          <PipelineBar pipeline={job.pipeline} />
        </Stack>

        <MetadataList columns={2}>
          <MetadataListItem label="Posted">{formatShortDate(job.postedOn)}</MetadataListItem>
          <MetadataListItem label="Views">{job.views.toLocaleString()}</MetadataListItem>
          <MetadataListItem label="Workplace">{job.workplace}</MetadataListItem>
          <MetadataListItem label="Assisted applications">
            {job.policy === "cap" && job.dailyCap
              ? `Up to ${job.dailyCap} a day`
              : POLICY_META[job.policy].description}
          </MetadataListItem>
          <MetadataListItem label="Screening questions">
            {(job.screeningQuestions ?? []).length || "None"}
          </MetadataListItem>
        </MetadataList>

        <Divider />

        <Stack gap={3}>
          <Heading level={3}>Custom stages</Heading>
          <CustomStagesEditor value={customStages} onChange={setCustomStages} />
        </Stack>

        <Stack gap={3}>
          <Heading level={3}>Feedback gate</Heading>
          <FeedbackGateEditor value={feedbackGate} onChange={setFeedbackGate} />
        </Stack>

        <Stack gap={3}>
          <Heading level={3}>Scorecard template</Heading>
          <ScorecardTemplateEditor value={scorecardTemplate} onChange={setScorecardTemplate} />
        </Stack>

        <Stack gap={3}>
          <Heading level={3}>Interview guide</Heading>
          <InterviewGuideShell value={interviewGuide} onChange={setInterviewGuide} />
        </Stack>
        <Stack gap={3}>
          <Heading level={3}>Offer templates</Heading>
          <OfferTemplateEditor value={offerTemplates} onChange={setOfferTemplates} />
        </Stack>
        <Text type="supporting" color="secondary">
          Pipeline eval and offer template settings stay local until Einstein lands PUT
          /v1/company/jobs/:id/pipeline (and offerTemplates on the job).
        </Text>

        <Divider />

        <Stack gap={3}>
          <Heading level={3}>Strongest candidates</Heading>
          {top.length === 0 ? (
            <Text color="secondary">No candidates yet.</Text>
          ) : (
            top.map((person) => (
              <HStack key={person.id} hAlign="between" vAlign="center" gap={3}>
                <HStack gap={3} vAlign="center">
                  <Avatar name={person.name} size={PERSON_SIZE} tooltip={false} />
                  <Stack gap={0}>
                    <Text weight="medium">{person.name}</Text>
                    <Text type="supporting" color="secondary">
                      {person.headline}
                    </Text>
                  </Stack>
                </HStack>
                <Badge
                  label={`${person.fit}% fit`}
                  variant={person.fit >= STRONG_FIT ? "success" : "neutral"}
                />
              </HStack>
            ))
          )}
        </Stack>
      </Stack>
    </Drawer>
  );
}
