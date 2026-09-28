"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatClock } from "@/lib/dates";
import { MESSAGE_POLL_MS } from "@/lib/me/client";
import {
  TODAY,
  matchesQuery,
  type InboxFilter,
  type MailMessage,
  type MailThread,
} from "@/lib/messages";

function markRead(threads: MailThread[], id: string | null) {
  return threads.map((thread) => (thread.id === id ? { ...thread, unread: 0 } : thread));
}

type InboxOptions = {
  sendMessage?: (id: string, text: string) => Promise<MailMessage>;
  refreshThread?: (id: string) => Promise<MailThread>;
};

/**
 * Inbox state: which conversation is open, the list's search and view, per-thread
 * drafts, and persisted sends when a messaging API is passed in.
 */
export function useInbox(initial: MailThread[], options: InboxOptions = {}) {
  const firstId = initial[0]?.id ?? null;
  const [threads, setThreads] = useState(() => markRead(initial, firstId));
  const [selectedId, setSelectedId] = useState<string | null>(firstId);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<InboxFilter>("inbox");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const refreshThread = options.refreshThread;
  const sendMessage = options.sendMessage;

  const isArchived = useCallback((id: string) => archivedIds.includes(id), [archivedIds]);

  const visible = useMemo(
    () =>
      threads.filter((thread) => {
        if (!matchesQuery(thread, query)) return false;
        if (filter === "archived") return isArchived(thread.id);
        if (isArchived(thread.id)) return false;
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
    if (refreshThread) {
      void refreshThread(id).then((thread) => {
        setThreads((current) =>
          current.map((item) => (item.id === thread.id ? { ...thread, unread: 0 } : item)),
        );
      });
    }
  };

  const send = (id: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    const local: MailMessage = {
      id: `${id}-${Date.now()}`,
      from: "you",
      text: body,
      day: TODAY,
      time: formatClock(new Date()),
      status: "sent",
    };
    setThreads((current) =>
      current.map((thread) =>
        thread.id === id ? { ...thread, messages: [...thread.messages, local] } : thread,
      ),
    );
    setDrafts((current) => ({ ...current, [id]: "" }));
    if (sendMessage) {
      void sendMessage(id, body).then((message) => {
        setThreads((current) =>
          current.map((thread) =>
            thread.id === id
              ? {
                  ...thread,
                  messages: thread.messages.map((item) => (item.id === local.id ? message : item)),
                }
              : thread,
          ),
        );
      });
    }
  };

  useEffect(() => {
    if (!selectedId || !refreshThread) return;
    const timer = window.setInterval(() => {
      void refreshThread(selectedId).then((thread) => {
        setThreads((current) =>
          current.map((item) => (item.id === thread.id ? { ...thread, unread: 0 } : item)),
        );
      });
    }, MESSAGE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [selectedId, refreshThread]);

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
