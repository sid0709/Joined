import {
  Badge,
  Button,
  Card,
  Glyph,
  Grid,
  HStack,
  Heading,
  PageContainer,
  PageHeader,
  SectionCard,
  Stack,
  Text,
  Timeline,
  type GlyphName,
  type TimelineItem,
} from "sid-ui";
import { BRAND } from "@/lib/config";
import { INSTALL_SECTION_ID, ROUTES } from "@/lib/routes";
import { SiteHeader } from "./site-header";

const FEATURE_MIN_WIDTH = 260;
const FEATURE_COLUMNS = 2;
const PAGE_PADDING = 5;

const AFTER_SIGN_IN = [
  {
    title: "Statistics",
    icon: "home",
    description:
      "Applications, reply rate, interviews, and your daily rhythm — charted week by week.",
  },
  {
    title: "Profile",
    icon: "user",
    description: "Every answer an application asks for, filled once from your résumé.",
  },
  {
    title: "Resume",
    icon: "file",
    description:
      "A draft aimed at one posting, with a check of which of its words you already cover.",
  },
  {
    title: "Gmail",
    icon: "mail",
    description: "Recruiter replies sorted into interviews, next steps, offers, and closed roles.",
  },
] as const satisfies { title: string; icon: GlyphName; description: string }[];

const STEPS: TimelineItem[] = [
  {
    id: "account",
    title: "Create an account",
    description: "Here, with email or Google.",
    status: "done",
  },
  {
    id: "profile",
    title: "Upload your résumé",
    description: "Acorn fills your profile from it.",
    status: "done",
  },
  {
    id: "extension",
    title: "Install the extension",
    description: "It signs in with the same account.",
    status: "current",
  },
  {
    id: "apply",
    title: "Apply",
    description: "Open a posting and let Acorn fill it.",
    status: "upcoming",
  },
];

export function LandingPage({ installHref }: { installHref: string }) {
  return (
    <Stack padding={PAGE_PADDING}>
      <PageContainer width="default">
        <Stack gap={8}>
          <SiteHeader hasSignIn />
          <Stack gap={4}>
            <HStack>
              <Badge label="Browser extension" variant="blue" />
            </HStack>
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
          <SectionCard
            title="How it works"
            description="Four steps from sign-up to your first filled application."
          >
            <Timeline label="Getting started" items={STEPS} variant="horizontal" />
          </SectionCard>
          <Grid columns={{ minWidth: FEATURE_MIN_WIDTH, max: FEATURE_COLUMNS }} gap={4}>
            {AFTER_SIGN_IN.map((item) => (
              <Card key={item.title} padding={5}>
                <Stack gap={3}>
                  <HStack gap={2} vAlign="center">
                    <Glyph name={item.icon} />
                    <Heading level={3}>{item.title}</Heading>
                  </HStack>
                  <Text color="secondary">{item.description}</Text>
                </Stack>
              </Card>
            ))}
          </Grid>
          <SectionCard
            title="Install Acorn"
            description="The store listing is not wired yet. Set ACORN_EXTENSION_INSTALL_URL when it is."
          >
            <Stack gap={3} id={INSTALL_SECTION_ID}>
              <Text color="secondary">
                Sign in on this site in the same browser, then open the extension and choose
                Continue.
              </Text>
            </Stack>
          </SectionCard>
        </Stack>
      </PageContainer>
    </Stack>
  );
}
