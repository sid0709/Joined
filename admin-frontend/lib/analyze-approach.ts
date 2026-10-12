import type { CatalogArch, CatalogModel } from "@/lib/ai-model";

export const APPROACHES = [
  { value: "chat", label: "Chat" },
  { value: "batch", label: "Batch" },
  { value: "decisions", label: "Decisions" },
] as const;

export type Approach = (typeof APPROACHES)[number]["value"];

export type AnalyzeKind = "job" | "company";

export function isApproach(value: string): value is Approach {
  return APPROACHES.some((approach) => approach.value === value);
}

export function approachLabel(approach: Approach) {
  return APPROACHES.find((item) => item.value === approach)?.label ?? approach;
}

/** The lane a catalog row runs on. A labeled row wins; otherwise the id and modality decide. */
export function modelLane(model: CatalogModel): Approach {
  if (model.lane === "chat" || model.lane === "batch" || model.lane === "decisions") {
    return model.lane;
  }
  const id = model.id.toLowerCase();
  if (id.includes(":batch")) return "batch";
  if (decisionSlug(id) || mentionsDecisions(model.architecture)) return "decisions";
  return "chat";
}

export function modelsForApproach(models: CatalogModel[], approach: Approach) {
  return models.filter((model) => model.id !== "" && modelLane(model) === approach);
}

/** The run's model: the staff pick when it belongs to the lane, else the saved model, else the first. */
export function pickRunModel(lane: CatalogModel[], chosen: string, saved: string) {
  if (chosen && lane.some((model) => model.id === chosen)) return chosen;
  if (saved && lane.some((model) => model.id === saved)) return saved;
  return lane[0]?.id ?? "";
}

/** Perplexity Sonar searches inside the model. A :batch id does not. */
export function nativeSearch(id: string) {
  const trimmed = id.trim().toLowerCase();
  if (trimmed.includes(":batch")) return false;
  const base = trimmed.split(":")[0] ?? "";
  return base.startsWith("perplexity/") && base.includes("sonar");
}

export function jobStepDescription(approach: Approach, model: string) {
  const name = model || "the model";
  switch (approach) {
    case "chat":
      return `${name} reads each job's description into the Joined job schema, many jobs at once, and publishes each job whose analysis has a real title and company, a summary, its duties or requirements, and its skills. Published jobs are removed from temp_jobs. Jobs it cannot describe that well, or jobs without a description, are marked not publishable; failed ones stay waiting for the next run.`;
    case "batch":
      return `${name} reads each job's description into the Joined job schema through OpenRouter's batch API, and publishes each job whose analysis has a real title and company, a summary, its duties or requirements, and its skills. A batch can take longer than a chat call. Published jobs are removed from temp_jobs. Jobs it cannot describe that well, or jobs without a description, are marked not publishable; failed ones stay waiting for the next run.`;
    case "decisions":
      return `${name} classifies each posting's workplace, seniority, employment, and visa sponsorship. It does not write a summary, duties, or skills, so every job is marked not publishable.`;
    default:
      return unexpectedApproach(approach);
  }
}

export function companyStepDescription(approach: Approach, model: string, webSearch: boolean) {
  const name = model || "the model";
  switch (approach) {
    case "chat":
      return webSearch
        ? `${name} searches the web for each staged company, busiest first and many at once, and fills in its about, industry, size, founding year, headquarters, offices, values, and benefits. Each company it finds is published to the directory right away; ones it cannot find stay staged as not found. It only fills blank fields, so admin edits stay, and answers that did not come from a web search are thrown away.`
        : `${name} fills each staged company from what it already knows, without web search, busiest first and many at once. Each company it can describe is published to the directory right away; ones it leaves blank stay staged as not found. It only fills blank fields, so admin edits stay.`;
    case "batch":
      return webSearch
        ? `${name} looks each staged company up through OpenRouter's batch API, busiest first. A batch can take longer than a chat call. It fills in about, industry, size, founding year, headquarters, offices, values, and benefits, and publishes each company it finds. Ones it cannot find stay staged as not found. It only fills blank fields, so admin edits stay.`
        : `${name} fills each staged company from what it already knows, through OpenRouter's batch API, busiest first. A batch can take longer than a chat call. Each company it can describe is published to the directory right away; ones it leaves blank stay staged as not found. It only fills blank fields, so admin edits stay.`;
    case "decisions":
      return `${name} classifies each company's industry, size, and company type. A company it can classify is published with those fields only. About, mission, and benefits stay blank.`;
    default:
      return unexpectedApproach(approach);
  }
}

export function searchSwitchDescription(
  kind: AnalyzeKind,
  approach: Exclude<Approach, "decisions">,
  model: string,
  webSearch: boolean,
) {
  if (approach === "chat" && nativeSearch(model)) {
    return webSearch
      ? "Perplexity Sonar searches on its own. The OpenRouter web plugin stays off, so the answer comes from Sonar's search."
      : "Web search is off, so the prompt tells the model to stay with what it was given. Sonar still searches, because search is part of the model.";
  }
  if (approach === "batch") {
    return webSearch
      ? "This run uses the provider's own search inside the batch. The OpenRouter web plugin does not run."
      : kind === "job"
        ? "The batch reads only the posting."
        : "The batch answers from what the model already knows.";
  }
  return kind === "job"
    ? "The model searches the live web before it answers, including for a salary the posting leaves out. Off, it only uses the posting."
    : "The model searches the live web before it answers. Off, it uses what it already knows and leaves a field empty when it is not sure.";
}

export function jobRedoDescription(approach: Approach, model: string, total: string) {
  const name = model || "the model";
  switch (approach) {
    case "chat":
    case "batch":
      return `This sends all ${total} temp jobs to ${name} again, using ${approachLabel(approach)}, including ones marked not publishable, and publishes those it can. Published jobs have already left temp jobs.`;
    case "decisions":
      return `This classifies all ${total} temp jobs again with ${name}. Decision runs mark jobs not publishable. Published jobs have already left temp jobs.`;
    default:
      return unexpectedApproach(approach);
  }
}

export function companyRetryDescription(
  approach: Approach,
  model: string,
  webSearch: boolean,
  notFound: string,
  waiting: string,
) {
  const name = model || "the model";
  switch (approach) {
    case "chat":
      return webSearch
        ? `This searches the web again for the ${notFound} not found, along with the ${waiting} still waiting. It still only fills blank fields.`
        : `This asks ${name} again, without web search, for the ${notFound} not found, along with the ${waiting} still waiting. It still only fills blank fields.`;
    case "batch":
      return webSearch
        ? `This looks them up again through the batch API: the ${notFound} not found, along with the ${waiting} still waiting. It still only fills blank fields.`
        : `This asks ${name} again through the batch API, without web search, for the ${notFound} not found and the ${waiting} still waiting. It still only fills blank fields.`;
    case "decisions":
      return `This classifies industry, size, and company type again for the ${notFound} not found and the ${waiting} still waiting. A company it can classify is published with those fields.`;
    default:
      return unexpectedApproach(approach);
  }
}

function decisionSlug(id: string) {
  const base = id.split(":")[0] ?? "";
  if (base.startsWith("typesafe/")) return true;
  if (base.includes("sonar")) return false;
  return base.includes("decision");
}

function mentionsDecisions(architecture: CatalogArch | undefined) {
  if (!architecture) return false;
  const modality =
    `${architecture.modality} ${(architecture.outputModalities ?? []).join(" ")}`.toLowerCase();
  return modality.includes("decisions");
}

function unexpectedApproach(approach: never): string {
  return approach;
}
