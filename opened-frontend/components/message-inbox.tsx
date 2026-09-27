"use client";

import { useState } from "react";
import {
  Avatar,
  Card,
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
  GridColumn,
  GridSystem,
  List,
  ListItem,
} from "@openseat/design-system";
import { THREADS, type MailMessage } from "@/lib/account";

const THREAD_HEIGHT = 520;

export function MessageInbox() {
  const [threadId, setThreadId] = useState(THREADS[0].id);
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<Record<string, MailMessage[]>>({});
  const thread = THREADS.find((item) => item.id === threadId) ?? THREADS[0];
  const messages = [...thread.messages, ...(extra[thread.id] ?? [])];

  return (
    <GridSystem gap={4}>
      <GridColumn span={12} lg={4}>
        <Card padding={2}>
          <List>
            {THREADS.map((item) => (
              <ListItem
                key={item.id}
                label={item.title}
                description={item.preview}
                isSelected={item.id === thread.id}
                onClick={() => setThreadId(item.id)}
              />
            ))}
          </List>
        </Card>
      </GridColumn>
      <GridColumn span={12} lg={8}>
        <Card height={THREAD_HEIGHT} padding={0}>
          <ChatLayout
            composer={
              <ChatComposer
                value={draft}
                onChange={setDraft}
                placeholder={`Reply to ${thread.title}`}
                onSubmit={(text) => {
                  const body = text.trim();
                  if (!body) return;
                  const next: MailMessage = { id: `${thread.id}-${messages.length}`, from: "you", text: body, time: "Now" };
                  setExtra((current) => ({ ...current, [thread.id]: [...(current[thread.id] ?? []), next] }));
                  setDraft("");
                }}
              />
            }
          >
            <ChatMessageList>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  sender={message.from === "you" ? "user" : "assistant"}
                  name={message.from === "you" ? "You" : thread.title}
                  avatar={message.from === "you" ? undefined : <Avatar name={thread.title} size="sm" tooltip={false} />}
                  metadata={<ChatMessageMetadata timestamp={message.time} />}
                >
                  <ChatMessageBubble>{message.text}</ChatMessageBubble>
                </ChatMessage>
              ))}
            </ChatMessageList>
          </ChatLayout>
        </Card>
      </GridColumn>
    </GridSystem>
  );
}
