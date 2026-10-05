"use client";

import { useRef } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Glyph,
  HStack,
  Icon,
  Kbd,
  Pagination,
  Selector,
  Show,
  Stack,
  Tab,
  TabList,
  Text,
  icons,
} from "sid-ui";
import {
  LISTS,
  SORTS,
  formatCount,
  scoreFor,
  type Job,
  type ListKey,
  type SortKey,
} from "@/lib/jobs";
import { JobResultCard } from "./job-result-card";
import { PAGE_SIZE } from "./use-job-search";

const SORT_WIDTH = 180;

type Props = {
  list: ListKey;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  listCounts: Record<ListKey, number>;
  onListChange: (list: ListKey) => void;
  total: number;
  jobs: Job[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  selectedId: string | null;
  savedIds: string[];
  appliedIds: string[];
  onSelect: (job: Job) => void;
  onToggleSave: (job: Job) => void;
  onClearFilters: () => void;
  canClear: boolean;
};

function Empty({
  list,
  canClear,
  onClearFilters,
  onShowAll,
}: {
  list: ListKey;
  canClear: boolean;
  onClearFilters: () => void;
  onShowAll: () => void;
}) {
  if (list === "saved" && !canClear) {
    return (
      <EmptyState
        icon={<Icon icon={icons.bookmark} size="lg" color="secondary" />}
        title="No saved jobs yet"
        description="Tap the bookmark on any job to keep it here while you decide."
        actions={<Button label="Browse all jobs" variant="secondary" onClick={onShowAll} />}
      />
    );
  }
  return (
    <EmptyState
      icon={<Icon icon={icons.search} size="lg" color="secondary" />}
      title="No jobs match this search"
      description="Try a broader title, another city, or fewer filters."
      actions={
        <HStack gap={2}>
          {canClear ? (
            <Button label="Clear filters" variant="primary" onClick={onClearFilters} />
          ) : null}
          {list !== "all" ? (
            <Button label="Search all jobs" variant="secondary" onClick={onShowAll} />
          ) : null}
        </HStack>
      }
    />
  );
}

/** The list side of the split view: tabs with counts, the result cards, and paging. */
export function JobResults({
  list,
  sort,
  onSortChange,
  listCounts,
  onListChange,
  total,
  jobs,
  page,
  pageCount,
  onPageChange,
  selectedId,
  savedIds,
  appliedIds,
  onSelect,
  onToggleSave,
  onClearFilters,
  canClear,
}: Props) {
  const topRef = useRef<HTMLElement>(null);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // A page is long now; start the next one at its first result, not where the last one ended.
  const changePage = (next: number) => {
    onPageChange(next);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <Stack gap={4} ref={topRef}>
      <TabList
        value={list}
        onChange={(value) => onListChange(value as ListKey)}
        hasDivider
        aria-label="Job lists"
      >
        {LISTS.map((item) => (
          <Tab
            key={item.value}
            value={item.value}
            label={item.label}
            endContent={
              <Badge
                label={String(listCounts[item.value])}
                variant={item.value === list ? "info" : "neutral"}
              />
            }
          />
        ))}
      </TabList>

      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {total === 0 ? "No results" : `Showing ${from}–${to} of ${formatCount(total, "job")}`}
        </Text>
        <Selector
          label="Sort by"
          isLabelHidden
          options={[...SORTS]}
          value={sort}
          onChange={(value) => onSortChange(value as SortKey)}
          startIcon={<Glyph name="sort" />}
          size="sm"
          variant="ghost"
          width={SORT_WIDTH}
        />
      </HStack>

      {jobs.length === 0 ? (
        <Card variant="muted" padding={6}>
          <Empty
            list={list}
            canClear={canClear}
            onClearFilters={onClearFilters}
            onShowAll={() => onListChange("all")}
          />
        </Card>
      ) : (
        <Stack gap={3} role="list" aria-label="Job results">
          {jobs.map((job) => (
            <div key={job.id} role="listitem">
              <JobResultCard
                job={job}
                score={scoreFor(job)}
                selected={job.id === selectedId}
                saved={savedIds.includes(job.id)}
                applied={appliedIds.includes(job.id)}
                onSelect={() => onSelect(job)}
                onToggleSave={() => onToggleSave(job)}
              />
            </div>
          ))}
        </Stack>
      )}

      {pageCount > 1 ? (
        <HStack hAlign="center">
          <Pagination
            page={page}
            onChange={changePage}
            totalPages={pageCount}
            label="Result pages"
          />
        </HStack>
      ) : null}

      <Stack gap={2} hAlign="center">
        <HStack gap={1.5} vAlign="center">
          <Glyph name="lock" />
          <Text type="supporting" color="secondary">
            Companies can’t see what you browse or save.
          </Text>
        </HStack>
        <Show from="lg" responsiveTo="viewport">
          <HStack gap={1} vAlign="center">
            <Kbd keys="J" />
            <Kbd keys="K" />
            <Text type="supporting" color="secondary">
              to move ·
            </Text>
            <Kbd keys="S" />
            <Text type="supporting" color="secondary">
              to save ·
            </Text>
            <Kbd keys="/" />
            <Text type="supporting" color="secondary">
              to search
            </Text>
          </HStack>
        </Show>
      </Stack>
    </Stack>
  );
}
