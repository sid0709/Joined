"use client";

import { useState } from "react";
import { AlertDialog, Banner, Button, Link, PageHeader, Stack, StatGrid } from "sid-ui";
import { TempCompaniesBrowser } from "@/components/companies/temp-companies-browser";
import { AnalyzeApproachFields, useAnalyzeApproach } from "@/components/migration/analyze-approach";
import { MigrationStep } from "@/components/migration/migration-step";
import { ModelBanner } from "@/components/migration/model-banner";
import { companyRetryDescription } from "@/lib/analyze-approach";
import { formatCount } from "@/lib/format";
import {
  isRunning,
  MAX_MIGRATION_SELECTION,
  MIGRATION_TASKS,
  type MigrationStart,
  type MigrationTask,
} from "@/lib/migration";
import { ROUTES } from "@/lib/nav";
import { useMigration } from "@/lib/use-migration";

const { researchCompanies } = MIGRATION_TASKS;

/**
 * Companies the crawler could not match wait in temp_companies. Research publishes
 * the ones it finds to the directory.
 */
export function CompanyMigration() {
  const { status, error, finished, start, cancel } = useMigration();
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const analyze = useAnalyzeApproach("company", status?.model ?? "");

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const researching = isRunning(runs[researchCompanies]);
  const model = analyze.model || status?.model || "the default model";
  const staging = counts?.companyStaging ?? "JoinedDB.temp_companies";
  const directory = counts?.companyDestination ?? "JoinedDB.companies";
  const waiting = counts?.waitingCompanies ?? 0;
  const notFound = counts?.notFoundCompanies ?? 0;

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
        title="Temp companies"
        description={`Companies the crawler could not match wait in ${staging}. Research each one with ${model}. Companies research finds are published to ${directory} and show in the directory.`}
        action={<Button label="Open companies" variant="secondary" href={ROUTES.companies} />}
      />
      <ModelBanner status={status} />
      {error ? <Banner status="error" title={error} /> : null}
      {notice ? <Banner status="error" title={notice} /> : null}
      {counts ? (
        <StatGrid
          stats={[
            {
              label: "Waiting",
              value: formatCount(waiting),
              hint: `In ${staging}, not researched yet`,
            },
            {
              label: "Not found",
              value: formatCount(notFound),
              hint: "Research could not find them",
            },
            {
              label: "Published",
              value: formatCount(counts.companies),
              hint: `${counts.companyDestination} · in the directory`,
            },
          ]}
        />
      ) : null}
      <MigrationStep
        title="Research with AI"
        description={analyze.description}
        run={runs[researchCompanies]}
        onCancel={() => stop(researchCompanies)}
        actions={
          <>
            <Button
              label={notFound ? `Retry ${formatCount(notFound)} not found` : "Retry not found"}
              variant="secondary"
              isDisabled={
                researching || !status?.modelReady || !analyze.canRun || waiting + notFound === 0
              }
              clickAction={() => setConfirmRedo(true)}
            />
            <Button
              label={waiting ? `Research ${formatCount(waiting)} waiting` : "Research waiting"}
              variant="primary"
              isDisabled={researching || !status?.modelReady || !analyze.canRun || waiting === 0}
              clickAction={() => run(researchCompanies, analyze.startBody)}
            />
          </>
        }
      >
        {analyze.catalogError ? <Banner status="error" title={analyze.catalogError} /> : null}
        <AnalyzeApproachFields
          kind="company"
          approach={analyze.approach}
          onApproach={analyze.setApproach}
          model={analyze.model}
          onModel={analyze.setChosen}
          laneModels={analyze.laneModels}
          webSearch={analyze.webSearch}
          onWebSearch={analyze.setWebSearch}
          disabled={researching}
          catalogError={analyze.catalogError}
        />
        {runs[researchCompanies]?.status === "succeeded" ? (
          <Link href={ROUTES.companies}>Review published companies</Link>
        ) : null}
      </MigrationStep>
      <TempCompaniesBrowser
        refreshKey={finished}
        maxSelection={MAX_MIGRATION_SELECTION}
        description={`Or pick companies and research just those with ${model}. Export the list, fill empty fields locally, and import the file to publish matches. Ones research or import lands show in the directory.`}
        busy={researching}
        onResearch={async (ids) => {
          if (!analyze.canRun) throw new Error("Pick a model for this approach.");
          await start(researchCompanies, { companyIds: ids, ...analyze.startBody });
          return {
            status: "success",
            title: `Researching ${formatCount(ids.length)} companies. Progress shows under Research with AI.`,
          };
        }}
      />
      <AlertDialog
        isOpen={confirmRedo}
        onOpenChange={setConfirmRedo}
        title="Retry companies research could not find?"
        description={companyRetryDescription(
          analyze.approach,
          model,
          analyze.webSearch,
          formatCount(notFound),
          formatCount(waiting),
        )}
        actionLabel="Retry"
        onAction={() => run(researchCompanies, { redo: true, ...analyze.startBody })}
      />
    </Stack>
  );
}
