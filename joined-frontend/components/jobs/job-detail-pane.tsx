import { Card, Layout, LayoutContent, LayoutHeader, Stack } from "sid-ui";
import { companyFromJob, openRolesFor, presentCompany, similarJobs, type Job } from "@/lib/jobs";
import { fitScoreOf, type JobFit } from "@/lib/jobs/fit";
import { CompanyCard } from "./company-card";
import { FitSummary } from "./fit-summary";
import { JobDetailHeader, type JobDetailHeaderProps } from "./job-detail-header";
import { JobOverview } from "./job-overview";
import { SimilarJobs } from "./similar-jobs";

const SIMILAR_LIMIT = 3;

type BodyProps = {
  job: Job;
  jobs: Job[];
  onSelect?: (job: Job) => void;
  fit?: JobFit | null;
  fits?: Record<string, JobFit>;
};

/** Fit, the job, the company, and where to look next — everything under the header. */
export function JobDetailBody({ job, jobs, onSelect, fit, fits }: BodyProps) {
  const company = companyFromJob(job);
  return (
    <Stack gap={6}>
      {fit ? <FitSummary fit={fit} /> : null}
      <JobOverview job={job} />
      {company ? (
        <CompanyCard
          company={presentCompany(company, jobs)}
          openRoles={openRolesFor(company.id, jobs)}
        />
      ) : null}
      <SimilarJobs
        jobs={similarJobs(job, jobs, SIMILAR_LIMIT)}
        scoreOf={(item) => fitScoreOf(fits?.[item.id])}
        onSelect={onSelect}
      />
    </Stack>
  );
}

type PaneProps = JobDetailHeaderProps & {
  jobs: Job[];
  onSelect?: (job: Job) => void;
  fit?: JobFit | null;
  fits?: Record<string, JobFit>;
};

/**
 * The split-view detail: the header and actions stay put while the rest
 * scrolls. Give it a height (Sticky fill) so it never runs past the fold.
 */
export function JobDetailPane({ jobs, onSelect, fit, fits, ...header }: PaneProps) {
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
            <JobDetailBody job={header.job} jobs={jobs} onSelect={onSelect} fit={fit} fits={fits} />
          </LayoutContent>
        }
      />
    </Card>
  );
}
