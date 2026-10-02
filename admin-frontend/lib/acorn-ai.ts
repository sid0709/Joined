export const ACORN_AI_PATH = "/v1/admin/acorn-ai";

/** What GET /v1/admin/acorn-ai says about Acorn's model settings. The key itself never comes back. */
export type AcornAISettings = {
  configured: boolean;
  /** The end of the saved key, enough to tell which one it is. */
  keyHint: string;
  /** The saved model; empty means the default. */
  model: string;
  updatedAt: string;
  updatedBy: string;
  /** False when the API has no SETTINGS_ENCRYPTION_KEY, so a key can't be saved. */
  encryptable: boolean;
  models: string[];
  defaultModel: string;
  /** True when the API's OPENAI_API_KEY covers a missing saved key. */
  envKey: boolean;
};

export type AcornAISource = "saved" | "environment" | "none";

/** Which key Acorn is using: the one saved here, else the API's environment one. */
export function acornAISource(settings: AcornAISettings): AcornAISource {
  if (settings.configured) return "saved";
  return settings.envKey ? "environment" : "none";
}

/** The model Acorn is using, saved or default. */
export function effectiveModel(settings: AcornAISettings) {
  return settings.model || settings.defaultModel;
}

export type AcornAIChange = { apiKey?: string; model?: string };

/** The PUT body for what changed: a key only when one was typed, a model only when it differs. */
export function acornAIChange(
  settings: AcornAISettings,
  typedKey: string,
  chosenModel: string,
): AcornAIChange | null {
  const change: AcornAIChange = {};
  const key = typedKey.trim();
  if (key) change.apiKey = key;
  if (chosenModel !== effectiveModel(settings)) {
    // Choosing the default returns to it, rather than pinning today's default.
    change.model = chosenModel === settings.defaultModel ? "" : chosenModel;
  }
  return Object.keys(change).length > 0 ? change : null;
}
