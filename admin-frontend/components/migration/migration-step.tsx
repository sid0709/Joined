"use client";

import type { ReactNode } from "react";
import {
  Badge,
  Banner,
  Button,
  Collapsible,
  HStack,
  ProgressBar,
  SectionCard,
  Stack,
  Text,
  type BadgeVariant,
} from "sid-ui";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  isRunning,
  runEta,
  runFinished,
  runTally,
  type MigrationRun,
  type MigrationRunStatus,
} from "@/lib/migration";

const STATUS: Record<MigrationRunStatus, { label: string; badge: BadgeVariant }> = {
  running: { label: "Running", badge: "info" },
  succeeded: { label: "Finished", badge: "success" },
  failed: { label: "Failed", badge: "error" },
  canceled: { label: "Stopped", badge: "warning" },
};

type MigrationStepProps = {
  title: string;
  description: string;
  run?: MigrationRun;
  /** The buttons that start the step; replaced by Stop while it runs. */
  actions: ReactNode;
  onCancel: () => void;
  children?: ReactNode;
};

/** One migration step: what it does, how to start it, and its latest run. */
export function MigrationStep({
  title,
  description,
  run,
  actions,
  onCancel,
  children,
}: MigrationStepProps) {
  const running = isRunning(run);
  return (
    <SectionCard
      title={title}
      description={description}
      action={
        running ? (
          <Button label="Stop" variant="secondary" clickAction={onCancel} />
        ) : (
          <HStack gap={2} wrap="wrap">
            {actions}
          </HStack>
        )
      }
    >
      {children}
      {run ? <RunReport run={run} /> : null}
    </SectionCard>
  );
}

function RunReport({ run }: { run: MigrationRun }) {
  const status = STATUS[run.status];
  const running = isRunning(run);
  const eta = runEta(run);
  return (
    <Stack gap={3}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Badge label={status.label} variant={status.badge} />
        <Text type="supporting" color="secondary">
          {[
            run.model,
            `Started ${formatDateTime(run.startedAt)}`,
            run.finishedAt ? `ended ${formatDateTime(run.finishedAt)}` : eta,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </HStack>
      <ProgressBar
        label={runTally(run)}
        value={runFinished(run)}
        max={Math.max(run.total, 1)}
        hasValueLabel
        isIndeterminate={running && run.total === 0}
        variant={run.status === "failed" ? "error" : run.failed ? "warning" : "accent"}
      />
      {run.summary ? <Text>{run.summary}</Text> : null}
      {run.error ? <Banner status="error" title={run.error} /> : null}
      {run.failures.length ? (
        <Collapsible
          trigger={`Latest failures (${formatCount(run.failures.length)} of ${formatCount(run.failed)})`}
        >
          <Stack gap={1}>
            {run.failures.map((failure, index) => (
              <Text key={`${failure.id}-${index}`} type="supporting" color="secondary">
                {failure.id}: {failure.error}
              </Text>
            ))}
          </Stack>
        </Collapsible>
      ) : null}
    </Stack>
  );
}
