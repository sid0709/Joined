"use client";

import { Banner, Button, Link, Text, useToast } from "sid-ui";
import type { GoogleCalendarFeed } from "@/lib/google-calendar";
import { startGoogleCalendar } from "@/lib/me/pipeline";
import { ROUTES } from "@/lib/routes";

/** Says where the grey events come from, or what to do when Google can't be read. */
export function GoogleCalendarNotice({ feed }: { feed: GoogleCalendarFeed }) {
  const toast = useToast();

  const reconnect = async () => {
    try {
      const started = await startGoogleCalendar();
      window.location.assign(started.url);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not open Google.",
        type: "error",
      });
    }
  };

  switch (feed.status) {
    case "connected":
      return (
        <Text type="supporting" color="secondary">
          Grey events are from your Google Calendar{feed.email ? ` (${feed.email})` : ""}. Only you
          see them.
        </Text>
      );
    case "reconnect":
      return (
        <Banner
          status="warning"
          title="Reconnect Google Calendar"
          description="Google stopped sharing your calendar with Joined. Reconnect to see your events here again."
          endContent={
            <Button label="Reconnect" variant="secondary" size="sm" clickAction={reconnect} />
          }
        />
      );
    case "unavailable":
      return (
        <Banner
          status="info"
          title="Couldn’t load your Google Calendar"
          description="Your Joined interviews are all here. Your Google events will be back when you reload."
        />
      );
    default:
      return (
        <Text type="supporting" color="secondary">
          See your other events here: <Link href={ROUTES.settings}>connect Google Calendar</Link> in
          Settings.
        </Text>
      );
  }
}
