import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { ApplicantBoard } from "@/components/applicant-board";
import { PageHeader } from "@/components/page-header";
import { COMPANY_APPLICANTS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_APPLICANTS_PAGE.label };

export default function ApplicantsPage() {
  return (
    <Stack gap={5}>
      <PageHeader title={COMPANY_APPLICANTS_PAGE.label} description={COMPANY_APPLICANTS_PAGE.description} />
      <ApplicantBoard />
    </Stack>
  );
}
