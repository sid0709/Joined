"use client";

import { useState } from "react";
import {
  BreadcrumbItem,
  Breadcrumbs,
  Card,
  GridColumn,
  GridSystem,
  Stack,
} from "@openseat/design-system";
import { INITIAL_SAVED_JOB_IDS } from "@/lib/account";
import { JOBS, companyBySlug, matchFor, scoreFor, similarJobs, type Job } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { CompanyCard } from "./company-card";
import { JobDetailHeader } from "./job-detail-header";
import { JobMatchCard } from "./job-match-card";
import { JobOverview } from "./job-overview";
import { SimilarJobs } from "./similar-jobs";
import { useJobActions } from "./use-job-actions";

const JOB_PAGE_MAX_WIDTH = 1200;
const SIMILAR_LIMIT = 4;

/** The standalone job page: shareable, with the match and company beside the role. */
export function JobPageView({ job }: { job: Job }) {
  const [saved, setSaved] = useState(INITIAL_SAVED_JOB_IDS.includes(job.id));
  const [applied, setApplied] = useState(false);
  const actions = useJobActions({
    isSaved: () => saved,
    toggleSave: () => setSaved((value) => !value),
    markApplied: () => setApplied(true),
  });
  const company = companyBySlug(job.companySlug);

  return (
    <Stack hAlign="center">
      <Stack gap={5} width="100%" maxWidth={JOB_PAGE_MAX_WIDTH}>
        <Breadcrumbs label="Job location">
          <BreadcrumbItem href={ROUTES.search}>Find jobs</BreadcrumbItem>
          <BreadcrumbItem href={ROUTES.companyPublic(job.companySlug)}>
            {job.company}
          </BreadcrumbItem>
          <BreadcrumbItem isCurrent>{job.title}</BreadcrumbItem>
        </Breadcrumbs>

        <Card padding={6} elevation="low">
          <JobDetailHeader
            job={job}
            saved={saved}
            applied={applied}
            onApply={() => actions.apply(job)}
            onSave={() => actions.save(job)}
            onShare={() => actions.share(job)}
          />
        </Card>

        <GridSystem gap={5} responsiveTo="viewport" align="start">
          <GridColumn span="full" lg={8}>
            <Card padding={6}>
              <JobOverview job={job} />
            </Card>
          </GridColumn>
          <GridColumn span="full" lg={4}>
            <Stack gap={5}>
              <JobMatchCard match={matchFor(job)} />
              {company ? <CompanyCard company={company} /> : null}
              <SimilarJobs jobs={similarJobs(job, JOBS, SIMILAR_LIMIT)} scoreOf={scoreFor} />
            </Stack>
          </GridColumn>
        </GridSystem>
      </Stack>
      {actions.dialog}
    </Stack>
  );
}
