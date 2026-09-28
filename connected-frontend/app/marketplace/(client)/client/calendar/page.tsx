"use client";

import { Calendar, type CalendarEvent } from "@openseat/design-system";
import { useState } from "react";

import { Badge, Button, Card, Input, PageBody, Stack } from "@/src/shared/marketplace-ui";

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "event-alex",
    date: new Date(2026, 9, 2),
    title: "Alex Miller · Growth evaluation",
    start: "10:00",
    end: "11:00",
    tone: "accent",
    location: "Video room",
  },
  {
    id: "event-maya",
    date: new Date(2026, 9, 6),
    title: "Maya Chen · Product design interview",
    start: "14:00",
    end: "15:00",
    tone: "success",
    location: "Video room",
  },
  {
    id: "event-review",
    date: new Date(2026, 9, 9),
    title: "Review shortlisted bidders",
    start: "09:00",
    end: "09:30",
    tone: "neutral",
    location: "Hiring workspace",
  },
];

export default function ClientCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 2));
  const [eventTitle, setEventTitle] = useState("");
  const eventsForDay = events.filter(
    (event) => event.date.toDateString() === selectedDate.toDateString(),
  );
  const addEvent = () => {
    if (!eventTitle.trim()) return;
    setEvents((current) => [
      ...current,
      {
        id: `event-${Date.now()}`,
        date: selectedDate,
        title: eventTitle.trim(),
        start: "10:00",
        end: "11:00",
        tone: "accent",
        location: "To be confirmed",
      },
    ]);
    setEventTitle("");
  };

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header marketplace-page-intro">
          <div>
            <span className="label text-primary">CLIENT WORKSPACE</span>
            <h1 className="h1">Evaluation Calendar</h1>
            <p className="body text-ink-muted">
              Create and manage interview or performance-test events. Bidders see the agreed
              schedule inside their invitation and conversation; this calendar is the source of
              truth.
            </p>
          </div>
          <Badge label={`${events.length} scheduled events`} tone="primary" />
        </div>
        <div className="marketplace-calendar-shell">
          <Card
            title="Schedule board"
            meta="Select a date to inspect or create a job-hunter evaluation event"
          >
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              defaultView="month"
              views={["month", "week", "agenda"]}
              events={events}
              eventDisplay="chips"
              footer={
                <span className="body-sm text-ink-muted">
                  Selected:{" "}
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              }
            />
          </Card>
          <Stack gap={16}>
            <Card
              title="Selected date"
              meta={`${eventsForDay.length} event${eventsForDay.length === 1 ? "" : "s"} on this date`}
            >
              {eventsForDay.length ? (
                <div className="marketplace-review-list">
                  {eventsForDay.map((event) => (
                    <div key={event.id}>
                      <div className="marketplace-card-footer">
                        <strong className="body-strong">{event.title}</strong>
                        <Badge
                          label={event.start ?? "All day"}
                          tone={event.tone === "success" ? "success" : "primary"}
                        />
                      </div>
                      <p className="body-sm text-ink-muted">
                        {event.location} · {event.end ? `Ends ${event.end}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="body-sm text-ink-muted">No evaluations scheduled for this date.</p>
              )}
            </Card>
            <Card
              title="Create evaluation event"
              meta="Publish a slot for a bidder you want to assess"
            >
              <Stack gap={12}>
                <Input
                  label="Event title"
                  placeholder="e.g. Candidate interview · role"
                  value={eventTitle}
                  onChange={(event) => setEventTitle(event.target.value)}
                />
                <Button type="button" variant="primary" onClick={addEvent}>
                  Add event
                </Button>
              </Stack>
            </Card>
            <Card title="Calendar rules" meta="Keep evaluation fair and room-linked">
              <p className="body-sm">
                Use a clear rubric, confirm the bidder, attach the job brief, and record the result
                in the relevant room.
              </p>
              <Button href="/marketplace/client/applications" variant="secondary">
                Open applications
              </Button>
            </Card>
          </Stack>
        </div>
        <Card title="Upcoming schedule" meta="Your next evaluation and hiring actions">
          <div className="marketplace-skeleton-grid">
            {events
              .slice()
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map((event) => (
                <div key={event.id}>
                  <span className="eyebrow">
                    {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <strong className="body-strong">{event.title}</strong>
                  <p className="body-sm text-ink-muted">
                    {event.start}–{event.end} · {event.location}
                  </p>
                </div>
              ))}
          </div>
        </Card>
      </Stack>
    </PageBody>
  );
}
