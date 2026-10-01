"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  List,
  ListItem,
  Stack,
  Text,
  useToast,
  PageHeader,
} from "@joined/design-system";
import { TONE_BADGE, type ScoutNotification } from "@joined/scout";
import { CursorPager } from "@/components/cursor-pager";
import { FullText } from "@/components/full-text";
import { formatDateTime } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { scoutSend } from "@/lib/scout/client";

const KIND_LABEL: Record<ScoutNotification["kind"], string> = {
  decision: "Decision",
  reward: "Reward",
  level: "Level",
  payout: "Payout",
  verification: "Verification",
};

/** Where a notification leads: its submission, or the page that owns the topic. */
function target(item: ScoutNotification) {
  if (item.kind === "payout" || item.kind === "verification") return ROUTES.payouts;
  if (item.kind === "level") return ROUTES.level;
  return item.subject_id ? ROUTES.submission(item.subject_id) : undefined;
}

export function NotificationsView({
  items,
  nextCursor,
  hasCursor,
}: {
  items: ScoutNotification[];
  nextCursor: string;
  hasCursor: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const unread = items.filter((item) => !item.read);

  const markAll = async () => {
    await scoutSend("/notifications/read", "POST", {});
    toast({ body: "All caught up." });
    router.refresh();
  };
  const open = async (item: ScoutNotification) => {
    if (!item.read) await scoutSend("/notifications/read", "POST", { ids: [item.id] });
    const href = target(item);
    if (href) router.push(href);
    else router.refresh();
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Notifications"
        description="Decisions on your jobs, rewards, payouts, and level changes."
        action={
          unread.length > 0 ? (
            <Button label="Mark all read" variant="secondary" clickAction={markAll} />
          ) : undefined
        }
      />
      <Card padding={2}>
        {items.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            description="You will hear from us when a job is decided or pays out."
          />
        ) : (
          <List>
            {items.map((item) => (
              <ListItem
                key={item.id}
                label={item.title}
                description={<FullText>{item.body}</FullText>}
                onClick={() => void open(item)}
                startContent={
                  <Badge label={KIND_LABEL[item.kind]} variant={TONE_BADGE[item.tone]} />
                }
                endContent={
                  <HStack gap={2} vAlign="center">
                    <Text type="supporting" color="secondary">
                      {formatDateTime(item.created_at)}
                    </Text>
                    {item.read ? null : <Badge label="New" variant="info" />}
                  </HStack>
                }
              />
            ))}
          </List>
        )}
      </Card>
      <CursorPager
        basePath={ROUTES.notifications}
        params={{}}
        nextCursor={nextCursor}
        hasCursor={hasCursor}
      />
    </Stack>
  );
}
