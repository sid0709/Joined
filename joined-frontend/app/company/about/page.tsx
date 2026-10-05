import type { Metadata } from "next";
import { Stack } from "sid-ui";
import { CompanyPageEditor } from "@/components/company/about/company-page-editor";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { canManageCompany, COMPANY_PAGE_VIEW_NOTE } from "@/lib/company/access";
import { COMPANY_ABOUT_PAGE, ROUTES } from "@/lib/routes";
import { CandidateViewButton } from "@/components/company/candidate-view-button";

export const metadata: Metadata = { title: COMPANY_ABOUT_PAGE.label };

export default async function CompanyAboutPage() {
  const session = await loadSession();
  if (!session?.company) return null;
  const canEdit = canManageCompany(session.company);
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_ABOUT_PAGE.label}
        description={canEdit ? COMPANY_ABOUT_PAGE.description : COMPANY_PAGE_VIEW_NOTE}
        action={
          <CandidateViewButton
            label="View as candidate"
            href={ROUTES.companyPublic(session.company.id)}
          />
        }
      />
      <CompanyPageEditor company={session.company} canEdit={canEdit} />
    </Stack>
  );
}
