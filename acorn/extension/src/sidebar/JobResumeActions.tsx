import { fetchCustomResume } from "../pipeline/api/custom-files";
import { fetchCustomLibraryResume } from "../pipeline/api/custom-library";
import { fetchRecommendedResume } from "../pipeline/api/job-files";
import { getJobGenerate } from "../tab-job-generate-session";
import { triggerResumeDownload } from "./download-resume";
import { pushAcornNotice } from "./acorn-notice";
import type { AcornWorkerJob } from "../worker-job";

export function resumeLabel(job: AcornWorkerJob): string | null {
  if (job.generatedResume) return "Generated";
  if (job.recommendedResumeStack) return job.recommendedResumeStack;
  if (job.recommendedResumeId) return "assigned";
  return null;
}

export function hasAssignedResume(job: AcornWorkerJob): boolean {
  return Boolean(resumeLabel(job));
}

export function resumeMetaText(job: AcornWorkerJob): string {
  return resumeLabel(job) ?? "No resume assigned";
}

export async function downloadJobResume(job: AcornWorkerJob): Promise<void> {
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
      pushAcornNotice({
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
    pushAcornNotice({
      kind: "error",
      title: "Couldn’t download résumé",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
