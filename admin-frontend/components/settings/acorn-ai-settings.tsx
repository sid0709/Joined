"use client";

import { ModelSettingsForm } from "@/components/settings/model-settings-form";
import { ACORN_AI_MODELS_PATH, ACORN_AI_PATH } from "@/lib/acorn-ai";

/** Staff set the OpenAI key and model Acorn's AI routes use. */
export function AcornAISettingsForm() {
  return (
    <ModelSettingsForm
      copy={{
        title: "Acorn AI",
        description:
          "The OpenAI key and model behind Acorn's AI Analyze, Q&A, and option matching. Saved here, it takes effect within seconds, with no redeploy.",
        sectionTitle: "OpenAI",
        sectionDescription: "The key is stored encrypted and is never sent back to this page.",
        path: ACORN_AI_PATH,
        modelsPath: ACORN_AI_MODELS_PATH,
        keyPlaceholder: "sk-…",
        modelHint: (defaultModel) =>
          `Default: ${defaultModel}. Newest first, from your OpenAI account.`,
        source: {
          saved: { label: "Using the saved key", variant: "success" },
          environment: { label: "Using the API's OPENAI_API_KEY", variant: "blue" },
          none: { label: "No key — Acorn's AI is off", variant: "error" },
        },
      }}
    />
  );
}
