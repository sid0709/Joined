"use client";

import { Card, Glyph, MessageList, type MessageListItem } from "sid-ui";
import { useState } from "react";

import { Examples, Preview } from "./shared";

const NARROW_WIDTH = 360;

const UNREAD: MessageListItem[] = [
  {
    id: "1",
    sender: "Avery Chen",
    subject: "Interview request",
    snippet: "Could you do a 30-minute call on Thursday?",
    time: "1:19 PM",
    isUnread: true,
    tag: { label: "Interview", variant: "blue" },
  },
  {
    id: "2",
    sender: "Lumen Recruiting",
    subject: "Next step for the platform role",
    snippet: "Please confirm your salary range.",
    time: "1:05 PM",
    isUnread: true,
    tag: { label: "Next step", variant: "purple" },
  },
  {
    id: "3",
    sender: "Harbor Health",
    subject: "Application received",
    snippet: "Thanks for applying.",
    time: "12:20 PM",
    isUnread: true,
  },
];

const READ: MessageListItem[] = [
  {
    id: "4",
    sender: "Quill",
    subject: "An update on your application",
    snippet: "We have decided to move forward with other candidates.",
    time: "Oct 1",
    tag: { label: "Closed", variant: "neutral" },
  },
];

export default function MessageListDemo() {
  const [selected, setSelected] = useState<string | null>("1");
  return (
    <Examples>
      <Preview
        label="Grouped inbox"
        description="Unread rows carry the accent dot and semibold sender and subject. The selected row takes the accent wash."
      >
        <MessageList
          label="Unread mail"
          heading="Unread"
          icon={<Glyph name="mail" />}
          items={UNREAD}
          selectedId={selected}
          onSelect={setSelected}
        />
        <MessageList
          label="Read mail"
          heading="Read"
          icon={<Glyph name="check" />}
          items={READ}
          selectedId={selected}
          onSelect={setSelected}
        />
      </Preview>
      <Preview
        align="start"
        label="Narrow"
        description="Below 560px of its own width a row stacks to two lines."
      >
        <Card padding={2} width={NARROW_WIDTH}>
          <MessageList
            label="Unread mail"
            items={UNREAD}
            selectedId={selected}
            onSelect={setSelected}
          />
        </Card>
      </Preview>
      <Preview label="Empty">
        <MessageList
          label="Archived mail"
          heading="Archived"
          items={[]}
          empty="Nothing archived yet."
        />
      </Preview>
    </Examples>
  );
}
