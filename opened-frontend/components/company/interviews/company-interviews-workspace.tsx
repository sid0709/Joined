"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Calendar,
  Card,
  EmptyState,
  GridColumn,
  GridSystem,
  Heading,
  HStack,
  Stack,
  Text,
  useToast,
} from "@openseat/design-system";
import { StatGrid } from "@/components/stat-card";
import {
  fetchBilling,
  fetchHiringProfile,
  fetchInterviews,
  fetchJobs,
  setAttendance,
} from "@/lib/company/api";
import {
  toCompanyCalendarEvent,
  type BillingAccount,
  type CompanyInterview,
  type CompanyJob,
  type HiringProfile,
  type ScorecardSubmission,
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
  const [items, setItems] = useState<CompanyInterview[]>([]);
  const [billing, setBilling] = useState<BillingAccount | null>(null);
  const [hiringProfile, setHiringProfile] = useState<HiringProfile | null>(null);
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [scorecards, setScorecards] = useState<ScorecardSubmission[]>([]);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchInterviews(), fetchBilling(), fetchJobs()])
      .then(([nextItems, nextBilling, nextJobs]) => {
        if (!active) return;
        setItems(nextItems);
        setBilling(nextBilling);
        setJobs(nextJobs);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    fetchHiringProfile()
      .then((profile) => {
        if (active) setHiringProfile(profile);
      })
      .catch(() => {
        /* Join falls back without meeting link. */
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const now = new Date();
  const thisWeek = items.filter((item) => {
    const days = daysBetween(now, item.date);
    return days >= 0 && days < WEEK_DAYS;
  });
  const held = items.filter((item) => item.status === "attended" || item.status === "no-show");
  const attended = held.filter((item) => item.status === "attended").length;
  const awaiting = items
    .filter((item) => item.status === "awaiting")
    .sort((a, b) => a.candidate.localeCompare(b.candidate));
  const onDay = items
    .filter((item) => isSameDay(item.date, day) && item.status !== "awaiting")
    .sort((a, b) => a.start.localeCompare(b.start));

  const replace = (next: CompanyInterview, message: string) => {
    const status = next.status === "no-show" ? "no-show" : "attended";
    setAttendance(next.id, status)
      .then((saved) => {
        setItems((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        // Keep drawer open after attend so feedback prompt can show.
        if (status === "attended") {
          setOpenId(saved.id);
        } else {
          setOpenId(null);
        }
        toast({ body: message });
        return fetchBilling();
      })
      .then((nextBilling) => {
        if (nextBilling) setBilling(nextBilling);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  const price = billing?.pricePerInterviewCents ?? 0;
  const currency = billing?.currency ?? "USD";
  const openInterview = items.find((item) => item.id === openId) ?? null;
  const scorecardTemplate =
    jobs.find((job) => job.id === openInterview?.jobId)?.scorecardTemplate ?? null;

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          {
            label: "This week",
            value: String(thisWeek.length),
            hint: `${awaiting.length} awaiting a slot`,
          },
          {
            label: "Attendance",
            value: `${held.length === 0 ? 0 : Math.round((attended / held.length) * PERCENT)}%`,
            hint: `${attended} of ${held.length} showed up`,
          },
          {
            label: "Billable",
            value: formatCents(billing?.spentCents ?? 0, currency),
            hint: `${formatCents(price, currency)} held per scheduled round`,
          },
          {
            label: "Balance left",
            value: formatCents(billing?.balanceCents ?? 0, currency),
            hint: "Returned if they don’t attend",
          },
        ]}
      />

      {awaiting.length > 0 ? (
        <Card padding={5}>
          <Stack gap={4}>
            <Stack gap={1}>
              <Heading level={2}>Awaiting a slot</Heading>
              <Text type="supporting" color="secondary">
                Candidates waiting to pick a time. Share self-schedule or offer times from the
                drawer.
              </Text>
            </Stack>
            <Banner
              status="warning"
              title={`${awaiting.length} round${awaiting.length === 1 ? "" : "s"} need a locked time`}
              description="These also show under Needs attention on Home."
            />
            <Stack gap={3}>
              {awaiting.map((item) => (
                <HStack key={item.id} hAlign="between" vAlign="center" gap={3} wrap="wrap">
                  <CompanyInterviewRow interview={item} onOpen={() => setOpenId(item.id)} />
                  <Button
                    label="Open"
                    variant="secondary"
                    size="sm"
                    onClick={() => setOpenId(item.id)}
                  />
                </HStack>
              ))}
            </Stack>
          </Stack>
        </Card>
      ) : null}

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Calendar
            value={day}
            onChange={(date) => setDay(startOfDay(date))}
            views={["week", "month", "agenda"]}
            defaultView="week"
            events={items.filter((item) => item.status !== "awaiting").map(toCompanyCalendarEvent)}
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
        interview={openInterview}
        onClose={() => setOpenId(null)}
        priceCents={price}
        currency={currency}
        meetingLink={hiringProfile?.meetingLink}
        scorecardTemplate={scorecardTemplate}
        scorecards={scorecards}
        onScorecard={(submission) => {
          setScorecards((current) => [submission, ...current]);
          toast({ body: "Scorecard saved locally — Einstein persist pending." });
        }}
        onChange={replace}
      />
    </Stack>
  );
}
