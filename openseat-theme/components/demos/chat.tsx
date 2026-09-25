"use client";

import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  ChatComposer,
  ChatComposerDrawer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
  ChatSystemMessage,
  ChatToolCalls,
  EmptyState,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  Thumbnail,
  icons,
  type ChatMessageStatus,
  type ChatToolCallItem,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, SAMPLE_IMAGES } from "./shared";

const THREAD_HEIGHT = 440;
const STREAM_MS = 35;
const STREAM_STEP = 3;
const TOOL_MS = 700;
const REPLY =
  "Here’s the summary: Dana is fastest at 10 days, Alex is cheapest at $2,150, and Jordan sits in the middle on both. If the deadline matters most, award Dana.";
const SUGGESTIONS = ["Summarize the bids", "Who is cheapest?", "Draft an award note"];

type Message = { id: number; sender: "user" | "assistant"; text: string; status?: ChatMessageStatus; time: string };

function now() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function SupportThread() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: "assistant", text: "Hi Jordan — thanks for posting Brand refresh.", time: "9:02 AM" },
    { id: 2, sender: "assistant", text: "Do you want the logo files as SVG as well as PNG?", time: "9:02 AM" },
    { id: 3, sender: "user", text: "Yes please, both. And a one-page usage guide.", status: "read", time: "9:05 AM" },
  ]);
  const nextId = useRef(4);

  return (
    <Card height={THREAD_HEIGHT} padding={0}>
      <ChatLayout
        composer={
          <ChatComposer
            value={draft}
            onChange={setDraft}
            placeholder="Reply to Dana"
            onSubmit={(text) => {
              if (!text.trim()) return;
              const id = nextId.current++;
              setMessages((m) => [...m, { id, sender: "user", text, status: "sending", time: now() }]);
              setDraft("");
              setTimeout(() => setMessages((m) => m.map((x) => (x.id === id ? { ...x, status: "delivered" } : x))), TOOL_MS);
            }}
          />
        }
      >
        <ChatMessageList>
          <ChatSystemMessage variant="divider">Today</ChatSystemMessage>
          <ChatSystemMessage icon={<Icon icon={icons.lock} size="sm" />}>Dana joined the sealed room</ChatSystemMessage>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const group = prev?.sender === m.sender ? (next?.sender === m.sender ? "middle" : "last") : next?.sender === m.sender ? "first" : undefined;
            return (
              <ChatMessage
                key={m.id}
                sender={m.sender}
                name={m.sender === "assistant" && group !== "middle" && group !== "last" ? "Dana Kim" : undefined}
                avatar={m.sender === "assistant" ? <Avatar name="Dana Kim" size="sm" tooltip={false} /> : undefined}
                metadata={!next || next.sender !== m.sender ? <ChatMessageMetadata timestamp={m.time} status={m.status} /> : undefined}
              >
                <ChatMessageBubble group={group}>{m.text}</ChatMessageBubble>
              </ChatMessage>
            );
          })}
        </ChatMessageList>
      </ChatLayout>
    </Card>
  );
}

function Assistant() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ id: number; sender: "user" | "assistant"; text: string; tools?: ChatToolCallItem[] }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextId = useRef(1);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStreaming(false);
  };

  useEffect(() => stop, []);

  const ask = (text: string) => {
    if (!text.trim() || streaming) return;
    const reply = nextId.current + 1;
    nextId.current += 2;
    setMessages((m) => [
      ...m,
      { id: reply - 1, sender: "user", text },
      {
        id: reply,
        sender: "assistant",
        text: "",
        tools: [
          { name: "Read bids", target: "Brand refresh", status: "running" },
          { name: "Compare prices", status: "pending" },
        ],
      },
    ]);
    setDraft("");
    setStreaming(true);
    setTimeout(() => {
      setMessages((m) =>
        m.map((x) =>
          x.id === reply
            ? { ...x, tools: [{ name: "Read bids", target: "Brand refresh", status: "complete", duration: "0.4s" }, { name: "Compare prices", status: "complete", duration: "0.2s" }] }
            : x,
        ),
      );
      let shown = 0;
      timer.current = setInterval(() => {
        shown = Math.min(REPLY.length, shown + STREAM_STEP);
        setMessages((m) => m.map((x) => (x.id === reply ? { ...x, text: REPLY.slice(0, shown) } : x)));
        if (shown === REPLY.length) stop();
      }, STREAM_MS);
    }, TOOL_MS);
  };

  return (
    <Card height={THREAD_HEIGHT} padding={0}>
      <ChatLayout
        composer={
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={ask}
            placeholder="Ask about your bids"
            isStopShown={streaming}
            onStop={stop}
            headerContext={<Text type="supporting" color="secondary">Context: Brand refresh · 3 bids</Text>}
          />
        }
        emptyState={
          <EmptyState
            icon={<Icon icon={icons.sparkle} size="lg" color="accent" />}
            title="Ask about this room"
            description="Summaries, comparisons, and drafts — grounded in your bids."
            actions={
              <HStack gap={2} wrap="wrap" hAlign="center">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} label={s} size="sm" variant="secondary" onClick={() => ask(s)} />
                ))}
              </HStack>
            }
          />
        }
      >
        {messages.length > 0 && (
          <ChatMessageList isStreaming={streaming}>
            {messages.map((m) =>
              m.sender === "user" ? (
                <ChatMessage key={m.id} sender="user">
                  <ChatMessageBubble>{m.text}</ChatMessageBubble>
                </ChatMessage>
              ) : (
                <ChatMessage key={m.id} sender="assistant" name="OpenSeat" avatar={<Avatar name="OpenSeat" size="sm" tooltip={false} />}>
                  <Stack gap={2}>
                    {m.tools && <ChatToolCalls calls={m.tools} defaultIsExpanded />}
                    {m.text && <ChatMessageBubble variant="ghost">{m.text}</ChatMessageBubble>}
                  </Stack>
                </ChatMessage>
              ),
            )}
          </ChatMessageList>
        )}
      </ChatLayout>
    </Card>
  );
}

