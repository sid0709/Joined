"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Calendar,
  Card,
  EmptyState,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Icon,
  Stack,
  Tab,
  TabList,
  Text,
  icons,
  useToast,
} from "@openseat/design-system";
import { StatCard } from "@/components/stat-card";
import { daysBetween, formatDay, formatTime, isSameDay, startOfDay } from "@/lib/dates";
import {
  INTERVIEWS,
  byDateTime,
  isUpcoming,
  toCalendarEvent,
  type Interview,
  type PrepTask,
} from "@/lib/interviews";
import { AddInterviewDialog } from "./add-interview-dialog";
import { InterviewDrawer } from "./interview-drawer";
import { InterviewRow } from "./interview-row";
import { NextInterview } from "./next-interview";
import { PastInterviews } from "./past-interviews";

type View = "calendar" | "upcoming" | "past";

const WEEK_DAYS = 7;
const CALENDAR_HOURS: [number, number] = [8, 19];

function percent(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** Interviews: the next one front and center, then a calendar, a list, and history. */
export function InterviewsWorkspace() {
  const toast = useToast();
  const [items, setItems] = useState(INTERVIEWS);
  const [view, setView] = useState<View>("calendar");
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [openId, setOpenId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const today = new Date();
  const upcoming = items.filter(isUpcoming).sort(byDateTime);
  const past = items
    .filter((item) => item.status === "completed")
    .sort(byDateTime)
    .reverse();
  const unconfirmed = upcoming.filter((item) => item.status === "unconfirmed");
  const thisWeek = upcoming.filter((item) => daysBetween(today, item.date) < WEEK_DAYS);
  const advanced = past.filter((item) => item.outcome === "advanced").length;
  const onDay = items
    .filter((item) => isSameDay(item.date, day) && item.status !== "cancelled")
    .sort(byDateTime);
  const open = items.find((item) => item.id === openId) ?? null;

  const replace = (next: Interview) =>
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  const setPrep = (id: string, prep: PrepTask[]) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, prep } : item)));
  const confirm = (item: Interview) => {
    replace({ ...item, status: "scheduled" });
    toast({ body: `Confirmed ${item.company} on ${formatDay(item.date)}` });
  };
  const dismiss = (item: Interview) => {
    replace({ ...item, status: "cancelled" });
    toast({ body: "Got it — we won’t count that one." });
  };

  return (
    <Stack gap={6}>
      {unconfirmed.map((item) => (
        <Banner
          key={item.id}
          status="warning"
          title={`We found an interview invite from ${item.company}`}
          description={`${item.role} · ${item.round} · ${formatDay(item.date)} at ${formatTime(item.start)}. Is this right?`}
          endContent={
            <HStack gap={2}>
              <Button
                label="Not an interview"
                variant="ghost"
                size="sm"
                onClick={() => dismiss(item)}
              />
              <Button label="Confirm" variant="secondary" size="sm" onClick={() => confirm(item)} />
            </HStack>
          }
        />
      ))}

      <GridSystem gap={6} align="stretch">
        <GridColumn span="full" lg={8}>
          <NextInterview
            interview={upcoming[0]}
            onPrepChange={setPrep}
            onOpen={setOpenId}
            onAdd={() => setIsAdding(true)}
          />
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={4}>
            <StatCard
              label="This week"
              value={String(thisWeek.length)}
              hint={`${upcoming.length} upcoming in total`}
            />
            <StatCard
              label="Advance rate"
              value={`${percent(advanced, past.length)}%`}
              hint={`${advanced} of ${past.length} rounds moved you forward`}
            />
          </Stack>
        </GridColumn>
      </GridSystem>

      <HStack hAlign="between" vAlign="end" gap={3} wrap="wrap">
        <TabList value={view} onChange={(value) => setView(value as View)}>
          <Tab value="calendar" label="Calendar" icon={<Icon icon={icons.calendar} />} />
          <Tab
            value="upcoming"
            label="Upcoming"
            endContent={<Badge label={String(upcoming.length)} variant="neutral" />}
          />
          <Tab
            value="past"
            label="Past"
            endContent={<Badge label={String(past.length)} variant="neutral" />}
          />
        </TabList>
        <Button
          label="Add interview"
          variant="primary"
          icon={<Icon icon={icons.plus} />}
          onClick={() => setIsAdding(true)}
        />
      </HStack>

      {view === "calendar" ? (
        <GridSystem gap={6} align="start">
          <GridColumn span="full" lg={8}>
            <Calendar
              value={day}
              onChange={(date) => setDay(startOfDay(date))}
              views={["month", "week", "agenda"]}
              defaultView="month"
              events={items.filter((item) => item.status !== "cancelled").map(toCalendarEvent)}
              eventDisplay="chips"
              hours={CALENDAR_HOURS}
              size="lg"
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
                    <InterviewRow
                      key={item.id}
                      interview={item}
                      onOpen={() => setOpenId(item.id)}
                    />
                  ))
                ) : (
                  <EmptyState
                    isCompact
                    title="Nothing scheduled"
                    description="Pick a day with a chip, or add an interview here."
                    actions={
                      <Button
                        label="Add on this day"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAdding(true)}
                      />
                    }
                  />
                )}
              </Stack>
            </Card>
          </GridColumn>
        </GridSystem>
      ) : null}

      {view === "upcoming" ? (
        upcoming.length > 0 ? (
          <Stack gap={3}>
            {upcoming.map((item) => (
              <InterviewRow key={item.id} interview={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </Stack>
        ) : (
          <EmptyState
            title="No upcoming interviews"
            description="Confirmed and detected rounds will appear here."
          />
        )
      ) : null}

      {view === "past" ? <PastInterviews rows={past} onOpen={setOpenId} /> : null}

      <InterviewDrawer interview={open} onClose={() => setOpenId(null)} onChange={replace} />
      <AddInterviewDialog
        key={day.getTime()}
        isOpen={isAdding}
        onOpenChange={setIsAdding}
        defaultDate={day}
        onAdd={(interview) => {
          setItems((current) => [...current, interview]);
          setDay(startOfDay(interview.date));
          toast({ body: `Added ${interview.company} on ${formatDay(interview.date)}` });
        }}
      />
    </Stack>
  );
}
