import {
  EXTRACT_LABEL,
  LOAD_JD_LABEL,
  type CustomUiProgress,
  type GenerateSegment,
} from "./custom-generate-progress";

export const RECOMMEND_LABEL = "Recommending…";

export type CustomRecommendPhase = "load-jd" | "recommend";

export function customRecommendProgress(input: {
  status: string;
  phase?: CustomRecommendPhase;
  source?: "fill" | "custom";
}): CustomUiProgress {
  const extracting =
    input.phase === "load-jd" || (input.phase == null && input.status === "queued");
  const running = input.status === "queued" || input.status === "running";
  const source = input.source ?? "custom";

  const jdSegment: GenerateSegment =
    input.status === "failed" && extracting
      ? "failed"
      : extracting
        ? running
          ? "active"
          : "pending"
        : "done";
  const recommendSegment: GenerateSegment =
    input.status === "completed"
      ? "done"
      : input.status === "failed" && !extracting
        ? "failed"
        : extracting
          ? "pending"
          : running
            ? "active"
            : "pending";

  let percent = 0;
  if (input.status === "completed") percent = 100;
  else if (extracting) percent = 15;
  else if (running) percent = 65;
  else if (input.status === "failed") percent = extracting ? 8 : 55;

  return {
    percent,
    label: extracting ? (source === "fill" ? LOAD_JD_LABEL : EXTRACT_LABEL) : RECOMMEND_LABEL,
    segments: [jdSegment, recommendSegment],
  };
}
