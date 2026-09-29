import { Button, EmptyState, HStack, PageHeader, Stack } from "@openseat/design-system";
import { ROUTES } from "@/lib/nav";

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
        description="Retention exceptions and connect ops are not a queue yet. Filed reports and create-case live under Trust."
        actions={
          <HStack gap={2} wrap="wrap">
            <Button label="Reports" variant="secondary" href={ROUTES.reports} />
            <Button label="Create case" variant="secondary" href={ROUTES.createCase} />
            <Button label="Cases" variant="ghost" href={ROUTES.cases} />
          </HStack>
        }
      />
    </Stack>
  );
}
