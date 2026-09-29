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
  useToast,
} from "@openseat/design-system";
import {
  APPLICANT_STAGES,
  DEFAULT_FEEDBACK_GATE,
  JOB_STATUS_META,
  POLICY_META,
  STRONG_FIT,
  mergeStageOptions,
  newInterviewGuide,
  newScorecardTemplate,
  type Applicant,
  type CompanyJob,
  type FeedbackGateConfig,
  type InterviewGuide,
  type JobPipelineConfig,
  type PipelineStageDef,
  type ScorecardTemplate,
  type OfferTemplate,
  defaultOfferTemplates,
} from "@/lib/company";
import { fetchJobPipeline, saveJobOfferTemplates, saveJobPipeline } from "@/lib/company/api";
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
  onPipelineSaved,
  canEdit = true,
  canPublish = true,
}: {
  job: CompanyJob | null;
  applicants: Applicant[];
  onClose: () => void;
  onAction: (job: CompanyJob, action: JobAction) => void;
  onPipelineSaved?: (
    jobId: string,
    pipeline: JobPipelineConfig,
    offerTemplates?: OfferTemplate[],
  ) => void;
  /** Soft gate — jobs.edit (edit draft fields). */
  canEdit?: boolean;
  /** Soft gate — jobs.publish (pause / resume / reopen / close). */
  canPublish?: boolean;
}) {
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
      subtitle={`${job.department || job.team} · ${job.location}`}
      footer={
        <HStack gap={2} hAlign="between" wrap="wrap">
          {job.status === "open" && canPublish ? (
            <Button label="Pause job" variant="ghost" onClick={() => onAction(job, "pause")} />
          ) : job.status === "paused" && canPublish ? (
            <Button label="Resume job" variant="ghost" onClick={() => onAction(job, "resume")} />
          ) : job.status === "closed" && canPublish ? (
            <Button label="Reopen job" variant="ghost" onClick={() => onAction(job, "reopen")} />
          ) : (
            <span />
          )}
          <HStack gap={2}>
            {job.status !== "closed" && canEdit ? (
              <Button label="Edit" variant="secondary" href={ROUTES.companyJobEdit(job.id)} />
            ) : null}
            {job.status !== "closed" && job.status !== "draft" && canPublish ? (
              <Button
                label="Close & archive"
                variant="secondary"
                onClick={() => onAction(job, "close")}
              />
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
          {job.status === "closed" ? (
            <MetadataListItem label="Closed">
              {job.closeReason || (job.closedAt ? "Archived from search" : "Archived")}
              {job.notifyOnClose != null
                ? job.notifyOnClose
                  ? " · Applicants notified"
                  : " · Applicants not notified"
                : ""}
            </MetadataListItem>
          ) : null}
        </MetadataList>

        <Divider />

        <JobPipelinePanel key={job.id} job={job} onPipelineSaved={onPipelineSaved} />

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

/** Remounts per job via key so editor state seeds from props without sync effects. */
function JobPipelinePanel({
  job,
  onPipelineSaved,
}: {
  job: CompanyJob;
  onPipelineSaved?: (
    jobId: string,
    pipeline: JobPipelineConfig,
    offerTemplates?: OfferTemplate[],
  ) => void;
}) {
  const toast = useToast();
  const [customStages, setCustomStages] = useState<PipelineStageDef[]>(
    () => job.customStages ?? [],
  );
  const [feedbackGate, setFeedbackGate] = useState<FeedbackGateConfig>(
    () => job.feedbackGate ?? DEFAULT_FEEDBACK_GATE,
  );
  const [scorecardTemplate, setScorecardTemplate] = useState<ScorecardTemplate>(
    () => job.scorecardTemplate ?? newScorecardTemplate(),
  );
  const [interviewGuide, setInterviewGuide] = useState<InterviewGuide>(
    () => job.interviewGuide ?? newInterviewGuide(),
  );
  const [offerTemplates, setOfferTemplates] = useState<OfferTemplate[]>(() =>
    job.offerTemplates && job.offerTemplates.length > 0
      ? job.offerTemplates
      : defaultOfferTemplates(),
  );
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineSaving, setPipelineSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchJobPipeline(job.id)
      .then((pipeline) => {
        if (!active) return;
        setCustomStages(pipeline.stages);
        setFeedbackGate(pipeline.feedbackGate);
        setScorecardTemplate(pipeline.scorecardTemplate ?? newScorecardTemplate());
        setInterviewGuide(pipeline.interviewGuide ?? newInterviewGuide());
      })
      .catch(() => {
        /* Job list hydrate is enough when pipeline GET fails. */
      })
      .finally(() => {
        if (active) setPipelineLoading(false);
      });
    return () => {
      active = false;
    };
  }, [job.id]);

  const savePipeline = () => {
    setPipelineSaving(true);
    const pipelinePromise = saveJobPipeline(job.id, {
      stages: customStages,
      feedbackGate,
      scorecardTemplate,
      interviewGuide,
    });
    const templatesPromise =
      job.status === "closed" ? Promise.resolve(null) : saveJobOfferTemplates(job, offerTemplates);
    Promise.all([pipelinePromise, templatesPromise])
      .then(([pipeline, savedJob]) => {
        setCustomStages(pipeline.stages);
        setFeedbackGate(pipeline.feedbackGate);
        setScorecardTemplate(pipeline.scorecardTemplate ?? newScorecardTemplate());
        setInterviewGuide(pipeline.interviewGuide ?? newInterviewGuide());
        const savedTemplates = savedJob?.offerTemplates ?? offerTemplates;
        setOfferTemplates(
          savedTemplates && savedTemplates.length > 0 ? savedTemplates : defaultOfferTemplates(),
        );
        onPipelineSaved?.(job.id, pipeline, savedTemplates);
        toast({
          body:
            job.status === "closed"
              ? "Pipeline settings saved. Offer templates are read-only on closed jobs."
              : "Pipeline and offer templates saved.",
        });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }))
      .finally(() => setPipelineSaving(false));
  };

  return (
    <Stack gap={6}>
      <Stack gap={3}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={3}>Pipeline & evaluation</Heading>
          <Button
            label={pipelineSaving ? "Saving…" : "Save pipeline"}
            variant="secondary"
            size="sm"
            isDisabled={pipelineLoading || pipelineSaving}
            onClick={savePipeline}
          />
        </HStack>
        {pipelineLoading ? (
          <Text type="supporting" color="secondary">
            Loading pipeline settings…
          </Text>
        ) : null}
      </Stack>

      <Stack gap={3}>
        <Heading level={3}>Custom stages</Heading>
        <CustomStagesEditor value={customStages} onChange={setCustomStages} />
      </Stack>

      <Stack gap={3}>
        <Heading level={3}>Feedback gate</Heading>
        <FeedbackGateEditor
          value={feedbackGate}
          onChange={setFeedbackGate}
          stages={mergeStageOptions(APPLICANT_STAGES, customStages)}
        />
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
        Save persists pipeline via PUT /v1/company/jobs/:id/pipeline and offerTemplates via PUT
        /v1/company/jobs/:id. Closed jobs keep templates read-only.
      </Text>
    </Stack>
  );
}
