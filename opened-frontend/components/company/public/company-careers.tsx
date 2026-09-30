"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ClickableCard,
  EmptyState,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
} from "@openseat/design-system";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { JobTags } from "@/components/jobs/job-tags";
import { SectionCard } from "@/components/section-card";
import { formatPay, formatPosted, type Job } from "@/lib/jobs";
import { groupJobsByDepartment, uniqueJobDepartments, uniqueJobLocations } from "@/lib/layer-a";
import { ROUTES } from "@/lib/routes";

const ROLE_LOGO_SIZE = 40;
const ALL = "all";

function RoleRow({ job }: { job: Job }) {
  return (
    <ClickableCard label={`${job.title} at ${job.company}`} href={ROUTES.job(job.id)} padding={4}>
      <HStack gap={3} vAlign="start" hAlign="between" wrap="wrap">
        <HStack gap={3} vAlign="start">
          <CompanyLogo
            name={job.company}
            companyId={job.companyId}
            src={job.companyLogo}
            size={ROLE_LOGO_SIZE}
          />
          <Stack gap={2}>
            <Stack gap={0.5}>
              <Text weight="semibold">{job.title}</Text>
              <Text type="supporting" color="secondary">
                {job.team ? `${job.team} · ` : ""}
                {job.location} · {formatPosted(job.postedHoursAgo)}
              </Text>
            </Stack>
            <JobTags job={job} applied={false} />
            <Text weight="medium" hasTabularNumbers>
              {formatPay(job.pay)}
            </Text>
          </Stack>
        </HStack>
        <Button label="View & apply" href={ROUTES.job(job.id)} variant="secondary" size="sm" />
      </HStack>
    </ClickableCard>
  );
}

function careersHref(companyId: string, department: string, location: string) {
  const params = new URLSearchParams();
  if (department && department !== ALL) params.set("department", department);
  if (location && location !== ALL) params.set("location", location);
  const base = ROUTES.companyPublic(companyId);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Light careers listing on the public company page — not a branded multi-page portal. */
export function CompanyCareers({
  companyId,
  companyName,
  jobs,
  allJobs,
  departmentFilter = "",
  locationFilter = "",
}: {
  companyId: string;
  companyName: string;
  /** Roles from GET /v1/search/companies/:id?department=&location=. */
  jobs: Job[];
  /** Unfiltered open roles for facet chips. */
  allJobs: Job[];
  departmentFilter?: string;
  locationFilter?: string;
}) {
  const router = useRouter();
  const locations = useMemo(() => uniqueJobLocations(allJobs), [allJobs]);
  const departments = useMemo(() => uniqueJobDepartments(allJobs), [allJobs]);
  const department = departmentFilter.trim() || ALL;
  const location = locationFilter.trim() || ALL;

  const filtered = useMemo(
    () => [...jobs].sort((a, b) => a.postedHoursAgo - b.postedHoursAgo),
    [jobs],
  );
  const groups = useMemo(() => groupJobsByDepartment(filtered), [filtered]);
  const showLocationFilter = locations.length > 1;
  const showDepartmentFilter = departments.length > 1;

  const setFilters = (nextDepartment: string, nextLocation: string) => {
    router.replace(careersHref(companyId, nextDepartment, nextLocation), { scroll: false });
  };

  return (
    <SectionCard
      title="Open roles"
      description={
        allJobs.length === 0
          ? `${companyName} isn’t hiring on OpenSeat right now`
          : `${filtered.length} of ${allJobs.length} open at ${companyName}`
      }
    >
      <Stack gap={4}>
        {showDepartmentFilter ? (
          <SegmentedControl
            label="Filter by department"
            value={department}
            onChange={(value) => setFilters(value, location)}
          >
            <SegmentedControlItem value={ALL} label="All departments" />
            {departments.map((item) => (
              <SegmentedControlItem key={item} value={item} label={item} />
            ))}
          </SegmentedControl>
        ) : null}

        {showLocationFilter ? (
          <SegmentedControl
            label="Filter by location"
            value={location}
            onChange={(value) => setFilters(department, value)}
          >
            <SegmentedControlItem value={ALL} label="All locations" />
            {locations.map((item) => (
              <SegmentedControlItem key={item} value={item} label={item} />
            ))}
          </SegmentedControl>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            title="No open roles right now"
            description={
              department === ALL && location === ALL
                ? `${companyName} isn’t hiring on OpenSeat at the moment. Check back soon.`
                : "No open roles match these filters. Try another department or location."
            }
          />
        ) : (
          groups.map((group) => (
            <Stack key={group.department} gap={3}>
              {groups.length > 1 ? (
                <HStack hAlign="between" vAlign="center">
                  <Text weight="semibold">{group.department}</Text>
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    {group.jobs.length}
                  </Text>
                </HStack>
              ) : null}
              <Stack gap={3}>
                {group.jobs.map((job) => (
                  <RoleRow key={job.id} job={job} />
                ))}
              </Stack>
            </Stack>
          ))
        )}
      </Stack>
    </SectionCard>
  );
}
