export const AI_MODEL_PATH = "/v1/admin/ai-model";
export const AI_MODEL_MODELS_PATH = `${AI_MODEL_PATH}/models`;

const TOKENS_PER_MILLION = 1_000_000;

/** What GET /v1/admin/ai-model says about the OpenRouter settings. The key itself never comes back. */
export type AIModelSettings = {
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
  /** True when the API's OPENROUTER_API_KEY covers a missing saved key. */
  envKey: boolean;
};

export type CatalogPricing = {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  webSearch?: string;
};

export type CatalogArch = {
  modality: string;
  inputModalities: string[];
  outputModalities: string[];
};

/** One OpenRouter model from GET /v1/admin/ai-model/models. */
export type CatalogModel = {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  created: number;
  pricing: CatalogPricing;
  architecture: CatalogArch;
  supportedParameters: string[];
  /** chat, batch, or decisions. Missing on a stub, which is labeled from its id. */
  lane?: "chat" | "batch" | "decisions";
};

/** GET /v1/admin/ai-model/models: the chat models the key can use, newest first. */
export type AIModelCatalog = {
  models: CatalogModel[];
  /** Why the list is empty, when it is. */
  reason?: string;
};

export function stubCatalogModel(id: string): CatalogModel {
  return {
    id,
    name: id,
    description: "",
    contextLength: 0,
    created: 0,
    pricing: { prompt: "", completion: "" },
    architecture: { modality: "", inputModalities: [], outputModalities: [] },
    supportedParameters: [],
  };
}

/**
 * The dropdown's choices: OpenRouter's live catalog, plus the default and the saved
 * model so the one in use is always there, even before the list loads.
 */
export function modelOptions(settings: AIModelSettings, live: CatalogModel[]) {
  const byId = new Map<string, CatalogModel>();
  for (const model of live) {
    if (model.id) byId.set(model.id, model);
  }
  const ordered: CatalogModel[] = [];
  const seen = new Set<string>();
  for (const id of settings.models) {
    if (!id || seen.has(id)) continue;
    ordered.push(byId.get(id) ?? stubCatalogModel(id));
    seen.add(id);
  }
  for (const model of live) {
    if (seen.has(model.id)) continue;
    ordered.push(model);
    seen.add(model.id);
  }
  return ordered;
}

export function catalogById(models: CatalogModel[], id: string) {
  return models.find((model) => model.id === id) ?? (id ? stubCatalogModel(id) : null);
}

export function filterCatalog(models: CatalogModel[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return models;
  return models.filter((model) => {
    return (
      model.id.toLowerCase().includes(needle) ||
      model.name.toLowerCase().includes(needle) ||
      model.description.toLowerCase().includes(needle)
    );
  });
}

export type AIModelSource = "saved" | "environment" | "none";

/** Which key admin is using: the one saved here, else the API's environment one. */
export function aiModelSource(settings: AIModelSettings): AIModelSource {
  if (settings.configured) return "saved";
  return settings.envKey ? "environment" : "none";
}

/** The model admin is using, saved or default. */
export function effectiveModel(settings: AIModelSettings) {
  return settings.model || settings.defaultModel;
}

export type AIModelChange = { apiKey?: string; model?: string };

/** The PUT body for what changed: a key only when one was typed, a model only when it differs. */
export function aiModelChange(
  settings: AIModelSettings,
  typedKey: string,
  chosenModel: string,
): AIModelChange | null {
  const change: AIModelChange = {};
  const key = typedKey.trim();
  if (key) change.apiKey = key;
  if (chosenModel !== effectiveModel(settings)) {
    // Choosing the default returns to it, rather than pinning today's default.
    change.model = chosenModel === settings.defaultModel ? "" : chosenModel;
  }
  return Object.keys(change).length > 0 ? change : null;
}

/** OpenRouter prices are USD per token; the console shows USD per million tokens. */
export function formatTokenPrice(perToken: string | undefined) {
  const raw = (perToken ?? "").trim();
  if (!raw) return "—";
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return "—";
  if (amount === 0) return "Free";
  const perMillion = amount * TOKENS_PER_MILLION;
  if (perMillion < 0.01) {
    return `$${perMillion.toPrecision(2)} / 1M tokens`;
  }
  return `$${perMillion.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 1M tokens`;
}

export function formatContextLength(tokens: number | undefined) {
  if (!tokens || tokens < 1) return "—";
  return `${tokens.toLocaleString("en")} tokens`;
}

export function modalityLabel(architecture: CatalogArch | undefined) {
  if (!architecture) return "—";
  if (architecture.modality) return architecture.modality;
  const input = architecture.inputModalities?.join(", ");
  const output = architecture.outputModalities?.join(", ");
  if (input && output) return `${input} → ${output}`;
  return input || output || "—";
}
