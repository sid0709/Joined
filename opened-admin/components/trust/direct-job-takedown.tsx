"use client";

import { useState } from "react";
import { Button, SectionCard, Stack, useToast } from "@openseat/design-system";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import { ROUTES } from "@/lib/nav";
import { jobReviewBody, jobReviewPath, jobTakedownBody, jobTakedownPath } from "@/lib/trust";

/** Take a direct job out of the pool. Restore is a review approve. */
export function DirectJobTakedown({ jobId }: { jobId: string }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(decision: string, reason: string) {
    setPending(true);
    setError("");
    try {
      if (decision === "restore") {
        await adminSend(jobReviewPath(jobId), "POST", jobReviewBody("approve", reason));
        toast({ body: "Job approved back into the pool." });
      } else {
        await adminSend(jobTakedownPath(jobId), "POST", jobTakedownBody(reason));
        toast({ body: "Job removed from the pool." });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the job.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      title="Trust take-down"
      description="Direct jobs only. Take-down requires a reason and sets the job to removed. Restore approves it again."
      action={<Button label="Open direct review" variant="ghost" href={ROUTES.directJob(jobId)} />}
    >
      <Stack gap={3}>
        <ReasonActions
          description="Take down posts the reason only. Restore posts a review approve."
          actions={[
            { id: "takedown", label: "Take down", variant: "destructive" },
            { id: "restore", label: "Restore", variant: "secondary" },
          ]}
          pending={pending}
          error={error}
          onSubmit={(actionId, reason) => void submit(actionId, reason)}
        />
      </Stack>
    </SectionCard>
  );
}
