import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Grid,
  GridColumn,
  GridSystem,
  Heading,
  HStack,
  Stack,
  Text,
  Timeline,
  SectionCard,
} from "@openseat/design-system";
import { LEVEL_BADGE, formatMoney, formatRate, type Meta } from "@openseat/scout";
import { ROUTES } from "@/lib/routes";

const HERO_WIDTH = 760;
const CARD_MIN = 220;

const SAMPLE = `POST /v1/scout/submissions
Authorization: Bearer scw_…
Idempotency-Key: 7f0c2a6e-…

{ "url": "https://jobs.lever.co/acme/…",
  "company_name": "Acme", "title": "Data Engineer",
  "summary": "…", "external_ref": "feed-0142" }`;

function money(meta: Meta) {
  const { rewards } = meta;
  return {
    interviews: `${formatMoney(rewards.interview_by_seniority.Junior)}–${formatMoney(rewards.interview_by_seniority.Senior)}`,
    hires: `${formatMoney(rewards.hire_by_seniority.Junior)}–${formatMoney(rewards.hire_by_seniority.Senior)}`,
  };
}

export function LandingPage({ meta, signedIn }: { meta: Meta; signedIn: boolean }) {
  const ranges = money(meta);
  const loop = [
    {
      id: "find",
      title: "Find an opening the big boards miss",
      description:
        "On a company careers page or its ATS: Greenhouse, Lever, Ashby, Workday, and more.",
      status: "done" as const,
    },
    {
      id: "submit",
      title: "Submit the official link",
      description: "Company, title, and a job description in your own words.",
      status: "done" as const,
    },
    {
      id: "check",
      title: "We check it in seconds",
      description: "Reachable, official, still open, not a duplicate, not a scam.",
      status: "done" as const,
    },
    {
      id: "earn",
      title: "Earn when it gets used",
      description: `Interviews and hires on your job pay you. Rewards hold ${meta.rewards.hold_days} days, payouts from ${formatMoney(meta.rewards.min_payout)}.`,
      status: "current" as const,
    },
  ];

  return (
    <Stack gap={10}>
      <Stack gap={5} maxWidth={HERO_WIDTH}>
        <HStack gap={2}>
          <Badge label="For scouts and sourcing partners" variant="blue" />
        </HStack>
        <Heading level={1} type="display-1">
          Find the jobs the big boards miss. Get paid when they&apos;re used.
        </Heading>
        <Text type="large" color="secondary" display="block">
          Submit official openings from company sites. When job hunters apply, interview, and get
          hired through them, you earn — never for raw volume.
        </Text>
        <HStack gap={3} wrap="wrap">
          {signedIn ? (
            <Button
              label="Go to your dashboard"
              variant="primary"
              size="lg"
              href={ROUTES.dashboard}
            />
          ) : (
            <>
              <Button label="Become a scout" variant="primary" size="lg" href={ROUTES.signUp} />
              <Button label="Sign in" variant="secondary" size="lg" href={ROUTES.signIn} />
            </>
          )}
        </HStack>
      </Stack>

      <Grid columns={{ minWidth: CARD_MIN, max: 3 }} gap={4}>
        <Card padding={6}>
          <Stack gap={2}>
            <Text type="supporting" color="secondary">
              Per settled interview
            </Text>
            <Heading level={2} type="display-3">
              {ranges.interviews}
            </Heading>
            <Text color="secondary" display="block">
              By seniority of the role, up to ×
              {Math.max(...meta.levels.map((level) => level.interview_multiplier))} at the top
              level.
            </Text>
          </Stack>
        </Card>
        <Card padding={6}>
          <Stack gap={2}>
            <Text type="supporting" color="secondary">
              Per confirmed hire
            </Text>
            <Heading level={2} type="display-3">
              {ranges.hires}
            </Heading>
            <Text color="secondary" display="block">
              Paid when an employer confirms the hire on your job.
            </Text>
          </Stack>
        </Card>
        <Card padding={6}>
          <Stack gap={2}>
            <Text type="supporting" color="secondary">
              Company conversion
            </Text>
            <Heading level={2} type="display-3">
              {formatRate(meta.rewards.conversion_share)}
            </Heading>
            <Text color="secondary" display="block">
              Of a company&apos;s interview fees when it claims its page and starts paying.
            </Text>
          </Stack>
        </Card>
      </Grid>

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <SectionCard title="How a scouted job earns" description="From link to payout.">
            <Timeline label="How scouting works" items={loop} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard title="Levels" description="Quality raises your limit and rewards.">
            <Stack gap={4}>
              {meta.levels.map((level) => (
                <Stack key={level.id} gap={1}>
                  <HStack gap={2} vAlign="center">
                    <Badge label={level.label} variant={LEVEL_BADGE[level.id]} />
                    <Text weight="semibold">{level.daily_limit} a day</Text>
                  </HStack>
                  <Text type="supporting" color="secondary" display="block">
                    {level.auto_approve
                      ? "Clean jobs publish automatically."
                      : "Every job is reviewed by a moderator."}{" "}
                    {level.approval_reward.amount_cents > 0
                      ? `${formatMoney(level.approval_reward)} per approved job.`
                      : "No approval credit yet."}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </GridColumn>
      </GridSystem>

      <Card padding={8} variant="muted">
        <GridSystem gap={6} align="center">
          <GridColumn span="full" lg={6}>
            <Stack gap={3}>
              <Badge label="API" variant="neutral" />
              <Heading level={2}>Source at scale with the Scoutwell API</Heading>
              <Text color="secondary" display="block">
                Agencies and sourcing teams submit from their own pipelines with an API key:
                idempotent creates, batch uploads of up to {meta.limits.max_batch}, your own
                reference ids, and change feeds to stay in sync. Same checks, same rewards.
              </Text>
              <HStack>
                <Button
                  label={signedIn ? "Get an API key" : "Create an account"}
                  variant="secondary"
                  href={signedIn ? ROUTES.developers : ROUTES.signUp}
                />
              </HStack>
            </Stack>
          </GridColumn>
          <GridColumn span="full" lg={6}>
            <CodeBlock code={SAMPLE} language="http" />
          </GridColumn>
        </GridSystem>
      </Card>
    </Stack>
  );
}
