import {
  Button,
  Card,
  Divider,
  Glyph,
  HStack,
  Stack,
  Text,
  type GlyphName,
} from "@openseat/design-system";
import { SectionCard } from "@/components/section-card";
import { APPLICANTS, BILLING, COMPANY_INTERVIEWS, COMPANY_JOBS } from "@/lib/company";
import { formatCount } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

type Task = {
  id: string;
  icon: GlyphName;
  title: string;
  detail: string;
  action: string;
  href: string;
};

const ICON_TILE = 36;

function tasks(): Task[] {
  const fresh = APPLICANTS.filter((person) => person.columnId === "new");
  const awaiting = COMPANY_INTERVIEWS.filter((interview) => interview.status === "awaiting");
  const paused = COMPANY_JOBS.filter((job) => job.status === "paused");
  const list: Task[] = [];

  if (fresh.length > 0)
    list.push({
      id: "review",
      icon: "users",
      title: `Review ${formatCount(fresh.length, "new applicant")}`,
      detail: `${fresh.filter((person) => person.verified).length} verified · newest ${fresh[0].name}`,
      action: "Review",
      href: ROUTES.companyApplicants,
    });
  awaiting.forEach((interview) =>
    list.push({
      id: interview.id,
      icon: "calendar",
      title: `${interview.candidate} is waiting for a slot`,
      detail: interview.round,
      action: "Offer times",
      href: ROUTES.companyInterviews,
    }),
  );
  paused.forEach((job) =>
    list.push({
      id: job.id,
      icon: "pause",
      title: `${job.title} is paused`,
      detail: "Resume it or close it so candidates hear back.",
      action: "Decide",
      href: ROUTES.companyJobs,
    }),
  );
  if (!BILLING.paymentMethod)
    list.push({
      id: "billing",
      icon: "lock",
      title: "Add a payment method",
      detail: `${BILLING.freeInterviewsRemaining} free interviews left before billing starts.`,
      action: "Add",
      href: ROUTES.companyBilling,
    });
  return list;
}

/** The short list of things only a person can unblock. */
export function NeedsAttention() {
  const items = tasks();
  return (
    <SectionCard
      title="Needs your attention"
      description={`${formatCount(items.length, "item")} waiting on your team.`}
    >
      <Stack gap={4}>
        {items.map((task, index) => (
          <Stack key={task.id} gap={4}>
            {index > 0 ? <Divider /> : null}
            <HStack hAlign="between" vAlign="center" gap={3}>
              <HStack gap={3} vAlign="center">
                <Card variant="blue" padding={0} width={ICON_TILE} height={ICON_TILE}>
                  <Stack hAlign="center" vAlign="center" height="100%">
                    <Text color="accent">
                      <Glyph name={task.icon} />
                    </Text>
                  </Stack>
                </Card>
                <Stack gap={0.5}>
                  <Text weight="medium">{task.title}</Text>
                  <Text type="supporting" color="secondary">
                    {task.detail}
                  </Text>
                </Stack>
              </HStack>
              <Button label={task.action} variant="ghost" size="sm" href={task.href} />
            </HStack>
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
