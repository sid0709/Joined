import { BrandFooter, Button, EmptyState, PageContainer } from "sid-ui";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <AppFrame header={<ScoutHeader />}>
      <PageContainer>
        <EmptyState
          title="That page is not here"
          description="The link may be wrong, or the submission belongs to another account."
          actions={<Button label="Back to overview" variant="primary" href={ROUTES.dashboard} />}
        />
        <BrandFooter lead={`${BRAND} is part of`} />
      </PageContainer>
    </AppFrame>
  );
}
