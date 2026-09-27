import { Button, Card, Glyph, HStack, Heading, Stack, Text } from "@openseat/design-system";
import { CompanyLogo } from "@/components/jobs/company-logo";
import type { AuthCompany } from "@/lib/auth/types";
import { ROUTES } from "@/lib/routes";

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
              {company.url || "Hiring workspace"}
            </Text>
          </Stack>
        </HStack>
        <HStack gap={2} wrap="wrap">
          <Button
            label="View public page"
            variant="secondary"
            href={ROUTES.companyPublic(company.id)}
            icon={<Glyph name="eye" />}
          />
        </HStack>
      </HStack>
    </Card>
  );
}
