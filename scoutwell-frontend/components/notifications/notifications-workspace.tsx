"use client";

import {
  Button,
  EmptyState,
  Glyph,
  Notification,
  NotificationList,
  Stack,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { relativeDay } from "@/lib/dates";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";

export function NotificationsWorkspace() {
  const scout = useScout();
  const user = scout.user;
  if (!user) return null;
  const items = ownedBy(scout.state.notifications, user.id);

  return (
    <Stack gap={6}>
      <PageHeader
        title="Notifications"
        description="Submission decisions, rewards, and level changes."
        action={
          <Button
            label="Mark all read"
            variant="ghost"
            size="sm"
            onClick={() => scout.markAllNotificationsRead()}
          />
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Approvals and interview rewards show up here."
        />
      ) : (
        <NotificationList label="Scout notifications">
          {items.map((item) => (
            <Notification
              key={item.id}
              title={item.title}
              description={item.description}
              time={relativeDay(item.createdAt)}
              unread={item.unread}
              tone={item.tone}
              href={item.href}
              start={<Glyph name="bell" />}
              onClick={() => scout.markNotificationRead(item.id)}
            />
          ))}
        </NotificationList>
      )}
    </Stack>
  );
}
