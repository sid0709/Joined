"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { HStack, Selector, Tab, TabList } from "@joined/design-system";
import { SearchBox } from "@/components/search-box";
import { ROUTES } from "@/lib/nav";

const VERIFICATION_TABS = [
  { value: "", label: "All scouts" },
  { value: "pending", label: "Verification pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Declined" },
];

const LEVELS = [
  { value: "", label: "Every level" },
  { value: "probation", label: "Probation" },
  { value: "trusted", label: "Trusted" },
  { value: "expert", label: "Expert" },
];

export type ScoutFilterState = { verification: string; level: string; q: string };

export function scoutsQuery(next: ScoutFilterState & { page?: number }) {
  const params = new URLSearchParams();
  if (next.verification) params.set("verification", next.verification);
  if (next.level) params.set("level", next.level);
  if (next.q) params.set("q", next.q);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ScoutFilters(current: ScoutFilterState) {
  const router = useRouter();
  const go = useCallback(
    (next: Partial<ScoutFilterState>) =>
      router.push(`${ROUTES.scouts}${scoutsQuery({ ...current, ...next })}`),
    [current, router],
  );
  return (
    <>
      <TabList
        value={current.verification || "all"}
        onChange={(value) => go({ verification: value === "all" ? "" : value })}
        hasDivider
        overflow="scroll"
      >
        {VERIFICATION_TABS.map((tab) => (
          <Tab key={tab.value || "all"} value={tab.value || "all"} label={tab.label} />
        ))}
      </TabList>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <HStack width={360}>
          <SearchBox
            key={current.q}
            value={current.q}
            label="Search scouts"
            placeholder="Name or email"
            onSearch={(value) => go({ q: value })}
          />
        </HStack>
        <Selector
          label="Level"
          isLabelHidden
          options={LEVELS}
          value={current.level}
          onChange={(value) => go({ level: value })}
        />
      </HStack>
    </>
  );
}
