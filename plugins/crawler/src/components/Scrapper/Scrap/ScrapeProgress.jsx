import { ProgressBar } from "@joined/design-system";

const formatPercent = (value) => `${Math.round(value)}%`;

function ScrapeProgress({ value }) {
  return (
    <ProgressBar
      label="Scrape progress"
      value={value}
      hasValueLabel
      formatValueLabel={formatPercent}
    />
  );
}

export default ScrapeProgress;
