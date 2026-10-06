import { Fragment } from "react";
import {
  ChatMessage,
  ChatMessageBubble,
  ChatMessageMetadata,
  ChatSystemMessage,
  Icon,
  icons,
} from "sid-ui";
import { bubblePosition, groupMessages, type MailThread } from "@/lib/messages";
import { ThreadAvatar } from "./thread-avatar";

/**
 * A conversation as people read it: a divider per day, consecutive messages
 * stacked under one name and avatar, events (a scheduled round, an application)
 * as quiet centered notes, and a delivery receipt on your last message.
 */
export function MessageRuns({ thread }: { thread: MailThread }) {
  const runs = groupMessages(thread.messages);

  return runs.map((run, index) => {
    const newDay = index === 0 || runs[index - 1].day !== run.day;
    const divider = newDay ? (
      <ChatSystemMessage variant="divider">{run.day}</ChatSystemMessage>
    ) : null;
    const key = run.messages[0].id;

    if (run.from === "event") {
      return (
        <Fragment key={key}>
          {divider}
          {run.messages.map((event) => (
            <ChatSystemMessage key={event.id} icon={<Icon icon={icons.calendar} size="sm" />}>
              {`${event.text} · ${event.time}`}
            </ChatSystemMessage>
          ))}
        </Fragment>
      );
    }

    const isYou = run.from === "you";
    const count = run.messages.length;
    return (
      <Fragment key={key}>
        {divider}
        <ChatMessage
          sender={isYou ? "user" : "assistant"}
          avatar={isYou ? undefined : <ThreadAvatar thread={thread} size="sm" />}
        >
          {run.messages.map((message, position) => (
            <ChatMessageBubble
              key={message.id}
              group={bubblePosition(position, count)}
              name={!isYou && position === 0 ? thread.title : undefined}
              metadata={
                position === count - 1 ? (
                  <ChatMessageMetadata
                    timestamp={message.time}
                    status={isYou ? message.status : undefined}
                  />
                ) : undefined
              }
            >
              {message.text}
            </ChatMessageBubble>
          ))}
        </ChatMessage>
      </Fragment>
    );
  });
}
