"use client";

import { useState } from "react";
import { RadioList, RadioListItem, Stack, TextArea, useToast } from "sid-ui";
import { FormDialog } from "@/components/form-dialog";
import type { Job } from "@/lib/jobs";
import {
  JOB_REPORT_REASONS,
  fileJobReport,
  isIdempotencyReuse,
  isJobReportReason,
  newReportIdempotencyKey,
  type JobReportReason,
} from "@/lib/reports";

const DETAILS_ROWS = 4;

/** Files one job report. Key this on the job id so a new job starts blank. */
export function JobReportDialog({
  job,
  onOpenChange,
}: {
  job: Job | null;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<JobReportReason | "">("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!job || !isJobReportReason(reason)) {
      toast({ body: "Choose a reason for this report.", type: "error" });
      return;
    }
    setPending(true);
    try {
      await fileJobReport({
        jobId: job.id,
        reasonCode: reason,
        details,
        idempotencyKey: newReportIdempotencyKey(),
      });
      toast({ body: `Report filed for ${job.title}.` });
      onOpenChange(false);
    } catch (error) {
      if (isIdempotencyReuse(error)) {
        toast({ body: "This report was already filed." });
        onOpenChange(false);
        return;
      }
      toast({
        body: error instanceof Error ? error.message : "Could not file the report.",
        type: "error",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      isOpen={job !== null}
      onOpenChange={onOpenChange}
      title="Report this job"
      subtitle="Tell us what looks wrong. A job that is simply not a fit is not a report."
      submitLabel={pending ? "Filing…" : "File report"}
      isSubmitDisabled={pending || reason === ""}
      onSubmit={() => void submit()}
    >
      <Stack gap={4}>
        <RadioList
          label="Reason"
          value={reason}
          onChange={(value) => {
            if (isJobReportReason(value)) setReason(value);
          }}
        >
          {JOB_REPORT_REASONS.map((item) => (
            <RadioListItem key={item.value} value={item.value} label={item.label} />
          ))}
        </RadioList>
        <TextArea
          label="Details"
          value={details}
          onChange={setDetails}
          rows={DETAILS_ROWS}
          placeholder="What should we look at?"
        />
      </Stack>
    </FormDialog>
  );
}
