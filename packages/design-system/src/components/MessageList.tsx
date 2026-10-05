import { Badge, type BadgeVariant } from "./Feedback";

import type { ReactNode } from "react";

export type MessageListItem = {
  id: string;
  sender: string;
  subject: string;
  /** The first line of the body, shown after the subject in secondary ink. */
  snippet?: string;
  /** Already formatted, e.g. "1:19 PM" or "Oct 2". */
  time: string;
  isUnread?: boolean;
  tag?: { label: string; variant?: BadgeVariant };
};

/**
 * Mail as one line per message: an unread dot, the sender, the subject with its first
 * line, a label, and the time. Rows stack to two lines in a narrow container. A heading
 * such as "Unread" or "Read" can sit above each group.
 */
export function MessageList({
  items,
  label,
  heading,
  icon,
  selectedId,
  onSelect,
  empty = "No messages.",
}: {
  items: MessageListItem[];
  /** Accessible name for the list. */
  label: string;
  /** A group title above the rows, with its count. */
  heading?: string;
  icon?: ReactNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  empty?: ReactNode;
}) {
  return (
    <section className="os-mail">
      {heading ? (
        <header className="os-mail-heading">
          {icon ? <span className="os-mail-heading-icon">{icon}</span> : null}
          <span>{heading}</span>
          <span className="os-mail-count">{items.length}</span>
        </header>
      ) : null}
      {items.length === 0 ? (
        <p className="os-mail-empty">{empty}</p>
      ) : (
        <ul className="os-mail-list" aria-label={label}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="os-mail-row"
                data-unread={item.isUnread || undefined}
                aria-current={selectedId === item.id || undefined}
                onClick={() => onSelect?.(item.id)}
              >
                <span className="os-mail-dot" aria-label={item.isUnread ? "Unread" : undefined} />
                <span className="os-mail-sender">{item.sender}</span>
                <span className="os-mail-text">
                  <span className="os-mail-subject">{item.subject}</span>
                  {item.snippet ? <span className="os-mail-snippet"> — {item.snippet}</span> : null}
                </span>
                <span className="os-mail-tag">
                  {item.tag ? <Badge label={item.tag.label} variant={item.tag.variant} /> : null}
                </span>
                <span className="os-mail-time">{item.time}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
