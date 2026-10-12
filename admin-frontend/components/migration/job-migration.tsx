"use client";

import { useState } from "react";
import { AlertDialog, Banner, Button, PageHeader, Stack, StatGrid, Switch } from "sid-ui";
import { TempJobsBrowser } from "@/components/jobs/temp-jobs-browser";
import { MigrationStep } from "@/components/migration/migration-step";
import { ModelBanner } from "@/components/migration/model-banner";
import { formatCount } from "@/lib/format";
import {
  isRunning,
  MAX_MIGRATION_SELECTION,
  MIGRATION_PAGE_SIZES,
  MIGRATION_TASKS,
  remaining,
  type MigrationStart,
  type MigrationTask,
} from "@/lib/migration";
import { useMigration } from "@/lib/use-migration";

const { analyzeJobs } = MIGRATION_TASKS;

/**
 * Jobs the crawler and plugin stage in temp_jobs. Analysis publishes each job it can
 * describe well enough to the job pool and drops it from temp_jobs.
 */
export function JobMigration() {
  const { status, error, finished, start, cancel } = useMigration();
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(true);

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const analyzing = isRunning(runs[analyzeJobs]);
  const model = status?.model || "the default model";
  const notPublishable = counts?.notPublishableJobs ?? 0;
  // Published jobs leave temp_jobs, so every temp job not marked is still waiting.
  const pending = counts ? remaining(counts.tempJobs, notPublishable) : 0;

  async function run(task: MigrationTask, body?: MigrationStart) {
    setNotice(null);
    setConfirmRedo(false);
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
        title="Temp jobs"
        description={`Jobs the crawler and plugin stage in ${counts?.jobDestination ?? "temp_jobs"}. Analyze them with ${model}. Jobs analysis can describe well enough are published to the job pool.`}
      />
      <ModelBanner status={status} />
      {error ? <Banner status="error" title={error} /> : null}
      {notice ? <Banner status="error" title={notice} /> : null}
      {counts ? (
        <StatGrid
          stats={[
            {
              label: "Waiting",
              value: formatCount(pending),
              hint: `In ${counts.jobDestination}, not analyzed yet`,
            },
            {
              label: "Not publishable",
              value: formatCount(notPublishable),
              hint: "Analysis left out too much",
            },
            {
              label: "Published",
              value: formatCount(counts.analyzedJobs),
              hint: "In the job pool",
            },
          ]}
        />
      ) : null}
      <MigrationStep
        title="Analyze with AI"
        description={`${model} reads each job's description into the Joined job schema, many jobs at once, and publishes each job whose analysis has a real title and company, a summary, its duties or requirements, and its skills. Published jobs are removed from temp_jobs. Jobs it cannot describe that well, or without a description, are marked not publishable; failed ones stay waiting for the next run.`}
        run={runs[analyzeJobs]}
        onCancel={() => stop(analyzeJobs)}
        actions={
          <>
            <Button
              label="Re-analyze all"
              variant="secondary"
              isDisabled={analyzing || !status?.modelReady}
              clickAction={() => setConfirmRedo(true)}
            />
            <Button
              label={pending ? `Analyze ${formatCount(pending)} waiting` : "Analyze waiting"}
              variant="primary"
              isDisabled={analyzing || !status?.modelReady || pending === 0}
              clickAction={() => run(analyzeJobs, { webSearch })}
            />
          </>
        }
      >
        <Switch
          label="Web search"
          description="The model searches the live web before it answers, including for a salary the posting leaves out. Off, it only uses the posting."
          value={webSearch}
          onChange={setWebSearch}
          isDisabled={analyzing}
        />
      </MigrationStep>
      <TempJobsBrowser
        layout="section"
        description={`Or pick listings and analyze just those with ${model}. Finished records appear on Jobs.`}
        maxSelection={MAX_MIGRATION_SELECTION}
        pageSizes={MIGRATION_PAGE_SIZES}
        refreshKey={finished}
        onAnalyze={async (ids) => {
          await start(analyzeJobs, { tempJobIds: ids, webSearch });
          return {
            status: "success",
            title: `Analyzing ${formatCount(ids.length)} jobs. Progress shows under Analyze with AI.`,
          };
        }}
      />
      <AlertDialog
        isOpen={confirmRedo}
        onOpenChange={setConfirmRedo}
        title="Analyze every temp job again?"
        description={`This sends all ${formatCount(counts?.tempJobs ?? 0)} temp jobs to ${model} again, including ones marked not publishable, and publishes those it can. Published jobs have already left temp jobs.`}
        actionLabel="Re-analyze all"
        onAction={() => run(analyzeJobs, { redo: true, webSearch })}
      />
    </Stack>
  );
}
