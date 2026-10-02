"use client";

import { HStack, Selector, Text } from "@joined/design-system";
import { SearchBox } from "@/components/search-box";
import { COMPLETION_OPTIONS, COMPLETION_PARAM, type DirectoryFilter } from "@/lib/directory";

/** A directory's search box, its filters, and a completion filter, all kept in the URL. */
export function DirectoryFilters({
  current,
  filters,
  search,
  summary,
  onChange,
}: {
  current: URLSearchParams;
  filters: DirectoryFilter[];
  search: { label: string; placeholder: string };
  summary: string;
  onChange: (values: Record<string, string | number | null>) => void;
}) {
  const query = current.get("q") ?? "";
  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <HStack width={320}>
        <SearchBox
          key={query}
          value={query}
          label={search.label}
          placeholder={search.placeholder}
          onSearch={(value) => onChange({ q: value, page: 1 })}
        />
      </HStack>
      {[
        ...filters,
        { param: COMPLETION_PARAM, label: "Completion", options: COMPLETION_OPTIONS },
      ].map((filter) => (
        <Selector
          key={filter.param}
          label={filter.label}
          isLabelHidden
          options={filter.options}
          value={current.get(filter.param) ?? ""}
          onChange={(value) => onChange({ [filter.param]: value, page: 1 })}
        />
      ))}
      <Text type="supporting" color="secondary">
        {summary}
      </Text>
    </HStack>
  );
}
