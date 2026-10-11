import { Banner } from "sid-ui";
import { formatTime, type ComponentStatus, type StatusPage } from "@/lib/status";

const SUMMARY: Record<
  ComponentStatus,
  { status: "success" | "warning" | "error" | "info"; title: string }
> = {
  operational: { status: "success", title: "All systems operational" },
  degraded: { status: "warning", title: "Some systems are running slowly" },
  partial_outage: { status: "warning", title: "Some systems are down" },
  major_outage: { status: "error", title: "Major outage" },
  unknown: { status: "info", title: "Live checks are unavailable" },
};

/** The one-line answer at the top: is Joined working right now? */
export function StatusSummary({ page }: { page: StatusPage | null }) {
  if (!page) {
    return (
      <Banner
        status="error"
        title="We can’t reach Joined’s servers"
        description="This page reads its status from them, so Joined is likely down. Please try again in a few minutes."
      />
    );
  }
  const summary = SUMMARY[page.status];
  const checked = `Checked ${formatTime(page.updatedAt)}.`;
  return (
    <Banner
      status={summary.status}
      title={summary.title}
      description={
        page.live ? checked : `${checked} The incidents below are current; uptime may lag.`
      }
    />
  );
}
