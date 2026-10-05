import { Card, Layout, LayoutContent, LayoutHeader, Stack } from "sid-ui";
import {
  companyFromJob,
  matchFor,
  openRolesFor,
  presentCompany,
  scoreFor,
  similarJobs,
  type Job,
} from "@/lib/jobs";
import { CompanyCard } from "./company-card";
import { JobDetailHeader, type JobDetailHeaderProps } from "./job-detail-header";
import { JobMatchCard } from "./job-match-card";
import { JobOverview } from "./job-overview";
import { SimilarJobs } from "./similar-jobs";

const SIMILAR_LIMIT = 3;

type BodyProps = { job: Job; jobs: Job[]; onSelect?: (job: Job) => void };

/** Fit, the job, the company, and where to look next — everything under the header. */
export function JobDetailBody({ job, jobs, onSelect }: BodyProps) {
  const company = companyFromJob(job);
  return (
    <Stack gap={6}>
      <JobMatchCard match={matchFor(job)} />
      <JobOverview job={job} />
      {company ? (
        <CompanyCard
          company={presentCompany(company, jobs)}
          openRoles={openRolesFor(company.id, jobs)}
        />
      ) : null}
      <SimilarJobs
        jobs={similarJobs(job, jobs, SIMILAR_LIMIT)}
        scoreOf={scoreFor}
        onSelect={onSelect}
      />
    </Stack>
  );
}

type PaneProps = JobDetailHeaderProps & { jobs: Job[]; onSelect?: (job: Job) => void };

/**
 * The split-view detail: the header and actions stay put while the rest
 * scrolls. Give it a height (Sticky fill) so it never runs past the fold.
 */
export function JobDetailPane({ jobs, onSelect, ...header }: PaneProps) {
  return (
    <Card padding={0} elevation="low">
      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider padding={5}>
            <JobDetailHeader {...header} />
          </LayoutHeader>
        }
        content={
          <LayoutContent isScrollable padding={5} label={`${header.job.title} details`}>
            <JobDetailBody job={header.job} jobs={jobs} onSelect={onSelect} />
          </LayoutContent>
        }
      />
    </Card>
  );
}
