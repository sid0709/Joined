"use client";

import { useState } from "react";

import type { BidderApplication } from "@/src/candidate/types/workspace";

import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { NumberField } from "@/src/shared/kit/Fields";
import { Banner, Button, Checkbox, Input, Modal, TextArea } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { POOL_BY_ID } from "@/src/shared/mock/pool";

const CHECKLIST = [
  "I used the resume version assigned for this task",
  "I saved a screenshot of the employer's confirmation page",
  "My answers match the approved answer bank",
  "I did not guess any eligibility or legal question",
];

export function SubmitDialog({
  application,
  onClose,
}: {
  application: BidderApplication | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={application !== null}
      onClose={onClose}
      title={application?.status === "returned" ? "Fix and resubmit" : "Submit application"}
    >
      {application && (
        <SubmitForm key={application.id} application={application} onClose={onClose} />
      )}
    </Modal>
  );
}

function SubmitForm({
  application,
  onClose,
}: {
  application: BidderApplication;
  onClose: () => void;
}) {
  const { submitApplication } = useBidderWorkspace();
  const job = POOL_BY_ID.get(application.jobId);
  const tier = PACKAGE_BY_ID.get(application.packageId);
  const [confirmation, setConfirmation] = useState(application.confirmation ?? "");
  const [minutes, setMinutes] = useState(
    String(application.minutesSpent ?? tier?.minutesPerLink ?? 8),
  );
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [error, setError] = useState<string | null>(null);
  const ready = checked.every(Boolean);

  const submit = () => {
    const result = submitApplication(application.id, {
      confirmation,
      minutesSpent: Number(minutes),
      evidenceNote: note,
    });
    if (!result.ok) return setError(result.error ?? "Could not submit.");
    onClose();
  };

  return (
    <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
      <div className="bx-callout">
        <strong>{job?.company}</strong>
        <span className="hx-small hx-muted">
          {job?.title} · {job?.ats} · {job?.location}
        </span>
      </div>
      {application.issue && application.status === "returned" && (
        <Banner
          tone="warning"
          title="Fix this before resubmitting"
          description={application.issue}
        />
      )}
      <Input
        label="Confirmation number or page title"
        placeholder="For example CNF-ST-1204 or “Thanks for applying”"
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value);
          setError(null);
        }}
      />
      <div className="hx-field-grid">
        <NumberField label="Minutes spent" value={minutes} onChange={setMinutes} min={1} />
      </div>
      <TextArea
        label="Note for the hunter (optional)"
        placeholder="Anything they should know, like a skipped field or an unusual question"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
      />
      <div className="hx-stack hx-stack-sm">
        {CHECKLIST.map((item, index) => (
          <Checkbox
            key={item}
            label={item}
            checked={checked[index]}
            onChange={(event) =>
              setChecked((current) =>
                current.map((value, i) => (i === index ? event.target.checked : value)),
              )
            }
          />
        ))}
      </div>
      {error && <Banner tone="danger" title={error} />}
      <div className="hx-row hx-row-between">
        <Button variant="ghost" label="Cancel" onClick={onClose} />
        <Button
          variant="primary"
          label={application.status === "returned" ? "Resubmit for QA" : "Submit for QA"}
          disabled={!ready}
          onClick={submit}
        />
      </div>
    </div>
  );
}
