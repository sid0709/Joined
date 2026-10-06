import {
  CheckboxList,
  CheckboxListItem,
  Divider,
  RadioList,
  RadioListItem,
  Slider,
  Stack,
  Switch,
  Text,
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
  facetCounts,
  formatAmount,
  type Job,
  type JobFilters,
  type PostedWithin,
} from "@/lib/jobs";
import { DEFAULT_CURRENCY } from "@/lib/profile";

type Props = {
  jobs: Job[];
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
};

function Count({ value }: { value: number | undefined }) {
  return (
    <Text type="supporting" color="secondary" hasTabularNumbers>
      {value ?? 0}
    </Text>
  );
}

const payLabel = (value: number) =>
  value === 0 ? "Any pay" : `${formatAmount(value, DEFAULT_CURRENCY)}+ a year`;

/** Every refinement, with live counts, for the All filters drawer. */
export function JobFiltersPanel({ jobs, filters, onChange }: Props) {
  const workplace = facetCounts(jobs, filters, "workplace");
  const seniority = facetCounts(jobs, filters, "seniority");
  const employment = facetCounts(jobs, filters, "employment");
  const source = facetCounts(jobs, filters, "source");

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
          <CheckboxListItem
            key={value}
            value={value}
            label={WORKPLACE_LABEL[value]}
            endContent={<Count value={workplace.get(value)} />}
          />
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
          <CheckboxListItem
            key={value}
            value={value}
            label={SENIORITY_LABEL[value]}
            endContent={<Count value={seniority.get(value)} />}
          />
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
          <CheckboxListItem
            key={value}
            value={value}
            label={EMPLOYMENT_LABEL[value]}
            endContent={<Count value={employment.get(value)} />}
          />
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
            endContent={<Count value={source.get(value)} />}
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
