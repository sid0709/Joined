import { expect, test } from "bun:test";

import { acornAIChange, acornAISource, effectiveModel, type AcornAISettings } from "./acorn-ai";

const base: AcornAISettings = {
  configured: false,
  keyHint: "",
  model: "",
  updatedAt: "",
  updatedBy: "",
  encryptable: true,
  models: ["gpt-4o-mini", "gpt-4o"],
  defaultModel: "gpt-4o-mini",
  envKey: false,
};

test("the source is the saved key, else the environment's, else none", () => {
  expect(acornAISource({ ...base, configured: true, envKey: true })).toBe("saved");
  expect(acornAISource({ ...base, envKey: true })).toBe("environment");
  expect(acornAISource(base)).toBe("none");
});

test("the model in use is the saved one or the default", () => {
  expect(effectiveModel(base)).toBe("gpt-4o-mini");
  expect(effectiveModel({ ...base, model: "gpt-4o" })).toBe("gpt-4o");
});

test("only what changed is sent", () => {
  expect(acornAIChange(base, "", "gpt-4o-mini")).toBeNull();
  expect(acornAIChange(base, "  sk-new  ", "gpt-4o-mini")).toEqual({ apiKey: "sk-new" });
  expect(acornAIChange(base, "", "gpt-4o")).toEqual({ model: "gpt-4o" });
  expect(acornAIChange(base, "sk-new", "gpt-4o")).toEqual({ apiKey: "sk-new", model: "gpt-4o" });
});

test("choosing the default model clears the saved one", () => {
  expect(acornAIChange({ ...base, model: "gpt-4o" }, "", "gpt-4o-mini")).toEqual({ model: "" });
});
