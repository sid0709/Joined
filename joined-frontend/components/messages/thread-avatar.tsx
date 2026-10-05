import { Avatar, type AvatarSize } from "sid-ui";
import type { MailThread } from "@/lib/messages";

/** Companies and Joined get a rounded tile, people a circle — the shape says who you're talking to. */
export function ThreadAvatar({ thread, size }: { thread: MailThread; size: AvatarSize }) {
  return (
    <Avatar
      name={thread.title}
      size={size}
      shape={thread.kind === "person" ? "circle" : "rounded"}
      tooltip={false}
    />
  );
}
