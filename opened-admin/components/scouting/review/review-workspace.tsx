"use client";

import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  PageHeader,
  Stack,
  Sticky,
} from "@openseat/design-system";
import {
  CHANNEL_LABEL,
  SUBMISSION_STATUS,
  type AdminSubmissionDetail,
  type Submission,
  type SubmissionInput,
} from "@openseat/scout";
import { ROUTES } from "@/lib/nav";
import { DecisionPanel } from "./decision-panel";
import { JobEditor } from "./job-editor";

/** The editable job fields, seeded from what the scout sent. */
export function inputFrom(sub: Submission): SubmissionInput {
  return {
    url: sub.url,
    company_name: sub.company_name,
    title: sub.title,
    location_text: sub.location_text,
    workplace: sub.workplace,
    employment: sub.employment,
    seniority: sub.seniority,
    salary: sub.salary,
    summary: sub.summary,
    tags: sub.tags,
    skills: sub.skills,
    on_major_boards: sub.on_major_boards,
  };
}

function dirty(a: SubmissionInput, b: SubmissionInput) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/**
 * The review screen: job details a moderator can correct on the left, the
 * decision on the right. Server-rendered sections arrive as slots.
 */
export function ReviewWorkspace({
  detail,
  jobHref,
  checks,
  related,
  scout,
  history,
}: {
  detail: AdminSubmissionDetail;
  jobHref: string;
  checks: ReactNode;
  related: ReactNode;
  scout: ReactNode;
  history: ReactNode;
}) {
  const sub = detail.submission;
  const original = inputFrom(sub);
  const [draft, setDraft] = useState<SubmissionInput>(original);
  const editable =
    sub.status === "needs_review" || sub.status === "rejected" || sub.status === "duplicate";
  const status = SUBMISSION_STATUS[sub.status];

  return (
    <Stack gap={5}>
      <HStack gap={2} hAlign="between" wrap="wrap">
        <Button
          label="Review queue"
          variant="ghost"
          size="sm"
          icon={<Glyph name="chevronLeft" />}
          href={ROUTES.queue}
        />
        {detail.queue.next_id ? (
          <Button
            label="Next in queue"
            variant="secondary"
            size="sm"
            icon={<Glyph name="chevronRight" />}
            href={ROUTES.submission(detail.queue.next_id)}
          />
        ) : null}
      </HStack>
      <PageHeader
        title={sub.title}
        description={[sub.company_name, sub.location_text, sub.ats ?? sub.host]
          .filter(Boolean)
          .join(" · ")}
        action={
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Badge
              label={sub.expired ? "Expired" : status.label}
              variant={sub.expired ? "neutral" : status.badge}
            />
            <Badge label={CHANNEL_LABEL[sub.channel]} variant="neutral" />
            {sub.spot_check ? <Badge label="Spot check" variant="purple" /> : null}
            <Button
              label="Open posting"
              variant="secondary"
              size="sm"
              href={sub.url}
              target="_blank"
            />
            {jobHref ? (
              <Button
                label="View on Opened"
                variant="secondary"
                size="sm"
                href={jobHref}
                target="_blank"
              />
            ) : null}
          </HStack>
        }
      />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            {checks}
            <JobEditor
              submission={sub}
              value={draft}
              onChange={setDraft}
              isEditable={editable}
              isDirty={dirty(draft, original)}
              onReset={() => setDraft(original)}
            />
            {related}
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Sticky offset={4}>
            <Stack gap={6}>
              <DecisionPanel
                detail={detail}
                edits={editable && dirty(draft, original) ? draft : null}
              />
              {scout}
              {history}
            </Stack>
          </Sticky>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
