import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Stack } from "@joined/design-system";
import { HiringProfileWorkspace } from "@/components/company/profile/hiring-profile-workspace";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { COMPANY_ABOUT_PAGE, COMPANY_PROFILE_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_PROFILE_PAGE.label };

/** You, not the company. The company's public page has its own editor. */
export default async function CompanyProfilePage() {
  const session = await loadSession();
  if (!session) redirect(signInHref(ROUTES.companyProfile));
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_PROFILE_PAGE.label}
        description={COMPANY_PROFILE_PAGE.description}
        action={
          <Button label="Edit company page" variant="secondary" href={COMPANY_ABOUT_PAGE.href} />
        }
      />
      <HiringProfileWorkspace session={session} />
    </Stack>
  );
}
