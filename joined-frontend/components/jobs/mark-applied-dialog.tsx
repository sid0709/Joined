"use client";

import { useState } from "react";
import { CheckboxInput, Stack, Text } from "sid-ui";
import { FormDialog } from "@/components/form-dialog";
import type { Job } from "@/lib/jobs";

export const REMEMBER_CHOICE_LABEL = "Remember my choice (don’t ask again)";

/**
 * Asks whether to mark a job as applied after its listing opens. Key this on the
 * job id so the checkbox starts unticked for each job.
 */
export function MarkAppliedDialog({
  job,
  pending,
  onConfirm,
  onOpenChange,
}: {
  job: Job | null;
  pending: boolean;
  onConfirm: (job: Job, remember: boolean) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [remember, setRemember] = useState(false);

  return (
    <FormDialog
      isOpen={job !== null}
      onOpenChange={onOpenChange}
      title="Mark this job as applied?"
      subtitle={job ? `${job.title} at ${job.company}` : undefined}
      submitLabel={pending ? "Marking…" : "Mark as applied"}
      cancelLabel="Not now"
      isSubmitDisabled={pending}
      onSubmit={() => {
        if (job) onConfirm(job, remember);
      }}
    >
      <Stack gap={4}>
        <Text color="secondary" display="block">
          We opened the listing in a new tab. Marking it adds it to My applications so your list
          stays up to date.
        </Text>
        <CheckboxInput label={REMEMBER_CHOICE_LABEL} value={remember} onChange={setRemember} />
      </Stack>
    </FormDialog>
  );
}
