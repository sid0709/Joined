"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  Stack,
  useToast,
} from "@openseat/design-system";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  JOB_REJECT_DISPOSITIONS,
  jobReviewBody,
  jobReviewPath,
  readReviewedJob,
  type AdminDirectJob,
  type JobReviewDecision,
} from "@/lib/trust";

/** Review one direct job. There is no get-by-id; the queue passes the row for display. */
export function DirectJobDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [reviewed, setReviewed] = useState<AdminDirectJob | null>(null);
  const [disposition, setDisposition] = useState("");
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const job = reviewed ?? jobFromQuery(id, searchParams);

  async function decide(decision: string, reason: string) {
    setPending(true);
    setDecisionError("");
    try {
      const body = jobReviewBody(
        decision as JobReviewDecision,
        reason,
        decision === "reject" ? disposition : undefined,
      );
      const updated = readReviewedJob(await adminSend<unknown>(jobReviewPath(id), "POST", body));
      if (updated) setReviewed(updated);
      const status = updated?.status;
      toast({
        body:
          decision === "approve"
            ? `Job approved${status ? ` (${status})` : ""}.`
            : `Job set to ${body.decision === "reject" ? body.rejectDisposition : "rejected"}.`,
      });
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
        title={job.title || "Direct job"}
        description="Approve publishes the job. Reject requires an explicit removed or draft disposition."
        action={<Button label="Back to queue" variant="ghost" href={ROUTES.directReview} />}
      />
      <SectionCard title="Listing">
        <Stack gap={4}>
          <HStack gap={2}>
            <Badge label={job.source || "direct"} variant="green" />
            <Badge label={job.status || "pending_review"} variant="warning" />
          </HStack>
          <MetadataList columns={2}>
            <MetadataListItem label="Company">
              {job.companyId ? (
                <Button
                  label={job.companyName || job.companyId}
                  variant="ghost"
                  href={ROUTES.companyCase(job.companyId)}
                />
              ) : (
                job.companyName || "—"
              )}
            </MetadataListItem>
            <MetadataListItem label="Location">{job.location || "—"}</MetadataListItem>
            <MetadataListItem label="Posted">{formatDateTime(job.postedAt)}</MetadataListItem>
            <MetadataListItem label="Created">{formatDateTime(job.createdAt)}</MetadataListItem>
            <MetadataListItem label="Job id">{job.id}</MetadataListItem>
          </MetadataList>
        </Stack>
      </SectionCard>
      <SectionCard
        title="Decision"
        description="A reason is required. Reject also needs an explicit removed or draft disposition."
      >
        <ReasonActions
          description="Approve leaves rejectDisposition off the body. Reject sends rejectDisposition."
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
    </Stack>
  );
}

function jobFromQuery(id: string, params: { get(name: string): string | null }): AdminDirectJob {
  return {
    id,
    title: params.get("title") ?? "",
    companyId: params.get("companyId") ?? "",
    companyName: params.get("companyName") ?? "",
    source: "direct",
    status: params.get("status") ?? "pending_review",
    postedAt: params.get("postedAt") ?? "",
    createdAt: params.get("createdAt") ?? "",
    location: params.get("location") ?? "",
  };
}
