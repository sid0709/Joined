"use client";

import { useState } from "react";
import {
  Calendar,
  Card,
  EmptyState,
  GridColumn,
  GridSystem,
  Heading,
  Stack,
  Text,
  useToast,
} from "@openseat/design-system";
import { StatGrid } from "@/components/stat-card";
import {
  BILLING,
  COMPANY_INTERVIEWS,
  toCompanyCalendarEvent,
  type CompanyInterview,
} from "@/lib/company";
import { daysBetween, formatDay, isSameDay, startOfDay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { CompanyInterviewDrawer } from "./company-interview-drawer";
import { CompanyInterviewRow } from "./company-interview-row";

const WEEK_DAYS = 7;
const PERCENT = 100;
const CALENDAR_HOURS: [number, number] = [8, 18];

/** The team interview calendar with a day panel and attendance that drives billing. */
export function CompanyInterviewsWorkspace() {
  const toast = useToast();
  const [items, setItems] = useState(COMPANY_INTERVIEWS);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [openId, setOpenId] = useState<string | null>(null);

  const now = new Date();
  const thisWeek = items.filter((item) => {
    const days = daysBetween(now, item.date);
    return days >= 0 && days < WEEK_DAYS;
  });
  const held = items.filter((item) => item.status === "attended" || item.status === "no-show");
  const attended = held.filter((item) => item.status === "attended").length;
  const onDay = items
    .filter((item) => isSameDay(item.date, day))
    .sort((a, b) => a.start.localeCompare(b.start));

  const replace = (next: CompanyInterview, message: string) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
    setOpenId(null);
    toast({ body: message });
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          {
            label: "This week",
            value: String(thisWeek.length),
            hint: `${thisWeek.filter((item) => item.status === "awaiting").length} awaiting a slot`,
          },
          {
            label: "Attendance",
            value: `${held.length === 0 ? 0 : Math.round((attended / held.length) * PERCENT)}%`,
            hint: `${attended} of ${held.length} showed up`,
          },
          {
            label: "Billable",
            value: formatCents(attended * BILLING.pricePerInterviewCents, BILLING.currency),
            hint: `${formatCents(BILLING.pricePerInterviewCents, BILLING.currency)} per attended round`,
          },
          {
            label: "Free left",
            value: String(BILLING.freeInterviewsRemaining),
            hint: "Used before billing starts",
          },
        ]}
      />

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Calendar
            value={day}
            onChange={(date) => setDay(startOfDay(date))}
            views={["week", "month", "agenda"]}
            defaultView="week"
            events={items.map(toCompanyCalendarEvent)}
            eventDisplay="chips"
            hours={CALENDAR_HOURS}
          />
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Card padding={5}>
            <Stack gap={4}>
              <Stack gap={1}>
                <Text type="supporting" color="secondary">
                  Selected day
                </Text>
                <Heading level={2}>{formatDay(day)}</Heading>
              </Stack>
              {onDay.length > 0 ? (
                onDay.map((item) => (
                  <CompanyInterviewRow
                    key={item.id}
                    interview={item}
                    onOpen={() => setOpenId(item.id)}
                  />
                ))
              ) : (
                <EmptyState
                  isCompact
                  title="No interviews"
                  description="Pick a day with an event to see the rounds."
                />
              )}
            </Stack>
          </Card>
        </GridColumn>
      </GridSystem>

      <CompanyInterviewDrawer
        interview={items.find((item) => item.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onChange={replace}
      />
    </Stack>
  );
}
