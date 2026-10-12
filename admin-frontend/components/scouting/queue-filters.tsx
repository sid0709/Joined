"use client";

import { HStack, Selector, Tab, TabList } from "sid-ui";
import { SearchBox } from "@/components/search-box";
import { QUEUE_FILTERS, type QueueFilter } from "@/lib/scouting";

const CHANNELS = [
  { value: "", label: "Web and API" },
  { value: "web", label: "Web form" },
  { value: "api", label: "API" },
];

export function QueueFilters({
  status,
  q,
  channel,
  onChange,
}: {
  status: QueueFilter;
  q: string;
  channel: string;
  onChange: (next: Partial<{ status: QueueFilter; q: string; channel: string }>) => void;
}) {
  const go = (next: Partial<{ status: QueueFilter; q: string; channel: string }>) => onChange(next);
  return (
    <>
      <TabList
        value={status || "all"}
        onChange={(value) => go({ status: value === "all" ? "" : (value as QueueFilter) })}
        hasDivider
        overflow="scroll"
      >
        {QUEUE_FILTERS.map((item) => (
          <Tab key={item.value || "all"} value={item.value || "all"} label={item.label} />
        ))}
      </TabList>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <HStack width={360}>
          <SearchBox
            key={q}
            value={q}
            label="Search submissions"
            placeholder="Title, company, host, scout, or id"
            onSearch={(value) => go({ q: value })}
          />
        </HStack>
        <Selector
          label="Channel"
          isLabelHidden
          options={CHANNELS}
          value={channel}
          onChange={(value) => go({ channel: value })}
        />
      </HStack>
    </>
  );
}
