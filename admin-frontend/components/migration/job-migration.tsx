"use client";

import { useState } from "react";
import { AlertDialog, Banner, Button, PageHeader, Stack, StatGrid } from "sid-ui";
import { TempJobsBrowser } from "@/components/jobs/temp-jobs-browser";
import { AnalyzeApproachFields, useAnalyzeApproach } from "@/components/migration/analyze-approach";
import { MigrationStep } from "@/components/migration/migration-step";
import { ModelBanner } from "@/components/migration/model-banner";
import { jobRedoDescription } from "@/lib/analyze-approach";
import { formatCount } from "@/lib/format";
import { TEMP_JOBS_REMOVE_PATH } from "@/lib/jobs";
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
  const analyze = useAnalyzeApproach("job", status?.model ?? "");

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const analyzing = isRunning(runs[analyzeJobs]);
  const model = analyze.model || status?.model || "the default model";
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
        description={analyze.description}
        run={runs[analyzeJobs]}
        onCancel={() => stop(analyzeJobs)}
        actions={
          <>
            <Button
              label="Re-analyze all"
              variant="secondary"
              isDisabled={analyzing || !status?.modelReady || !analyze.canRun}
              clickAction={() => setConfirmRedo(true)}
            />
            <Button
              label={pending ? `Analyze ${formatCount(pending)} waiting` : "Analyze waiting"}
              variant="primary"
              isDisabled={analyzing || !status?.modelReady || !analyze.canRun || pending === 0}
              clickAction={() => run(analyzeJobs, analyze.startBody)}
            />
          </>
        }
      >
        {analyze.catalogError ? <Banner status="error" title={analyze.catalogError} /> : null}
        <AnalyzeApproachFields
          kind="job"
          approach={analyze.approach}
          onApproach={analyze.setApproach}
          model={analyze.model}
          onModel={analyze.setChosen}
          laneModels={analyze.laneModels}
          webSearch={analyze.webSearch}
          onWebSearch={analyze.setWebSearch}
          disabled={analyzing}
          catalogError={analyze.catalogError}
        />
      </MigrationStep>
      <TempJobsBrowser
        layout="section"
        description={`Or pick listings and analyze just those with ${model}. Finished records appear on Jobs.`}
        maxSelection={MAX_MIGRATION_SELECTION}
        removePath={TEMP_JOBS_REMOVE_PATH}
        pageSizes={MIGRATION_PAGE_SIZES}
        refreshKey={finished}
        onAnalyze={async (ids) => {
          if (!analyze.canRun) throw new Error("Pick a model for this approach.");
          await start(analyzeJobs, { tempJobIds: ids, ...analyze.startBody });
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
        description={jobRedoDescription(
          analyze.approach,
          model,
          formatCount(counts?.tempJobs ?? 0),
        )}
        actionLabel="Re-analyze all"
        onAction={() => run(analyzeJobs, { redo: true, ...analyze.startBody })}
      />
    </Stack>
  );
}
