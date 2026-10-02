import {
  fetchCustomLibraryResume,
  fetchCustomResume,
  fetchRecommendedResume,
} from "../pipeline/ai-client";
import { getJobGenerate } from "../tab-job-generate-session";
import { triggerResumeDownload } from "./download-resume";
import { pushBashNotice } from "./bash-notice";
import type { BashWorkerJob } from "../worker-job";

export function resumeLabel(job: BashWorkerJob): string | null {
  if (job.generatedResume) return "Generated";
  if (job.recommendedResumeStack) return job.recommendedResumeStack;
  if (job.recommendedResumeId) return "assigned";
  return null;
}

export function hasAssignedResume(job: BashWorkerJob): boolean {
  return Boolean(resumeLabel(job));
}

export function resumeMetaText(job: BashWorkerJob): string {
  return resumeLabel(job) ?? "No resume assigned";
}

export async function downloadJobResume(job: BashWorkerJob): Promise<void> {
  try {
    const gen = await getJobGenerate(job.id);
    const generationId = String(gen?.generationId || "").trim();
    const libraryId = String(gen?.recommendedResumeId || "").trim();
    const file = generationId
      ? await fetchCustomResume(generationId)
      : libraryId
        ? await fetchCustomLibraryResume(libraryId)
        : await fetchRecommendedResume(job.id);
    if (!file?.base64 || !file.name) {
      pushBashNotice({
        kind: "error",
        title: "Couldn’t download résumé",
        detail:
          job.generatedResume || generationId
            ? "Could not download the generated résumé"
            : "Could not download the Library résumé",
      });
      return;
    }
    triggerResumeDownload(file);
  } catch (err) {
    pushBashNotice({
      kind: "error",
      title: "Couldn’t download résumé",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
