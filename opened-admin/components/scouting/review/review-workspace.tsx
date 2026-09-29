"use client";

import {
  Badge,
  Banner,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  PageHeader,
  Stack,
  Sticky,
} from "@openseat/design-system";
import { DEFAULT_CURRENCY } from "@openseat/job-schema";
import {
  CHANNEL_LABEL,
  SUBMISSION_STATUS,
  ApiError,
  type AdminSubmissionDetail,
  type Submission,
  type SubmissionInput,
} from "@openseat/scout";
import { useState, type ReactNode } from "react";

import { ReviewCompanyCard } from "./company-card";
import { ListingPreview } from "./listing-preview";
import { DecisionPanel } from "./decision-panel";
import { JobEditor } from "./job-editor";

import { adminSend } from "@/lib/api";
import { ROUTES } from "@/lib/nav";
import { SEARCH_JOBS_PATH, type SearchRecord } from "@/lib/search-job";
import { useAdminQuery } from "@/lib/use-admin-query";

/** The editable job fields, seeded from what the scout sent. */
export function inputFrom(sub: Submission): SubmissionInput {
  return {
    url: sub.url,
    company_name: sub.company_name,
    company_id: sub.company_id ?? "",
    title: sub.title,
    location_text: sub.location_text,
    workplace: sub.workplace,
    employment: sub.employment,
    seniority: sub.seniority,
    pay: sub.pay ?? { min: 0, max: 0, currency: DEFAULT_CURRENCY, period: "year" },
    equity: sub.equity,
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
  openedOrigin,
  checks,
  related,
  scout,
  history,
}: {
  detail: AdminSubmissionDetail;
  jobHref: string;
  openedOrigin?: string;
  checks: ReactNode;
  related: ReactNode;
  scout: ReactNode;
  history: ReactNode;
}) {
  const sub = detail.submission;
  const original = inputFrom(sub);
  const [draft, setDraft] = useState<SubmissionInput>(original);
  const [analyzed, setAnalyzed] = useState<SearchRecord | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const savedJob = useAdminQuery<SearchRecord>(
    sub.job_id ? `${SEARCH_JOBS_PATH}/${encodeURIComponent(sub.job_id)}` : "",
  );
  const listing = analyzed ?? (sub.job_id ? savedJob.result : null);
  const liveHref =
    jobHref ||
    (openedOrigin && listing?.job.id && !sub.expired ? `${openedOrigin}/jobs/${listing.job.id}` : "");
  const editable =
    sub.status === "needs_review" || sub.status === "rejected" || sub.status === "duplicate";
  const status = SUBMISSION_STATUS[sub.status];

  async function analyze() {
    setAnalyzeError("");
    setAnalyzing(true);
    try {
      const body = await adminSend<{ submission: Submission; record: SearchRecord }>(
        `/v1/admin/scout/submissions/${sub.id}/analyze`,
        "POST",
        { edits: dirty(draft, original) ? draft : undefined },
      );
      setAnalyzed(body.record);
      setDraft(inputFrom(body.submission));
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : "Could not analyze the job.");
    } finally {
      setAnalyzing(false);
    }
  }

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
            {liveHref ? (
              <Button
                label="View on Opened"
                variant="secondary"
                size="sm"
                href={liveHref}
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
            <ReviewCompanyCard companyId={draft.company_id} companyName={draft.company_name} />
            {analyzeError ? <Banner status="error" title={analyzeError} /> : null}
            <JobEditor
              submission={sub}
              value={draft}
              onChange={setDraft}
              isEditable={editable}
              isDirty={dirty(draft, original)}
              onReset={() => setDraft(original)}
              onAnalyze={analyze}
              analyzing={analyzing}
            />
            {listing?.job ? <ListingPreview job={listing.job} /> : null}
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
