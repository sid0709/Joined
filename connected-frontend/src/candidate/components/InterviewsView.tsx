"use client";

import Link from "next/link";
import { useState } from "react";
import { Glyph } from "sid-ui";

import type { BidderInterview } from "@/src/candidate/types/workspace";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { PIPELINE_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { DateField } from "@/src/shared/kit/Fields";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { Badge, Button, Modal, PageBody, Select } from "@/src/shared/marketplace-ui";
import { MOCK_TODAY } from "@/src/shared/mock/clock";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

const TIME_SLOTS = Array.from({ length: 17 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});
const MODE_LABEL = { video: "Video call", phone: "Phone call", chat: "Chat" } as const;

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function InterviewsView() {
  const { interviews, engagements, cancelInterview, rescheduleInterview } = useBidderWorkspace();
  const [moving, setMoving] = useState<BidderInterview | null>(null);
  const [date, setDate] = useState(MOCK_TODAY);
  const [start, setStart] = useState("10:00");

  const scheduled = interviews
    .filter((item) => item.status === "scheduled")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const past = interviews
    .filter((item) => item.status !== "scheduled")
    .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`));

  const context = (interview: BidderInterview) => {
    const engagement = engagements.find((item) => item.id === interview.engagementId);
    const task = engagement && BOARD_TASK_BY_ID.get(engagement.taskId);
    const hunter = task && HUNTER_BY_ID.get(task.hunterId);
    return { engagement, task, hunter };
  };

  const open = (interview: BidderInterview) => {
    setMoving(interview);
    setDate(interview.date);
    setStart(interview.start);
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Pipeline"
          title="Interviews"
          description="Short calls with job hunters before they connect you. Prepare using the agenda, join on time and follow up in chat."
        />
        <SectionNav label="Pipeline sections" links={PIPELINE_LINKS} />

        <div className="hx-split hx-split-even">
          <Panel title="Upcoming" subtitle={`${scheduled.length} scheduled`}>
            {scheduled.length === 0 ? (
              <EmptyBlock
                icon="calendar"
                title="No interviews scheduled"
                description="Hunters will propose a time once they want to talk. You can also ask in chat."
                action={
                  <Button href={BIDDER_ROUTES.messages} variant="secondary" label="Open messages" />
                }
              />
            ) : (
              <div className="hx-stack">
                {scheduled.map((interview) => {
                  const { engagement, task, hunter } = context(interview);
                  return (
                    <div key={interview.id} className="hx-interview">
                      <div className="hx-interview-time">
                        <strong>{dayLabel(interview.date)}</strong>
                        <span className="hx-small hx-muted">
                          {interview.start} · {interview.durationMin} min
                        </span>
                      </div>
                      <div className="hx-stack hx-stack-sm">
                        {hunter && <HunterLine hunter={hunter} size={24} />}
                        <span className="hx-strong">{task?.title}</span>
                        <div className="hx-row">
                          <Badge label={MODE_LABEL[interview.mode]} tone="info" />
                          {interview.date === MOCK_TODAY && <Badge label="Today" tone="warning" />}
                        </div>
                        <ul className="bx-agenda">
                          {interview.agenda.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        <div className="hx-row">
                          {interview.link && (
                            <Button
                              href={interview.link}
                              variant="primary"
                              size="sm"
                              label="Join call"
                            />
                          )}
                          {engagement && (
                            <Button
                              href={BIDDER_ROUTES.thread(engagement.id)}
                              variant="secondary"
                              size="sm"
                              label="Open chat"
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            label="Reschedule"
                            onClick={() => open(interview)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            label="Cancel"
                            onClick={() => cancelInterview(interview.id)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="hx-stack">
            <Panel title="Prepare well" subtitle="What hunters ask in the first call">
              <div className="hx-stack hx-stack-sm">
                {[
                  "Share your QA pass rate and how you verify each link",
                  "Explain how you keep an answer bank and handle new questions",
                  "Confirm daily capacity and the days you work",
                  "Ask about payout schedule and how feedback is given",
                ].map((tip) => (
                  <div key={tip} className="hx-check-row" data-done="true">
                    <span className="hx-check-mark">
                      <Glyph name="check" size="0.9em" />
                    </span>
                    {tip}
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="History" subtitle="Past and cancelled calls" flush>
              {past.length === 0 ? (
                <EmptyBlock
                  icon="clock"
                  title="No history yet"
                  description="Completed calls appear here."
                />
              ) : (
                <ul className="hx-list">
                  {past.map((interview) => {
                    const { task, hunter } = context(interview);
                    return (
                      <li key={interview.id} className="hx-list-item">
                        <span className="hx-list-body">
                          <span className="hx-list-title">{hunter?.company}</span>
                          <span className="hx-list-meta">
                            {task?.title} · {dayLabel(interview.date)}
                          </span>
                          {interview.outcome && (
                            <span className="hx-list-meta">{interview.outcome}</span>
                          )}
                        </span>
                        <Badge
                          label={interview.status === "completed" ? "Completed" : "Cancelled"}
                          tone={interview.status === "completed" ? "success" : "neutral"}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Link href={BIDDER_ROUTES.pipeline} className="hx-link hx-small">
              Back to pipeline
            </Link>
          </div>
        </div>
      </div>

      <Modal
        open={moving !== null}
        onClose={() => setMoving(null)}
        title="Ask to reschedule"
        footer={
          <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
            <Button variant="ghost" label="Cancel" onClick={() => setMoving(null)} />
            <Button
              variant="primary"
              label="Send request"
              onClick={() => {
                if (moving) rescheduleInterview(moving.id, date, start);
                setMoving(null);
              }}
            />
          </div>
        }
      >
        <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
          <DateField label="New date" value={date} onChange={setDate} />
          <Select
            label="Start time (hunter's timezone)"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </Select>
          <span className="hx-small hx-muted">
            The hunter is notified in chat and can confirm or suggest another time.
          </span>
        </div>
      </Modal>
    </PageBody>
  );
}
