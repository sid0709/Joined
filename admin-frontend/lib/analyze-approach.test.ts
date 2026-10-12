import { expect, test } from "bun:test";

import { stubCatalogModel, type CatalogModel } from "./ai-model";
import {
  approachLabel,
  companyRetryDescription,
  companyStepDescription,
  isApproach,
  jobRedoDescription,
  jobStepDescription,
  modelLane,
  modelsForApproach,
  nativeSearch,
  pickRunModel,
  searchSwitchDescription,
} from "./analyze-approach";

function row(id: string, lane?: CatalogModel["lane"], modality = ""): CatalogModel {
  return {
    ...stubCatalogModel(id),
    lane,
    architecture: { modality, inputModalities: [], outputModalities: modality ? [modality] : [] },
  };
}

test("modelLane trusts the catalog label, then the id", () => {
  expect(modelLane(row("openai/gpt-6", "chat"))).toBe("chat");
  expect(modelLane(row("openai/gpt-6-luna:batch", "batch"))).toBe("batch");
  expect(modelLane(row("typesafe/jev-1.13", "decisions"))).toBe("decisions");
  expect(modelLane(row("openai/gpt-6-luna:batch"))).toBe("batch");
  expect(modelLane(row("typesafe/jev-1.13"))).toBe("decisions");
  expect(modelLane(row("acme/picker", undefined, "decisions"))).toBe("decisions");
  expect(modelLane(row("perplexity/sonar-pro"))).toBe("chat");
});

test("modelsForApproach keeps one lane", () => {
  const models = [
    row("openai/gpt-6", "chat"),
    row("openai/gpt-6:batch", "batch"),
    row("typesafe/jev-1.13", "decisions"),
  ];
  expect(modelsForApproach(models, "batch").map((model) => model.id)).toEqual([
    "openai/gpt-6:batch",
  ]);
});

test("pickRunModel prefers a pick in the lane, then the saved model, then the first", () => {
  const lane = [row("openai/gpt-6", "chat"), row("perplexity/sonar-pro", "chat")];
  expect(pickRunModel(lane, "perplexity/sonar-pro", "openai/gpt-6")).toBe("perplexity/sonar-pro");
  expect(pickRunModel(lane, "openai/gpt-6:batch", "perplexity/sonar-pro")).toBe(
    "perplexity/sonar-pro",
  );
  expect(pickRunModel(lane, "", "")).toBe("openai/gpt-6");
  expect(pickRunModel([], "openai/gpt-6", "openai/gpt-6")).toBe("");
});

test("nativeSearch is Perplexity Sonar and skips batch ids", () => {
  expect(nativeSearch("perplexity/sonar-pro")).toBe(true);
  expect(nativeSearch("perplexity/sonar:batch")).toBe(false);
  expect(nativeSearch("openai/gpt-6")).toBe(false);
});

test("job and company copy follow the approach", () => {
  expect(isApproach("chat")).toBe(true);
  expect(isApproach("plugins")).toBe(false);
  expect(approachLabel("batch")).toBe("Batch");
  expect(jobStepDescription("chat", "")).toContain("the model");
  expect(jobStepDescription("decisions", "typesafe/jev-1.13")).toContain("not publishable");
  expect(jobStepDescription("batch", "openai/gpt-6:batch")).toContain("batch API");
  expect(companyStepDescription("decisions", "typesafe/jev-1.13", true)).toContain("industry");
  expect(companyStepDescription("chat", "openai/gpt-6", false)).toContain("without web search");
  expect(companyStepDescription("batch", "openai/gpt-6:batch", true)).toContain("batch API");
  expect(companyStepDescription("batch", "openai/gpt-6:batch", false)).toContain("already knows");
  expect(searchSwitchDescription("job", "chat", "perplexity/sonar-pro", true)).toContain(
    "plugin stays off",
  );
  expect(searchSwitchDescription("company", "chat", "perplexity/sonar-pro", false)).toContain(
    "Sonar still searches",
  );
  expect(searchSwitchDescription("company", "batch", "openai/gpt-6:batch", true)).toContain(
    "provider's own search",
  );
  expect(searchSwitchDescription("job", "batch", "openai/gpt-6:batch", false)).toContain("posting");
  expect(searchSwitchDescription("company", "batch", "openai/gpt-6:batch", false)).toContain(
    "already knows",
  );
  expect(searchSwitchDescription("job", "chat", "openai/gpt-6", true)).toContain("salary");
  expect(searchSwitchDescription("company", "chat", "openai/gpt-6", false)).toContain(
    "already knows",
  );
  expect(jobRedoDescription("chat", "", "12")).toContain("Chat");
  expect(jobRedoDescription("decisions", "typesafe/jev-1.13", "12")).toContain("not publishable");
  expect(companyRetryDescription("chat", "openai/gpt-6", true, "2", "3")).toContain(
    "searches the web",
  );
  expect(companyRetryDescription("chat", "openai/gpt-6", false, "2", "3")).toContain(
    "without web search",
  );
  expect(companyRetryDescription("batch", "openai/gpt-6:batch", true, "2", "3")).toContain(
    "batch API",
  );
  expect(companyRetryDescription("batch", "", false, "2", "3")).toContain("the model");
  expect(companyRetryDescription("decisions", "typesafe/jev-1.13", true, "2", "3")).toContain(
    "industry",
  );
});

test("an unlabeled decision slug stays off the chat lane", () => {
  expect(modelLane(row("acme/decision-pro"))).toBe("decisions");
  expect(modelLane(row("perplexity/sonar-reasoning"))).toBe("chat");
});
