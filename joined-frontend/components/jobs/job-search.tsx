"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  GridColumn,
  GridSystem,
  HStack,
  Icon,
  Stack,
  Sticky,
  VIEWPORT_TIERS,
  icons,
  useMediaQuery,
} from "sid-ui";
import { WIDE_PAGE_MAX_WIDTH } from "@/components/page-container";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import {
  RECENT_SEARCHES,
  formatCount,
  type Job,
  type JobFilters,
  type JobSearchPage,
} from "@/lib/jobs";
import { logRankingEvent } from "@/lib/jobs/ranking-events";
import { loadJob } from "@/lib/jobs/search-action";
import { ROLE_SUGGESTIONS } from "@/lib/profile";
import { ROUTES } from "@/lib/routes";
import { JobActiveFilters } from "./job-active-filters";
import { JobDetailHeader } from "./job-detail-header";
import { JobDetailBody, JobDetailPane } from "./job-detail-pane";
import { JobFilterToolbar } from "./job-filter-toolbar";
import { JobResults } from "./job-results";
import { JobSearchBar, type SavedQuery } from "./job-search-bar";
import { JobSuggestions } from "./job-suggestions";
import { SavedSearches } from "./saved-searches";
import { useJobFit } from "./use-job-fits";
import { useJobActions } from "./use-job-actions";
import { useJobKeyboard } from "./use-job-keyboard";
import { useJobSearch } from "./use-job-search";

const RECENT_LIMIT = 4;
const WIDE_QUERY = `(min-width: ${VIEWPORT_TIERS.lg}px)`;

const JobFiltersPanel = dynamic(() =>
  import("./job-filters-panel").then((mod) => mod.JobFiltersPanel),
);

/**
 * Find jobs: search, refine, and read a job side by side. On narrow screens
 * the detail opens in a drawer instead of the right-hand pane.
 */
