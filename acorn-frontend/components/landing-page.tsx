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

const AFTER_SIGN_IN = [
  {
    title: "Statistics",
    description: "See resumes, connected mailboxes, and applications in one place.",
  },
  {
    title: "Profile",
    description: "Set the headline and summary the extension applies with.",
  },
  {
    title: "Resume",
    description: "Generate a draft aimed at a single posting.",
  },
  {
    title: "Gmail",
    description: "Choose the mailbox that should receive replies.",
  },
] as const;

export function LandingPage({ installHref }: { installHref: string }) {
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader signedIn={false} />
        <Stack gap={4}>
          <Badge label="Browser extension" variant="blue" />
          <PageHeader
            title={`${BRAND} fills applications from your resume.`}
            description="Create an Acorn account here. The extension signs in with that same account."
            action={
              <HStack gap={3} wrap="wrap">
                <Button label="Create account" variant="primary" size="lg" href={ROUTES.signUp} />
                <Button label="Sign in" variant="secondary" size="lg" href={ROUTES.signIn} />
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
        <SectionCard title="On your account" description="Available after you sign in.">
          <Stack gap={4}>
            {AFTER_SIGN_IN.map((item) => (
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
