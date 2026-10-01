import {
  Button,
  Card,
  Divider,
  EmptyState,
  Glyph,
  HStack,
  Stack,
  Text,
  type GlyphName,
} from "@joined/design-system";
import { SectionCard } from "@/components/section-card";
import type { Applicant, BillingAccount, CompanyInterview, CompanyJob } from "@/lib/company";
import { formatCount } from "@/lib/jobs";
import { formatCents } from "@/lib/money";
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

function tasks(
  applicants: Applicant[],
  interviews: CompanyInterview[],
  jobs: CompanyJob[],
  billing: BillingAccount,
  canAddBalance: boolean,
): Task[] {
  const fresh = applicants.filter((person) => person.columnId === "new");
  const awaiting = interviews.filter((interview) => interview.status === "awaiting");
  const paused = jobs.filter((job) => job.status === "paused");
  const list: Task[] = [];

  if (fresh.length > 0)
    list.push({
      id: "review",
      icon: "users",
      title: `Review ${formatCount(fresh.length, "new applicant")}`,
      detail: `Newest ${fresh[0].name}`,
      action: "Review",
      href: ROUTES.companyApplicants,
    });
  awaiting.forEach((interview) => {
    const offered = interview.proposedSlots?.length ?? 0;
    const detail = interview.selfScheduleUrl
      ? `${interview.round} · self-schedule ready`
      : offered > 0
        ? `${interview.round} · ${offered} time${offered === 1 ? "" : "s"} offered`
        : `${interview.round} · offer times or share a self-schedule link`;
    list.push({
      id: interview.id,
      icon: "calendar",
      title: `${interview.candidate} is waiting for a slot`,
      detail,
      action: "Offer times",
      href: ROUTES.companyInterviews,
    });
  });
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
  if (billing.balanceCents < billing.pricePerInterviewCents) {
    const left = formatCents(billing.balanceCents, billing.currency);
    const price = formatCents(billing.pricePerInterviewCents, billing.currency);
    list.push(
      canAddBalance
        ? {
            id: "billing",
            icon: "lock",
            title: "Add purchase balance",
            detail: `${left} left. An interview costs ${price}.`,
            action: "Add",
            href: ROUTES.companyBilling,
          }
        : {
            id: "billing",
            icon: "lock",
            title: "Purchase balance is low",
            detail: `${left} left. An interview costs ${price}. The company creator adds balance.`,
            action: "",
            href: "",
          },
    );
  }
  return list;
}

/** The short list of things only a person can unblock. */
export function NeedsAttention({
  applicants,
  interviews,
  jobs,
  billing,
  canAddBalance,
}: {
  applicants: Applicant[];
  interviews: CompanyInterview[];
  jobs: CompanyJob[];
  billing: BillingAccount;
  canAddBalance: boolean;
}) {
  const items = tasks(applicants, interviews, jobs, billing, canAddBalance);
  return (
    <SectionCard
      title="Needs your attention"
      description={
        items.length === 0
          ? "Nothing is waiting on your team."
          : `${formatCount(items.length, "item")} waiting on your team.`
      }
    >
      {items.length === 0 ? (
        <EmptyState
          isCompact
          title="You’re caught up"
          description="New applicants, awaiting slots, and low balance show up here."
        />
      ) : (
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
                {task.href ? (
                  <Button label={task.action} variant="ghost" size="sm" href={task.href} />
                ) : null}
              </HStack>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
