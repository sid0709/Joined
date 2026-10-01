"use client";

import { Drawer, Glyph, Rating } from "@joined/design-system";
import { useState } from "react";

import type { HiringStage, Interview } from "@/src/shared/types/marketplace";

import { InterviewRow } from "@/src/client/components/interviews/InterviewRow";
import { useHunter } from "@/src/client/context/HunterContext";
import { HIRING_STAGES } from "@/src/client/data/pipeline";
import { InquiryStatusBadge } from "@/src/shared/kit/StatusBadge";
import { money, percent, relativeTime } from "@/src/shared/lib/format";
import { Banner, Button, Select, TextArea } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

const DEFAULT_SCORE = 3;

interface BidderDrawerProps {
  inquiryId: string | null;
  onClose: () => void;
  onSchedule: (inquiryId: string) => void;
  onReschedule: (interview: Interview) => void;
  onOutcome: (interview: Interview) => void;
}

/** Everything about one bidder in the hiring process, with private notes. */
export function BidderDrawer({
  inquiryId,
  onClose,
  onSchedule,
  onReschedule,
  onOutcome,
}: BidderDrawerProps) {
  const {
    inquiries,
    interviews,
    bidderById,
    taskById,
    moveInquiry,
    saveInquiryNotes,
    cancelInterview,
  } = useHunter();
  const inquiry = inquiries.find((item) => item.id === inquiryId);
  const bidder = inquiry ? bidderById(inquiry.bidderId) : undefined;
  const task = inquiry ? taskById(inquiry.taskId) : undefined;
  const [notes, setNotes] = useState(inquiry?.notes ?? "");
  const [score, setScore] = useState(inquiry?.score ?? DEFAULT_SCORE);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const history = inquiry
    ? interviews
        .filter((item) => item.inquiryId === inquiry.id)
        .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
    : [];

  const move = (stage: HiringStage) => {
    if (!inquiry) return;
    const result = moveInquiry(inquiry.id, stage);
    setError(result.ok ? null : (result.error ?? null));
  };

  return (
    <Drawer
      isOpen={Boolean(inquiry && bidder && task)}
      onOpenChange={(next) => !next && onClose()}
      title={bidder?.name ?? "Bidder"}
      subtitle={task?.title}
      size="md"
      footer={
        inquiry && (
          <div className="hx-row hx-row-between" style={{ width: "100%" }}>
            <Button
              variant="ghost"
              label="Decline"
              disabled={inquiry.stage === "declined"}
              onClick={() => move("declined")}
            />
            <div className="hx-row">
              <Button
                href={`${HUNTER_ROUTES.messages}?inquiry=${inquiry.id}`}
                variant="secondary"
                label="Message"
              />
              {(inquiry.stage === "inquiry" ||
                inquiry.stage === "screening" ||
                inquiry.stage === "interview") && (
                <Button
                  variant="secondary"
                  label="Schedule interview"
                  onClick={() => onSchedule(inquiry.id)}
                />
              )}
              {inquiry.stage !== "connected" && inquiry.stage !== "declined" && (
                <Button
                  variant="primary"
                  label="Accept and connect"
                  onClick={() => move("connected")}
                />
              )}
            </div>
          </div>
        )
      }
    >
      {inquiry && bidder && task && (
        <div className="hx-stack" key={inquiry.id}>
          {error && <Banner tone="danger" title={error} />}
          <div className="hx-row hx-row-between">
            <InquiryStatusBadge status={inquiry.status} />
            <Select
              label="Hiring stage"
              value={inquiry.stage}
              onChange={(event) => move(event.target.value as HiringStage)}
            >
              {HIRING_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}
                </option>
              ))}
            </Select>
          </div>

          <p style={{ margin: 0, lineHeight: 1.55 }}>“{inquiry.pitch}”</p>

          <dl className="hx-kv">
            <dt>Rating</dt>
            <dd>
              <span className="hx-score">
                <span className="hx-star">
                  <Glyph name="star" />
                </span>
                {bidder.rating} <span className="hx-muted">({bidder.reviews})</span>
              </span>
            </dd>
            <dt>Links done</dt>
            <dd className="hx-num">{bidder.completedLinks.toLocaleString("en-US")}</dd>
            <dt>QA pass rate</dt>
            <dd className="hx-num">{percent(bidder.qaPassRate)}</dd>
            <dt>Avg. time</dt>
            <dd className="hx-num">{bidder.avgMinutesPerLink} min / link</dd>
            <dt>Capacity offered</dt>
            <dd className="hx-num">{inquiry.weeklyCapacity} links / week</dd>
            <dt>Replies</dt>
            <dd>{bidder.replyTime}</dd>
            <dt>Timezone</dt>
            <dd>{bidder.timezone}</dd>
            <dt>Contacted</dt>
            <dd>{relativeTime(inquiry.createdAt)}</dd>
            {inquiry.proposedRates.map((offer) => (
              <div key={offer.packageId} style={{ display: "contents" }}>
                <dt>{PACKAGE_BY_ID.get(offer.packageId)?.name}</dt>
                <dd className="hx-num">{money(offer.rate)} / link</dd>
              </div>
            ))}
          </dl>

          <div className="hx-contact">
            <strong className="hx-strong hx-small">Contact</strong>
            {inquiry.stage === "connected" ? (
              <dl className="hx-kv" style={{ marginTop: "var(--space-2)" }}>
                <dt>Email</dt>
                <dd>{bidder.email}</dd>
                <dt>Handle</dt>
                <dd>{bidder.handle}</dd>
              </dl>
            ) : (
              <p className="hx-small hx-muted" style={{ margin: "var(--space-1) 0 0" }}>
                <Glyph name="lock" /> Email and handle unlock when you connect this bidder.
              </p>
            )}
          </div>

          <div className="hx-stack hx-stack-sm">
            <strong className="hx-strong">Your private notes</strong>
            <Rating
              value={score}
              onChange={setScore}
              label="Your score"
              caption="Only you can see this"
            />
            <TextArea
              label="Notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setSaved(false);
              }}
            />
            <div className="hx-row">
              <Button
                variant="secondary"
                size="sm"
                label="Save notes"
                onClick={() => {
                  saveInquiryNotes(inquiry.id, notes, score);
                  setSaved(true);
                }}
              />
              {saved && <span className="hx-small hx-muted">Saved</span>}
            </div>
          </div>

          <div className="hx-stack hx-stack-sm">
            <strong className="hx-strong">Interviews</strong>
            {history.length ? (
              history.map((item) => (
                <InterviewRow
                  key={item.id}
                  interview={item}
                  showDate
                  onReschedule={onReschedule}
                  onOutcome={onOutcome}
                  onCancel={(target) => cancelInterview(target.id)}
                />
              ))
            ) : (
              <span className="hx-small hx-muted">No interviews yet.</span>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
