"use client";

import { useState } from "react";
import { BreadcrumbItem, Breadcrumbs, Card, GridColumn, GridSystem, Stack } from "sid-ui";
import { saveJob, unsaveJob } from "@/lib/me/pipeline";
import { companyFromJob, openRolesFor, presentCompany, similarJobs, type Job } from "@/lib/jobs";
import { fitScoreOf } from "@/lib/jobs/fit";
import { ROUTES } from "@/lib/routes";
import { CompanyCard } from "./company-card";
import { FitSummary } from "./fit-summary";
import { JobDetailHeader } from "./job-detail-header";
import { JobOverview } from "./job-overview";
import { SimilarJobs } from "./similar-jobs";
import { useJobActions } from "./use-job-actions";
import { useJobFit, useJobFits } from "./use-job-fits";

const JOB_PAGE_MAX_WIDTH = 1200;
const SIMILAR_LIMIT = 4;

/** The standalone job page: shareable, with the match and company beside the role. */
export function JobPageView({
  job,
  jobs,
  saved = false,
  applied = false,
  signedIn = false,
}: {
  job: Job;
  jobs: Job[];
  saved?: boolean;
  applied?: boolean;
  signedIn?: boolean;
}) {
  const [isSaved, setSaved] = useState(saved);
  const [isApplied, setApplied] = useState(applied);
  const actions = useJobActions({
    isSaved: () => isSaved,
    toggleSave: () => {
      const next = !isSaved;
      setSaved(next);
      void (next ? saveJob(job.id) : unsaveJob(job.id));
    },
    markApplied: () => setApplied(true),
    isApplied: () => isApplied,
    signedIn,
  });
  const company = companyFromJob(job);
  const similar = similarJobs(job, jobs, SIMILAR_LIMIT);
  const fit = useJobFit(signedIn, job.id);
  const similarFits = useJobFits(
    signedIn,
    similar.map((item) => item.id),
  );

  return (
    <Stack hAlign="center">
      <Stack gap={5} width="100%" maxWidth={JOB_PAGE_MAX_WIDTH}>
        <Breadcrumbs label="Job location">
          <BreadcrumbItem href={ROUTES.search}>Find jobs</BreadcrumbItem>
          {company ? (
            <BreadcrumbItem href={ROUTES.companyPublic(company.id)}>{job.company}</BreadcrumbItem>
          ) : (
            <BreadcrumbItem>{job.company}</BreadcrumbItem>
          )}
          <BreadcrumbItem isCurrent>{job.title}</BreadcrumbItem>
        </Breadcrumbs>

        <Card padding={6} elevation="low">
          <JobDetailHeader
            job={job}
            saved={isSaved}
            applied={isApplied}
            onApply={() => actions.apply(job)}
            onSave={() => actions.save(job)}
            onShare={() => actions.share(job)}
            onReport={() => actions.report(job)}
          />
        </Card>

        <GridSystem gap={5} responsiveTo="viewport" align="start">
          <GridColumn span="full" lg={8}>
            <Card padding={6}>
              <Stack gap={5}>
                {fit ? <FitSummary fit={fit} /> : null}
                <JobOverview job={job} />
              </Stack>
            </Card>
          </GridColumn>
          <GridColumn span="full" lg={4}>
            <Stack gap={5}>
              {company ? (
                <CompanyCard
                  company={presentCompany(company, jobs)}
                  openRoles={jobs.length > 1 ? openRolesFor(company.id, jobs) : undefined}
                />
              ) : null}
              <SimilarJobs jobs={similar} scoreOf={(item) => fitScoreOf(similarFits[item.id])} />
            </Stack>
          </GridColumn>
        </GridSystem>
      </Stack>
      {actions.dialog}
    </Stack>
  );
}
