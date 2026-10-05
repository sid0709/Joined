"use client";

import { Badge, Card, Heading, HStack, Link, Section, Skeleton, Stack, Text } from "sid-ui";
import { CompanyMark } from "@/components/jobs/company-mark";
import { COMPANIES_PATH, companyLogoSrc, type AdminCompany } from "@/lib/company";
import { ROUTES } from "@/lib/nav";
import { useAdminQuery } from "@/lib/use-admin-query";

const ABOUT_LINES = 4;

/** The employer on this submission, with logo and page facts — not a name field. */
export function ReviewCompanyCard({
  companyId,
  companyName,
}: {
  companyId?: string;
  companyName: string;
}) {
  if (!companyId) {
    return <CompanyCardBody name={companyName} />;
  }
  return <LoadedCompanyCard companyId={companyId} companyName={companyName} />;
}

function LoadedCompanyCard({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { result, loading } = useAdminQuery<AdminCompany>(
    `${COMPANIES_PATH}/${encodeURIComponent(companyId)}`,
  );
  return (
    <CompanyCardBody
      name={result?.name || companyName}
      company={result}
      companyId={companyId}
      loading={loading}
    />
  );
}

function CompanyCardBody({
  name,
  company,
  companyId,
  loading,
}: {
  name: string;
  company?: AdminCompany | null;
  companyId?: string;
  loading?: boolean;
}) {
  return (
    <Card padding={0}>
      <Section variant="muted" dividers={["bottom"]} padding={5}>
        <HStack gap={3} vAlign="center">
          <CompanyMark name={name} logo={company ? companyLogoSrc(company) : undefined} size="lg" />
          <Stack gap={0.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Heading level={3}>{name}</Heading>
              {company?.industry ? <Badge label={company.industry} variant="neutral" /> : null}
            </HStack>
            {company?.url ? (
              <Link href={company.url} target="_blank">
                {company.url.replace(/^https?:\/\//, "")}
              </Link>
            ) : loading ? (
              <Skeleton width={160} height={14} />
            ) : null}
          </Stack>
        </HStack>
      </Section>
      <Stack gap={3} padding={5}>
        {company?.tagline ? (
          <Text weight="semibold" display="block">
            {company.tagline}
          </Text>
        ) : null}
        {company?.about ? (
          <Text color="secondary" display="block" maxLines={ABOUT_LINES}>
            {company.about}
          </Text>
        ) : null}
        <HStack gap={2} wrap="wrap">
          {company?.size ? (
            <Text type="supporting" color="secondary">
              {company.size} people
            </Text>
          ) : null}
          {company?.headquarters || company?.locations ? (
            <Text type="supporting" color="secondary">
              {[company.headquarters, company.locations].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          {companyId ? (
            <Link href={`${ROUTES.companies}?company=${encodeURIComponent(companyId)}`}>
              Company page
            </Link>
          ) : null}
        </HStack>
      </Stack>
    </Card>
  );
}
