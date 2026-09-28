import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { List, ScoutNotification } from "@openseat/scout";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { PAGE_LIMIT } from "@/lib/config";
import { param, type SearchParams } from "@/lib/page";
import { ROUTES, signInHref } from "@/lib/routes";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const cursor = param((await searchParams).cursor);
  const search = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) search.set("cursor", cursor);
  const list = await scoutGet<List<ScoutNotification>>(`/notifications?${search.toString()}`);
  if (!list) redirect(signInHref(ROUTES.notifications));
  return (
    <NotificationsView
      items={list.data}
      nextCursor={list.next_cursor}
      hasCursor={Boolean(cursor)}
    />
  );
}
