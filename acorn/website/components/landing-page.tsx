import {
  Badge,
  BrandFooter,
  Button,
  Code,
  HStack,
  Heading,
  PageContainer,
  PageHeader,
  SectionCard,
  Stack,
  Text,
} from "@joined/design-system";
import { BRAND } from "@/lib/config";
import { INSTALL_HREF, INSTALL_SECTION_ID, ROUTES } from "@/lib/routes";
import { SiteHeader } from "./site-header";

const COMING_NEXT = [
  {
    title: "Profile",
    description: "Edit the same profile the Acorn extension already reads.",
  },
  {
    title: "Resume library",
    description: "Upload and manage resumes in the same storage the extension uses.",
  },
  {
    title: "Billing",
    description: "Choose a plan and manage Acorn billing from this site.",
  },
] as const;

export function LandingPage({ signedIn, installHref }: { signedIn: boolean; installHref: string }) {
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader signedIn={signedIn} />
        <Stack gap={4}>
          <Badge label="Browser extension" variant="blue" />
          <PageHeader
            title={`${BRAND} fills applications from your resume.`}
            description="Sign in with the same Joined session the extension already uses. Profile, resume, and billing pages will land here."
            action={
              <HStack gap={3} wrap="wrap">
                <Button
                  label={signedIn ? "Go to sign-in" : "Sign in"}
                  variant="primary"
                  size="lg"
                  href={ROUTES.signIn}
                />
                <Button
                  label="Install the extension"
                  variant="secondary"
                  size="lg"
                  href={installHref}
                />
              </HStack>
            }
          />
        </Stack>
        <SectionCard
          title="Coming next"
          description="This scaffold is ready for the later Acorn website pages."
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
              Until a listing URL is configured, this note is the install target. The extension
              signs in with the Joined <Code>joined_session</Code> cookie.
            </Text>
            {installHref !== INSTALL_HREF ? (
              <Button label="Open the install page" variant="secondary" href={installHref} />
            ) : null}
          </Stack>
        </SectionCard>
        <BrandFooter lead={`${BRAND} is part of`} />
      </Stack>
    </PageContainer>
  );
}