function ComposerOptions() {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>(["brief.pdf", "moodboard.svg"]);
  const [sent, setSent] = useState<string | null>(null);

  return (
    <Stack gap={3}>
      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSubmit={(text) => {
          setSent(`${text || "(no text)"} · ${files.length} file${files.length === 1 ? "" : "s"}`);
          setDraft("");
          setFiles([]);
        }}
        placeholder="Write a message"
        elevation="low"
        drawer={
          files.length ? (
            <ChatComposerDrawer count={files.length} label="Attachments">
              <HStack gap={2}>
                {files.map((f) => (
                  <Thumbnail key={f} src={f.endsWith(".svg") ? SAMPLE_IMAGES.window : undefined} label={f} alt={f} onRemove={() => setFiles((all) => all.filter((x) => x !== f))} showRemoveOn="always" />
                ))}
              </HStack>
            </ChatComposerDrawer>
          ) : undefined
        }
        footerActions={
          <HStack gap={1}>
            <IconButton label="Attach a file" variant="ghost" size="sm" icon={<Icon icon={icons.upload} />} onClick={() => setFiles((all) => [...all, `file-${all.length + 1}.pdf`])} />
            <IconButton label="Add an image" variant="ghost" size="sm" icon={<Icon icon={icons.image} />} onClick={() => setFiles((all) => [...all, `image-${all.length + 1}.svg`])} />
          </HStack>
        }
      />
      <Caption>{sent ? `Sent: ${sent}` : "Attach files, then send."}</Caption>
      <ChatComposer onSubmit={() => undefined} placeholder="Offline" status={{ type: "error", message: "You’re offline — messages will send when you reconnect." }} />
      <ChatComposer onSubmit={() => undefined} placeholder="This room is closed" isDisabled density="compact" />
    </Stack>
  );
}

export default function ChatDemo() {
  return (
    <Examples>
      <Preview label="Room thread" description="Grouped bubbles, names, avatars, read receipts, and system lines. Send a reply to see it deliver.">
        <SupportThread />
      </Preview>

      <Preview label="Assistant" description="Suggestions in the empty state, tool calls, a streamed answer, and Stop while it types.">
        <Assistant />
      </Preview>

      <Preview label="Bubble variants" description="filled for people, ghost for long assistant answers.">
        <Card padding={4}>
          <ChatMessageList>
            <ChatMessage sender="user">
              <ChatMessageBubble variant="filled">Filled bubble from the user.</ChatMessageBubble>
            </ChatMessage>
            <ChatMessage sender="assistant" name="OpenSeat">
              <ChatMessageBubble variant="ghost">Ghost bubble — reads like a document, good for long answers with lists and code.</ChatMessageBubble>
            </ChatMessage>
            <ChatMessage sender="assistant" name={PEOPLE[1].name} avatar={<Avatar name={PEOPLE[1].name} size="sm" tooltip={false} />}>
              <ChatMessageBubble variant="filled">Filled bubble from another person.</ChatMessageBubble>
            </ChatMessage>
          </ChatMessageList>
        </Card>
      </Preview>

      <Preview label="Delivery status" description="sending, sent, delivered, read, or error under the last message.">
        <Card padding={4}>
          <ChatMessageList>
            {(["sending", "sent", "delivered", "read", "error"] as ChatMessageStatus[]).map((status) => (
              <ChatMessage key={status} sender="user" metadata={<ChatMessageMetadata timestamp="9:41 AM" status={status} />}>
                <ChatMessageBubble>Status: {status}</ChatMessageBubble>
              </ChatMessage>
            ))}
          </ChatMessageList>
        </Card>
      </Preview>

      <Preview label="Tool calls" description="Show what the assistant did — running, finished, or failed, with stats.">
        <ChatToolCalls
          defaultIsExpanded
          calls={[
            { name: "Search rooms", target: "“brand”", status: "complete", duration: "0.3s" },
            { name: "Update brief", target: "brief.md", status: "complete", additions: 12, deletions: 3 },
            { name: "Send invites", status: "running" },
            { name: "Charge card", status: "error", errorMessage: "Card declined." },
          ]}
        />
      </Preview>

      <Preview label="Composer" description="Attachments in a drawer, footer actions, an error status, and a disabled state.">
        <ComposerOptions />
      </Preview>
    </Examples>
  );
}
