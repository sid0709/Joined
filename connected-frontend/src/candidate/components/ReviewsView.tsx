"use client";

import { Glyph } from "@openseat/design-system";
import { useMemo, useState } from "react";

import type { Review } from "@/src/candidate/types/workspace";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { Stars } from "@/src/candidate/components/ui/Stars";
import { ResolutionBadge, VerdictBadge } from "@/src/candidate/components/ui/StatusBadges";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { StatCard } from "@/src/shared/kit/StatCard";
import { Tabs } from "@/src/shared/kit/Tabs";
import { clockTime, percent, plural, ratio, relativeTime } from "@/src/shared/lib/format";
import { Avatar, Banner, Button, Modal, PageBody, TextArea } from "@/src/shared/marketplace-ui";
import { POOL_BY_ID } from "@/src/shared/mock/pool";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

type Filter = "all" | "attention" | "approved" | "praise";

const needsAttention = (review: Review) =>
  (review.verdict === "mistake" || review.verdict === "warning") &&
  (review.resolution === "open" || review.resolution === "acknowledged");

const REPLIES = [
  "Understood, I'm fixing this now.",
  "Could you share an example of the correct answer?",
  "Thanks for the feedback. I'll apply it to the rest of the batch.",
];

const VERDICT_ICON = {
  approved: "check",
  praise: "heart",
  mistake: "close",
  warning: "info",
} as const;

