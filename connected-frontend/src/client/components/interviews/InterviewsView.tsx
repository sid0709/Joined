"use client";

import { Calendar } from "@openseat/design-system";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { Interview } from "@/src/client/types/hunter";

import { InterviewRow } from "@/src/client/components/interviews/InterviewRow";
import { OutcomeDialog } from "@/src/client/components/interviews/OutcomeDialog";
import { ScheduleDialog } from "@/src/client/components/interviews/ScheduleDialog";
import { EmptyBlock } from "@/src/client/components/ui/EmptyBlock";
import { PageHeader } from "@/src/client/components/ui/PageHeader";
import { Panel } from "@/src/client/components/ui/Panel";
import { StatCard } from "@/src/client/components/ui/StatCard";
import { useHunter } from "@/src/client/context/HunterContext";
import { MOCK_TODAY } from "@/src/client/data/clock";
import { percent, ratio } from "@/src/client/lib/format";
import {
  dateFromYmd,
  isUpcoming,
  needsOutcome,
  toEvent,
  ymdFromDate,
} from "@/src/client/lib/interviews";
import { Banner, Button, PageBody } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

const WEEK_DAYS = 7;
const HOURS: [number, number] = [8, 19];

export function InterviewsView() {
  const params = useSearchParams();
  const { interviews, inquiries, bidderById, profile, cancelInterview } = useHunter();
  const [selected, setSelected] = useState(dateFromYmd(MOCK_TODAY));
  const [scheduling, setScheduling] = useState(Boolean(params.get("schedule")));
  const [rescheduling, setRescheduling] = useState<Interview | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<Interview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nameOf = useCallback(
    (interview: Interview) => {
      const inquiry = inquiries.find((item) => item.id === interview.inquiryId);
      return inquiry ? (bidderById(inquiry.bidderId)?.name ?? "Bidder") : "Bidder";
    },
    [bidderById, inquiries],
  );
  const events = useMemo(
    () =>
      interviews
        .filter((item) => item.status !== "cancelled")
        .map((item) => toEvent(item, `${nameOf(item)} · interview`)),
    [interviews, nameOf],
  );
  const selectedYmd = ymdFromDate(selected);
  const dayList = interviews
    .filter((item) => item.date === selectedYmd && item.status !== "cancelled")
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = interviews
    .filter(isUpcoming)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
    .slice(0, 5);
  const overdue = interviews.filter(needsOutcome);

  const weekEnd = new Date(dateFromYmd(MOCK_TODAY).getTime() + WEEK_DAYS * 24 * 60 * 60 * 1000);
  const thisWeek = interviews.filter(
    (item) => item.status === "scheduled" && dateFromYmd(item.date) < weekEnd,
  ).length;
  const held = interviews.filter((item) => item.status === "completed");
  const advanced = held.filter((item) => item.outcome === "advance").length;
  const noShows = interviews.filter((item) => item.status === "no_show").length;
  const inInterview = inquiries.filter((item) => item.stage === "interview").length;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Interviews"
          title="Interview calendar"
          description="Every bidder you screen becomes an interview here. Book from your open slots, join the call, record how it went, and the hiring pipeline updates itself."
          actions={
            <>
              <Button href={HUNTER_ROUTES.bidders} variant="secondary" label="Hiring pipeline" />
              <Button
                variant="primary"
                label="Schedule interview"
                onClick={() => setScheduling(true)}
              />
            </>
          }
        />

        {overdue.length > 0 && (
          <Banner
            tone="warning"
            title={`${overdue.length} interview${overdue.length === 1 ? "" : "s"} waiting for an outcome`}
            description="Record what happened so the bidder can move to the next stage."
          />
        )}
        {notice && <Banner tone="success" title={notice} />}

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Interviews this week"
            value={thisWeek}
            icon="calendar"
            footnote={`${upcoming.length} coming up next`}
          />
          <StatCard
            label="Bidders in interview stage"
            value={inInterview}
            icon="users"
            tone="warning"
            footnote="Waiting on a call or a decision"
          />
          <StatCard
            label="Advance rate"
            value={held.length ? percent(ratio(advanced, held.length)) : "—"}
            icon="check"
            tone="success"
            footnote={`${advanced} of ${held.length} completed advanced`}
          />
          <StatCard
            label="No-shows"
            value={noShows}
            icon="clock"
            tone={noShows ? "danger" : "success"}
            footnote="Bidders who missed the call"
          />
        </div>

        <div className="hx-split">
          <Panel
            title="Calendar"
            subtitle={`Working ${profile.availability.startHour}:00–${profile.availability.endHour}:00 · ${profile.availability.timezone}`}
            flush
          >
            <div className="hx-calendar">
              <Calendar
                value={selected}
                onChange={setSelected}
                events={events}
                eventDisplay="chips"
                views={["month", "week", "day", "agenda"]}
                defaultView="month"
                hours={HOURS}
                weekStartsOn={1}
              />
            </div>
          </Panel>

          <div className="hx-stack">
            <Panel
              title={selected.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              subtitle={`${dayList.length} interview${dayList.length === 1 ? "" : "s"}`}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  label="Book this day"
                  onClick={() => setScheduling(true)}
                />
              }
            >
              {dayList.length ? (
                <div className="hx-stack">
                  {dayList.map((item) => (
                    <InterviewRow
                      key={item.id}
                      interview={item}
                      onReschedule={setRescheduling}
                      onOutcome={setOutcomeFor}
                      onCancel={(target) => cancelInterview(target.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  icon="calendar"
                  title="Nothing scheduled"
                  description="Pick a bidder from the pipeline to book time."
                />
              )}
            </Panel>
            <Panel title="Coming up" subtitle="Your next interviews">
              {upcoming.length ? (
                <div className="hx-stack">
                  {upcoming.map((item) => (
                    <InterviewRow
                      key={item.id}
                      interview={item}
                      showDate
                      onReschedule={setRescheduling}
                      onOutcome={setOutcomeFor}
                      onCancel={(target) => cancelInterview(target.id)}
                    />
                  ))}
                </div>
              ) : (
                <span className="hx-muted">No upcoming interviews.</span>
              )}
            </Panel>
          </div>
        </div>

        {scheduling && (
          <ScheduleDialog
            open
            onClose={() => setScheduling(false)}
            inquiryId={params.get("schedule") ?? undefined}
            date={selectedYmd}
            onDone={setNotice}
          />
        )}
        {rescheduling && (
          <ScheduleDialog
            key={rescheduling.id}
            open
            onClose={() => setRescheduling(null)}
            date={rescheduling.date}
            editing={rescheduling}
            onDone={setNotice}
          />
        )}
        <OutcomeDialog
          key={`outcome-${outcomeFor?.id ?? "none"}`}
          interview={outcomeFor}
          onClose={() => setOutcomeFor(null)}
        />
      </div>
    </PageBody>
  );
}
