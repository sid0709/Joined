"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { HStack, Selector, Tab, TabList } from "@joined/design-system";
import { SearchBox } from "@/components/search-box";
import { ROUTES } from "@/lib/nav";
import { QUEUE_FILTERS, queueQuery, type QueueFilter } from "@/lib/scouting";

const CHANNELS = [
  { value: "", label: "Web and API" },
  { value: "web", label: "Web form" },
  { value: "api", label: "API" },
];

export function QueueFilters({
  status,
  q,
  channel,
}: {
  status: QueueFilter;
  q: string;
  channel: string;
}) {
  const router = useRouter();
  const go = useCallback(
    (next: Partial<{ status: QueueFilter; q: string; channel: string }>) =>
      router.push(`${ROUTES.queue}${queueQuery({ status, q, channel, ...next, page: 1 })}`),
    [channel, q, router, status],
  );
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
