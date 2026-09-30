"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BoardHunter, BoardTask } from "@/src/candidate/types/workspace";

import { EngagementBadge } from "@/src/candidate/components/ui/StatusBadges";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { PLATFORM_FEE } from "@/src/candidate/lib/derive";
import { suggestedPitch } from "@/src/candidate/lib/tasks";
import { NumberField } from "@/src/shared/kit/Fields";
import { Panel } from "@/src/shared/kit/Panel";
import { clockTime, money } from "@/src/shared/lib/format";
import { Banner, Button, TextArea } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

export function TaskContactPanel({ task, hunter }: { task: BoardTask; hunter: BoardHunter }) {
  const router = useRouter();
  const { profile, engagementForTask, contactTask, hasAssessment } = useBidderWorkspace();
  const existing = engagementForTask(task.id);
  const [pitch, setPitch] = useState("");
  const [capacity, setCapacity] = useState(String(Math.min(profile.weeklyCapacity, 60)));
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(task.packageLines.map((line) => [line.packageId, String(line.rate)])),
  );
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    const last = existing.messages.at(-1);
    return (
      <Panel title="Your conversation" subtitle={`With ${hunter.name}`}>
        <div className="hx-stack">
          <EngagementBadge status={existing.status} />
          {last && (
            <div className="bx-callout">
              <span className="hx-small hx-muted">Latest message · {clockTime(last.at)}</span>
              <p style={{ margin: 0 }}>{last.body}</p>
            </div>
          )}
          <Button
            href={BIDDER_ROUTES.thread(existing.id)}
            variant="primary"
            label={existing.unread ? `Open chat (${existing.unread} new)` : "Open chat"}
          />
          {existing.status === "connected" && (
            <Button href={BIDDER_ROUTES.work} variant="secondary" label="Go to My Work" />
          )}
        </div>
      </Panel>
    );
  }

  if (task.status === "closed") {
    return (
      <Panel title="This task is closed">
        <p className="hx-muted" style={{ margin: 0 }}>
          All slots have been filled. Save the hunter's other tasks or check the board for similar
          work.
        </p>
      </Panel>
    );
  }

  const missing = task.requiredAssessmentId && !hasAssessment(task.requiredAssessmentId);
  const estimate = task.packageLines.reduce(
    (sum, line) => sum + line.quota * (Number(rates[line.packageId]) || 0),
    0,
  );

  const send = () => {
    const result = contactTask({
      taskId: task.id,
      pitch,
      weeklyCapacity: Number(capacity) || 0,
      proposedRates: task.packageLines.map((line) => ({
        packageId: line.packageId,
        rate: Number(rates[line.packageId]) || line.rate,
      })),
    });
    if (!result.ok) return setError(result.error ?? "Could not send your message.");
    router.push(BIDDER_ROUTES.thread(result.id ?? ""));
  };

  return (
    <Panel
      title="Contact the job hunter"
      subtitle="Start a chat, agree a rate and get connected"
      className="hx-sticky"
    >
      <div id="contact" className="hx-inline-form">
        {missing && (
          <Banner
            tone="warning"
            title="Assessment required"
            description="You can message the hunter, but they will only connect you after you pass the required assessment."
          />
        )}
        {missing && (
          <Link className="hx-link hx-small" href={BIDDER_ROUTES.assessments}>
            Go to assessments
          </Link>
        )}
        <NumberField
          label="Links you can do per week"
          value={capacity}
          onChange={setCapacity}
          min={1}
          helper="The hunter uses this to plan your drops"
        />
        {task.packageLines.map((line) => (
          <NumberField
            key={line.packageId}
            label={`${PACKAGE_BY_ID.get(line.packageId)?.name} · your rate per link`}
            value={rates[line.packageId] ?? ""}
            onChange={(value) => setRates((current) => ({ ...current, [line.packageId]: value }))}
            min={0}
            step={0.05}
            helper={`Listed at ${money(line.rate)}. Proposing higher may need negotiation.`}
          />
        ))}
        <TextArea
          label="Message to the hunter"
          placeholder="Introduce yourself, relevant experience and when you can start"
          value={pitch}
          onChange={(event) => {
            setPitch(event.target.value);
            setError(null);
          }}
          rows={5}
        />
        <button
          type="button"
          className="hx-chip"
          onClick={() => setPitch(suggestedPitch(task, hunter.name.split(" ")[0], profile))}
        >
          Use a suggested intro
        </button>
        {error && <Banner tone="danger" title={error} />}
        <div className="bx-callout">
          <span className="hx-small hx-muted">Estimated earnings at these rates</span>
          <strong className="bx-earn-value">{money(estimate * (1 - PLATFORM_FEE))}</strong>
          <span className="hx-small hx-muted">
            {task.type === "permanent" ? "per week" : "for the whole batch"} after the 8% fee
          </span>
        </div>
        <Button variant="primary" label="Send message" onClick={send} />
      </div>
    </Panel>
  );
}
