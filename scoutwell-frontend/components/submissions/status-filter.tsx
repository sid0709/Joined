"use client";

import { SegmentedControl, SegmentedControlItem } from "@openseat/design-system";
import { useRouter } from "next/navigation";

import { SUBMISSION_FILTERS } from "./filters";

import { ROUTES } from "@/lib/routes";

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
