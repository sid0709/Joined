import { Glyph } from "@openseat/design-system";

import type { Bidder, Inquiry, Task } from "@/src/shared/types/marketplace";

import { Person } from "@/src/shared/kit/Person";
import { InquiryStatusBadge } from "@/src/shared/kit/StatusBadge";
import { money, relativeTime } from "@/src/shared/lib/format";
import { Badge, Button } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface InquiryCardProps {
  inquiry: Inquiry;
  bidder: Bidder;
  task: Task;
  onDecision: (decision: "accept" | "decline") => void;
}

/** One bidder's pitch for a task, with their proposed rate set against yours. */
export function InquiryCard({ inquiry, bidder, task, onDecision }: InquiryCardProps) {
  const open = inquiry.status === "new" || inquiry.status === "negotiating";
  return (
    <div className="hx-panel">
      <div className="hx-panel-body">
        <div className="hx-row hx-row-between" style={{ alignItems: "flex-start" }}>
          <Person
            name={bidder.name}
            detail={`${bidder.level} bidder · ${bidder.timezone}`}
            size={48}
          />
          <div className="hx-row">
            {inquiry.unread > 0 && <span className="hx-unread">{inquiry.unread}</span>}
            <InquiryStatusBadge status={inquiry.status} />
            <span className="hx-small hx-muted">{relativeTime(inquiry.createdAt)}</span>
          </div>
        </div>

        <p style={{ margin: 0, lineHeight: 1.55 }}>“{inquiry.pitch}”</p>

        <div className="hx-chip-row">
          <span className="hx-chip">
            <Glyph name="star" /> {bidder.rating} · {bidder.reviews} reviews
          </span>
          <span className="hx-chip">
            {bidder.completedLinks.toLocaleString("en-US")} links done
          </span>
          <span className="hx-chip">{bidder.qaPassRate}% QA pass</span>
          <span className="hx-chip">Replies {bidder.replyTime.toLowerCase()}</span>
          <span className="hx-chip">{inquiry.weeklyCapacity} links / week</span>
        </div>

        <dl className="hx-kv">
          {inquiry.proposedRates.map((offer) => {
            const listed =
              task.packageLines.find((line) => line.packageId === offer.packageId)?.rate ??
              offer.rate;
            const diff = offer.rate - listed;
            return (
              <div key={offer.packageId} style={{ display: "contents" }}>
                <dt>{PACKAGE_BY_ID.get(offer.packageId)?.name}</dt>
                <dd className="hx-num">
                  {money(offer.rate)}{" "}
                  <Badge
                    label={
                      diff === 0
                        ? "At listed rate"
                        : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))} vs listed`
                    }
                    tone={diff === 0 ? "success" : diff > 0 ? "warning" : "info"}
                  />
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="hx-row hx-row-between">
          <Button
            href={`${HUNTER_ROUTES.messages}?inquiry=${inquiry.id}`}
            variant="secondary"
            size="sm"
            label="Open chat"
          />
          {open && (
            <div className="hx-row">
              <Button
                variant="ghost"
                size="sm"
                label="Decline"
                onClick={() => onDecision("decline")}
              />
              <Button
                variant="primary"
                size="sm"
                label="Accept and connect"
                onClick={() => onDecision("accept")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
