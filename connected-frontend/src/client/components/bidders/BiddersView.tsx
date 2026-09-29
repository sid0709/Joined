"use client";

import { useMemo, useState } from "react";

import type { HiringStage, Interview } from "@/src/client/types/hunter";

import { BidderDrawer } from "@/src/client/components/bidders/BidderDrawer";
import { PipelineBoard } from "@/src/client/components/bidders/PipelineBoard";
import { PipelineList } from "@/src/client/components/bidders/PipelineList";
import { OutcomeDialog } from "@/src/client/components/interviews/OutcomeDialog";
import { ScheduleDialog } from "@/src/client/components/interviews/ScheduleDialog";
import { PageHeader } from "@/src/client/components/ui/PageHeader";
import { StatCard } from "@/src/client/components/ui/StatCard";
import { Tabs } from "@/src/client/components/ui/Tabs";
import { useHunter } from "@/src/client/context/HunterContext";
import { MOCK_TODAY } from "@/src/client/data/clock";
import { STAGE_TITLE } from "@/src/client/data/pipeline";
import { percent, ratio } from "@/src/client/lib/format";
import { Banner, Button, Checkbox, Input, PageBody, Select } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

type ViewKey = "board" | "list";

export function BiddersView() {
  const { inquiries, tasks, bidderById } = useHunter();
  const [view, setView] = useState<ViewKey>("board");
  const [taskFilter, setTaskFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [byTask, setByTask] = useState(false);
  const [showDeclined, setShowDeclined] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Interview | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<Interview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      inquiries.filter((item) => {
        const bidder = bidderById(item.bidderId);
        return (
          (taskFilter === "all" || item.taskId === taskFilter) &&
          `${bidder?.name} ${bidder?.specialties.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [inquiries, taskFilter, query, bidderById],
  );

  const count = (stage: HiringStage) => inquiries.filter((item) => item.stage === stage).length;
  const decided = inquiries.filter(
    (item) => item.stage === "connected" || item.stage === "declined",
  ).length;
  const slots = tasks
    .filter((task) => task.status === "in_progress" || task.status === "open")
    .reduce((sum, task) => sum + task.bidderSlots, 0);

  const handleMoved = (inquiryId: string, from: HiringStage, to: HiringStage) => {
    const inquiry = inquiries.find((item) => item.id === inquiryId);
    const name = inquiry && bidderById(inquiry.bidderId)?.name;
    setNotice(`${name} moved from ${STAGE_TITLE[from]} to ${STAGE_TITLE[to]}.`);
    if (to === "interview" && inquiry) setScheduleFor(inquiryId);
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Bidder management"
          title="Hire your bidders"
          description="Every bidder who contacts you enters a hiring pipeline. Screen them, interview them, run a paid trial, then connect. Drag a bidder between stages to move them along."
          actions={
            <>
              <Button
                href={HUNTER_ROUTES.interviews}
                variant="secondary"
                label="Interview calendar"
              />
              <Button
                variant="primary"
                label="Schedule interview"
                onClick={() => setScheduleFor("")}
              />
            </>
          }
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="In your pipeline"
            value={inquiries.length - decided}
            icon="users"
            footnote={`${count("inquiry")} new · ${count("screening")} screening`}
          />
          <StatCard
            label="Interviews"
            value={count("interview")}
            icon="calendar"
            tone="warning"
            footnote="Booked or waiting on a decision"
          />
          <StatCard
            label="Trial batches"
            value={count("trial")}
            icon="play"
            footnote="Paid samples in progress"
          />
          <StatCard
            label="Connected bidders"
            value={count("connected")}
            icon="check"
            tone="success"
            footnote={`${slots} slots across live tasks · ${percent(ratio(count("connected"), inquiries.length))} hire rate`}
          />
        </div>

        <div className="hx-toolbar">
          <div className="hx-filters">
            <div className="hx-filter-wide">
              <Input
                label="Search bidders"
                placeholder="Name or specialty"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Select
              label="Task"
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value)}
            >
              <option value="all">All tasks</option>
              {tasks
                .filter((task) => inquiries.some((item) => item.taskId === task.id))
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
            </Select>
          </div>
          <div className="hx-row">
            {view === "board" && (
              <Checkbox
                label="Group by task"
                checked={byTask}
                onChange={(event) => setByTask(event.target.checked)}
              />
            )}
            <Checkbox
              label="Show declined"
              checked={showDeclined}
              onChange={(event) => setShowDeclined(event.target.checked)}
            />
            <Tabs
              label="Pipeline view"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: "Board" },
                { value: "list", label: "List" },
              ]}
            />
          </div>
        </div>

        {notice && <Banner tone="info" title={notice} />}

        {view === "board" ? (
          <PipelineBoard
            inquiries={visible}
            byTask={byTask}
            showDeclined={showDeclined}
            onOpen={setOpenId}
            onSchedule={setScheduleFor}
            onMoved={handleMoved}
          />
        ) : (
          <PipelineList
            inquiries={visible.filter((item) => showDeclined || item.stage !== "declined")}
            onOpen={setOpenId}
          />
        )}

        <BidderDrawer
          key={`drawer-${openId ?? "none"}`}
          inquiryId={openId}
          onClose={() => setOpenId(null)}
          onSchedule={setScheduleFor}
          onReschedule={setRescheduling}
          onOutcome={setOutcomeFor}
        />
        {scheduleFor !== null && (
          <ScheduleDialog
            key={scheduleFor}
            open
            onClose={() => setScheduleFor(null)}
            inquiryId={scheduleFor || undefined}
            date={MOCK_TODAY}
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
