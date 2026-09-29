import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { CompanyPageEditor } from "@/components/company/about/company-page-editor";
import { PageHeader } from "@/components/page-header";
import { WORKSPACE } from "@/lib/company";
import { COMPANY_ABOUT_PAGE, ROUTES } from "@/lib/routes";
import { CandidateViewButton } from "@/components/company/candidate-view-button";

export const metadata: Metadata = { title: COMPANY_ABOUT_PAGE.label };

export default function CompanyAboutPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_ABOUT_PAGE.label}
        description={COMPANY_ABOUT_PAGE.description}
        action={
          <CandidateViewButton
            label="View as candidate"
            href={ROUTES.companyPublic(WORKSPACE.slug)}
          />
        }
      />
      <CompanyPageEditor />
    </Stack>
  );
}
