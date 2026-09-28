import { Button, EmptyState, Stack } from "@openseat/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { PageContainer } from "@/components/page-container";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <AppFrame header={<ScoutHeader />}>
      <PageContainer>
        <Stack gap={4}>
          <EmptyState
            title="That page is not here"
            description="The job may have been merged, or the link is wrong."
            actions={<Button label="Back to overview" variant="primary" href={ROUTES.dashboard} />}
          />
        </Stack>
      </PageContainer>
    </AppFrame>
  );
}
