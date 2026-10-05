"use client";

import { Banner, Button, Stack } from "@joined/design-system";
import type { Application } from "@/lib/applications";
import {
  applicationsWithReminders,
  reminderLabel,
  reminderStatus,
} from "@/lib/application-reminders";

const MAX_REMINDER_BANNERS = 4;

/** Upcoming and overdue follow-ups for the tracker, overdue first. */
export function ApplicationReminderBanners({
  applications,
  now = new Date(),
  onOpen,
}: {
  applications: Application[];
  now?: Date;
  onOpen: (application: Application) => void;
}) {
  const due = applicationsWithReminders(applications, now);
  if (due.length === 0) return null;
  const shown = due.slice(0, MAX_REMINDER_BANNERS);
  const hidden = due.length - shown.length;

  return (
    <Stack gap={3}>
      {shown.map((application) => {
        const status = reminderStatus(application.remindAt, now);
        if (status === "none" || !application.remindAt) return null;
        const overdue = status === "overdue";
        return (
          <Banner
            key={application.id}
            status={overdue ? "warning" : "info"}
            title={
              overdue
                ? `Overdue reminder · ${application.title}`
                : `Upcoming reminder · ${application.title}`
            }
            description={`${application.company} · ${reminderLabel(application.remindAt, now)}`}
            endContent={
              <Button label="Open" size="sm" variant="ghost" onClick={() => onOpen(application)} />
            }
          />
        );
      })}
      {hidden > 0 ? (
        <Banner
          status="info"
          title={`${hidden} more reminder${hidden === 1 ? "" : "s"}`}
          description="Open a card to see its follow-up time."
        />
      ) : null}
    </Stack>
  );
}
