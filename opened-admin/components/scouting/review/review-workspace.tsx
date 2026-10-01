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
} from "@joined/design-system";
import { DEFAULT_CURRENCY } from "@joined/job-schema";
import {
  CHANNEL_LABEL,
  SUBMISSION_STATUS,
  ApiError,
  type AdminSubmissionDetail,
  type Submission,
  type SubmissionInput,
} from "@joined/scout";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ReviewCompanyCard } from "./company-card";
import { DecisionPanel } from "./decision-panel";
import { JobEditor } from "./job-editor";
import { ListingPreview } from "./listing-preview";
import { MatchesReview } from "./matches-review";

import { adminSend } from "@/lib/api";
import { ROUTES } from "@/lib/nav";
import { SEARCH_JOBS_PATH, type SearchRecord } from "@/lib/search-job";
import { useAdminQuery } from "@/lib/use-admin-query";

type DuplicateHit = { job_id: string; title: string; company: string; reason: string };
type TitleCandidate = { job_id: string; title: string; company: string };
type AnalyzeResponse = {
  submission: Submission;
  record?: SearchRecord;
  duplicate?: DuplicateHit;
  top_k?: TitleCandidate[];
};

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
  const router = useRouter();
  const sub = detail.submission;
  const original = inputFrom(sub);
  const [draft, setDraft] = useState<SubmissionInput>(original);
  const [analyzed, setAnalyzed] = useState<SearchRecord | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateHit | null>(null);
  const [topK, setTopK] = useState<TitleCandidate[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const savedJob = useAdminQuery<SearchRecord>(
    sub.job_id ? `${SEARCH_JOBS_PATH}/${encodeURIComponent(sub.job_id)}` : "",
  );
  const listing = analyzed ?? (sub.job_id ? savedJob.result : null);
  const liveHref =
    jobHref ||
    (openedOrigin && listing?.job.id && !sub.expired
      ? `${openedOrigin}/jobs/${listing.job.id}`
      : "");
  const editable =
    sub.status === "needs_review" || sub.status === "rejected" || sub.status === "duplicate";
  const status = SUBMISSION_STATUS[sub.status];

  async function analyze(continueExtract = false) {
    setAnalyzeError("");
    setAnalyzing(true);
    try {
      const body = await adminSend<AnalyzeResponse>(
        `/v1/admin/scout/submissions/${sub.id}/analyze`,
        "POST",
        { edits: dirty(draft, original) ? draft : undefined, continue_extract: continueExtract },
      );
      setDraft(inputFrom(body.submission));
      setTopK(body.top_k ?? []);
      if (body.duplicate) {
        setDuplicate(body.duplicate);
        setAnalyzed(null);
        return;
      }
      setDuplicate(null);
      if (body.record) setAnalyzed(body.record);
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
            <MatchesReview submission={sub} />
            <ReviewCompanyCard companyId={draft.company_id} companyName={draft.company_name} />
            {analyzeError ? <Banner status="error" title={analyzeError} /> : null}
            {duplicate ? (
              <Stack gap={3}>
                <Banner
                  status="warning"
                  title={`Likely duplicate of “${duplicate.title}” at ${duplicate.company}`}
                  description={duplicate.reason || "The model thinks this is the same opening."}
                />
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Reject as duplicate"
                    variant="destructive"
                    size="sm"
                    clickAction={async () => {
                      try {
                        await adminSend(`/v1/admin/scout/submissions/${sub.id}/review`, "POST", {
                          decision: "duplicate",
                          duplicate_of: `job ${duplicate.job_id}`,
                        });
                        router.refresh();
                      } catch (err) {
                        setAnalyzeError(
                          err instanceof ApiError ? err.message : "Could not mark this duplicate.",
                        );
                      }
                    }}
                  />
                  <Button
                    label="Continue extract"
                    variant="secondary"
                    size="sm"
                    clickAction={() => {
                      void analyze(true);
                    }}
                    isDisabled={analyzing}
                  />
                  {duplicate.job_id ? (
                    <Button
                      label="Open existing listing"
                      variant="ghost"
                      size="sm"
                      href={`${ROUTES.jobs}?job=${duplicate.job_id}`}
                    />
                  ) : null}
                </HStack>
              </Stack>
            ) : null}
            {topK.length > 0 && !duplicate ? (
              <Banner
                status="info"
                title="Title matches checked"
                description={topK.map((item) => item.title).join(" · ")}
              />
            ) : null}
            <JobEditor
              submission={sub}
              value={draft}
              onChange={setDraft}
              isEditable={editable}
              isDirty={dirty(draft, original)}
              onReset={() => setDraft(original)}
              onAnalyze={() => {
                void analyze(false);
              }}
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
                hasSkills={Boolean(listing?.job.skills.length)}
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
