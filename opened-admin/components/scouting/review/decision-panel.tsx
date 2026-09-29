"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  SectionCard,
  Selector,
  Stack,
  Text,
  TextArea,
  useToast,
} from "@openseat/design-system";
import {
  ApiError,
  type AdminSubmissionDetail,
  type ReviewInput,
  type Submission,
  type SubmissionInput,
} from "@openseat/scout";
import { adminSend } from "@/lib/api";
import { ROUTES } from "@/lib/nav";

/** Approve, reject, or mark duplicate; record outcomes once the job is live. */
export function DecisionPanel({
  detail,
  edits,
}: {
  detail: AdminSubmissionDetail;
  edits: SubmissionInput | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const sub = detail.submission;
  const [reason, setReason] = useState(detail.rejection_reasons[0]?.code ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const base = `/v1/admin/scout/submissions/${sub.id}`;
  const fromQueue = sub.status === "needs_review";

  const run = async (path: string, body: unknown, done: string, advance = false) => {
    setError("");
    try {
      await adminSend<Submission>(path, "POST", body);
      toast({ body: done });
      if (advance && detail.queue.next_id) router.push(ROUTES.submission(detail.queue.next_id));
      else router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the decision.");
    }
  };
  const review = (input: ReviewInput, done: string) =>
    run(`${base}/review`, input, done, fromQueue);

  const decidable =
    sub.status === "needs_review" || sub.status === "rejected" || sub.status === "duplicate";
  const live = sub.status === "approved" && !sub.expired;

  return (
    <SectionCard title="Decision">
      <Stack gap={4}>
        {error ? <Banner status="error" title={error} /> : null}
        {decidable ? (
          <Button
            label={edits ? "Save edits and publish" : "Approve and publish"}
            variant="primary"
            clickAction={() =>
              review(
                { decision: "approve", note, edits: edits ?? undefined },
                "Approved and published.",
              )
            }
          />
        ) : null}
        {sub.status === "needs_review" || live ? (
          <Stack gap={3}>
            <Selector
              label={live ? "Revoke because" : "Reject because"}
              options={detail.rejection_reasons.map((item) => ({
                value: item.code,
                label: item.label,
              }))}
              value={reason}
              onChange={setReason}
            />
            <TextArea label="Note to the scout" value={note} onChange={setNote} isOptional />
            <Button
              label={live ? "Revoke and claw back" : "Reject"}
              variant="destructive"
              clickAction={() =>
                review(
                  { decision: "reject", reason_code: reason, note },
                  live ? "Revoked." : "Rejected.",
                )
              }
            />
          </Stack>
        ) : null}
        {sub.status === "needs_review" ? (
          <Button
            label="Mark duplicate"
            variant="secondary"
            clickAction={() =>
              review(
                {
                  decision: "duplicate",
                  note,
                  duplicate_of: detail.related[0] ? `submission ${detail.related[0].id}` : "",
                },
                "Marked duplicate.",
              )
            }
          />
        ) : null}
        {live ? (
          <Stack gap={2}>
            <Text type="supporting" color="secondary" display="block">
              Outcomes pay the scout: interviews release now, hires hold.
            </Text>
            <Button
              label="Record settled interview"
              variant="secondary"
              clickAction={() =>
                run(`${base}/outcomes`, { type: "interview" }, "Interview recorded.")
              }
            />
            <Button
              label="Confirm hire"
              variant="secondary"
              clickAction={() => run(`${base}/outcomes`, { type: "hire" }, "Hire recorded.")}
            />
            <Button
              label="Mark expired"
              variant="ghost"
              clickAction={() => run(`${base}/expire`, { note }, "Job expired.")}
            />
          </Stack>
        ) : null}
        {decidable ? (
          <Button
            label="Run checks again"
            variant="ghost"
            clickAction={() => run(`${base}/recheck`, {}, "Checks queued.")}
          />
        ) : null}
      </Stack>
    </SectionCard>
  );
}
