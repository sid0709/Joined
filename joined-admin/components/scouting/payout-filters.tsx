"use client";

import { useRouter } from "next/navigation";
import { Tab, TabList } from "@joined/design-system";
import { ROUTES } from "@/lib/nav";

export const PAYOUT_FILTERS = [
  { value: "requested", label: "To pay" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Declined" },
  { value: "all", label: "All" },
] as const;

export function PayoutFilters({ status }: { status: string }) {
  const router = useRouter();
  return (
    <TabList
      value={status}
      onChange={(value) =>
        router.push(value === "requested" ? ROUTES.payouts : `${ROUTES.payouts}?status=${value}`)
      }
      hasDivider
    >
      {PAYOUT_FILTERS.map((item) => (
        <Tab key={item.value} value={item.value} label={item.label} />
      ))}
    </TabList>
  );
}
