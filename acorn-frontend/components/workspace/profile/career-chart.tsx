import { BarChart } from "sid-ui";
import { formatDuration, monthsInRole, type ApplicantProfile } from "@/lib/workspace/profile";

/** Time in each role, so the longest stretches stand out. */
export function CareerChart({ profile, today }: { profile: ApplicantProfile; today: Date }) {
  const roles = profile.timeline.filter((entry) => entry.kind === "role" && entry.org);
  if (roles.length === 0) return null;
  return (
    <BarChart
      label="Time in each role"
      orientation="bars"
      formatValue={formatDuration}
      data={roles.map((entry) => ({
        label: entry.org,
        value: monthsInRole(entry, today),
        tone: entry.current ? "blue" : "neutral",
      }))}
    />
  );
}
