import { Badge, Button, Heading, JobCard, Spinner, Stack, Text } from "sid-ui";

import type { CapturedJob } from "../capture";
import type { DetectedJobState } from "../hooks/detectedJob";
import {
  detectedJobHeading,
  detectedJobSaveLabel,
  jobBoardLabel,
  jobMetaLine,
  previewText,
} from "./copy";

export function DetectedJobPanel({
  state,
  alreadyQueued,
  onSaveToDrafts,
}: {
  state: DetectedJobState;
  alreadyQueued: boolean;
  onSaveToDrafts: (job: CapturedJob) => void;
}) {
  const heading = detectedJobHeading(state);

  if (state.status === "loading") {
    return (
      <Stack gap={2}>
        <Spinner size="sm" />
        <Text color="secondary">{heading}</Text>
      </Stack>
    );
  }

  if (state.status === "empty") {
    return <Text color="secondary">{heading}</Text>;
  }

  const { job } = state;
  return (
    <Stack gap={2}>
      <Heading level={4}>{heading}</Heading>
      <JobCard title={job.title} meta={jobMetaLine(job)}>
        <Badge label={jobBoardLabel(job.board)} variant="neutral" />
        {job.description ? (
          <Text type="supporting" color="secondary">
            {previewText(job.description)}
          </Text>
        ) : null}
        <Text type="supporting" color="secondary">
          {job.applyUrl}
        </Text>
        <Button
          size="sm"
          variant={alreadyQueued ? "secondary" : "primary"}
          label={detectedJobSaveLabel(alreadyQueued)}
          isDisabled={alreadyQueued}
          onClick={() => onSaveToDrafts(job)}
        />
      </JobCard>
    </Stack>
  );
}
