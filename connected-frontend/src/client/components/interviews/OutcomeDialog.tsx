"use client";

import { Rating } from "@joined/design-system";
import { useState } from "react";

import type { Interview, InterviewOutcome } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { Person } from "@/src/shared/kit/Person";
import { Button, Modal, Select, TextArea } from "@/src/shared/marketplace-ui";

const DEFAULT_SCORE = 4;

const OUTCOMES: { value: InterviewOutcome; label: string }[] = [
  { value: "advance", label: "Advance to the next stage" },
  { value: "hold", label: "Hold and decide later" },
  { value: "reject", label: "Decline this bidder" },
];

interface OutcomeDialogProps {
  interview: Interview | null;
  onClose: () => void;
}

/** Records how an interview went and moves the bidder along the hiring pipeline. */
export function OutcomeDialog({ interview, onClose }: OutcomeDialogProps) {
  const { inquiries, bidderById, recordInterview } = useHunter();
  const inquiry = interview ? inquiries.find((item) => item.id === interview.inquiryId) : undefined;
  const bidder = inquiry ? bidderById(inquiry.bidderId) : undefined;
  const [held, setHeld] = useState("completed");
  const [outcome, setOutcome] = useState<InterviewOutcome>("advance");
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [notes, setNotes] = useState(interview?.notes ?? "");

  const save = () => {
    if (!interview) return;
    recordInterview(
      interview.id,
      held === "completed"
        ? { status: "completed", outcome, score, notes: notes.trim() }
        : { status: "no_show", notes: notes.trim() },
    );
    onClose();
  };

  return (
    <Modal
      open={Boolean(interview)}
      onClose={onClose}
      title="Record interview outcome"
      footer={
        <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button variant="primary" label="Save outcome" onClick={save} />
        </div>
      }
    >
      <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
        {bidder && <Person name={bidder.name} detail={bidder.headline} size={40} />}
        <Select
          label="What happened?"
          value={held}
          onChange={(event) => setHeld(event.target.value)}
        >
          <option value="completed">The interview took place</option>
          <option value="no_show">The bidder did not show up</option>
        </Select>
        {held === "completed" && (
          <>
            <Rating
              value={score}
              onChange={setScore}
              label="Interview score"
              caption="How strong was this bidder?"
            />
            <Select
              label="Decision"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as InterviewOutcome)}
            >
              {OUTCOMES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </>
        )}
        <TextArea
          label="Notes"
          placeholder="What did you learn? Rate, hours, references, concerns"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
    </Modal>
  );
}
