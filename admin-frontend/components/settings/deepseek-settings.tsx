"use client";

import { ModelSettingsForm } from "@/components/settings/model-settings-form";
import { DEEPSEEK_MODELS_PATH, DEEPSEEK_PATH } from "@/lib/deepseek-settings";

/** Staff set the DeepSeek key and model admin analysis and research use. */
export function DeepSeekSettingsForm() {
  return (
    <ModelSettingsForm
      copy={{
        title: "DeepSeek",
        description:
          "The DeepSeek key and model behind job analysis, company research, and company autofill. Saved here, it takes effect within seconds, with no redeploy.",
        sectionTitle: "DeepSeek",
        sectionDescription:
          "The key is stored encrypted in the database and is never sent back to this page.",
        path: DEEPSEEK_PATH,
        modelsPath: DEEPSEEK_MODELS_PATH,
        keyPlaceholder: "sk-…",
        modelHint: (defaultModel) =>
          `Default: ${defaultModel}. Newest first, from your DeepSeek account.`,
        source: {
          saved: { label: "Using the saved key", variant: "success" },
          environment: { label: "Using the API's DEEPSEEK_API_KEY", variant: "blue" },
          none: { label: "No key — analysis and research are off", variant: "error" },
        },
      }}
    />
  );
}