export function ReviewsView() {
  const { reviews, applications, replyToReview, acknowledgeReview, disputeReview } =
    useBidderWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");

  const visible = useMemo(
    () =>
      reviews.filter((review) =>
        filter === "all"
          ? true
          : filter === "attention"
            ? needsAttention(review)
            : filter === "approved"
              ? review.verdict === "approved"
              : review.verdict === "praise",
      ),
    [reviews, filter],
  );
  const current = visible.find((review) => review.id === selectedId) ?? visible[0];
  const application = current?.applicationId
    ? applications.find((item) => item.id === current.applicationId)
    : undefined;
  const job = application ? POOL_BY_ID.get(application.jobId) : undefined;
  const task = current ? BOARD_TASK_BY_ID.get(current.taskId) : undefined;
  const hunter = task && HUNTER_BY_ID.get(task.hunterId);

  const approved = reviews.filter((review) => review.verdict === "approved").length;
  const mistakes = reviews.filter((review) => review.verdict === "mistake").length;
  const attention = reviews.filter(needsAttention).length;
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const scorecards = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const review of reviews) {
      const hunterId = BOARD_TASK_BY_ID.get(review.taskId)?.hunterId;
      if (!hunterId) continue;
      const entry = map.get(hunterId) ?? { total: 0, count: 0 };
      entry.total += review.rating;
      entry.count += 1;
      map.set(hunterId, entry);
    }
    return [...map.entries()].map(([hunterId, entry]) => ({
      hunter: HUNTER_BY_ID.get(hunterId),
      average: entry.total / entry.count,
      count: entry.count,
    }));
  }, [reviews]);

  const send = (text = draft) => {
    if (!current || !text.trim()) return;
    replyToReview(current.id, text);
    setDraft("");
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Reviews"
          title="Feedback from your job hunters"
          description="Hunters review every submission. See what was approved, fix what they marked as a mistake, and talk it through so the same issue never repeats."
          actions={<Button href={BIDDER_ROUTES.work} variant="primary" label="Go to my work" />}
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Approval rate"
            value={percent(ratio(approved, approved + mistakes), 0)}
            icon="check"
            tone="success"
            footnote={`${approved} approved · ${mistakes} marked as mistakes`}
          />
          <StatCard
            label="Needs your attention"
            value={attention}
            icon="info"
            tone={attention ? "warning" : "success"}
            footnote="Corrections and heads-ups"
          />
          <StatCard
            label="Average rating"
            value={average.toFixed(1)}
            icon="star"
            tone="warning"
            footnote={`${plural(reviews.length, "review")} in total`}
          />
          <StatCard
            label="Praise received"
            value={reviews.filter((review) => review.verdict === "praise").length}
            icon="heart"
            footnote="Kind words from hunters"
          />
        </div>

        {attention > 0 && (
          <Banner
            tone="warning"
            title={`${plural(attention, "review")} waiting for you`}
            description="Reply or fix the linked application to close each one. Open items count against your responsiveness score."
          />
        )}

        <div className="hx-toolbar">
          <Tabs
            label="Filter reviews"
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setSelectedId("");
            }}
            options={[
              { value: "all", label: `All (${reviews.length})` },
              { value: "attention", label: `Needs attention (${attention})` },
              { value: "approved", label: `Approved (${approved})` },
              { value: "praise", label: "Praise" },
            ]}
          />
        </div>

        {visible.length === 0 || !current ? (
          <EmptyBlock
            icon="check"
            title="Nothing here"
            description="You're all caught up for this filter."
          />
        ) : (
          <div className="hx-inbox bx-reviews">
            <div className="hx-inbox-col">
              <ul className="hx-list">
                {visible.map((review) => (
                  <li key={review.id}>
                    <button
                      type="button"
                      className="hx-list-item"
                      data-active={review.id === current.id}
                      onClick={() => setSelectedId(review.id)}
                    >
                      <span className="bx-verdict" data-verdict={review.verdict}>
                        <Glyph name={VERDICT_ICON[review.verdict]} size="1em" />
                      </span>
                      <span className="hx-list-body">
                        <span className="hx-list-title hx-truncate">{review.summary}</span>
                        <span className="hx-list-meta hx-truncate">
                          {
                            HUNTER_BY_ID.get(BOARD_TASK_BY_ID.get(review.taskId)?.hunterId ?? "")
                              ?.company
                          }{" "}
                          · {relativeTime(review.at)}
                        </span>
                      </span>
                      {needsAttention(review) && (
                        <span className="bx-dot" aria-label="Needs attention" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hx-inbox-col bx-chat">
              <div className="hx-inbox-head hx-stack hx-stack-sm">
                <div className="hx-row hx-row-between">
                  <div className="hx-row">
                    <VerdictBadge verdict={current.verdict} />
                    <ResolutionBadge resolution={current.resolution} />
                  </div>
                  <Stars value={current.rating} />
                </div>
                <h2 className="hx-panel-title">{current.summary}</h2>
                {hunter && <HunterLine hunter={hunter} size={24} />}
              </div>

              <div className="hx-thread bx-thread">
                <div className="bx-callout">
                  <span className="hx-small hx-muted">Hunter's assessment</span>
                  <p style={{ margin: 0, lineHeight: 1.55 }}>{current.detail}</p>
                  <div className="hx-chip-row">
                    {current.tags.map((tag) => (
                      <span key={tag} className="hx-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {application && job && (
                  <div className="bx-linked">
                    <div>
                      <strong>{job.company}</strong>
                      <span className="hx-small hx-muted bx-block">
                        {job.title} · {job.ats}
                      </span>
                    </div>
                    <Button
                      href={BIDDER_ROUTES.workDesk(application.assignmentId)}
                      variant={application.status === "returned" ? "primary" : "secondary"}
                      size="sm"
                      label={
                        application.status === "returned" ? "Fix in My Work" : "View in My Work"
                      }
                    />
                  </div>
                )}

                {current.thread.length === 0 && (
                  <span className="hx-small hx-faint" style={{ alignSelf: "center" }}>
                    No replies yet. Start the conversation below.
                  </span>
                )}
                {current.thread.map((comment) => (
                  <div key={comment.id} className="bx-bubble" data-side={comment.sender}>
                    {comment.sender === "hunter" && hunter && (
                      <Avatar name={hunter.company} size={24} />
                    )}
                    <div className="bx-bubble-body">
                      {comment.body}
                      <span className="bx-bubble-time">{clockTime(comment.at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hx-inbox-foot hx-stack hx-stack-sm">
                <div className="hx-row">
                  {(current.verdict === "mistake" || current.verdict === "warning") &&
                    current.resolution === "open" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        label="Acknowledge"
                        onClick={() => acknowledgeReview(current.id)}
                      />
                    )}
                  {current.resolution !== "disputed" &&
                    current.resolution !== "closed" &&
                    (current.verdict === "mistake" || current.verdict === "warning") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        label="Dispute this decision"
                        onClick={() => setDisputing(true)}
                      />
                    )}
                </div>
                <div className="hx-chip-row">
                  {REPLIES.map((reply) => (
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
                <div className="hx-row" style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
                  <div className="hx-grow">
                    <TextArea
                      label="Reply to the hunter"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button
                    variant="primary"
                    label="Send"
                    disabled={!draft.trim()}
                    onClick={() => send()}
                  />
                </div>
              </div>
            </div>

            <div className="hx-inbox-col">
              <div className="bx-sidebar">
                <span className="hx-eyebrow">Scorecard by hunter</span>
                {scorecards.map(({ hunter: card, average: avg, count }) =>
                  card ? (
                    <div
                      key={card.id}
                      className="hx-row hx-row-between"
                      style={{ flexWrap: "nowrap" }}
                    >
                      <span className="hx-truncate">{card.company}</span>
                      <span className="hx-small hx-muted">
                        <Stars value={avg} /> · {count}
                      </span>
                    </div>
                  ) : null,
                )}
                <span className="hx-eyebrow">How to respond</span>
                <ul className="bx-agenda">
                  <li>Acknowledge quickly. It shows you are on it.</li>
                  <li>Fix the linked application with fresh evidence.</li>
                  <li>Dispute only when you have proof the answer was correct.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={disputing}
        onClose={() => setDisputing(false)}
        title="Dispute this decision"
        footer={
          <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
            <Button variant="ghost" label="Cancel" onClick={() => setDisputing(false)} />
            <Button
              variant="primary"
              label="Send dispute"
              disabled={!reason.trim()}
              onClick={() => {
                if (current) disputeReview(current.id, reason);
                setReason("");
                setDisputing(false);
              }}
            />
          </div>
        }
      >
        <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
          <p className="hx-muted" style={{ margin: 0 }}>
            Explain why you believe the work met the requirements. OpenSeat support reviews disputes
            within one business day and the hunter is notified.
          </p>
          <TextArea
            label="Your reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
          />
        </div>
      </Modal>
    </PageBody>
  );
}
