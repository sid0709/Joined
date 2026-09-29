"use client";

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
  JOB_STATUS_META,
  POLICY_META,
  STRONG_FIT,
  type Applicant,
  type CompanyJob,
} from "@/lib/company";
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
