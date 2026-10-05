import { Timeline, type TimelineItem, type TimelineTone } from "sid-ui";

import type { ApplicationRecord, ApplicationStatus } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { Panel } from "@/src/shared/kit/Panel";
import { dayKey, relativeTime } from "@/src/shared/lib/format";
import { MOCK_NOW } from "@/src/shared/mock/clock";
import { POOL_BY_ID } from "@/src/shared/mock/pool";

const EVENT_LIMIT = 30;

const VERB: Record<ApplicationStatus, string> = {
  queued: "was assigned to",
  in_progress: "started",
  submitted: "submitted",
  qa_passed: "passed QA for",
  returned: "had a returned application for",
  failed: "could not complete",
};

const TONE: Record<ApplicationStatus, TimelineTone> = {
  queued: "neutral",
  in_progress: "accent",
  submitted: "accent",
  qa_passed: "success",
  returned: "warning",
  failed: "danger",
};

function groupFor(iso: string) {
  const today = dayKey(MOCK_NOW);
  const yesterday = dayKey(MOCK_NOW.getTime() - 24 * 60 * 60 * 1000);
  const key = dayKey(iso);
  return key === today ? "Today" : key === yesterday ? "Yesterday" : "Earlier this week";
}

/** A live feed of what bidders just did, newest first. */
export function ActivityTab({ apps }: { apps: ApplicationRecord[] }) {
  const { bidderById } = useHunter();
  const items: TimelineItem[] = apps
    .filter((app) => app.status !== "queued")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, EVENT_LIMIT)
    .map((app) => {
      const job = POOL_BY_ID.get(app.jobId);
      return {
        id: app.id,
        title: `${bidderById(app.bidderId)?.name ?? "Bidder"} ${VERB[app.status]} ${job?.company ?? "a job"}`,
        description: `${job?.title ?? ""}${app.issue ? ` · ${app.issue}` : ""}`,
        time: relativeTime(app.updatedAt),
        tone: TONE[app.status],
        group: groupFor(app.updatedAt),
      };
    });

  return (
    <Panel title="Live activity" subtitle="The latest 30 events across your bidders">
      <Timeline items={items} variant="rail" label="Bidder activity" />
    </Panel>
  );
}
