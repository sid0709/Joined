import { Glyph } from "@joined/design-system";
import Link from "next/link";

import type { Bidder, Inquiry, Task } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { displayClock, isUpcoming } from "@/src/client/lib/interviews";
import { money, shortDate } from "@/src/shared/lib/format";
import { Avatar, Badge, Button } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface BidderTicketProps {
  inquiry: Inquiry;
  bidder: Bidder;
  task: Task;
  showTask: boolean;
  onOpen: () => void;
  onSchedule: () => void;
}

const LEVEL_TONE = { Rising: "neutral", Top: "info", Elite: "purple" } as const;

/** One bidder on the pipeline board. Drag it between hiring stages. */
export function BidderTicket({
  inquiry,
  bidder,
  task,
  showTask,
  onOpen,
  onSchedule,
}: BidderTicketProps) {
  const { interviews } = useHunter();
  const next = interviews
    .filter((item) => item.inquiryId === inquiry.id && isUpcoming(item))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0];
  const lowestRate = Math.min(...inquiry.proposedRates.map((offer) => offer.rate));
  const canSchedule =
    (inquiry.stage === "inquiry" ||
      inquiry.stage === "screening" ||
      inquiry.stage === "interview") &&
    !next;

  return (
    <div className="hx-ticket">
      <div
        className="hx-row hx-row-between"
        style={{ flexWrap: "nowrap", alignItems: "flex-start" }}
      >
        <button
          type="button"
          className="hx-ticket-main"
          onClick={onOpen}
          aria-label={`Open ${bidder.name}`}
        >
          <Avatar name={bidder.name} size={32} />
          <span className="hx-person-text">
            <span className="hx-strong hx-truncate">{bidder.name}</span>
            <span className="hx-small hx-muted hx-truncate">
              {bidder.specialties.slice(0, 2).join(" · ")}
            </span>
          </span>
        </button>
        <div className="hx-row" style={{ gap: "var(--space-1)", flexWrap: "nowrap" }}>
          {inquiry.unread > 0 && <span className="hx-unread">{inquiry.unread}</span>}
          <Badge label={bidder.level} tone={LEVEL_TONE[bidder.level]} />
        </div>
      </div>

      {showTask && <span className="hx-small hx-muted hx-truncate">{task.title}</span>}

      <div className="hx-chip-row">
        <span className="hx-chip">
          <span className="hx-star">
            <Glyph name="star" />
          </span>{" "}
          {bidder.rating}
        </span>
        <span className="hx-chip">{money(lowestRate)}/link</span>
        <span className="hx-chip">{inquiry.weeklyCapacity}/wk</span>
        {inquiry.score ? <span className="hx-chip">Score {inquiry.score}/5</span> : null}
      </div>

      {next && (
        <span className="hx-ticket-interview">
          <Glyph name="calendar" /> {shortDate(`${next.date}T00:00:00Z`)} ·{" "}
          {displayClock(next.start)}
        </span>
      )}

      <div className="hx-row hx-row-between" style={{ flexWrap: "nowrap" }}>
        <Link className="hx-link hx-small" href={`${HUNTER_ROUTES.messages}?inquiry=${inquiry.id}`}>
          Message
        </Link>
        {canSchedule && (
          <Button variant="secondary" size="sm" label="Schedule" onClick={onSchedule} />
        )}
        {inquiry.stage === "trial" && (
          <Button
            href={`${HUNTER_ROUTES.pool}?task=${task.id}&bidder=${bidder.id}`}
            variant="secondary"
            size="sm"
            label="Send trial links"
          />
        )}
        {inquiry.stage === "connected" && (
          <Button
            href={`${HUNTER_ROUTES.pool}?task=${task.id}&bidder=${bidder.id}`}
            variant="secondary"
            size="sm"
            label="Assign links"
          />
        )}
      </div>
    </div>
  );
}
