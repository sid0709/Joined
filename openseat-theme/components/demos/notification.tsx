"use client";

import {
  Avatar,
  Button,
  Heading,
  HStack,
  Icon,
  Link,
  Notification,
  NotificationList,
  icons,
  useNotification,
  type NotificationPosition,
  type NotificationTone,
} from "@openseat/design-system";
import { useState } from "react";

import { Examples, PEOPLE, Preview, Row } from "./shared";

const POSITIONS: NotificationPosition[] = ["topStart", "topEnd", "bottomStart", "bottomEnd"];

function Triggers() {
  const notify = useNotification();
  return (
    <Row>
      {POSITIONS.map((position) => (
        <Button
          key={position}
          label={position}
          onClick={() =>
            notify({
              position,
              tone: position.endsWith("End") ? "success" : "accent",
              title: position.startsWith("top") ? "Invite sent" : "New bid received",
              description: `Shown at ${position}. It leaves on its own, or use the close button.`,
            })
          }
        />
      ))}
      <Button
        label="Stay until dismissed"
        variant="secondary"
        onClick={() =>
          notify({
            position: "bottomEnd",
            tone: "warning",
            duration: 0,
            title: "Payment method expired",
            description: "Update it in settings. This one stays until you close it.",
          })
        }
      />
    </Row>
  );
}

const TONES: { tone: NotificationTone; title: string; description: string }[] = [
  { tone: "accent", title: "Alex Rivera submitted a bid", description: "Brand refresh · $2,400" },
  { tone: "success", title: "Room published", description: "Three invitees were notified." },
  { tone: "warning", title: "Closing in 2 hours", description: "Two invitees haven’t bid yet." },
  {
    tone: "danger",
    title: "Payment failed",
    description: "Update your card to keep escrow active.",
  },
  { tone: "neutral", title: "Sam Okafor viewed the brief", description: "No action needed." },
];

const FEED = [
  {
    id: "bid",
    who: PEOPLE[1].name,
    title: "submitted a bid on Brand refresh",
    description: "$2,400 · sealed until Friday",
    time: "2m",
    tone: "accent" as const,
  },
  {
    id: "question",
    who: PEOPLE[2].name,
    title: "asked a question on Landing page copy",
    description: "“Is the voice formal or conversational?”",
    time: "1h",
    tone: "accent" as const,
  },
  {
    id: "invite",
    who: PEOPLE[4].name,
    title: "accepted your invite",
    description: "Pitch deck",
    time: "3h",
    tone: "success" as const,
  },
  {
    id: "files",
    who: PEOPLE[0].name,
    title: "uploaded final files",
    description: "Motion system · 4 files",
    time: "1d",
    tone: "neutral" as const,
  },
];

export default function NotificationDemo() {
  const [unread, setUnread] = useState<string[]>(["bid", "question", "invite"]);
  const [gone, setGone] = useState<string[]>([]);
  const visible = FEED.filter((item) => !gone.includes(item.id));

  return (
    <Examples>
      <Preview
        align="start"
        label="Trigger"
        description="useNotification() shows a message at a corner — top or bottom, start or end."
      >
        <Triggers />
      </Preview>

      <Preview
        label="Tones"
        description="The mark carries the tone. The title still says what happened."
      >
        <NotificationList label="Tone examples">
          {TONES.map((item) => (
            <Notification
              key={item.tone}
              unread
              tone={item.tone}
              title={item.title}
              description={item.description}
              time="Just now"
            />
          ))}
        </NotificationList>
      </Preview>

      <Preview
        label="Read and unread"
        description="Unread items are semibold with a mark. Read items stay quiet."
      >
        <NotificationList label="Read state">
          <Notification
            unread
            title="New bid on Brand refresh"
            description="Alex Rivera · $2,400"
            time="2m"
            start={<Avatar name={PEOPLE[1].name} size="sm" tooltip={false} />}
          />
          <Notification
            title="You published Landing page copy"
            description="Invitees can bid now."
            time="Yesterday"
            start={<Avatar name={PEOPLE[0].name} size="sm" tooltip={false} />}
          />
        </NotificationList>
      </Preview>

      <Preview
        label="Inbox"
        description="Dismiss one, or mark the rest read. A link is the row’s next step."
      >
        <NotificationList
          header={
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>Notifications</Heading>
              <Button
                label="Mark all read"
                size="sm"
                variant="ghost"
                isDisabled={unread.length === 0}
                onClick={() => setUnread([])}
              />
            </HStack>
          }
        >
          {visible.map((item) => (
            <Notification
              key={item.id}
              unread={unread.includes(item.id)}
              tone={item.tone}
              title={
                <>
                  {item.who} {item.title}
                </>
              }
              description={item.description}
              time={item.time}
              start={<Avatar name={item.who} size="sm" tooltip={false} />}
              action={item.id === "bid" ? <Link href="#bid">Review</Link> : undefined}
              onClick={() => setUnread((ids) => ids.filter((id) => id !== item.id))}
              onDismiss={() => setGone((ids) => [...ids, item.id])}
            />
          ))}
          {visible.length === 0 && (
            <Notification
              title="You’re all caught up"
              description="We’ll let you know when a bid comes in."
              start={<Icon icon={icons.bell} />}
            />
          )}
        </NotificationList>
      </Preview>
    </Examples>
  );
}
