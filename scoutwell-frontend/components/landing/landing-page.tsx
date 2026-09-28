import {
  Button,
  Card,
  GridColumn,
  GridSystem,
  Heading,
  HStack,
  Stack,
  Text,
  Timeline,
} from "@openseat/design-system";
import { HOLD_DAYS, LEVELS, MIN_PAYOUT_CENTS } from "@/lib/config";
import { formatCents } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { SectionCard } from "@/components/section-card";

const LOOP = [
  {
    id: "submit",
    title: "Submit an official apply link",
    description: "Company career page or ATS — never Indeed or LinkedIn.",
    time: "1",
  },
  {
    id: "check",
    title: "Quality checks run",
    description: "Reachable, official, still open, not a duplicate, not a scam.",
    time: "2",
  },
  {
    id: "use",
    title: "Job hunters and bidders use it",
    description: "Applications, settled interviews, and hires on your job.",
    time: "3",
  },
  {
    id: "earn",
    title: "You get paid for outcomes",
    description: `Rewards sit in a ${HOLD_DAYS}-day hold. Payouts start at ${formatCents(MIN_PAYOUT_CENTS)}.`,
    time: "4",
  },
];

export function LandingPage() {
  return (
    <Stack gap={8}>
      <Stack gap={4} maxWidth={720}>
        <Text type="supporting" color="secondary">
          Scout mode
        </Text>
        <Heading level={1} type="display-2">
          Find jobs the big boards miss. Earn when they get used.
        </Heading>
        <Text color="secondary" display="block">
          Anyone can submit an official opening. If job hunters apply and bidders work those jobs,
          you earn on interviews, hires, and companies that start paying — never on dump-and-go
          volume.
        </Text>
        <HStack gap={3} wrap="wrap">
          <Button label="Become a scout" variant="primary" href={ROUTES.signUp} />
          <Button label="Sign in to the demo" variant="secondary" href={ROUTES.signIn} />
        </HStack>
      </Stack>
      <GridSystem gap={5}>
        <GridColumn span="full" md={4}>
          <Card padding={5}>
            <Stack gap={2}>
              <Heading level={3}>Approval</Heading>
              <Text color="secondary" display="block">
                Small credit once a Trusted or Expert scout’s job publishes. Probation earns $0
                until the quality bar is met.
              </Text>
            </Stack>
          </Card>
        </GridColumn>
        <GridColumn span="full" md={4}>
          <Card padding={5}>
            <Stack gap={2}>
              <Heading level={3}>Interview & hire</Heading>
              <Text color="secondary" display="block">
                $3–$20 per settled interview by seniority, plus $25–$100 when a hire is confirmed.
              </Text>
            </Stack>
          </Card>
        </GridColumn>
        <GridColumn span="full" md={4}>
          <Card padding={5}>
            <Stack gap={2}>
              <Heading level={3}>Company conversion</Heading>
              <Text color="secondary" display="block">
                If that employer claims their page and pays, you earn about 10% of their interview
                fees for a few months.
              </Text>
            </Stack>
          </Card>
        </GridColumn>
      </GridSystem>
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <SectionCard
            title="How a scouted job earns"
            description="Paid for what the job produces."
          >
            <Timeline label="Scout loop" items={LOOP} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard title="Levels" description="Quality earns a higher daily cap.">
            <Stack gap={4}>
              {Object.entries(LEVELS).map(([id, level]) => (
                <Stack key={id} gap={1}>
                  <Text weight="semibold">
                    {level.label} · {level.dailyLimit}/day
                  </Text>
                  <Text type="supporting" color="secondary" display="block">
                    {level.autoApprove
                      ? "Auto-approve when checks pass."
                      : "Every submission is reviewed by a moderator."}{" "}
                    Interview multiplier {level.interviewMultiplier}×.
                  </Text>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
