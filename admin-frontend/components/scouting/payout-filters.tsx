"use client";

import { Tab, TabList } from "sid-ui";

export const PAYOUT_FILTERS = [
  { value: "requested", label: "To pay" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Declined" },
  { value: "all", label: "All" },
] as const;

export function PayoutFilters({
  status,
  onChange,
}: {
  status: string;
  onChange: (status: string) => void;
}) {
  return (
    <TabList value={status} onChange={onChange} hasDivider>
      {PAYOUT_FILTERS.map((item) => (
        <Tab key={item.value} value={item.value} label={item.label} />
      ))}
    </TabList>
  );
}
