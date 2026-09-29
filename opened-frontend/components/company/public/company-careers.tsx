"use client";

import { useMemo, useState } from "react";
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
import { groupJobsByDepartment, uniqueJobLocations } from "@/lib/layer-a";
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

/** Light careers listing on the public company page — not a branded multi-page portal. */
export function CompanyCareers({ companyName, jobs }: { companyName: string; jobs: Job[] }) {
  const locations = useMemo(() => uniqueJobLocations(jobs), [jobs]);
  const [location, setLocation] = useState(ALL);

  const filtered = useMemo(() => {
    const list = location === ALL ? jobs : jobs.filter((job) => job.location.trim() === location);
    return [...list].sort((a, b) => a.postedHoursAgo - b.postedHoursAgo);
  }, [jobs, location]);

  const groups = useMemo(() => groupJobsByDepartment(filtered), [filtered]);
  const showLocationFilter = locations.length > 1;

  return (
    <SectionCard
      title="Open roles"
      description={
        jobs.length === 0
          ? `${companyName} isn’t hiring on OpenSeat right now`
          : `${filtered.length} of ${jobs.length} open at ${companyName}`
      }
    >
      <Stack gap={4}>
        {showLocationFilter ? (
          <SegmentedControl label="Filter by location" value={location} onChange={setLocation}>
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
              location === ALL
                ? `${companyName} isn’t hiring on OpenSeat at the moment. Check back soon.`
                : `No open roles in ${location}. Try another location.`
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
