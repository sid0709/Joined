import { Avatar, EmptyState, Glyph, Timeline, type TimelineItem } from "@joined/design-system";
import { daysBetween, formatDay, type Day } from "@/lib/workspace/dates";
import type { Upcoming } from "@/lib/workspace/stats";

const THIS_WEEK = 7;

function when(on: Day, today: Day) {
  const days = daysBetween(today, on);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatDay(on);
}

/** Interviews on the calendar, soonest first. */
export function ComingUp({ interviews, today }: { interviews: Upcoming[]; today: Day }) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        isCompact
        icon={<Glyph name="calendar" />}
        title="No interviews scheduled"
        description="Interview requests from Gmail land here."
      />
    );
  }
  const items: TimelineItem[] = interviews.map((interview) => ({
    id: interview.id,
    title: interview.company,
    description: `${interview.role} · with ${interview.contact}`,
    time: when(interview.on, today),
    marker: <Avatar name={interview.company} size={24} />,
    tone: daysBetween(today, interview.on) <= 1 ? "warning" : "accent",
    status: "upcoming",
    group: daysBetween(today, interview.on) < THIS_WEEK ? "This week" : "Later",
  }));
  return <Timeline label="Upcoming interviews" items={items} variant="activity" />;
}
