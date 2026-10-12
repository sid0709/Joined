import {
  CheckboxList,
  CheckboxListItem,
  Divider,
  RadioList,
  RadioListItem,
  Slider,
  Stack,
  Switch,
} from "sid-ui";
import {
  EMPLOYMENTS,
  EMPLOYMENT_LABEL,
  PAY_FLOOR_MAX,
  PAY_FLOOR_STEP,
  POSTED_WITHIN,
  SENIORITIES,
  SENIORITY_LABEL,
  SOURCES,
  SOURCE_DESCRIPTION,
  SOURCE_LABEL,
  WORKPLACES,
  WORKPLACE_LABEL,
  formatAmount,
  type JobFilters,
  type PostedWithin,
} from "@/lib/jobs";
import { DEFAULT_CURRENCY } from "@/lib/profile";

type Props = {
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
};

const payLabel = (value: number) =>
  value === 0 ? "Any pay" : `${formatAmount(value, DEFAULT_CURRENCY)}+ a year`;

/** Every refinement for the All filters drawer. Counts stay off the client so the page does not download the catalog. */
export function JobFiltersPanel({ filters, onChange }: Props) {
  return (
    <Stack gap={6}>
      <CheckboxList
        label="Workplace"
        value={filters.workplace}
        onChange={(values) =>
          onChange({ workplace: WORKPLACES.filter((item) => values.includes(item)) })
        }
      >
        {WORKPLACES.map((value) => (
          <CheckboxListItem key={value} value={value} label={WORKPLACE_LABEL[value]} />
        ))}
      </CheckboxList>

      <Divider />

      <Slider
        label="Minimum pay"
        description="Hourly contracts count as a full-time year."
        min={0}
        max={PAY_FLOOR_MAX}
        step={PAY_FLOOR_STEP}
        value={filters.minPay}
        onChange={(value: number) => onChange({ minPay: value })}
        formatValue={payLabel}
        valueDisplay="text"
      />

      <Divider />

      <CheckboxList
        label="Experience level"
        value={filters.seniority}
        onChange={(values) =>
          onChange({ seniority: SENIORITIES.filter((item) => values.includes(item)) })
        }
      >
        {SENIORITIES.map((value) => (
          <CheckboxListItem key={value} value={value} label={SENIORITY_LABEL[value]} />
        ))}
      </CheckboxList>

      <Divider />

      <CheckboxList
        label="Job type"
        value={filters.employment}
        onChange={(values) =>
          onChange({ employment: EMPLOYMENTS.filter((item) => values.includes(item)) })
        }
      >
        {EMPLOYMENTS.map((value) => (
          <CheckboxListItem key={value} value={value} label={EMPLOYMENT_LABEL[value]} />
        ))}
      </CheckboxList>

      <Divider />

      <RadioList
        label="Date posted"
        value={filters.posted}
        onChange={(value) => onChange({ posted: value as PostedWithin })}
      >
        {POSTED_WITHIN.map((option) => (
          <RadioListItem key={option.value} value={option.value} label={option.label} />
        ))}
      </RadioList>

      <Divider />

      <CheckboxList
        label="Where the job came from"
        value={filters.source}
        onChange={(values) => onChange({ source: SOURCES.filter((item) => values.includes(item)) })}
      >
        {SOURCES.map((value) => (
          <CheckboxListItem
            key={value}
            value={value}
            label={SOURCE_LABEL[value]}
            description={SOURCE_DESCRIPTION[value]}
          />
        ))}
      </CheckboxList>

      <Divider />

      <Switch
        label="Offers visa sponsorship"
        description="Only show jobs that sponsor work visas."
        value={filters.visa}
        onChange={(checked) => onChange({ visa: checked })}
        labelPosition="start"
        labelSpacing="spread"
      />
    </Stack>
  );
}
