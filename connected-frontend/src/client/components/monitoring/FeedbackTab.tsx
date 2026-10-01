"use client";

import { Rating } from "@joined/design-system";
import { useState } from "react";

import { FeedbackDialog } from "@/src/client/components/monitoring/FeedbackDialog";
import { useHunter } from "@/src/client/context/HunterContext";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { Panel } from "@/src/shared/kit/Panel";
import { Person } from "@/src/shared/kit/Person";
import { relativeTime } from "@/src/shared/lib/format";
import { Button, Select } from "@/src/shared/marketplace-ui";

/** What you have told bidders. They see this on their collaboration page. */
export function FeedbackTab({ bidderIds }: { bidderIds: string[] }) {
  const { feedback, bidderById } = useHunter();
  const [target, setTarget] = useState<string | null>(null);
  const [choice, setChoice] = useState(bidderIds[0] ?? "");
  const visible = feedback.filter((item) => bidderIds.includes(item.bidderId));

  return (
    <Panel
      title="Feedback to bidders"
      subtitle="Bidders read this on their side to improve the next batch"
      actions={
        <>
          <Select label="Bidder" value={choice} onChange={(event) => setChoice(event.target.value)}>
            {bidderIds.map((id) => (
              <option key={id} value={id}>
                {bidderById(id)?.name}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            label="Write feedback"
            disabled={!choice}
            onClick={() => setTarget(choice)}
          />
        </>
      }
      flush
    >
      {visible.length ? (
        <ul className="hx-list">
          {visible.map((item) => {
            const bidder = bidderById(item.bidderId);
            return (
              <li key={item.id} className="hx-list-item" style={{ alignItems: "flex-start" }}>
                <Person name={bidder?.name ?? "Bidder"} size={40} />
                <div className="hx-list-body">
                  <Rating
                    value={item.rating}
                    readOnly
                    size="sm"
                    showValue={false}
                    label={`${bidder?.name} rating`}
                  />
                  <span>{item.message}</span>
                  <div className="hx-chip-row">
                    {item.tags.map((tag) => (
                      <span key={tag} className="hx-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="hx-small hx-muted">{relativeTime(item.at)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyBlock
          icon="star"
          title="No feedback yet"
          description="Tell bidders what is working so they can match your standards."
        />
      )}
      <FeedbackDialog bidderId={target} onClose={() => setTarget(null)} />
    </Panel>
  );
}
