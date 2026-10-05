import { Badge, Glyph, HStack } from "sid-ui";
import { EMPLOYMENT_LABEL, SENIORITY_LABEL, WORKPLACE_LABEL, isNew, type Job } from "@/lib/jobs";

/** The facts a job hunter scans for first, as a row of badges. */
export function JobTags({
  job,
  applied = false,
  detailed = false,
}: {
  job: Job;
  applied?: boolean;
  detailed?: boolean;
}) {
  return (
    <HStack gap={1.5} wrap="wrap" vAlign="center">
      {applied ? <Badge label="Applied" variant="success" icon={<Glyph name="check" />} /> : null}
      {isNew(job) ? <Badge label="New" variant="blue" /> : null}
      {job.source === "scouted" ? (
        <Badge label="Hidden job" variant="purple" icon={<Glyph name="eye" />} />
      ) : null}
      <Badge label={WORKPLACE_LABEL[job.workplace]} variant="neutral" />
      {detailed || job.employment !== "full-time" ? (
        <Badge label={EMPLOYMENT_LABEL[job.employment]} variant="neutral" />
      ) : null}
      {detailed ? <Badge label={SENIORITY_LABEL[job.seniority]} variant="neutral" /> : null}
      {job.visa ? <Badge label="Visa sponsor" variant="teal" /> : null}
    </HStack>
  );
}
