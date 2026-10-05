"use client";

import { Glyph } from "sid-ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage } from "@/src/candidate/types/workspace";

import { MessageSidebar } from "@/src/candidate/components/MessageSidebar";
import { EngagementBadge } from "@/src/candidate/components/ui/StatusBadges";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { bidderQa } from "@/src/candidate/lib/derive";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Tabs } from "@/src/shared/kit/Tabs";
import { clockTime, longDate, plural, relativeTime } from "@/src/shared/lib/format";
import { Avatar, Button, ChatComposer, PageBody } from "@/src/shared/marketplace-ui";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

type Filter = "all" | "active" | "connected";

const STAGES = ["inquiry", "screening", "interview", "trial", "connected"] as const;
const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  inquiry: "Inquiry",
  screening: "Screening",
  interview: "Interview",
  trial: "Trial",
  connected: "Connected",
};

const quickReplies = (qaRate: number) => [
  "Could we schedule a short call?",
  `My recent QA pass rate is ${qaRate}% across all my desks.`,
  "What is the payout schedule?",
  "Could you assign my first batch?",
];

export function MessagesView() {
  const params = useSearchParams();
  const {
    engagements,
    interviews,
    assignments,
    applications,
    typingIds,
    sendMessage,
    markRead,
    unreadMessages,
  } = useBidderWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(params.get("thread") ?? "");
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      engagements
        .flatMap((engagement) => {
          const task = BOARD_TASK_BY_ID.get(engagement.taskId);
          const hunter = task && HUNTER_BY_ID.get(task.hunterId);
          return task && hunter ? [{ engagement, task, hunter }] : [];
        })
        .filter(({ engagement }) =>
          filter === "all"
            ? true
            : filter === "connected"
              ? engagement.status === "connected"
              : engagement.status === "contacted" || engagement.status === "negotiating",
        )
        .sort((a, b) =>
          (b.engagement.messages.at(-1)?.at ?? "").localeCompare(
            a.engagement.messages.at(-1)?.at ?? "",
          ),
        ),
    [engagements, filter],
  );

  const current = items.find((item) => item.engagement.id === selectedId) ?? items[0];
  const typing = current ? typingIds.includes(current.engagement.id) : false;
  const openCount = engagements.filter((item) =>
    ["contacted", "negotiating"].includes(item.status),
  ).length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [current?.engagement.id, current?.engagement.messages.length, typing]);

  useEffect(() => {
    if (current?.engagement.unread) markRead(current.engagement.id);
  }, [current?.engagement.id, current?.engagement.unread, markRead]);

  const send = (text = draft) => {
    if (!current || !text.trim()) return;
    sendMessage(current.engagement.id, text);
    setDraft("");
  };

  const grouped = useMemo(() => {
    const groups: { day: string; messages: ChatMessage[] }[] = [];
    for (const message of current?.engagement.messages ?? []) {
      const day = message.at.slice(0, 10);
      const last = groups.at(-1);
      if (last?.day === day) last.messages.push(message);
      else groups.push({ day, messages: [message] });
    }
    return groups;
  }, [current]);

  const stageIndex = current
    ? STAGES.indexOf(current.engagement.stage as (typeof STAGES)[number])
    : -1;
  const closed = current && ["declined", "withdrawn"].includes(current.engagement.status);

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Messages"
          title="Talk to job hunters"
          description="Every desk starts as a conversation. Introduce yourself, agree a rate, and once the hunter connects you they will assign links and give feedback here."
          meta={
            <span className="hx-small hx-muted">
              {plural(openCount, "open conversation")} · {plural(unreadMessages, "unread message")}
            </span>
          }
          actions={
            <Button href={BIDDER_ROUTES.board} variant="secondary" label="Browse the task board" />
          }
        />

        <div className="hx-inbox bx-inbox">
          <div className="hx-inbox-col">
            <div className="hx-inbox-head">
              <Tabs
                label="Filter conversations"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: `Active (${openCount})` },
                  { value: "connected", label: "Connected" },
                ]}
              />
            </div>
            {items.length ? (
              <ul className="hx-list">
                {items.map(({ engagement, task, hunter }) => {
                  const last = engagement.messages.at(-1);
                  return (
                    <li key={engagement.id}>
                      <button
                        type="button"
                        className="hx-list-item"
                        data-active={engagement.id === current?.engagement.id}
                        onClick={() => {
                          setSelectedId(engagement.id);
                          markRead(engagement.id);
                        }}
                      >
                        <Avatar name={hunter.company} size={40} />
                        <span className="hx-list-body">
                          <span className="hx-row hx-row-between" style={{ flexWrap: "nowrap" }}>
                            <span className="hx-list-title hx-truncate">{hunter.company}</span>
                            <span className="hx-small hx-faint bx-nowrap">
                              {last ? relativeTime(last.at) : ""}
                            </span>
                          </span>
                          <span className="hx-list-meta hx-truncate">{task.title}</span>
                          <span className="hx-list-meta hx-truncate">
                            {last?.sender === "bidder" ? "You: " : ""}
                            {last?.body}
                          </span>
                        </span>
                        {engagement.unread > 0 && (
                          <span className="hx-unread">{engagement.unread}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBlock
                icon="chat"
                title="No conversations yet"
                description="Contact a job hunter from any task to start one."
                action={
                  <Button href={BIDDER_ROUTES.board} variant="primary" label="Browse tasks" />
                }
              />
            )}
          </div>

          {current ? (
            <>
              <div className="hx-inbox-col bx-chat">
                <div className="hx-inbox-head hx-stack hx-stack-sm">
                  <div className="hx-row hx-row-between">
                    <div className="hx-person">
                      <Avatar name={current.hunter.company} size={40} />
                      <div className="hx-person-text">
                        <span className="hx-strong">{current.hunter.company}</span>
                        <span className="hx-small hx-muted">
                          {current.hunter.name} · replies {current.hunter.replyTime.toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <EngagementBadge status={current.engagement.status} />
                  </div>
                  {!closed && stageIndex >= 0 && (
                    <ol className="hx-steps bx-stage">
                      {STAGES.map((stage, index) => (
                        <li
                          key={stage}
                          className="hx-step"
                          data-state={
                            index < stageIndex
                              ? "done"
                              : index === stageIndex
                                ? "current"
                                : "upcoming"
                          }
                        >
                          <span className="hx-step-index">
                            {index < stageIndex ? <Glyph name="check" size="0.85em" /> : index + 1}
                          </span>
                          {STAGE_LABEL[stage]}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="hx-thread bx-thread">
                  {grouped.map((group) => (
                    <div key={group.day} className="bx-day">
                      <span className="bx-day-label">{longDate(group.messages[0].at)}</span>
                      {group.messages.map((message) => (
                        <div key={message.id} className="bx-bubble" data-side={message.sender}>
                          {message.sender === "hunter" && (
                            <Avatar name={current.hunter.company} size={24} />
                          )}
                          <div className="bx-bubble-body">
                            {message.body}
                            <span className="bx-bubble-time">{clockTime(message.at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {typing && (
                    <div className="bx-bubble" data-side="hunter">
                      <Avatar name={current.hunter.company} size={24} />
                      <div
                        className="bx-bubble-body bx-typing"
                        aria-label="The job hunter is typing"
                      >
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                <div className="hx-inbox-foot hx-stack hx-stack-sm">
                  {!closed && (
                    <div className="hx-chip-row">
                      {quickReplies(Math.round(bidderQa(applications))).map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          className="hx-chip"
                          onClick={() => send(reply)}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                  <ChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSend={() => send()}
                    placeholder={closed ? "This conversation is closed" : "Write a message"}
                  />
                </div>
              </div>
              <div className="hx-inbox-col">
                <MessageSidebar
                  key={current.engagement.id}
                  engagement={current.engagement}
                  task={current.task}
                  hunter={current.hunter}
                  interview={interviews.find(
                    (item) =>
                      item.engagementId === current.engagement.id && item.status !== "cancelled",
                  )}
                  hasAssignment={assignments.some(
                    (item) => item.engagementId === current.engagement.id,
                  )}
                />
              </div>
            </>
          ) : (
            <div className="hx-inbox-col" style={{ gridColumn: "span 2" }}>
              <EmptyBlock
                icon="chat"
                title="Select a conversation"
                description="Choose a job hunter on the left to read your messages."
              />
            </div>
          )}
        </div>
      </div>
    </PageBody>
  );
}
