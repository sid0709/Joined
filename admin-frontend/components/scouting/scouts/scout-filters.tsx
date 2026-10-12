"use client";

import { HStack, Selector, Tab, TabList } from "sid-ui";
import { SearchBox } from "@/components/search-box";

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

export function ScoutFilters({
  current,
  onChange,
}: {
  current: ScoutFilterState;
  onChange: (next: Partial<ScoutFilterState>) => void;
}) {
  const go = (next: Partial<ScoutFilterState>) => onChange(next);
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
