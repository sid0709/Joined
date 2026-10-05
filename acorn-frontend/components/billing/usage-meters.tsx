import { ProgressBar, Stack, Text } from "sid-ui";
import type { PlanLimits } from "@/lib/billing";

const WARN = 0.8;
const FULL = 1;

type Meter = { label: string; used: number; limit: number | null };

/** What this cycle has used against the plan's limits. */
export function UsageMeters({
  used,
  limits,
}: {
  used: Record<keyof PlanLimits, number>;
  limits: PlanLimits;
}) {
  const meters: Meter[] = [
    { label: "Applications", used: used.applications, limit: limits.applications },
    { label: "Resume drafts", used: used.drafts, limit: limits.drafts },
    { label: "Gmail mailboxes", used: used.mailboxes, limit: limits.mailboxes },
  ];
  return (
    <Stack gap={4}>
      {meters.map((meter) =>
        meter.limit === null ? (
          <Stack key={meter.label} gap={1}>
            <Text weight="semibold">{meter.label}</Text>
            <Text color="secondary">{`${meter.used.toLocaleString()} used · no limit`}</Text>
          </Stack>
        ) : (
          <ProgressBar
            key={meter.label}
            label={meter.label}
            value={Math.min(meter.used, meter.limit)}
            max={meter.limit}
            hasValueLabel
            formatValueLabel={(value, max) =>
              `${value.toLocaleString()} of ${max.toLocaleString()}`
            }
            variant={
              meter.used / meter.limit >= FULL
                ? "error"
                : meter.used / meter.limit >= WARN
                  ? "warning"
                  : "accent"
            }
          />
        ),
      )}
    </Stack>
  );
}
