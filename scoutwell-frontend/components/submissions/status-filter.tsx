"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl, SegmentedControlItem } from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";
import { SUBMISSION_FILTERS } from "./filters";

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
