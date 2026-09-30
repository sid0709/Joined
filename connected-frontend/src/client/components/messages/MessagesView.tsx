"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BidderSidebar } from "@/src/client/components/messages/BidderSidebar";
import { ThreadList } from "@/src/client/components/messages/ThreadList";
import { useHunter } from "@/src/client/context/HunterContext";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Person } from "@/src/shared/kit/Person";
import { InquiryStatusBadge } from "@/src/shared/kit/StatusBadge";
import { Tabs } from "@/src/shared/kit/Tabs";
import { clockTime, plural } from "@/src/shared/lib/format";
import { Banner, Button, ChatComposer, PageBody } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

type Filter = "all" | "pending" | "connected";

const QUICK_REPLIES = [
  "Thanks for reaching out. Can you share a recent completion log?",
  "Could you start this week?",
  "Your rate is a bit above the listed rate. Is there room to adjust?",
];

export function MessagesView() {
  const params = useSearchParams();
  const { inquiries, bidderById, taskById, sendMessage, markInquiryRead, respondToInquiry } =
    useHunter();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(params.get("inquiry") ?? "");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      inquiries
        .flatMap((inquiry) => {
          const bidder = bidderById(inquiry.bidderId);
          const task = taskById(inquiry.taskId);
          return bidder && task ? [{ inquiry, bidder, task }] : [];
        })
        .filter(
          ({ inquiry }) =>
            filter === "all" ||
            (filter === "connected"
              ? inquiry.status === "connected"
              : inquiry.status === "new" || inquiry.status === "negotiating"),
        )
        .sort((a, b) =>
          (b.inquiry.messages.at(-1)?.at ?? "").localeCompare(a.inquiry.messages.at(-1)?.at ?? ""),
        ),
    [inquiries, bidderById, taskById, filter],
  );

  const current = items.find((item) => item.inquiry.id === selectedId) ?? items[0];
  const pendingCount = inquiries.filter(
    (item) => item.status === "new" || item.status === "negotiating",
  ).length;
  const unread = inquiries.reduce((sum, item) => sum + item.unread, 0);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end" });
  }, [current?.inquiry.id, current?.inquiry.messages.length]);

  const select = (id: string) => {
    setSelectedId(id);
    markInquiryRead(id);
    setError(null);
  };

  const send = () => {
    if (!current) return;
    sendMessage(current.inquiry.id, draft);
    setDraft("");
  };

  const decide = (decision: "accept" | "decline") => {
    if (!current) return;
    const result = respondToInquiry(current.inquiry.id, decision);
    setError(result.ok ? null : (result.error ?? null));
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Messages"
          title="Talk to bidders who contacted you"
          description="Every bidder relationship starts here. A bidder finds your task on the board and messages you; you negotiate the rate, then accept to connect and reveal their contact details."
          meta={
            <span className="hx-small hx-muted">
              {plural(pendingCount, "open inquiry", "open inquiries")} ·{" "}
              {plural(unread, "unread message")}
            </span>
          }
        />

        <div className="hx-inbox">
          <div className="hx-inbox-col">
            <div className="hx-inbox-head">
              <Tabs
                label="Filter conversations"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "pending", label: `Inquiries (${pendingCount})` },
                  { value: "connected", label: "Connected" },
                ]}
              />
            </div>
            {items.length ? (
              <ThreadList items={items} selectedId={current?.inquiry.id ?? ""} onSelect={select} />
            ) : (
              <EmptyBlock
                icon="mail"
                title="No conversations"
                description="Bidders will appear here after they contact you about a task."
              />
            )}
          </div>

          {current ? (
            <>
              <div className="hx-inbox-col" style={{ overflow: "hidden" }}>
                <div className="hx-inbox-head hx-row hx-row-between">
                  <Person name={current.bidder.name} detail={current.task.title} size={40} />
                  <div className="hx-row">
                    <InquiryStatusBadge status={current.inquiry.status} />
                    {(current.inquiry.status === "new" ||
                      current.inquiry.status === "negotiating") && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          label="Decline"
                          onClick={() => decide("decline")}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          label="Accept and connect"
                          onClick={() => decide("accept")}
                        />
                      </>
                    )}
                    {current.inquiry.status === "connected" && (
                      <Button
                        href={`${HUNTER_ROUTES.pool}?task=${current.task.id}&bidder=${current.bidder.id}`}
                        variant="primary"
                        size="sm"
                        label="Assign links"
                      />
                    )}
                  </div>
                </div>
                {error && <Banner tone="danger" title={error} />}
                <div className="hx-thread">
                  {current.inquiry.messages.map((message) => (
                    <div key={message.id} className="hx-bubble" data-side={message.sender}>
                      {message.body}
                      <span className="hx-bubble-time">{clockTime(message.at)}</span>
                    </div>
                  ))}
                  <div ref={threadEnd} />
                </div>
                <div className="hx-inbox-foot hx-stack hx-stack-sm">
                  {current.inquiry.status !== "declined" && (
                    <div className="hx-chip-row">
                      {QUICK_REPLIES.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          className="hx-chip"
                          onClick={() => setDraft(reply)}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                  <ChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSend={send}
                    placeholder={
                      current.inquiry.status === "declined"
                        ? "This inquiry was declined"
                        : "Write a message"
                    }
                  />
                </div>
              </div>
              <div className="hx-inbox-col">
                <BidderSidebar
                  key={current.inquiry.id}
                  inquiry={current.inquiry}
                  bidder={current.bidder}
                  task={current.task}
                />
              </div>
            </>
          ) : (
            <div className="hx-inbox-col" style={{ gridColumn: "span 2" }}>
              <EmptyBlock
                icon="mail"
                title="Select a conversation"
                description="Choose a bidder on the left to read their message."
              />
            </div>
          )}
        </div>
      </div>
    </PageBody>
  );
}
