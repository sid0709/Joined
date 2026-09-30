"use client";

import { useMemo, useState } from "react";

import type { Ats } from "@/src/candidate/types/workspace";

import { TaskBoardCard } from "@/src/candidate/components/TaskBoardCard";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASKS, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { bestRate, slotsLeft } from "@/src/candidate/lib/tasks";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { StatCard } from "@/src/shared/kit/StatCard";
import { Tabs } from "@/src/shared/kit/Tabs";
import { money } from "@/src/shared/lib/format";
import { Button, Input, PageBody, Select } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

type View = "all" | "saved";
type Sort = "newest" | "rate" | "slots";

const ATS_OPTIONS: Ats[] = ["Greenhouse", "Lever", "Ashby", "Workday", "iCIMS", "SmartRecruiters"];

export function TaskBoardView() {
  const { engagementForTask, savedTaskIds, toggleSaved, engagements } = useBidderWorkspace();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [ats, setAts] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BOARD_TASKS.filter((task) => {
      const hunter = HUNTER_BY_ID.get(task.hunterId);
      if (view === "saved" && !savedTaskIds.includes(task.id)) return false;
      if (type !== "all" && task.type !== type) return false;
      if (
        ats !== "all" &&
        !task.packageLines.some((line) =>
          PACKAGE_BY_ID.get(line.packageId)?.ats.includes(ats as Ats),
        )
      )
        return false;
      if (!needle) return true;
      return `${task.title} ${task.summary} ${hunter?.company ?? ""} ${hunter?.name ?? ""}`
        .toLowerCase()
        .includes(needle);
    }).sort((a, b) => {
      if ((a.status === "closed") !== (b.status === "closed"))
        return a.status === "closed" ? 1 : -1;
      if (sort === "rate") return bestRate(b) - bestRate(a);
      if (sort === "slots") return slotsLeft(b) - slotsLeft(a);
      return b.postedAt.localeCompare(a.postedAt);
    });
  }, [view, query, type, ats, sort, savedTaskIds]);

  const open = BOARD_TASKS.filter((task) => task.status !== "closed");
  const talking = engagements.filter((item) =>
    ["contacted", "negotiating"].includes(item.status),
  ).length;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Task board"
          title="Find work that fits your week"
          description="Job hunters post tasks here. Compare pay per link, open a chat with the owner, agree a rate and start receiving links once you are connected."
          actions={
            <>
              <Button href={BIDDER_ROUTES.invitations} variant="secondary" label="Invitations" />
              <Button href={BIDDER_ROUTES.pipeline} variant="primary" label="My pipeline" />
            </>
          }
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Open tasks"
            value={open.length}
            icon="list"
            footnote="Accepting bidders"
          />
          <StatCard
            label="Permanent desks"
            value={open.filter((task) => task.type === "permanent").length}
            icon="users"
            tone="success"
            footnote="Long-term weekly income"
          />
          <StatCard
            label="Highest rate on the board"
            value={money(Math.max(...open.map(bestRate)))}
            icon="star"
            tone="warning"
            footnote="Per submitted link"
          />
          <StatCard
            label="Your open conversations"
            value={talking}
            icon="chat"
            footnote={`${savedTaskIds.length} saved tasks`}
          />
        </div>

        <div className="hx-toolbar">
          <Tabs
            label="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All tasks" },
              { value: "saved", label: `Saved (${savedTaskIds.length})` },
            ]}
          />
        </div>

        <div className="hx-filters">
          <div className="hx-filter-wide">
            <Input
              label="Search tasks"
              placeholder="Search by title, hunter or company"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select
            label="Contract type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="permanent">Permanent desk</option>
            <option value="one_time">One-time batch</option>
          </Select>
          <Select
            label="Application system"
            value={ats}
            onChange={(event) => setAts(event.target.value)}
          >
            <option value="all">Any system</option>
            {ATS_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option value="newest">Newest</option>
            <option value="rate">Highest rate</option>
            <option value="slots">Most open slots</option>
          </Select>
        </div>

        {visible.length ? (
          <div className="hx-grid hx-grid-2">
            {visible.map((task) => {
              const hunter = HUNTER_BY_ID.get(task.hunterId);
              return hunter ? (
                <TaskBoardCard
                  key={task.id}
                  task={task}
                  hunter={hunter}
                  engagement={engagementForTask(task.id)}
                  saved={savedTaskIds.includes(task.id)}
                  onToggleSaved={() => toggleSaved(task.id)}
                />
              ) : null;
            })}
          </div>
        ) : (
          <EmptyBlock
            icon="search"
            title={view === "saved" ? "No saved tasks yet" : "No tasks match these filters"}
            description={
              view === "saved"
                ? "Tap the bookmark on any task to keep it here."
                : "Clear the search or try another application system."
            }
          />
        )}
      </div>
    </PageBody>
  );
}
