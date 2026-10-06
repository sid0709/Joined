"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Glyph } from "sid-ui";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { PIPELINE_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { fitChecks, taskPotential } from "@/src/candidate/lib/tasks";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { TaskTypeBadge } from "@/src/shared/kit/StatusBadge";
import { daysUntil, money, relativeTime } from "@/src/shared/lib/format";
import { Badge, Banner, Button, PageBody } from "@/src/shared/marketplace-ui";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

export function InvitationsView() {
  const router = useRouter();
  const { invitations, respondInvitation, profile, assessments } = useBidderWorkspace();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ordered = [...invitations].sort((a, b) => {
    if ((a.status === "pending") !== (b.status === "pending"))
      return a.status === "pending" ? -1 : 1;
    return b.sentAt.localeCompare(a.sentAt);
  });
  const pending = invitations.filter((item) => item.status === "pending").length;

  const respond = (id: string, decision: "accept" | "decline") => {
    const result = respondInvitation(id, decision);
    if (!result.ok) return setErrors((current) => ({ ...current, [id]: result.error ?? "" }));
    if (decision === "accept" && result.id) router.push(BIDDER_ROUTES.thread(result.id));
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Pipeline"
          title="Invitations"
          description="Job hunters invite bidders whose profile and QA record they trust. Accepting opens a chat where you confirm the rate and get connected."
          actions={
            <Button href={BIDDER_ROUTES.board} variant="secondary" label="Browse the board" />
          }
        />
        <SectionNav
          label="Pipeline sections"
          links={PIPELINE_LINKS.map((link) =>
            link.href === BIDDER_ROUTES.invitations ? { ...link, count: pending } : link,
          )}
        />

        {ordered.length === 0 ? (
          <EmptyBlock
            icon="mail"
            title="No invitations yet"
            description="Keep your profile and availability up to date so hunters can find you."
            action={
              <Button href={BIDDER_ROUTES.profile} variant="primary" label="Update profile" />
            }
          />
        ) : (
          <div className="hx-stack">
            {ordered.map((invitation) => {
              const task = BOARD_TASK_BY_ID.get(invitation.taskId);
              const hunter = task && HUNTER_BY_ID.get(task.hunterId);
              if (!task || !hunter) return null;
              const checks = fitChecks(task, profile, assessments);
              const blocked = checks.find((check) => check.id === "assessment" && !check.ok);
              const days = daysUntil(invitation.expiresAt);
              const isPending = invitation.status === "pending";
              const potential = taskPotential(task);
              return (
                <Panel
                  key={invitation.id}
                  title={task.title}
                  subtitle={`Invited ${relativeTime(invitation.sentAt)}`}
                  actions={
                    isPending ? (
                      <Badge
                        label={days > 0 ? `Expires in ${days} d` : "Expired"}
                        tone={days <= 2 ? "warning" : "info"}
                      />
                    ) : (
                      <Badge
                        label={invitation.status === "accepted" ? "Accepted" : "Declined"}
                        tone={invitation.status === "accepted" ? "success" : "neutral"}
                      />
                    )
                  }
                >
                  <div className="bx-invite">
                    <div className="hx-stack">
                      <div className="hx-row hx-row-between">
                        <HunterLine hunter={hunter} size={40} />
                        <TaskTypeBadge type={task.type} />
                      </div>
                      <blockquote className="bx-quote">{invitation.message}</blockquote>
                      {errors[invitation.id] && (
                        <Banner tone="danger" title={errors[invitation.id]} />
                      )}
                      {blocked && isPending && (
                        <Banner
                          tone="warning"
                          title="Assessment needed"
                          description={`This invitation needs the ${blocked.label.replace(" assessment passed", "")} assessment.`}
                        />
                      )}
                    </div>
                    <div className="bx-invite-side">
                      <div className="bx-callout">
                        <span className="hx-small hx-muted">Offered rate</span>
                        <strong className="bx-earn-value">{money(invitation.offeredRate)}</strong>
                        <span className="hx-small hx-muted">
                          per link · about {money(potential.amount)} {potential.unit}
                        </span>
                      </div>
                      <div className="hx-stack hx-stack-sm">
                        {checks.slice(0, 4).map((check) => (
                          <div key={check.id} className="hx-check-row" data-done={check.ok}>
                            <span className="hx-check-mark">
                              <Glyph name={check.ok ? "check" : "info"} size="0.9em" />
                            </span>
                            {check.label}
                          </div>
                        ))}
                      </div>
                      <div className="hx-row">
                        {isPending ? (
                          <>
                            <Button
                              variant="primary"
                              label="Accept and chat"
                              disabled={days <= 0}
                              onClick={() => respond(invitation.id, "accept")}
                            />
                            <Button
                              variant="ghost"
                              label="Decline"
                              onClick={() => respond(invitation.id, "decline")}
                            />
                          </>
                        ) : null}
                        <Link className="hx-link hx-small" href={BIDDER_ROUTES.task(task.id)}>
                          View task
                        </Link>
                        {blocked && isPending && (
                          <Link className="hx-link hx-small" href={BIDDER_ROUTES.assessments}>
                            Take assessment
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </PageBody>
  );
}
