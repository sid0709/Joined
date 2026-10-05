import { Badge, Heading, JobCard, Spinner, Stack, Text } from "@joined/design-system";

import type { DetectedJobState } from "../hooks/detectedJob";
import { COPY, jobBoardLabel, jobMetaLine, previewText } from "./copy";

export function detectedJobHeading(state: DetectedJobState): string {
  switch (state.status) {
    case "loading":
      return COPY.LOOKING_FOR_JOB;
    case "empty":
      return COPY.NO_JOB_FOUND;
    case "found":
      return COPY.DETECTED_JOB;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function DetectedJobPanel({ state }: { state: DetectedJobState }) {
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
      </JobCard>
    </Stack>
  );
}
