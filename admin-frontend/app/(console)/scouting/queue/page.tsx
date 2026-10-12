import type { Metadata } from "next";
import type { AdminList, AdminSubmission } from "@joined/scout";
import { QueueBrowser } from "@/components/scouting/queue-browser";
import { positiveInt } from "@/lib/format";
import { param, type SearchParams } from "@/lib/page";
import { queueFilter, submissionsPath } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Review queue" };

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filters = {
    status: queueFilter(param(query.status) || null),
    q: param(query.q),
    channel: param(query.channel),
    page: positiveInt(param(query.page), 1),
  };
  const path = submissionsPath(filters);
  const list = await adminGet<AdminList<AdminSubmission>>(path);
  return <QueueBrowser initialPath={path} initialList={list} />;
}
