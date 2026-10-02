"use client";

import { useState } from "react";
import {
  AlertDialog,
  Banner,
  Button,
  Link,
  PageHeader,
  Stack,
  StatGrid,
} from "@joined/design-system";
import { MigrationStep } from "@/components/migration/migration-step";
import { ModelBanner } from "@/components/migration/model-banner";
import { formatCount } from "@/lib/format";
import {
  isRunning,
  MIGRATION_TASKS,
  type MigrationStart,
  type MigrationTask,
} from "@/lib/migration";
import { ROUTES } from "@/lib/nav";
import { useMigration } from "@/lib/use-migration";

const { copyCompanies, researchCompanies } = MIGRATION_TASKS;

/**
 * Copy Athens companies into staging, then research each one on the web with DeepSeek.
 * Research publishes the companies it finds to the directory. The two steps run
 * independently, so research can start while a copy is still running.
 */
export function CompanyMigration() {
  const { status, error, start, cancel } = useMigration();
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const copying = isRunning(runs[copyCompanies]);
  const researching = isRunning(runs[researchCompanies]);
  const model = status?.model || "DeepSeek";
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
        title="Company migration"
        description={`Copy ${counts?.companySource ?? "AthensDB.companies"} into ${staging}, then research each company on the web with ${model}. Companies research finds are published to ${directory} and show in the directory.`}
        action={<Button label="Open companies" variant="secondary" href={ROUTES.companies} />}
      />
      <ModelBanner status={status} />
      {error ? <Banner status="error" title={error} /> : null}
      {notice ? <Banner status="error" title={notice} /> : null}
      {counts ? (
        <StatGrid
          stats={[
            {
              label: "Athens companies",
              value: formatCount(counts.sourceCompanies),
              hint: counts.companySource,
            },
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
        title="1. Copy companies"
        description={`Upserts every Athens company by its Athens id into ${staging} in parallel batches, keeping each company's public id and admin edits. First moves every Athens company research has not published out of ${directory} back to staging, so the directory only holds researched companies. Companies research already published are updated in place. Then links public jobs to their companies. Safe to run again.`}
        run={runs[copyCompanies]}
        onCancel={() => stop(copyCompanies)}
        actions={
          <Button
            label="Copy companies"
            variant="primary"
            isDisabled={copying}
            clickAction={() => run(copyCompanies)}
          />
        }
      />
      <MigrationStep
        title="2. Research with AI"
        description={`${model} searches the web for each staged company, busiest first and many at once, and fills in its about, industry, size, founding year, headquarters, offices, values, and benefits. Each company it finds is published to the directory right away; ones it cannot find stay staged as not found. It only fills blank fields, so admin edits stay, and answers that did not come from a web search are thrown away. It can run while companies are still copying and picks up newly staged ones before it finishes.`}
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
              isDisabled={researching || !status?.modelReady || (waiting === 0 && !copying)}
              clickAction={() => run(researchCompanies)}
            />
          </>
        }
      >
        {runs[researchCompanies]?.status === "succeeded" ? (
          <Link href={ROUTES.companies}>Review published companies</Link>
        ) : null}
      </MigrationStep>
      <AlertDialog
        isOpen={confirmRedo}
        onOpenChange={setConfirmRedo}
        title="Retry companies research could not find?"
        description={`This searches the web again for the ${formatCount(notFound)} not found, along with the ${formatCount(waiting)} still waiting. It still only fills blank fields.`}
        actionLabel="Retry"
        onAction={() => run(researchCompanies, { redo: true })}
      />
    </Stack>
  );
}
