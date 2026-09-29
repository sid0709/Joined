import {
  Badge,
  Button,
  Divider,
  EmptyState,
  Glyph,
  HStack,
  Stack,
  Text,
} from "@openseat/design-system";
import { SectionCard } from "@/components/section-card";
import { JOB_STATUS_META, pipelineTotal, type CompanyJob } from "@/lib/company";
import { formatCount } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { PipelineBar } from "../pipeline-bar";

/** Every live job with its candidate funnel at a glance. */
export function JobsPipeline({ jobs }: { jobs: CompanyJob[] }) {
  const active = jobs.filter((job) => job.status === "open" || job.status === "paused");
  return (
    <SectionCard
      title="Pipeline by job"
      description="Where candidates sit on each live role."
      action={
        <Button
          label="All jobs"
          variant="ghost"
          size="sm"
          href={ROUTES.companyJobs}
          icon={<Glyph name="arrowRight" />}
        />
      }
    >
      {active.length === 0 ? (
        <EmptyState
          isCompact
          title="No live jobs"
          description="Post a job and applicants will collect here."
          actions={
            <Button label="Post a job" variant="primary" size="sm" href={ROUTES.companyJobNew} />
          }
        />
      ) : (
        <Stack gap={5}>
          {active.map((job, index) => (
            <Stack key={job.id} gap={5}>
              {index > 0 ? <Divider /> : null}
              <Stack gap={3}>
                <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
                  <Stack gap={0.5}>
                    <HStack gap={2} vAlign="center">
                      <Text weight="semibold">{job.title}</Text>
                      {job.status !== "open" ? (
                        <Badge
                          label={JOB_STATUS_META[job.status].label}
                          variant={JOB_STATUS_META[job.status].badge}
                        />
                      ) : null}
                    </HStack>
                    <Text type="supporting" color="secondary">
                      {job.team} · {job.location} ·{" "}
                      {formatCount(pipelineTotal(job.pipeline), "candidate")}
                    </Text>
                  </Stack>
                  <Button
                    label="Review"
                    variant="secondary"
                    size="sm"
                    href={ROUTES.companyApplicants}
                  />
                </HStack>
                <PipelineBar pipeline={job.pipeline} />
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
