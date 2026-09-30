import type { Bidder, Inquiry, Task } from "@/src/shared/types/marketplace";

import { InquiryStatusBadge } from "@/src/shared/kit/StatusBadge";
import { relativeTime } from "@/src/shared/lib/format";
import { Avatar } from "@/src/shared/marketplace-ui";

interface ThreadListProps {
  items: { inquiry: Inquiry; bidder: Bidder; task: Task }[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ThreadList({ items, selectedId, onSelect }: ThreadListProps) {
  return (
    <ul className="hx-list">
      {items.map(({ inquiry, bidder, task }) => {
        const last = inquiry.messages[inquiry.messages.length - 1];
        return (
          <li key={inquiry.id}>
            <button
              type="button"
              className="hx-list-item"
              data-active={inquiry.id === selectedId}
              onClick={() => onSelect(inquiry.id)}
              style={{ alignItems: "flex-start" }}
            >
              <Avatar name={bidder.name} size={40} />
              <span className="hx-list-body">
                <span className="hx-row hx-row-between" style={{ flexWrap: "nowrap" }}>
                  <span className="hx-list-title hx-truncate">{bidder.name}</span>
                  <span className="hx-small hx-muted">{last ? relativeTime(last.at) : ""}</span>
                </span>
                <span className="hx-list-meta hx-truncate">{task.title}</span>
                <span className="hx-list-meta hx-truncate">{last?.body}</span>
                <span className="hx-row" style={{ gap: "var(--space-2)" }}>
                  <InquiryStatusBadge status={inquiry.status} />
                  {inquiry.unread > 0 && <span className="hx-unread">{inquiry.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
