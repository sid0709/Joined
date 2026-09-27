import { Button, HStack, Text, Token } from "@openseat/design-system";
import {
  EMPLOYMENT_LABEL,
  POSTED_WITHIN,
  SENIORITY_LABEL,
  SOURCE_LABEL,
  WORKPLACE_LABEL,
  formatAmount,
  type JobFilters,
} from "@/lib/jobs";
import { PROFILE } from "@/lib/profile";

type Chip = { key: string; label: string; remove: Partial<JobFilters> };

function chipsFor(filters: JobFilters): Chip[] {
  const chips: Chip[] = [];
  const drop = <T,>(values: T[], value: T) => values.filter((item) => item !== value);
  for (const value of filters.workplace)
    chips.push({
      key: `w-${value}`,
      label: WORKPLACE_LABEL[value],
      remove: { workplace: drop(filters.workplace, value) },
    });
  for (const value of filters.seniority)
    chips.push({
      key: `s-${value}`,
      label: SENIORITY_LABEL[value],
      remove: { seniority: drop(filters.seniority, value) },
    });
  for (const value of filters.employment)
    chips.push({
      key: `e-${value}`,
      label: EMPLOYMENT_LABEL[value],
      remove: { employment: drop(filters.employment, value) },
    });
  for (const value of filters.source)
    chips.push({
      key: `o-${value}`,
      label: SOURCE_LABEL[value],
      remove: { source: drop(filters.source, value) },
    });
  if (filters.minPay > 0)
    chips.push({
      key: "pay",
      label: `${formatAmount(filters.minPay, PROFILE.currency)}+ a year`,
      remove: { minPay: 0 },
    });
  if (filters.posted !== "any") {
    const label =
      POSTED_WITHIN.find((option) => option.value === filters.posted)?.label ?? filters.posted;
    chips.push({ key: "posted", label, remove: { posted: "any" } });
  }
  if (filters.visa) chips.push({ key: "visa", label: "Visa sponsor", remove: { visa: false } });
  return chips;
}

/** Every active refinement as a removable chip, plus one way to clear them all. */
export function JobActiveFilters({
  filters,
  onChange,
  onClearAll,
}: {
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
  onClearAll: () => void;
}) {
  const chips = chipsFor(filters);
  if (chips.length === 0) return null;

  return (
    <HStack gap={2} vAlign="center" wrap="wrap" aria-label="Active filters">
      <Text type="supporting" color="secondary">
        Filtered by
      </Text>
      {chips.map((chip) => (
        <Token
          key={chip.key}
          label={chip.label}
          size="sm"
          color="blue"
          onRemove={() => onChange(chip.remove)}
        />
      ))}
      <Button label="Clear all" variant="ghost" size="sm" onClick={onClearAll} />
    </HStack>
  );
}
