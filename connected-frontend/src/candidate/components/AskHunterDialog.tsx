"use client";

import { useState } from "react";

import type { BidderApplication } from "@/src/candidate/types/workspace";

import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { Button, Modal, TextArea } from "@/src/shared/marketplace-ui";
import { POOL_BY_ID } from "@/src/shared/mock/pool";

const SUGGESTIONS = [
  "The form asks for a work authorization detail that isn't in the guide. How should I answer?",
  "The link looks closed or redirects elsewhere. Should I skip it?",
  "Resume parsing changed my details. Which resume version should I keep?",
];

export function AskHunterDialog({
  application,
  onClose,
}: {
  application: BidderApplication | null;
  onClose: () => void;
}) {
  return (
    <Modal open={application !== null} onClose={onClose} title="Ask the job hunter">
      {application && <AskForm key={application.id} application={application} onClose={onClose} />}
    </Modal>
  );
}

function AskForm({
  application,
  onClose,
}: {
  application: BidderApplication;
  onClose: () => void;
}) {
  const { askHunter } = useBidderWorkspace();
  const job = POOL_BY_ID.get(application.jobId);
  const [question, setQuestion] = useState("");
  return (
    <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
      <div className="bx-callout">
        <strong>{job?.company}</strong>
        <span className="hx-small hx-muted">{job?.title}</span>
      </div>
      <TextArea
        label="Your question"
        placeholder="Be specific so the hunter can answer in one message"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={4}
      />
      <div className="hx-chip-row">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="hx-chip"
            onClick={() => setQuestion(suggestion)}
          >
            {suggestion.slice(0, 44)}…
          </button>
        ))}
      </div>
      <div className="hx-row hx-row-between">
        <Button variant="ghost" label="Cancel" onClick={onClose} />
        <Button
          variant="primary"
          label="Send to chat"
          disabled={!question.trim()}
          onClick={() => {
            askHunter(application.id, question);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
