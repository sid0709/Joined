"use client";

import { useState } from "react";
import { Button, SectionCard, Stack, useToast } from "@openseat/design-system";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import { ROUTES } from "@/lib/nav";
import { jobTakedownBody, jobTakedownPath, type JobTakedownDecision } from "@/lib/trust";

/** Reversible take-down for a direct job already in the jobs browser. */
export function DirectJobTakedown({ jobId }: { jobId: string }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(decision: string, reason: string) {
    setPending(true);
    setError("");
    try {
      const body = jobTakedownBody(decision as JobTakedownDecision, reason);
      await adminSend(jobTakedownPath(jobId), "POST", body);
      toast({
        body:
          body.decision === "takedown" ? "Job removed from the pool." : "Job restored to active.",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the job.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      title="Trust take-down"
      description="Direct jobs only. Take the listing out of the pool, or restore it. A reason is required."
      action={<Button label="Open direct review" variant="ghost" href={ROUTES.directJob(jobId)} />}
    >
      <Stack gap={3}>
        <ReasonActions
          description="Take down sets disposition removed. Restore sets disposition active."
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
