"use client";

import { useCallback, useMemo, useState } from "react";
import { formatClock } from "@/lib/dates";
import { TODAY, matchesQuery, type InboxFilter, type MailThread } from "@/lib/messages";

function markRead(threads: MailThread[], id: string | null) {
  return threads.map((thread) => (thread.id === id ? { ...thread, unread: 0 } : thread));
}

/**
 * Inbox state: which conversation is open, the list's search and view, per-thread
 * drafts, and local changes (read, archived, sent) until the messaging API lands.
 */
export function useInbox(initial: MailThread[]) {
  const firstId = initial[0]?.id ?? null;
  // The first conversation opens on arrival, so it starts read.
  const [threads, setThreads] = useState(() => markRead(initial, firstId));
  const [selectedId, setSelectedId] = useState<string | null>(firstId);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<InboxFilter>("inbox");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const isArchived = useCallback((id: string) => archivedIds.includes(id), [archivedIds]);

  const visible = useMemo(
    () =>
      threads.filter((thread) => {
        if (!matchesQuery(thread, query)) return false;
        if (filter === "archived") return isArchived(thread.id);
        if (isArchived(thread.id)) return false;
        // Keep the open conversation listed after reading it, so Unread doesn't jump.
        if (filter === "unread") return thread.unread > 0 || thread.id === selectedId;
        return true;
      }),
    [threads, query, filter, isArchived, selectedId],
  );

  const active = threads.filter((thread) => !isArchived(thread.id));
  const counts: Record<InboxFilter, number> = {
    inbox: active.length,
    unread: active.filter((thread) => thread.unread > 0).length,
    archived: archivedIds.length,
  };

  const open = (id: string) => {
    setSelectedId(id);
    setThreads((current) => markRead(current, id));
  };

  const send = (id: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    setThreads((current) =>
      current.map((thread) =>
        thread.id === id
          ? {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id: `${id}-${thread.messages.length}`,
                  from: "you",
                  text: body,
                  day: TODAY,
                  time: formatClock(new Date()),
                  status: "sent",
                },
              ],
            }
          : thread,
      ),
    );
    setDrafts((current) => ({ ...current, [id]: "" }));
  };

  const markUnread = (id: string) =>
    setThreads((current) =>
      current.map((thread) =>
        thread.id === id ? { ...thread, unread: Math.max(thread.unread, 1) } : thread,
      ),
    );

  const toggleArchive = (id: string) =>
    setArchivedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  return {
    threads: visible,
    selected: threads.find((thread) => thread.id === selectedId) ?? null,
    open,
    close: () => setSelectedId(null),
    filter,
    setFilter,
    query,
    setQuery,
    counts,
    draftFor: (id: string) => drafts[id] ?? "",
    setDraft: (id: string, text: string) => setDrafts((current) => ({ ...current, [id]: text })),
    send,
    markUnread,
    isArchived,
    toggleArchive,
  };
}

export type InboxState = ReturnType<typeof useInbox>;
