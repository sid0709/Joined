import { Glyph, HStack, Text, Token } from "sid-ui";
import { applySuggestion, type FilterSuggestion, type JobFilters } from "@/lib/jobs";

/**
 * Filters the typed query implies ("remote", "senior", "$150k"), offered as chips.
 * Nothing is applied until the hunter taps one, so a query never narrows on its own.
 */
export function JobSuggestions({
  filters,
  suggestions,
  onChange,
}: {
  filters: JobFilters;
  suggestions: FilterSuggestion[];
  onChange: (patch: Partial<JobFilters>) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Text type="supporting" color="secondary">
        Add a filter
      </Text>
      {suggestions.map((suggestion) => (
        <Token
          key={`${suggestion.kind}-${suggestion.value}`}
          label={suggestion.label}
          size="sm"
          icon={<Glyph name="plus" />}
          onClick={() => onChange(applySuggestion(filters, suggestion))}
        />
      ))}
    </HStack>
  );
}
