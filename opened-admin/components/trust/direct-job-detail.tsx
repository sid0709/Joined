"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  CodeBlock,
  Collapsible,
  EmptyState,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  Skeleton,
  Stack,
  useToast,
} from "@openseat/design-system";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  JOB_REJECT_DISPOSITIONS,
  directJobPath,
  jobReviewBody,
  jobReviewPath,
  readDirectJobDetail,
  trustLoadError,
  type JobReviewDecision,
} from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

const RAW_MAX_HEIGHT = 320;

/** Review one direct job: approve to active, or reject to removed or draft. */
export function DirectJobDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { result, loading, error, errorStatus, reload } = useAdminQuery<unknown>(directJobPath(id));
  const job = result ? readDirectJobDetail(result) : null;
  const [disposition, setDisposition] = useState("");
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const message =
    result && !job ? "The API responded, but not with a job." : trustLoadError(errorStatus, error);

  async function decide(decision: string, reason: string) {
    setPending(true);
    setDecisionError("");
    try {
      const body = jobReviewBody(
        decision as JobReviewDecision,
        reason,
        decision === "reject" ? disposition : undefined,
      );
      await adminSend(jobReviewPath(id), "POST", body);
      toast({
        body: decision === "approve" ? "Job set to active." : `Job set to ${body.disposition}.`,
      });
      reload();
      router.refresh();
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : "Could not save the decision.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap={5}>
      <PageHeader
        title={job?.title ?? "Direct job"}
        description="Approve publishes the job as active. Reject requires an explicit removed or draft disposition."
        action={<Button label="Back to queue" variant="ghost" href={ROUTES.directReview} />}
      />
      {loading && !result ? <Skeleton width="100%" height={160} /> : null}
      {!loading && !job ? (
        <EmptyState isCompact title="Job unavailable" description={message || "Could not load."} />
      ) : null}
      {job ? (
        <Stack gap={5}>
          <SectionCard title="Listing">
            <Stack gap={4}>
              <HStack gap={2}>
                <Badge label={job.source || "direct"} variant="green" />
                <Badge label={job.status || "unknown"} variant="warning" />
              </HStack>
              <MetadataList columns={2}>
                <MetadataListItem label="Company">
                  {job.companyId ? (
                    <Button
                      label={job.companyName || job.companyId}
                      variant="ghost"
                      href={`${ROUTES.companies}?company=${encodeURIComponent(job.companyId)}`}
                    />
                  ) : (
                    job.companyName || "—"
                  )}
                </MetadataListItem>
                <MetadataListItem label="Posted">{formatDateTime(job.postedAt)}</MetadataListItem>
                <MetadataListItem label="Apply link">{job.applyUrl || "—"}</MetadataListItem>
                <MetadataListItem label="Job id">{job.id}</MetadataListItem>
              </MetadataList>
            </Stack>
          </SectionCard>
          <SectionCard
            title="Decision"
            description="A reason is required before approve or reject."
          >
            <ReasonActions
              description="Approve sets disposition active. Reject stays disabled until you choose removed or draft."
              actions={[
                { id: "approve", label: "Approve", variant: "primary" },
                { id: "reject", label: "Reject", variant: "destructive", needsDisposition: true },
              ]}
              dispositions={[...JOB_REJECT_DISPOSITIONS]}
              disposition={disposition}
              onDisposition={setDisposition}
              pending={pending}
              error={decisionError}
              onSubmit={(actionId, reason) => void decide(actionId, reason)}
            />
          </SectionCard>
          <Collapsible trigger="Raw job">
            <CodeBlock
              code={JSON.stringify(result, null, 2)}
              language="json"
              maxHeight={RAW_MAX_HEIGHT}
            />
          </Collapsible>
        </Stack>
      ) : null}
    </Stack>
  );
}
