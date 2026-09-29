import {
  HStack,
  SectionCard,
  Stack,
  Text,
  Timeline,
  type TimelineItem,
} from "@openseat/design-system";
import {
  EARNING_STATUS,
  REWARD_TYPE,
  formatMoney,
  type AdminSubmissionDetail,
} from "@openseat/scout";
import { formatDateTime } from "@/lib/format";

function trail(detail: AdminSubmissionDetail): TimelineItem[] {
  const sub = detail.submission;
  const items: TimelineItem[] = detail.audit.map((entry, index) => ({
    id: `audit-${index}`,
    title: entry.action.replace(/^submission\./, "").replace(/[._]/g, " "),
    description: [entry.actor, entry.note].filter(Boolean).join(" · "),
    time: formatDateTime(entry.at),
    tone: entry.action.includes("reject")
      ? "danger"
      : entry.action.includes("approve")
        ? "success"
        : "accent",
    status: "done",
  }));
  if (sub.reviewed_by === "auto" && sub.reviewed_at) {
    items.push({
      id: "auto",
      title: "auto-approved",
      time: formatDateTime(sub.reviewed_at),
      tone: "success",
      status: "done",
    });
  }
  items.push({
    id: "submitted",
    title: `submitted ${sub.channel === "api" ? "over the API" : "on the web"}`,
    description: sub.external_ref ? `Partner reference ${sub.external_ref}` : undefined,
    time: formatDateTime(sub.submitted_at),
    tone: "neutral",
    status: "done",
  });
  return items;
}

/** Staff actions on this submission, newest first, and the money it produced. */
export function HistoryCard({ detail }: { detail: AdminSubmissionDetail }) {
  return (
    <SectionCard title="History">
      <Timeline label="Submission history" items={trail(detail)} />
      {detail.earnings.length > 0 ? (
        <Stack gap={2}>
          <Text weight="semibold">Rewards</Text>
          {detail.earnings.map((earning) => (
            <HStack key={earning.id} hAlign="between" gap={3}>
              <Text type="supporting">
                {REWARD_TYPE[earning.type].label} · {EARNING_STATUS[earning.status].label}
              </Text>
              <Text type="supporting" weight="semibold" hasTabularNumbers>
                {formatMoney(earning.amount)}
              </Text>
            </HStack>
          ))}
        </Stack>
      ) : null}
    </SectionCard>
  );
}
