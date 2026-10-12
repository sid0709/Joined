"use client";

import { useState } from "react";
import { AlertDialog, Banner, Button, Link, PageHeader, Stack, StatGrid, Switch } from "sid-ui";
import { TempCompaniesBrowser } from "@/components/companies/temp-companies-browser";
import { MigrationStep } from "@/components/migration/migration-step";
import { ModelBanner } from "@/components/migration/model-banner";
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
  const [webSearch, setWebSearch] = useState(true);

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const researching = isRunning(runs[researchCompanies]);
  const model = status?.model || "the default model";
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
        description={
          webSearch
            ? `${model} searches the web for each staged company, busiest first and many at once, and fills in its about, industry, size, founding year, headquarters, offices, values, and benefits. Each company it finds is published to the directory right away; ones it cannot find stay staged as not found. It only fills blank fields, so admin edits stay, and answers that did not come from a web search are thrown away.`
            : `${model} fills each staged company from what it already knows, without web search, busiest first and many at once. Each company it can describe is published to the directory right away; ones it leaves blank stay staged as not found. It only fills blank fields, so admin edits stay.`
        }
        run={runs[researchCompanies]}
        onCancel={() => stop(researchCompanies)}
        actions={
          <>
            <Button
              label={notFound ? `Retry ${formatCount(notFound)} not found` : "Retry not found"}
              variant="secondary"
              isDisabled={researching || !status?.modelReady || waiting + notFound === 0}
              clickAction={() => setConfirmRedo(true)}
            />
            <Button
              label={waiting ? `Research ${formatCount(waiting)} waiting` : "Research waiting"}
              variant="primary"
              isDisabled={researching || !status?.modelReady || waiting === 0}
              clickAction={() => run(researchCompanies, { webSearch })}
            />
          </>
        }
      >
        <Switch
          label="Web search"
          description="The model searches the live web before it answers. Off, it uses what it already knows and leaves a field empty when it is not sure."
          value={webSearch}
          onChange={setWebSearch}
          isDisabled={researching}
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
          await start(researchCompanies, { companyIds: ids, webSearch });
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
        description={
          webSearch
            ? `This searches the web again for the ${formatCount(notFound)} not found, along with the ${formatCount(waiting)} still waiting. It still only fills blank fields.`
            : `This asks ${model} again, without web search, for the ${formatCount(notFound)} not found, along with the ${formatCount(waiting)} still waiting. It still only fills blank fields.`
        }
        actionLabel="Retry"
        onAction={() => run(researchCompanies, { redo: true, webSearch })}
      />
    </Stack>
  );
}
