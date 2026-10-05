import { JSON_LD_SCRIPT_TYPE } from "@/lib/seo/constants";
import { absoluteJobPageUrl } from "@/lib/seo/job-metadata";
import { jobPostingJsonLd, serializeJsonLd } from "@/lib/seo/job-posting";
import type { Job } from "@/lib/jobs";

/** Server-only JSON-LD for public job pages. Keep out of client job views. */
export function JobPostingJsonLd({ job }: { job: Job }) {
  const data = jobPostingJsonLd(job, { pageUrl: absoluteJobPageUrl(job.id) });
  return (
    <script
      type={JSON_LD_SCRIPT_TYPE}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
