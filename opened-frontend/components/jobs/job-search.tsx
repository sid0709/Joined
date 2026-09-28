"use client";

import { useEffect, useRef, useState } from "react";
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
  useToast,
} from "@openseat/design-system";
import { WIDE_PAGE_MAX_WIDTH } from "@/components/page-container";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import { RECENT_SEARCHES, filterJobs, formatCount, type Job, type JobFilters } from "@/lib/jobs";
import { PROFILE } from "@/lib/profile";
import { ROUTES } from "@/lib/routes";
import { JobActiveFilters } from "./job-active-filters";
import { JobDetailHeader } from "./job-detail-header";
import { JobDetailBody, JobDetailPane } from "./job-detail-pane";
import { JobFilterToolbar } from "./job-filter-toolbar";
import { JobFiltersPanel } from "./job-filters-panel";
import { JobResults } from "./job-results";
import { JobSearchBar, type SavedQuery } from "./job-search-bar";
import { useJobActions } from "./use-job-actions";
import { useJobKeyboard } from "./use-job-keyboard";
import { useJobSearch } from "./use-job-search";

const RECENT_LIMIT = 4;
const WIDE_QUERY = `(min-width: ${VIEWPORT_TIERS.lg}px)`;

/**
 * Find jobs: search, refine, and read a job side by side. On narrow screens
 * the detail opens in a drawer instead of the right-hand pane.
 */
export function JobSearch({
  initialFilters,
  jobs,
  loadError,
}: {
  initialFilters: JobFilters;
  jobs: Job[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const search = useJobSearch(initialFilters, jobs);
  const totals = {
    jobs: jobs.length,
    companies: new Set(jobs.map((job) => job.companyId).filter(Boolean)).size,
    hidden: jobs.filter((job) => job.source === "scouted").length,
  };
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerJob, setDrawerJob] = useState<Job | null>(null);
  const [alertOn, setAlertOn] = useState(false);
  const [recent, setRecent] = useState<SavedQuery[]>(RECENT_SEARCHES);

  const actions = useJobActions({
    isSaved: (id) => search.savedIds.includes(id),
    toggleSave: search.toggleSave,
    markApplied: search.markApplied,
    hide: search.hide,
    unhide: search.unhide,
  });

  const { filters, selected } = search;

  useEffect(() => {
    if (selected?.id) router.prefetch(ROUTES.job(selected.id));
  }, [router, selected?.id]);

  const select = (job: Job) => {
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

  const toggleAlert = () => {
    setAlertOn((on) => !on);
    toast({
      body: alertOn
        ? "Job alert turned off."
        : `Job alert on. We’ll email new matches for “${filters.q || "all jobs"}” every morning.`,
    });
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
  });

  const filteredCount = filterJobs(search.visibleJobs, filters).length;

  return (
    <Stack hAlign="center">
      <Stack gap={5} width="100%" maxWidth={WIDE_PAGE_MAX_WIDTH}>
        <JobSearchBar
          q={filters.q}
          where={filters.where}
          onChange={search.update}
          onSubmit={remember}
          recent={recent}
          suggestions={PROFILE.targetRoles}
          totals={totals}
          alertOn={alertOn}
          onToggleAlert={toggleAlert}
          inputRef={searchRef}
        />

        <Stack gap={3}>
          <JobFilterToolbar
            filters={filters}
            refinementCount={search.refinementCount}
            onChange={search.update}
            onOpenFilters={() => setFiltersOpen(true)}
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
              total={search.results.length}
              jobs={search.pageResults}
              page={search.page}
              pageCount={search.pageCount}
              onPageChange={search.setPage}
              selectedId={isWide ? (selected?.id ?? null) : null}
              savedIds={search.savedIds}
              appliedIds={search.appliedIds}
              onSelect={select}
              onToggleSave={actions.save}
              onClearFilters={search.reset}
              canClear={search.refinementCount > 0 || Boolean(filters.q || filters.where)}
            />
          </GridColumn>
          <GridColumn span="hidden" lg={7}>
            <Sticky fill offset={CONTENT_PADDING}>
              {loadError ? (
                <Card variant="muted">
                  <EmptyState
                    icon={<Icon icon={icons.list} size="lg" color="secondary" />}
                    title="Jobs are unavailable"
                    description={loadError}
                  />
                </Card>
              ) : selected ? (
                <JobDetailPane
                  key={selected.id}
                  {...detailProps(selected)}
                  jobs={jobs}
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
        subtitle={`${formatCount(filteredCount, "job")} match`}
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
              label={`Show ${formatCount(filteredCount, "job")}`}
              variant="primary"
              onClick={() => setFiltersOpen(false)}
            />
          </HStack>
        }
      >
        <JobFiltersPanel jobs={search.visibleJobs} filters={filters} onChange={search.update} />
      </Drawer>

      <Drawer
        isOpen={drawerJob !== null}
        onOpenChange={(open) => (open ? undefined : setDrawerJob(null))}
        title="Job details"
        size="lg"
      >
        {drawerJob ? (
          <Stack gap={6}>
            <JobDetailHeader {...detailProps(drawerJob)} showPageLink />
            <JobDetailBody job={drawerJob} jobs={jobs} onSelect={select} />
          </Stack>
        ) : null}
      </Drawer>

      {actions.dialog}
    </Stack>
  );
}
