"use client";

import { useMemo, useState } from "react";
import { Selector, Stack, Switch } from "sid-ui";
import {
  APPROACHES,
  companyStepDescription,
  isApproach,
  jobStepDescription,
  modelsForApproach,
  pickRunModel,
  searchSwitchDescription,
  type AnalyzeKind,
  type Approach,
} from "@/lib/analyze-approach";
import { AI_MODEL_MODELS_PATH, type AIModelCatalog, type CatalogModel } from "@/lib/ai-model";
import type { MigrationStart } from "@/lib/migration";
import { useAdminQuery } from "@/lib/use-admin-query";

function optionLabel(model: CatalogModel) {
  return model.name && model.name !== model.id ? `${model.name} · ${model.id}` : model.id;
}

/** Approach, model, and web search for one analyze run. The saved model is only a starting point. */
export function useAnalyzeApproach(kind: AnalyzeKind, savedModel: string) {
  const live = useAdminQuery<AIModelCatalog>(AI_MODEL_MODELS_PATH);
  const [approach, setApproach] = useState<Approach>("chat");
  const [chosen, setChosen] = useState("");
  const [webSearch, setWebSearch] = useState(true);
  const laneModels = useMemo(
    () => modelsForApproach(live.result?.models ?? [], approach),
    [live.result?.models, approach],
  );
  const model = pickRunModel(laneModels, chosen, savedModel);
  const description =
    kind === "job"
      ? jobStepDescription(approach, model)
      : companyStepDescription(approach, model, webSearch);
  const startBody: MigrationStart = {
    approach,
    model,
    ...(approach === "decisions" ? {} : { webSearch }),
  };
  return {
    approach,
    setApproach,
    model,
    setChosen,
    webSearch,
    setWebSearch,
    laneModels,
    description,
    startBody,
    canRun: model !== "" && !live.loading,
    catalogError: live.error,
  };
}

type AnalyzeApproachFieldsProps = {
  kind: AnalyzeKind;
  approach: Approach;
  onApproach: (approach: Approach) => void;
  model: string;
  onModel: (model: string) => void;
  laneModels: CatalogModel[];
  webSearch: boolean;
  onWebSearch: (webSearch: boolean) => void;
  disabled: boolean;
  catalogError: string | null;
};

/** The three analyze lanes, the models that can run the selected one, and web search when it applies. */
export function AnalyzeApproachFields({
  kind,
  approach,
  onApproach,
  model,
  onModel,
  laneModels,
  webSearch,
  onWebSearch,
  disabled,
  catalogError,
}: AnalyzeApproachFieldsProps) {
  return (
    <Stack gap={4}>
      <Selector
        label="Approach"
        description="Chat writes a full profile. Batch is the same work on OpenRouter's batch API. Decisions classifies with a decision model."
        options={APPROACHES.map((item) => ({ value: item.value, label: item.label }))}
        value={approach}
        onChange={(value) => {
          if (isApproach(value)) onApproach(value);
        }}
        isDisabled={disabled}
      />
      <Selector
        label="Model"
        description={
          catalogError ||
          (laneModels.length > 0
            ? "Models that can run this approach. This choice is for the run, and the saved default stays as it is."
            : "This approach has no models in the catalog yet.")
        }
        options={laneModels.map((item) => ({ value: item.id, label: optionLabel(item) }))}
        value={model}
        onChange={onModel}
        isDisabled={disabled || laneModels.length === 0}
      />
      {approach === "decisions" ? null : (
        <Switch
          label="Web search"
          description={searchSwitchDescription(kind, approach, model, webSearch)}
          value={webSearch}
          onChange={onWebSearch}
          isDisabled={disabled}
        />
      )}
    </Stack>
  );
}
