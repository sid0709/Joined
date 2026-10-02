"use client";

import { useState } from "react";
import { AlertDialog, Banner, Button, PageHeader, Stack, StatGrid } from "@joined/design-system";
import { TempJobsBrowser } from "@/components/jobs/temp-jobs-browser";
import { MigrationStep } from "@/components/migration/migration-step";
import { ModelBanner } from "@/components/migration/model-banner";
import { formatCount } from "@/lib/format";
import {
  isRunning,
  MAX_MIGRATION_SELECTION,
  MIGRATION_TASKS,
  remaining,
  type MigrationStart,
  type MigrationTask,
} from "@/lib/migration";
import { useMigration } from "@/lib/use-migration";

const { copyJobs, analyzeJobs } = MIGRATION_TASKS;

/** Copy Athens jobs into temp_jobs, then turn them into public jobs with DeepSeek. */
export function JobMigration() {
  const { status, error, finished, start, cancel } = useMigration();
  const [confirm, setConfirm] = useState<"copy" | "redo" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const busy = isRunning(runs[copyJobs]) || isRunning(runs[analyzeJobs]);
  const model = status?.model || "DeepSeek";
  const pending = counts ? remaining(counts.tempJobs, counts.analyzedJobs) : 0;

  async function run(task: MigrationTask, body?: MigrationStart) {
    setNotice(null);
    setConfirm(null);
    try {
      await start(task, body);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not start the step");
    }
  }

  async function stop(task: MigrationTask) {
    try {
      await cancel(task);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not stop the step");
    }
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Job migration"
        description={`Copy ${counts?.jobSource ?? "AthensDB.jobs"} into ${counts?.jobDestination ?? "JoinedDB.temp_jobs"} as is, then analyze the copies into public jobs with ${model}.`}
      />
      <ModelBanner status={status} />
      {error ? <Banner status="error" title={error} /> : null}
      {notice ? <Banner status="error" title={notice} /> : null}
      {counts ? (
        <StatGrid
          stats={[
            { label: "Athens jobs", value: formatCount(counts.sourceJobs), hint: counts.jobSource },
            {
              label: "Temp jobs",
              value: formatCount(counts.tempJobs),
              hint: counts.jobDestination,
            },
            {
              label: "Analyzed",
              value: formatCount(counts.analyzedJobs),
              hint: "Public job records",
            },
            { label: "Waiting", value: formatCount(pending), hint: "Temp jobs not analyzed yet" },
          ]}
        />
      ) : null}
      <MigrationStep
        title="1. Copy jobs"
        description="Replaces temp_jobs with a fresh copy of every Athens job, written in parallel batches. Analyzed and scouted jobs are not affected."
        run={runs[copyJobs]}
        onCancel={() => stop(copyJobs)}
        actions={
          <Button
            label="Copy jobs"
            variant="primary"
            isDisabled={busy}
            clickAction={() => setConfirm("copy")}
          />
        }
      />
      <MigrationStep
        title="2. Analyze with AI"
        description={`${model} reads each job's description into the Joined job schema, many jobs at once. Jobs without a description are skipped; failed ones stay waiting for the next run.`}
        run={runs[analyzeJobs]}
        onCancel={() => stop(analyzeJobs)}
        actions={
          <>
            <Button
              label="Re-analyze all"
              variant="secondary"
              isDisabled={busy || !status?.modelReady}
              clickAction={() => setConfirm("redo")}
            />
            <Button
              label={pending ? `Analyze ${formatCount(pending)} waiting` : "Analyze waiting"}
              variant="primary"
              isDisabled={busy || !status?.modelReady || pending === 0}
              clickAction={() => run(analyzeJobs)}
            />
          </>
        }
      />
      <TempJobsBrowser
        layout="section"
        description={`Or pick listings and analyze just those with ${model}. Finished records appear on Jobs.`}
        maxSelection={MAX_MIGRATION_SELECTION}
        refreshKey={finished}
        onAnalyze={async (ids) => {
          await start(analyzeJobs, { tempJobIds: ids });
          return {
            status: "success",
            title: `Analyzing ${formatCount(ids.length)} jobs. Progress shows under Analyze with AI.`,
          };
        }}
      />
      <AlertDialog
        isOpen={confirm === "copy"}
        onOpenChange={(open) => setConfirm(open ? "copy" : null)}
        title="Replace every temp job?"
        description={`This replaces ${counts?.jobDestination ?? "temp_jobs"} with a fresh copy of ${counts?.jobSource ?? "the Athens jobs"}. Analyzed jobs and scouted jobs are not affected.`}
        actionLabel="Replace temp jobs"
        actionVariant="destructive"
        onAction={() => run(copyJobs)}
      />
      <AlertDialog
        isOpen={confirm === "redo"}
        onOpenChange={(open) => setConfirm(open ? "redo" : null)}
        title="Analyze every temp job again?"
        description={`This sends all ${formatCount(counts?.tempJobs ?? 0)} temp jobs to ${model} again and replaces their public records, including ones already analyzed.`}
        actionLabel="Re-analyze all"
        onAction={() => run(analyzeJobs, { redo: true })}
      />
    </Stack>
  );
}
