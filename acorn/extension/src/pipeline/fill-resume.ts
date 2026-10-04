import { sameApplySite } from "@acorn/shared/apply-site";
import type { RuntimeAttachedFile } from "@acorn/shared/plan-runner/types";
import { customTabHasResume, type AcornCustomTabBinding } from "../tab-custom-session";
import { getJobGenerate } from "../tab-job-generate-session";
import type { AcornTabJobBinding } from "../tab-job-session";
import type { PipelineSource } from "../types";
import { fetchCustomResume } from "./api/custom-files";
import { fetchCustomLibraryResume } from "./api/custom-library";
import { fetchRecommendedResume } from "./api/job-files";

const WRONG_SITE = "Page is not this job's apply site — skipped resume upload";

export async function loadFillResume(input: {
  source?: PipelineSource;
  tabJob: AcornTabJobBinding | null;
  customTab?: AcornCustomTabBinding | null;
  customGenerationId?: string | null;
  apiUrl: string;
}): Promise<{ file: RuntimeAttachedFile | null; skipReason: string | null }> {
  if (input.source === "custom" || (input.customTab && customTabHasResume(input.customTab))) {
    return loadCustomFillResume(input);
  }

  const tabJob = input.tabJob;
  if (!tabJob?.jobId) {
    return { file: null, skipReason: null };
  }

  const jobGen = await getJobGenerate(tabJob.jobId);
  const generationId = String(jobGen?.generationId || "").trim();
  if (generationId && jobGen?.generateStatus === "completed") {
    try {
      const file = await fetchCustomResume(generationId, input.apiUrl);
      if (file) return { file, skipReason: null };
    } catch (err) {
      return {
        file: null,
        skipReason: err instanceof Error ? err.message : String(err),
      };
    }
  }
  const libraryId = String(jobGen?.recommendedResumeId || "").trim();
  if (libraryId && jobGen?.generateStatus === "completed" && jobGen.workKind === "recommend") {
    try {
      const file = await fetchCustomLibraryResume(libraryId, input.apiUrl);
      if (file) return { file, skipReason: null };
    } catch (err) {
      return {
        file: null,
        skipReason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  try {
    const file = await fetchRecommendedResume(tabJob.jobId, input.apiUrl);
    if (!file) {
      return {
        file: null,
        skipReason: tabJob.resumeStack
          ? `Could not load the ${tabJob.resumeStack} file`
          : "No generated or recommended resume for this job",
      };
    }
    return { file, skipReason: null };
  } catch (err) {
    return {
      file: null,
      skipReason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function loadCustomFillResume(input: {
  customTab?: AcornCustomTabBinding | null;
  customGenerationId?: string | null;
  apiUrl: string;
}): Promise<{ file: RuntimeAttachedFile | null; skipReason: string | null }> {
  const tab = input.customTab;
  const recommending = tab?.resumeMode === "recommend";
  const libraryId = String(tab?.recommendedResumeId || "").trim();
  const generationId = String(tab?.generationId || input.customGenerationId || "").trim();

  if (recommending) {
    if (!libraryId) {
      return { file: null, skipReason: "Recommend a Library résumé first" };
    }
    try {
      const file = await fetchCustomLibraryResume(libraryId, input.apiUrl);
      if (!file) {
        return {
          file: null,
          skipReason: "Could not load the recommended Library résumé",
        };
      }
      return { file, skipReason: null };
    } catch (err) {
      return {
        file: null,
        skipReason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (!generationId) {
    return { file: null, skipReason: "Generate a résumé for this tab first" };
  }
  try {
    const file = await fetchCustomResume(generationId, input.apiUrl);
    if (!file) {
      return {
        file: null,
        skipReason: "Could not load the stored editor résumé",
      };
    }
    return { file, skipReason: null };
  } catch (err) {
    return {
      file: null,
      skipReason: err instanceof Error ? err.message : String(err),
    };
  }
}

export function keepResumeIfSameSite(
  file: RuntimeAttachedFile | null,
  tabJob: AcornTabJobBinding | null,
  pageUrl: string,
  skipReason: string | null,
): { file: RuntimeAttachedFile | null; skipReason: string | null } {
  if (!file) return { file: null, skipReason };
  if (!tabJob?.applyUrl || sameApplySite(pageUrl, tabJob.applyUrl)) {
    return { file, skipReason: null };
  }
  return { file: null, skipReason: WRONG_SITE };
}
