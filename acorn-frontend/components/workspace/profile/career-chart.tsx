import { BarChart } from "@joined/design-system";
import { MONTHS_PER_YEAR, monthsInRole, type ApplicantProfile } from "@/lib/workspace/profile";

const years = (months: number) => `${Math.round((months / MONTHS_PER_YEAR) * 10) / 10} yrs`;

/** Time in each role, so the longest stretches stand out. */
export function CareerChart({ profile, today }: { profile: ApplicantProfile; today: Date }) {
  const roles = profile.timeline.filter((entry) => entry.kind === "role" && entry.org);
  if (roles.length === 0) return null;
  return (
    <BarChart
      label="Time in each role"
      orientation="bars"
      formatValue={years}
      data={roles.map((entry) => ({
        label: entry.org,
        value: monthsInRole(entry, today),
        tone: entry.current ? "blue" : "neutral",
      }))}
    />
  );
}
