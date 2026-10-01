import { Badge, Button, Glyph, HStack, ScrollableArea, ToggleButton } from "@joined/design-system";
import { formatAmount, type JobFilters } from "@/lib/jobs";
import { DEFAULT_CURRENCY } from "@/lib/profile";

const QUICK_PAY_FLOOR = 150_000;
const QUICK_POSTED = "7d";

type Props = {
  filters: JobFilters;
  refinementCount: number;
  onChange: (patch: Partial<JobFilters>) => void;
  onOpenFilters: () => void;
};

function without<T>(values: T[], value: T) {
  return values.filter((item) => item !== value);
}

/** The full filter panel and the one-tap refinements people reach for most. Scrolls sideways on phones. */
export function JobFilterToolbar({ filters, refinementCount, onChange, onOpenFilters }: Props) {
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
          label="Remote"
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
          label="Hidden jobs"
          icon={<Glyph name="eye" />}
          isPressed={hidden}
          onPressedChange={(on) =>
            onChange({
              source: on ? [...filters.source, "scouted"] : without(filters.source, "scouted"),
            })
          }
        />
        <ToggleButton
          label="Visa sponsor"
          icon={<Glyph name="seat" />}
          isPressed={filters.visa}
          onPressedChange={(on) => onChange({ visa: on })}
        />
        <ToggleButton
          label="Past week"
          icon={<Glyph name="clock" />}
          isPressed={thisWeek}
          onPressedChange={(on) => onChange({ posted: on ? QUICK_POSTED : "any" })}
        />
        <ToggleButton
          label={`${formatAmount(QUICK_PAY_FLOOR, DEFAULT_CURRENCY)}+`}
          isPressed={wellPaid}
          onPressedChange={(on) => onChange({ minPay: on ? QUICK_PAY_FLOOR : 0 })}
        />
      </HStack>
    </ScrollableArea>
  );
}
