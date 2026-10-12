import { expect, test } from "bun:test";

import {
  aiModelChange,
  aiModelSource,
  catalogById,
  effectiveModel,
  filterCatalog,
  formatContextLength,
  formatTokenPrice,
  modelOptions,
  stubCatalogModel,
  type CatalogModel,
  type AIModelSettings,
} from "./ai-model";

const mini: CatalogModel = {
  ...stubCatalogModel("openai/gpt-4o-mini"),
  name: "GPT-4o Mini",
  description: "Small and cheap",
  contextLength: 128000,
  pricing: { prompt: "0.00000015", completion: "0.0000006" },
};

const sonnet: CatalogModel = {
  ...stubCatalogModel("anthropic/claude-sonnet"),
  name: "Claude Sonnet",
  description: "Balanced",
  pricing: { prompt: "0.000003", completion: "0.000015" },
};

const base: AIModelSettings = {
  configured: false,
  keyHint: "",
  model: "",
  updatedAt: "",
  updatedBy: "",
  encryptable: true,
  models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet"],
  defaultModel: "openai/gpt-4o-mini",
  envKey: false,
};

test("the source is the saved key, else the environment's, else none", () => {
  expect(aiModelSource({ ...base, configured: true, envKey: true })).toBe("saved");
  expect(aiModelSource({ ...base, envKey: true })).toBe("environment");
  expect(aiModelSource(base)).toBe("none");
});

test("the model in use is the saved one or the default", () => {
  expect(effectiveModel(base)).toBe("openai/gpt-4o-mini");
  expect(effectiveModel({ ...base, model: "anthropic/claude-sonnet" })).toBe(
    "anthropic/claude-sonnet",
  );
});

test("only what changed is sent", () => {
  expect(aiModelChange(base, "", "openai/gpt-4o-mini")).toBeNull();
  expect(aiModelChange(base, "  sk-or-new  ", "openai/gpt-4o-mini")).toEqual({
    apiKey: "sk-or-new",
  });
  expect(aiModelChange(base, "", "anthropic/claude-sonnet")).toEqual({
    model: "anthropic/claude-sonnet",
  });
  expect(aiModelChange(base, "sk-or-new", "anthropic/claude-sonnet")).toEqual({
    apiKey: "sk-or-new",
    model: "anthropic/claude-sonnet",
  });
});

test("choosing the default model clears the saved one", () => {
  expect(
    aiModelChange({ ...base, model: "anthropic/claude-sonnet" }, "", "openai/gpt-4o-mini"),
  ).toEqual({
    model: "",
  });
});

test("the dropdown lists live models and keeps the one in use", () => {
  const settings = { ...base, models: ["openai/gpt-4o-mini", "saved/custom"] };
  const options = modelOptions(settings, [sonnet, mini]);
  expect(options.map((model) => model.id)).toEqual([
    "openai/gpt-4o-mini",
    "saved/custom",
    "anthropic/claude-sonnet",
  ]);
  expect(options[0].name).toBe("GPT-4o Mini");
  expect(options[1].name).toBe("saved/custom");
  expect(modelOptions(settings, []).map((model) => model.id)).toEqual([
    "openai/gpt-4o-mini",
    "saved/custom",
  ]);
});

test("filterCatalog matches id, name, and description", () => {
  const models = [mini, sonnet];
  expect(filterCatalog(models, "sonnet").map((model) => model.id)).toEqual([
    "anthropic/claude-sonnet",
  ]);
  expect(filterCatalog(models, "cheap").map((model) => model.id)).toEqual(["openai/gpt-4o-mini"]);
  expect(filterCatalog(models, "  ").length).toBe(2);
});

test("catalogById falls back to a stub", () => {
  expect(catalogById([mini], "openai/gpt-4o-mini")?.name).toBe("GPT-4o Mini");
  expect(catalogById([mini], "missing")?.name).toBe("missing");
  expect(catalogById([mini], "")).toBeNull();
});

test("OpenRouter per-token prices display per million tokens", () => {
  expect(formatTokenPrice("0")).toBe("Free");
  expect(formatTokenPrice("")).toBe("—");
  expect(formatTokenPrice("0.00000015")).toBe("$0.15 / 1M tokens");
  expect(formatTokenPrice("0.000003")).toBe("$3.00 / 1M tokens");
  expect(formatContextLength(128000)).toBe("128,000 tokens");
  expect(formatContextLength(0)).toBe("—");
});
