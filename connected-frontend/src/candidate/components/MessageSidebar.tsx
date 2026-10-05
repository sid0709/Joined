"use client";

import Link from "next/link";
import { useState } from "react";
import { Glyph } from "sid-ui";

import type {
  BidderInterview,
  BoardHunter,
  BoardTask,
  Engagement,
} from "@/src/candidate/types/workspace";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { NumberField } from "@/src/shared/kit/Fields";
import { longDate, money } from "@/src/shared/lib/format";
import { Button } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

interface MessageSidebarProps {
  engagement: Engagement;
  task: BoardTask;
  hunter: BoardHunter;
  interview?: BidderInterview;
  hasAssignment: boolean;
}

export function MessageSidebar({
  engagement,
  task,
  hunter,
  interview,
  hasAssignment,
}: MessageSidebarProps) {
  const { proposeRates, withdrawEngagement } = useBidderWorkspace();
  const [editing, setEditing] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(engagement.proposedRates.map((rate) => [rate.packageId, String(rate.rate)])),
  );
  const negotiating = engagement.status === "contacted" || engagement.status === "negotiating";
  const connected = engagement.status === "connected";

  const steps = [
    { label: "Message sent", done: true },
    { label: "Hunter replied", done: engagement.replies > 0 || connected },
    {
      label: interview ? `Interview ${longDate(interview.date)}` : "Interview (optional)",
      done: interview?.status === "completed" || connected,
    },
    { label: "Connected", done: connected },
    { label: "Links assigned", done: hasAssignment },
  ];

  return (
    <div className="bx-sidebar">
      <div className="hx-stack hx-stack-sm">
        <span className="hx-eyebrow">Task</span>
        <Link href={BIDDER_ROUTES.task(task.id)} className="bx-title-link hx-strong">
          {task.title}
        </Link>
        <HunterLine hunter={hunter} />
      </div>

      <div className="hx-stack hx-stack-sm">
        <span className="hx-eyebrow">Rates</span>
        {editing ? (
          <div className="hx-inline-form">
            {engagement.proposedRates.map((rate) => (
              <NumberField
                key={rate.packageId}
                label={PACKAGE_BY_ID.get(rate.packageId)?.name ?? rate.packageId}
                value={rates[rate.packageId] ?? ""}
                onChange={(value) =>
                  setRates((current) => ({ ...current, [rate.packageId]: value }))
                }
                step={0.05}
                helper={`Listed ${money(task.packageLines.find((line) => line.packageId === rate.packageId)?.rate ?? 0)}`}
              />
            ))}
            <div className="hx-row">
              <Button
                variant="primary"
                size="sm"
                label="Send proposal"
                onClick={() => {
                  proposeRates(
                    engagement.id,
                    engagement.proposedRates.map((rate) => ({
                      packageId: rate.packageId,
                      rate: Number(rates[rate.packageId]) || rate.rate,
                    })),
                  );
                  setEditing(false);
                }}
              />
              <Button variant="ghost" size="sm" label="Cancel" onClick={() => setEditing(false)} />
            </div>
          </div>
        ) : (
          <>
            <dl className="hx-kv">
              {engagement.proposedRates.map((rate) => (
                <div key={rate.packageId} style={{ display: "contents" }}>
                  <dt>{PACKAGE_BY_ID.get(rate.packageId)?.name}</dt>
                  <dd>{money(rate.rate)}/link</dd>
                </div>
              ))}
              <dt>Weekly capacity</dt>
              <dd>{engagement.weeklyCapacity} links</dd>
            </dl>
            {negotiating && (
              <Button
                variant="secondary"
                size="sm"
                label="Propose new rates"
                onClick={() => setEditing(true)}
              />
            )}
          </>
        )}
      </div>

      <div className="hx-stack hx-stack-sm">
        <span className="hx-eyebrow">Progress</span>
        {steps.map((step) => (
          <div key={step.label} className="hx-check-row" data-done={step.done}>
            <span className="hx-check-mark">
              <Glyph name={step.done ? "check" : "dot"} size="0.9em" />
            </span>
            {step.label}
          </div>
        ))}
      </div>

      {interview && interview.status === "scheduled" && (
        <div className="hx-ticket-interview">
          <Glyph name="calendar" size="1em" />
          {longDate(interview.date)} · {interview.start} · {interview.durationMin} min
        </div>
      )}

      {connected && (
        <Button
          href={hasAssignment ? BIDDER_ROUTES.work : BIDDER_ROUTES.pipeline}
          variant="primary"
          label={hasAssignment ? "Open my work" : "View pipeline"}
        />
      )}
      {negotiating && (
        <Button
          variant="ghost"
          label="Withdraw inquiry"
          onClick={() => withdrawEngagement(engagement.id)}
        />
      )}
    </div>
  );
}