export function JobSearch({
  initialFilters,
  initialResult,
  catalogTotal,
  loadError,
  savedIds = [],
  appliedIds = [],
  signedIn = false,
  roleSuggestions = ROLE_SUGGESTIONS,
}: {
  initialFilters: JobFilters;
  initialResult: JobSearchPage;
  catalogTotal: number;
  loadError?: string | null;
  savedIds?: string[];
  appliedIds?: string[];
  signedIn?: boolean;
  roleSuggestions?: string[];
}) {
  const router = useRouter();
  const search = useJobSearch(initialFilters, initialResult, {
    savedIds,
    appliedIds,
    signedIn,
  });
  const jobs = search.pageResults;
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerJob, setDrawerJob] = useState<Job | null>(null);
  const [detail, setDetail] = useState<Job | null>(null);
  const [recent, setRecent] = useState<SavedQuery[]>(RECENT_SEARCHES);

  const track = (id: string, type: "click" | "save" | "apply" | "dismiss") =>
    logRankingEvent(search.rankingId, id, type, search.positionOf(id));

  const actions = useJobActions({
    isSaved: (id) => search.savedIds.includes(id),
    toggleSave: (id) => {
      if (!search.savedIds.includes(id)) track(id, "save");
      void search.toggleSave(id);
    },
    markApplied: (id) => {
      track(id, "apply");
      search.markApplied(id);
    },
    isApplied: (id) => search.appliedIds.includes(id),
    signedIn,
    hide: (id) => {
      track(id, "dismiss");
      search.hide(id);
    },
    unhide: search.unhide,
  });

  const { filters, selected, fits: pageFits } = search;
  // The page's fits come with the results; a job selected from elsewhere is scored alone.
  const missingFit = selected != null && !(selected.id in pageFits);
  const selectedFit = useJobFit(signedIn && missingFit, selected?.id ?? "");
  const fits = selected && selectedFit ? { ...pageFits, [selected.id]: selectedFit } : pageFits;

  useEffect(() => {
    if (selected?.id) router.prefetch(ROUTES.job(selected.id));
  }, [router, selected?.id]);

  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    let active = true;
    loadJob(id).then((job) => {
      if (active && job) setDetail(job);
    });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  const detailJob = detail?.id === selected?.id ? detail : selected;

  const select = (job: Job) => {
    if (job.id !== selected?.id) track(job.id, "click");
    search.select(job.id);
    if (!isWide) setDrawerJob(job);
  };

  useJobKeyboard({
    ids: search.pageResults.map((job) => job.id),
    selectedId: selected?.id ?? null,
    onSelect: search.select,
    onSave: (id) => {
      const job = jobs.find((item) => item.id === id);
      if (job) actions.save(job);
    },
    searchRef,
  });

  const remember = () => {
    const query = { q: filters.q.trim(), where: filters.where.trim() };
    if (!query.q && !query.where) return;
    setRecent((items) =>
      [query, ...items.filter((item) => item.q !== query.q || item.where !== query.where)].slice(
        0,
        RECENT_LIMIT,
      ),
    );
  };

  const detailProps = (job: Job) => ({
    job,
    saved: search.savedIds.includes(job.id),
    applied: search.appliedIds.includes(job.id),
    onApply: () => actions.apply(job),
    onSave: () => actions.save(job),
    onShare: () => actions.share(job),
    onHide: actions.dismiss
      ? () => {
          actions.dismiss?.(job);
          setDrawerJob(null);
        }
      : undefined,
    onReport: () => actions.report(job),
  });

  const shown = search.total;

  return (
    <Stack hAlign="center">
      <Stack gap={5} width="100%" maxWidth={WIDE_PAGE_MAX_WIDTH}>
        <JobSearchBar
          q={filters.q}
          where={filters.where}
          onChange={search.update}
          onSubmit={() => {
            remember();
            search.submit();
          }}
          onPick={search.submit}
          recent={recent}
          suggestions={roleSuggestions.length > 0 ? roleSuggestions : ROLE_SUGGESTIONS}
          totals={{ jobs: catalogTotal }}
          inputRef={searchRef}
        />

        <SavedSearches
          key={signedIn ? "member" : "guest"}
          signedIn={signedIn}
          filters={filters}
          onApply={(next) => search.update(next)}
        />

        <Stack gap={3}>
          <JobFilterToolbar
            filters={filters}
            facets={search.facets}
            refinementCount={search.refinementCount}
            onChange={search.update}
            onOpenFilters={() => setFiltersOpen(true)}
          />
          <JobSuggestions
            filters={filters}
            suggestions={search.suggestions}
            onChange={search.update}
          />
          <JobActiveFilters
            filters={filters}
            onChange={search.update}
            onClearAll={search.clearAll}
          />
        </Stack>

        <GridSystem gap={5} responsiveTo="viewport">
          <GridColumn span="full" lg={5}>
            <JobResults
              list={filters.list}
              sort={filters.sort}
              onSortChange={(sort) => search.update({ sort })}
              listCounts={search.listCounts}
              onListChange={(list) => search.update({ list })}
              total={search.total}
              exact={search.exact}
              signedIn={signedIn}
              jobs={search.pageResults}
              fits={fits}
              page={search.page}
              pageCount={search.pageCount}
              onPageChange={search.setPage}
              selectedId={isWide ? (selected?.id ?? null) : null}
              savedIds={search.savedIds}
              appliedIds={search.appliedIds}
              onSelect={select}
              onToggleSave={actions.save}
              onReport={actions.report}
              onClearFilters={search.reset}
              canClear={search.refinementCount > 0 || Boolean(filters.q || filters.where)}
            />
          </GridColumn>
          <GridColumn span="hidden" lg={7}>
            <Sticky fill offset={CONTENT_PADDING}>
              {loadError || search.error ? (
                <Card variant="muted">
                  <EmptyState
                    icon={<Icon icon={icons.list} size="lg" color="secondary" />}
                    title="Jobs are unavailable"
                    description={loadError || search.error || undefined}
                  />
                </Card>
              ) : detailJob ? (
                <JobDetailPane
                  key={detailJob.id}
                  {...detailProps(detailJob)}
                  jobs={jobs}
                  fit={fits[detailJob.id]}
                  fits={fits}
                  showPageLink
                  onSelect={select}
                />
              ) : (
                <Card variant="muted">
                  <EmptyState
                    icon={<Icon icon={icons.list} size="lg" color="secondary" />}
                    title="Pick a job to see the details"
                    description="Your match, the role, and the company show up here."
                  />
                </Card>
              )}
            </Sticky>
          </GridColumn>
        </GridSystem>
      </Stack>

      <Drawer
        isOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="All filters"
        subtitle={`${formatCount(shown, "job")} match`}
        side="start"
        size="sm"
        footer={
          <HStack hAlign="between" vAlign="center" gap={2}>
            <Button
              label="Clear all"
              variant="ghost"
              onClick={search.clearAll}
              isDisabled={search.refinementCount === 0}
            />
            <Button
              label={`Show ${formatCount(shown, "job")}`}
              variant="primary"
              onClick={() => setFiltersOpen(false)}
            />
          </HStack>
        }
      >
        <JobFiltersPanel filters={filters} onChange={search.update} />
      </Drawer>

      <Drawer
        isOpen={drawerJob !== null}
        onOpenChange={(open) => (open ? undefined : setDrawerJob(null))}
        title="Job details"
        size="lg"
      >
        {drawerJob ? (
          <Stack gap={6}>
            <JobDetailHeader
              {...detailProps(detail?.id === drawerJob.id ? detail : drawerJob)}
              showPageLink
            />
            <JobDetailBody
              job={detail?.id === drawerJob.id ? detail : drawerJob}
              jobs={jobs}
              onSelect={select}
              fit={fits[drawerJob.id]}
              fits={fits}
            />
          </Stack>
        ) : null}
      </Drawer>

      {actions.dialog}
    </Stack>
  );
}
