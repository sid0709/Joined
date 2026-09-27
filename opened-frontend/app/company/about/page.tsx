import type { Metadata } from "next";
import { Card, MetadataList, MetadataListItem, Stack } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { companyBySlug, jobsForCompany } from "@/lib/jobs";
import { COMPANY_ABOUT_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_ABOUT_PAGE.label };

const COMPANY = companyBySlug("northwind");

export default function CompanyAboutPage() {
  const openJobs = COMPANY ? jobsForCompany(COMPANY.slug).length : 0;

  return (
    <Stack gap={5} maxWidth={720}>
      <PageHeader title={COMPANY_ABOUT_PAGE.label} description={COMPANY_ABOUT_PAGE.description} />
      <Card>
        <MetadataList columns="single" label={{ position: "start", width: 140 }}>
          <MetadataListItem label="Name">{COMPANY?.name}</MetadataListItem>
          <MetadataListItem label="Locations">{COMPANY?.locations}</MetadataListItem>
          <MetadataListItem label="About">{COMPANY?.about}</MetadataListItem>
          <MetadataListItem label="Open jobs">{openJobs}</MetadataListItem>
          <MetadataListItem label="Claim status">Verified</MetadataListItem>
        </MetadataList>
      </Card>
    </Stack>
  );
}
