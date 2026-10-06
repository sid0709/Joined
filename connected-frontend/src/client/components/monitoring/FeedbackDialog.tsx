"use client";

import { useState } from "react";
import { Rating } from "sid-ui";

import { useHunter } from "@/src/client/context/HunterContext";
import { Person } from "@/src/shared/kit/Person";
import { Button, Modal, TextArea } from "@/src/shared/marketplace-ui";

const DEFAULT_RATING = 5;
const FEEDBACK_TAGS = [
  "Accurate",
  "Fast",
  "Communicative",
  "On schedule",
  "Quality writing",
  "Check links",
  "Resume version",
  "Missing screenshots",
];

interface FeedbackDialogProps {
  bidderId: string | null;
  assignmentId?: string;
  onClose: () => void;
}

/** Tells a bidder how their work is going. Bidders read this on their collaboration page. */
export function FeedbackDialog({ bidderId, assignmentId, onClose }: FeedbackDialogProps) {
  const { bidderById, sendFeedback } = useHunter();
  const bidder = bidderId ? bidderById(bidderId) : undefined;
  const [rating, setRating] = useState(DEFAULT_RATING);
  const [tags, setTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const close = () => {
    setRating(DEFAULT_RATING);
    setTags([]);
    setMessage("");
    onClose();
  };

  const send = () => {
    if (!bidder || !message.trim()) return;
    sendFeedback({ bidderId: bidder.id, assignmentId, rating, message: message.trim(), tags });
    close();
  };

  return (
    <Modal
      open={Boolean(bidder)}
      onClose={close}
      title="Send feedback to bidder"
      footer={
        <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
          <Button variant="ghost" label="Cancel" onClick={close} />
          <Button
            variant="primary"
            label="Send feedback"
            disabled={!message.trim()}
            onClick={send}
          />
        </div>
      }
    >
      {bidder && (
        <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
          <Person name={bidder.name} detail={bidder.headline} size={40} />
          <Rating
            value={rating}
            onChange={setRating}
            label="Work quality"
            caption="How was the quality of their recent work?"
          />
          <div className="hx-chip-row">
            {FEEDBACK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="hx-chip"
                aria-pressed={tags.includes(tag)}
                style={
                  tags.includes(tag)
                    ? {
                        background: "var(--color-accent-muted)",
                        color: "var(--color-text-accent)",
                        borderColor: "var(--color-border-blue)",
                      }
                    : undefined
                }
                onClick={() =>
                  setTags((current) =>
                    current.includes(tag)
                      ? current.filter((item) => item !== tag)
                      : [...current, tag],
                  )
                }
              >
                {tag}
              </button>
            ))}
          </div>
          <TextArea
            label="Message"
            placeholder="What went well, and what should change on the next batch?"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
