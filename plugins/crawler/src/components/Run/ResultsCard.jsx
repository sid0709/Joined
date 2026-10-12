import {
  Badge,
  Card,
  Divider,
  Glyph,
  HStack,
  List,
  ListItem,
  SegmentBar,
  Spinner,
  Text,
  VStack,
} from "sid-ui";

import { hasRunComponent, hasRunStat, RUN_COMPONENT, RUN_STAT } from "../../routineKit/runView";

import { JOB_STATUS, outcomeSegments } from "./runState";

function QueueStatus({ queue }) {
  const pending = queue.queued + queue.saving;
  if (!pending) {
    return (
      <HStack gap={1} align="center">
        <Glyph name="check" className="crawler-tone-success" />
        <Text type="supporting" color="secondary">
          All saved
        </Text>
      </HStack>
    );
  }
  return (
    <HStack gap={1.5} align="center">
      <Spinner size="sm" label="Saving to backend" />
      <Text type="supporting" color="secondary" hasTabularNumbers>
        {queue.queued} queued · {queue.saving} saving
      </Text>
    </HStack>
  );
}

function RecentJobs({ jobs }) {
  if (!jobs.length) {
    return (
      <Text type="supporting" color="secondary">
        Jobs show up here as the routine reads them.
      </Text>
    );
  }
  return (
    <List density="compact" hasDividers>
      {jobs.map((job) => {
        const status = JOB_STATUS[job.status] ?? JOB_STATUS.queued;
        return (
          <ListItem
            key={job.key}
            label={job.title}
            description={job.company || undefined}
            endContent={<Badge variant={status.badge} label={status.label} />}
          />
        );
      })}
    </List>
  );
}

/** Outcomes, queue, and recent jobs — only the stats the routine declared. */
export default function ResultsCard({ stats, queue, recentJobs, routine }) {
  if (!hasRunComponent(routine, RUN_COMPONENT.RESULTS)) return null;
  const showOutcomes = hasRunStat(routine, RUN_STAT.OUTCOMES);
  const showQueue = hasRunStat(routine, RUN_STAT.QUEUE);
  const showRecent = hasRunStat(routine, RUN_STAT.RECENT_JOBS);
  const segments = outcomeSegments(stats);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack align="center" justify="between" gap={2}>
          <Text weight="semibold">Results</Text>
          {showQueue ? <QueueStatus queue={queue} /> : null}
        </HStack>
        {showOutcomes && total ? (
          <SegmentBar segments={segments} unit="jobs" />
        ) : showOutcomes ? (
          <Text type="supporting" color="secondary">
            No results yet. Start a run to fill this in.
          </Text>
        ) : null}
        {showRecent ? (
          <>
            <Divider />
            <Text type="supporting" weight="semibold" color="secondary">
              Recent jobs
            </Text>
            <RecentJobs jobs={recentJobs} />
          </>
        ) : null}
      </VStack>
    </Card>
  );
}
