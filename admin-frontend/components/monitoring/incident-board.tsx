"use client";

import { useState } from "react";
import { Banner, Button, EmptyState, PageHeader, Skeleton, Stack } from "sid-ui";
import { sortIncidents, STATUS_INCIDENTS_PATH, type IncidentList } from "@/lib/status-incidents";
import { useAdminQuery } from "@/lib/use-admin-query";
import { IncidentItem } from "./incident-item";
import { NewIncidentForm } from "./new-incident-form";

/** Staff write the incidents joinedhq.com/status shows: open, update, resolve. */
export function IncidentBoard({ statusPageUrl }: { statusPageUrl: string | null }) {
  const { result, loading, error, reload } = useAdminQuery<IncidentList>(STATUS_INCIDENTS_PATH);
  const [creating, setCreating] = useState(false);
  const incidents = result ? sortIncidents(result.incidents) : [];

  return (
    <Stack gap={5}>
      <PageHeader
        title="Status incidents"
        description="What people read on the public status page. Up and down is measured on its own; incidents explain it."
        action={
          <Stack gap={2}>
            {statusPageUrl ? (
              <Button label="Open status page" variant="ghost" href={statusPageUrl} />
            ) : null}
            {!creating ? (
              <Button
                label="New incident"
                variant="primary"
                isDisabled={!result}
                clickAction={() => setCreating(true)}
              />
            ) : null}
          </Stack>
        }
      />
      {error ? (
        <Banner status="error" title="Could not load incidents" description={error} />
      ) : null}
      {creating && result ? (
        <NewIncidentForm
          components={result.components}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}
      {!result && loading ? <Skeleton height={240} /> : null}
      {result && incidents.length === 0 ? (
        <EmptyState
          title="No incidents in the last 90 days"
          description="Post one when something people notice is broken or slow."
        />
      ) : null}
      {result
        ? incidents.map((incident) => (
            <IncidentItem
              key={`${incident.id}-${incident.updatedAt}`}
              incident={incident}
              components={result.components}
              onChanged={reload}
            />
          ))
        : null}
    </Stack>
  );
}
