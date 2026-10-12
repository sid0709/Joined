import { Badge, Button, Glyph, HStack, ScrollableArea, ToggleButton } from "sid-ui";
import { formatAmount, formatCompactCount, type JobFilters, type SearchFacets } from "@/lib/jobs";
import { DEFAULT_CURRENCY } from "@/lib/profile";

const QUICK_PAY_FLOOR = 150_000;
const QUICK_POSTED = "7d";
const QUICK_POSTED_DAYS = 7;

type Props = {
  filters: JobFilters;
  /** Exact counts per chip, when the search has them (blank queries). */
  facets?: SearchFacets;
  refinementCount: number;
  onChange: (patch: Partial<JobFilters>) => void;
  onOpenFilters: () => void;
};

function without<T>(values: T[], value: T) {
  return values.filter((item) => item !== value);
}

/** "Remote · 23.8K" when a count is known, else just the label. */
function counted(label: string, count: number | undefined) {
  return count === undefined ? label : `${label} · ${formatCompactCount(count)}`;
}

/** The full filter panel and the one-tap refinements people reach for most. Scrolls sideways on phones. */
export function JobFilterToolbar({
  filters,
  facets,
  refinementCount,
  onChange,
  onOpenFilters,
}: Props) {
  const remote = filters.workplace.includes("remote");
  const hidden = filters.source.includes("scouted");
  const thisWeek = filters.posted === QUICK_POSTED;
  const wellPaid = filters.minPay >= QUICK_PAY_FLOOR;

  return (
    <ScrollableArea axis="inline" label="Quick filters" width="100%">
      <HStack gap={2} vAlign="center">
        <Button
          label="All filters"
          variant="secondary"
          icon={<Glyph name="filter" />}
          onClick={onOpenFilters}
          endContent={
            refinementCount ? <Badge label={String(refinementCount)} variant="info" /> : undefined
          }
        />
        <ToggleButton
          label={counted("Remote", facets?.workplace.remote)}
          icon={<Glyph name="home" />}
          isPressed={remote}
          onPressedChange={(on) =>
            onChange({
              workplace: on
                ? [...filters.workplace, "remote"]
                : without(filters.workplace, "remote"),
            })
          }
        />
        <ToggleButton
          label={counted("Hidden jobs", facets?.hidden)}
          icon={<Glyph name="eye" />}
          isPressed={hidden}
          onPressedChange={(on) =>
            onChange({
              source: on ? [...filters.source, "scouted"] : without(filters.source, "scouted"),
            })
          }
        />
        <ToggleButton
          label={counted("Visa sponsor", facets?.visa)}
          icon={<Glyph name="seat" />}
          isPressed={filters.visa}
          onPressedChange={(on) => onChange({ visa: on })}
        />
        <ToggleButton
          label={counted("Past week", facets?.postedDays[String(QUICK_POSTED_DAYS)])}
          icon={<Glyph name="clock" />}
          isPressed={thisWeek}
          onPressedChange={(on) => onChange({ posted: on ? QUICK_POSTED : "any" })}
        />
        <ToggleButton
          label={counted(
            `${formatAmount(QUICK_PAY_FLOOR, DEFAULT_CURRENCY)}+`,
            facets?.payAtLeast[String(QUICK_PAY_FLOOR)],
          )}
          isPressed={wellPaid}
          onPressedChange={(on) => onChange({ minPay: on ? QUICK_PAY_FLOOR : 0 })}
        />
      </HStack>
    </ScrollableArea>
  );
}
