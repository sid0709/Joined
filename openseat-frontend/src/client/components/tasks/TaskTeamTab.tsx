import { Glyph } from "@openseat/design-system";

import type { ApplicationRecord, Bidder, Inquiry, Task } from "@/src/client/types/hunter";

import { EmptyBlock } from "@/src/client/components/ui/EmptyBlock";
import { Meter } from "@/src/client/components/ui/Meter";
import { Person } from "@/src/client/components/ui/Person";
import { PACKAGE_BY_ID } from "@/src/client/data/packages";
import { money, percent } from "@/src/client/lib/format";
import { countStatuses, deliveredCount, qaRate } from "@/src/client/lib/selectors";
import { Button } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface TaskTeamTabProps {
  task: Task;
  members: { inquiry: Inquiry; bidder: Bidder }[];
  applications: ApplicationRecord[];
  onFeedback: (bidderId: string) => void;
}

/** Connected bidders and how to reach them. Contact details are revealed once you accept an inquiry. */
export function TaskTeamTab({ task, members, applications, onFeedback }: TaskTeamTabProps) {
  if (!members.length) {
    return (
      <EmptyBlock
        icon="users"
        title="No connected bidders yet"
        description="Bidders who contact you about this task appear under Inquiries. Accept one to connect and reveal their contact details."
      />
    );
  }
  return (
    <div className="hx-grid hx-grid-2">
      {members.map(({ inquiry, bidder }) => {
        const own = applications.filter((application) => application.bidderId === bidder.id);
        const counts = countStatuses(own);
        return (
          <div key={bidder.id} className="hx-panel">
            <div className="hx-panel-body">
              <Person name={bidder.name} detail={bidder.headline} size={48} />
              <div className="hx-contact">
                <dl className="hx-kv">
                  <dt>Email</dt>
                  <dd>{bidder.email}</dd>
                  <dt>Handle</dt>
                  <dd>{bidder.handle}</dd>
                  <dt>Timezone</dt>
                  <dd>{bidder.timezone}</dd>
                  <dt>Languages</dt>
                  <dd>{bidder.languages.join(", ")}</dd>
                </dl>
              </div>
              <dl className="hx-kv">
                {inquiry.proposedRates.map((offer) => (
                  <div key={offer.packageId} style={{ display: "contents" }}>
                    <dt>{PACKAGE_BY_ID.get(offer.packageId)?.name}</dt>
                    <dd className="hx-num">{money(offer.rate)} / link</dd>
                  </div>
                ))}
                <dt>Weekly capacity</dt>
                <dd className="hx-num">{inquiry.weeklyCapacity} links</dd>
              </dl>
              {own.length > 0 ? (
                <div className="hx-stack hx-stack-sm">
                  <Meter
                    label={`${bidder.name} progress`}
                    total={own.length}
                    segments={[
                      { label: "QA passed", value: counts.qa_passed, tone: "positive" },
                      { label: "Awaiting QA", value: counts.submitted, tone: "soft" },
                      {
                        label: "Returned or failed",
                        value: counts.returned + counts.failed,
                        tone: "critical",
                      },
                    ]}
                  />
                  <span className="hx-small hx-muted">
                    {deliveredCount(counts)} delivered of {own.length} assigned ·{" "}
                    {percent(qaRate(counts), 0)} QA pass rate
                  </span>
                </div>
              ) : (
                <span className="hx-small hx-muted">No links assigned to this bidder yet.</span>
              )}
              <div className="hx-row">
                <Button
                  href={`${HUNTER_ROUTES.messages}?inquiry=${inquiry.id}`}
                  variant="secondary"
                  size="sm"
                  label="Message"
                  icon={<Glyph name="mail" />}
                />
                {task.status !== "completed" && (
                  <Button
                    href={`${HUNTER_ROUTES.pool}?task=${task.id}&bidder=${bidder.id}`}
                    variant="primary"
                    size="sm"
                    label="Assign links"
                    icon={<Glyph name="link" />}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  label="Feedback"
                  onClick={() => onFeedback(bidder.id)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
