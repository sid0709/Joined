import { Card, HStack, Heading, Stack, Text } from "@joined/design-system";
import { CompanyLogo } from "@/components/jobs/company-logo";
import type { AuthCompany } from "@/lib/auth/types";
import { companyRoleLabel } from "@/lib/company/access";
import { ROUTES } from "@/lib/routes";
import { CandidateViewButton } from "@/components/company/candidate-view-button";

const LOGO_SIZE = 64;

/** The workspace’s front door: who you’re hiring for and the two most common actions. */
export function WorkspaceHero({ greeting, company }: { greeting: string; company: AuthCompany }) {
  return (
    <Card padding={6} elevation="low">
      <HStack hAlign="between" vAlign="center" gap={5} wrap="wrap">
        <HStack gap={4} vAlign="center">
          <CompanyLogo
            name={company.name}
            src={company.logo}
            companyId={company.id}
            size={LOGO_SIZE}
          />
          <Stack gap={1}>
            <Text type="supporting" color="secondary">
              {greeting}
            </Text>
            <Heading level={1}>{company.name}</Heading>
            <Text color="secondary" display="block">
              {company.url
                ? `${companyRoleLabel(company)} · ${company.url}`
                : companyRoleLabel(company)}
            </Text>
          </Stack>
        </HStack>
        <HStack gap={2} wrap="wrap">
          <CandidateViewButton label="View as candidate" href={ROUTES.companyPublic(company.id)} />
        </HStack>
      </HStack>
    </Card>
  );
}
