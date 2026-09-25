"use client";

import { Checkbox, Stack } from "@openseat/design-system";
import { BudgetType, ExperienceLevel, FilterState } from "@/src/shared/types/job-room";

interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
}

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  const toggleExperience = (level: ExperienceLevel) => {
    const next = filters.experienceLevels.includes(level)
      ? filters.experienceLevels.filter((item) => item !== level)
      : [...filters.experienceLevels, level];
    onFilterChange({ experienceLevels: next });
  };

  const toggleBudget = (type: BudgetType) => {
    const next = filters.budgetTypes.includes(type)
      ? filters.budgetTypes.filter((item) => item !== type)
      : [...filters.budgetTypes, type];
    onFilterChange({ budgetTypes: next });
  };

  return (
    <aside className="marketplace-filter-sidebar">
      <Stack gap={12}>
        <p className="body-strong">Experience level</p>
        {(["Entry Level", "Intermediate", "Expert"] as ExperienceLevel[]).map((level) => (
          <Checkbox key={level} label={level} checked={filters.experienceLevels.includes(level)} onChange={() => toggleExperience(level)} />
        ))}
      </Stack>
      <Stack gap={12} className="marketplace-filter-section">
        <p className="body-strong">Job type</p>
        {(["Hourly", "Fixed-Price"] as BudgetType[]).map((type) => (
          <Checkbox key={type} label={type} checked={filters.budgetTypes.includes(type)} onChange={() => toggleBudget(type)} />
        ))}
      </Stack>
    </aside>
  );
}
