import { useCallback, useState } from "react";
import { fetchCustomResume, fetchCustomResumePreview } from "../pipeline/api/custom-files";
import {
  fetchCustomLibraryResume,
  fetchCustomLibraryResumePreview,
} from "../pipeline/api/custom-library";
import { fetchGeneratedResumePreview, fetchRecommendedResume } from "../pipeline/api/job-files";
import type { AcornCustomTabBinding } from "../tab-custom-session";
import type { ResumePreviewDownload } from "./ResumePreviewPanel";
import type { useTabSession } from "./use-tab-session";
import type { AcornWorkerJob } from "./WorkerPoolList";

type JobGenerates = ReturnType<typeof useTabSession>["jobGenerates"];

export type ResumePreviewRequest = {
  title: string;
  sourceKey: string;
  loadHtml: () => Promise<string>;
  downloadFile: () => Promise<ResumePreviewDownload>;
};

/** Which résumé the preview overlay shows, and how to load and download it. */
export function useResumePreview(jobGenerates: JobGenerates) {
  const [preview, setPreview] = useState<ResumePreviewRequest | null>(null);

  const openJobResumePreview = useCallback(
    (job: AcornWorkerJob) => {
      const generationId = String(jobGenerates[job.id]?.generationId || "").trim();
      setPreview({
        title: job.title,
        sourceKey: generationId ? `job-gen:${generationId}` : `job:${job.id}`,
        loadHtml: () =>
          generationId
            ? fetchCustomResumePreview(generationId)
            : fetchGeneratedResumePreview(job.id),
        downloadFile: async () => {
          if (generationId) {
            const file = await fetchCustomResume(generationId);
            if (!file?.base64 || !file.name) {
              throw new Error("Could not download the generated résumé");
            }
            return file;
          }
          const file = await fetchRecommendedResume(job.id);
          if (!file?.base64 || !file.name) {
            throw new Error(
              job.generatedResume
                ? "Could not download the generated résumé"
                : "Could not download the Library résumé",
            );
          }
          return file;
        },
      });
    },
    [jobGenerates],
  );

  const openCustomResumePreview = useCallback((tab: AcornCustomTabBinding) => {
    if (tab.resumeMode === "recommend") {
      const resumeId = String(tab.recommendedResumeId || "").trim();
      if (!resumeId) return;
      setPreview({
        title: tab.title || "Untitled",
        sourceKey: `custom-library:${resumeId}`,
        loadHtml: () => fetchCustomLibraryResumePreview(resumeId),
        downloadFile: async () => {
          const file = await fetchCustomLibraryResume(resumeId);
          if (!file?.base64 || !file.name) {
            throw new Error("Could not download the Library résumé");
          }
          return file;
        },
      });
      return;
    }
    const generationId = String(tab.generationId || "").trim();
    if (!generationId) return;
    setPreview({
      title: tab.title || "Untitled",
      sourceKey: `custom:${generationId}:${String(tab.resumeId || "")}`,
      loadHtml: () => fetchCustomResumePreview(generationId),
      downloadFile: async () => {
        const file = await fetchCustomResume(generationId);
        if (!file?.base64 || !file.name) {
          throw new Error("Could not download the stored editor résumé");
        }
        return file;
      },
    });
  }, []);

  return { preview, setPreview, openJobResumePreview, openCustomResumePreview };
}
