import { Glyph } from "@openseat/design-system";
import Link from "next/link";

import type { Interview } from "@/src/client/types/hunter";

import { Person } from "@/src/client/components/ui/Person";
import { useHunter } from "@/src/client/context/HunterContext";
import { STAGE_TITLE } from "@/src/client/data/pipeline";
import { longDate } from "@/src/client/lib/format";
import { MODE_LABEL, displayClock, needsOutcome } from "@/src/client/lib/interviews";
import { Badge, Button } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface InterviewRowProps {
  interview: Interview;
  showDate?: boolean;
  onReschedule: (interview: Interview) => void;
  onOutcome: (interview: Interview) => void;
  onCancel: (interview: Interview) => void;
}

const STATUS_BADGE: Record<Interview["status"], { label: string; tone: string }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  no_show: { label: "No-show", tone: "error" },
};

export function InterviewRow({
  interview,
  showDate,
  onReschedule,
  onOutcome,
  onCancel,
}: InterviewRowProps) {
  const { inquiries, bidderById, taskById } = useHunter();
  const inquiry = inquiries.find((item) => item.id === interview.inquiryId);
  const bidder = inquiry && bidderById(inquiry.bidderId);
  const task = inquiry && taskById(inquiry.taskId);
  const overdue = needsOutcome(interview);
  const badge = overdue
    ? { label: "Needs outcome", tone: "warning" }
    : STATUS_BADGE[interview.status];

  return (
    <div className="hx-interview">
      <div className="hx-interview-time">
        <strong className="hx-num">{displayClock(interview.start)}</strong>
        <span className="hx-small hx-muted">{interview.durationMin} min</span>
      </div>
      <div className="hx-list-body">
        <div className="hx-row hx-row-between" style={{ flexWrap: "nowrap" }}>
          {bidder ? <Person name={bidder.name} detail={task?.title} /> : <span>Bidder</span>}
          <Badge label={badge.label} tone={badge.tone} />
        </div>
        <div className="hx-chip-row">
          {showDate && <span className="hx-chip">{longDate(`${interview.date}T00:00:00Z`)}</span>}
          <span className="hx-chip">{MODE_LABEL[interview.mode]}</span>
          {inquiry && <span className="hx-chip">{STAGE_TITLE[inquiry.stage]}</span>}
        </div>
        {interview.notes && (
          <p className="hx-small hx-muted" style={{ margin: 0 }}>
            {interview.notes}
          </p>
        )}
        <div className="hx-row">
          {interview.status === "scheduled" && (
            <>
              {interview.link && !overdue && (
                <Link
                  className="hx-link hx-small hx-strong"
                  href={interview.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Glyph name="play" /> Join
                </Link>
              )}
              {overdue ? (
                <Button
                  variant="primary"
                  size="sm"
                  label="Record outcome"
                  onClick={() => onOutcome(interview)}
                />
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  label="Reschedule"
                  onClick={() => onReschedule(interview)}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                label="Cancel"
                onClick={() => onCancel(interview)}
              />
            </>
          )}
          {inquiry && (
            <Button
              href={`${HUNTER_ROUTES.messages}?inquiry=${inquiry.id}`}
              variant="ghost"
              size="sm"
              label="Message"
            />
          )}
        </div>
      </div>
    </div>
  );
}
