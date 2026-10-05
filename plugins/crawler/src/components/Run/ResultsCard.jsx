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

/** What the run produced: outcomes, the save queue, and the latest jobs. */
export default function ResultsCard({ stats, queue, recentJobs }) {
  const segments = outcomeSegments(stats);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack align="center" justify="between" gap={2}>
          <Text weight="semibold">Results</Text>
          <QueueStatus queue={queue} />
        </HStack>
        {total ? (
          <SegmentBar segments={segments} unit="jobs" />
        ) : (
          <Text type="supporting" color="secondary">
            No results yet. Start a run to fill this in.
          </Text>
        )}
        <Divider />
        <Text type="supporting" weight="semibold" color="secondary">
          Recent jobs
        </Text>
        <RecentJobs jobs={recentJobs} />
      </VStack>
    </Card>
  );
}
