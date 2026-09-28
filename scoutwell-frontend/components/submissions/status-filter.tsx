"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl, SegmentedControlItem } from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";

export const SUBMISSION_FILTERS = [
  { value: "", label: "All" },
  { value: "needs_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
] as const;

export function StatusFilter({ value }: { value: string }) {
  const router = useRouter();
  return (
    <SegmentedControl
      label="Filter by status"
      value={value}
      onChange={(next) =>
        router.push(next ? `${ROUTES.submissions}?status=${next}` : ROUTES.submissions)
      }
    >
      {SUBMISSION_FILTERS.map((item) => (
        <SegmentedControlItem key={item.value || "all"} value={item.value} label={item.label} />
      ))}
    </SegmentedControl>
  );
}
