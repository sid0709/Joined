import {
  Badge,
  Button,
  HStack,
  Heading,
  PageContainer,
  PageHeader,
  SectionCard,
  Stack,
  Text,
} from "@joined/design-system";
import { BRAND } from "@/lib/config";
import { INSTALL_SECTION_ID, ROUTES } from "@/lib/routes";
import { SiteHeader } from "./site-header";

const COMING_NEXT = [
  {
    title: "Profile",
    description: "The name and email on this account are what the extension uses today.",
  },
  {
    title: "Resume library",
    description: "Upload and manage resumes the extension can attach.",
  },
  {
    title: "Billing",
    description: "Choose a plan and manage Acorn billing from this site.",
  },
] as const;

export function LandingPage({
  signedIn,
  accountName,
  installHref,
}: {
  signedIn: boolean;
  accountName: string | null;
  installHref: string;
}) {
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader signedIn={signedIn} />
        <Stack gap={4}>
          <Badge label="Browser extension" variant="blue" />
          <PageHeader
            title={
              signedIn && accountName
                ? `Welcome back, ${accountName}.`
                : `${BRAND} fills applications from your resume.`
            }
            description="Create an Acorn account here. The extension signs in with that same account."
            action={
              <HStack gap={3} wrap="wrap">
                {signedIn ? null : (
                  <>
                    <Button
                      label="Create account"
                      variant="primary"
                      size="lg"
                      href={ROUTES.signUp}
                    />
                    <Button label="Sign in" variant="secondary" size="lg" href={ROUTES.signIn} />
                  </>
                )}
                <Button
                  label="Install the extension"
                  variant={signedIn ? "primary" : "secondary"}
                  size="lg"
                  href={installHref}
                />
              </HStack>
            }
          />
        </Stack>
        <SectionCard
          title="Coming next"
          description="Profile, resumes, and billing land on this site."
        >
          <Stack gap={4}>
            {COMING_NEXT.map((item) => (
              <Stack key={item.title} gap={1}>
                <Heading level={3}>{item.title}</Heading>
                <Text color="secondary">{item.description}</Text>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
        <SectionCard
          title="Install Acorn"
          description="The store listing is not wired yet. Set ACORN_EXTENSION_INSTALL_URL when it is."
        >
          <Stack gap={3} id={INSTALL_SECTION_ID}>
            <Text color="secondary">
              Sign in on this site in the same browser, then open the extension and choose Continue.
            </Text>
          </Stack>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
