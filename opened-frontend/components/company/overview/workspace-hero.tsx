import { Badge, Button, Card, Glyph, HStack, Heading, Stack, Text } from "@openseat/design-system";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { PostJobButton } from "@/components/post-job-button";
import { WORKSPACE } from "@/lib/company";
import { ROUTES } from "@/lib/routes";

const LOGO_SIZE = 64;

/** The workspace’s front door: who you’re hiring for and the two most common actions. */
export function WorkspaceHero({ greeting }: { greeting: string }) {
  return (
    <Card padding={6} elevation="low">
      <HStack hAlign="between" vAlign="center" gap={5} wrap="wrap">
        <HStack gap={4} vAlign="center">
          <CompanyLogo name={WORKSPACE.name} size={LOGO_SIZE} />
          <Stack gap={1}>
            <Text type="supporting" color="secondary">
              {greeting}
            </Text>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Heading level={1}>{WORKSPACE.name}</Heading>
              {WORKSPACE.verified ? (
                <Badge label="Verified employer" variant="info" icon={<Glyph name="check" />} />
              ) : null}
            </HStack>
            <Text color="secondary" display="block">
              {WORKSPACE.industry} · {WORKSPACE.size} people · {WORKSPACE.locations}
            </Text>
          </Stack>
        </HStack>
        <HStack gap={2} wrap="wrap">
          <Button
            label="View public page"
            variant="secondary"
            href={ROUTES.companyPublic(WORKSPACE.slug)}
            icon={<Glyph name="eye" />}
          />
          <PostJobButton />
        </HStack>
      </HStack>
    </Card>
  );
}
