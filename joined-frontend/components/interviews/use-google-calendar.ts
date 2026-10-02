"use client";

import { useEffect, useState } from "react";
import { EMPTY_FEED, monthWindow, type GoogleCalendarFeed } from "@/lib/google-calendar";
import { fetchGoogleEvents } from "@/lib/me/pipeline";

const UNAVAILABLE: GoogleCalendarFeed = { status: "unavailable", events: [] };

/** The job hunter's Google Calendar for the month around `day`, loaded as the month changes. */
export function useGoogleCalendar(day: Date) {
  const { from, to } = monthWindow(day);
  const [feed, setFeed] = useState<GoogleCalendarFeed>(EMPTY_FEED);

  useEffect(() => {
    let isCurrent = true;
    fetchGoogleEvents(from, to)
      .then((next) => {
        if (isCurrent) setFeed(next);
      })
      .catch(() => {
        if (isCurrent) setFeed(UNAVAILABLE);
      });
    return () => {
      isCurrent = false;
    };
  }, [from, to]);

  return feed;
}
