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
  remaining,
  type MigrationStart,
  type MigrationTask,
} from "@/lib/migration";
import { ROUTES } from "@/lib/nav";
import { useMigration } from "@/lib/use-migration";

const { copyCompanies, researchCompanies } = MIGRATION_TASKS;

/** Copy Athens companies, then fill in their pages from the web with DeepSeek. */
export function CompanyMigration() {
  const { status, error, start, cancel } = useMigration();
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = status?.counts;
  const runs = status?.runs ?? {};
  const busy = isRunning(runs[copyCompanies]) || isRunning(runs[researchCompanies]);
  const model = status?.model || "DeepSeek";
  const pending = counts ? remaining(counts.companies, counts.researchedCompanies) : 0;

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
        description={`Copy ${counts?.companySource ?? "AthensDB.companies"} into ${counts?.companyDestination ?? "JoinedDB.companies"}, then research each company on the web with ${model}.`}
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
              label: "Joined companies",
              value: formatCount(counts.companies),
              hint: counts.companyDestination,
            },
            {
              label: "Researched",
              value: formatCount(counts.researchedCompanies),
              hint: "Filled in from the web",
            },
            { label: "Waiting", value: formatCount(pending), hint: "Not researched yet" },
          ]}
        />
      ) : null}
      <MigrationStep
        title="1. Copy companies"
        description="Upserts every Athens company by its Athens id in parallel batches, keeps each company's public id and admin edits, then links public jobs to their companies. Safe to run again."
        run={runs[copyCompanies]}
        onCancel={() => stop(copyCompanies)}
        actions={
          <Button
            label="Copy companies"
            variant="primary"
            isDisabled={busy}
            clickAction={() => run(copyCompanies)}
          />
        }
      />
      <MigrationStep
        title="2. Research with AI"
        description={`${model} searches the web for each company, busiest first and many at once, and fills in its about, industry, size, founding year, headquarters, offices, values, and benefits. It only fills blank fields, so admin edits stay. Answers that did not come from a web search are thrown away.`}
        run={runs[researchCompanies]}
        onCancel={() => stop(researchCompanies)}
        actions={
          <>
            <Button
              label="Research all"
              variant="secondary"
              isDisabled={busy || !status?.modelReady}
              clickAction={() => setConfirmRedo(true)}
            />
            <Button
              label={pending ? `Research ${formatCount(pending)} waiting` : "Research waiting"}
              variant="primary"
              isDisabled={busy || !status?.modelReady || pending === 0}
              clickAction={() => run(researchCompanies)}
            />
          </>
        }
      >
        {runs[researchCompanies]?.status === "succeeded" ? (
          <Link href={ROUTES.companies}>Review researched companies</Link>
        ) : null}
      </MigrationStep>
      <AlertDialog
        isOpen={confirmRedo}
        onOpenChange={setConfirmRedo}
        title="Research every company again?"
        description={`This searches the web again for all ${formatCount(counts?.companies ?? 0)} companies. It still only fills blank fields.`}
        actionLabel="Research all"
        onAction={() => run(researchCompanies, { redo: true })}
      />
    </Stack>
  );
}
