import type { ExtensionSubmissionInput } from "../api/types";
import type { CapturedJob } from "../capture";

export function toExtensionInput(job: CapturedJob): ExtensionSubmissionInput {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    apply_url: job.applyUrl,
    description: job.description,
    board: job.board,
  };
}
