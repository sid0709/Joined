import {
  fetchCustomLibraryResume,
  fetchCustomResume,
  fetchRecommendedResume,
} from "../pipeline/ai-client";
import { getJobGenerate } from "../tab-job-generate-session";
import { triggerResumeDownload } from "./download-resume";
import { pushOakNotice } from "./oak-notice";
import type { OakWorkerJob } from "../worker-job";

export function resumeLabel(job: OakWorkerJob): string | null {
  if (job.generatedResume) return "Generated";
  if (job.recommendedResumeStack) return job.recommendedResumeStack;
  if (job.recommendedResumeId) return "assigned";
  return null;
}

export function hasAssignedResume(job: OakWorkerJob): boolean {
  return Boolean(resumeLabel(job));
}

export function resumeMetaText(job: OakWorkerJob): string {
  return resumeLabel(job) ?? "No resume assigned";
}

export async function downloadJobResume(job: OakWorkerJob): Promise<void> {
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
      pushOakNotice({
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
    pushOakNotice({
      kind: "error",
      title: "Couldn’t download résumé",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
