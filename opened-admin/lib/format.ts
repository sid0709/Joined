import type { TempJob } from "@/lib/jobs";

export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatCount(value: number): string {
  return value.toLocaleString("en");
}

export function jobLocation(job: TempJob): string {
  const details = job.metadata?.details;
  return [details?.location, details?.remote].filter(Boolean).join(" · ");
}

export function pageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  const adjusted = Math.max(1, end - 4);
  const pages: number[] = [];
  for (let current = adjusted; current <= end; current += 1) {
    pages.push(current);
  }
  return pages;
}
