import { EmptyState, PageHeader, Stack } from "@openseat/design-system";

export const metadata = { title: "Retention and ops" };

/** Placeholder only. Docs name connect ops and legal retention, not a staff API. */
export default function RetentionOpsPage() {
  return (
    <Stack gap={5}>
      <PageHeader
        title="Retention and ops"
        description="Legal retention holds and connect ops. No staff route is locked for this surface."
      />
      <EmptyState
        isCompact
        title="Nothing to review"
        description="Retention exceptions and connect ops are not a queue yet. Reports, disputes, and fraud flags stay under Cases."
      />
    </Stack>
  );
}
