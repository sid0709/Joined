"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  Selector,
  Stack,
  Text,
  TextInput,
  useToast,
} from "sid-ui";
import { SearchBox } from "@/components/search-box";
import { adminSend } from "@/lib/api";
import {
  AI_MODEL_MODELS_PATH,
  AI_MODEL_PATH,
  aiModelChange,
  aiModelSource,
  catalogById,
  effectiveModel,
  filterCatalog,
  formatContextLength,
  formatTokenPrice,
  modalityLabel,
  modelOptions,
  type AIModelCatalog,
  type AIModelSettings,
  type CatalogModel,
} from "@/lib/ai-model";
import { formatDateTime } from "@/lib/format";
import { useAdminQuery } from "@/lib/use-admin-query";

const SOURCE = {
  saved: { label: "Using the saved key", variant: "success" as const },
  environment: { label: "Using the API's OPENROUTER_API_KEY", variant: "blue" as const },
  none: { label: "No key — analysis and research are off", variant: "error" as const },
};

function optionLabel(model: CatalogModel) {
  return model.name === model.id ? model.id : `${model.name} · ${model.id}`;
}

/** Staff set the OpenRouter key and the default model every admin AI step uses. */
export function ModelSettingsForm() {
  const toast = useToast();
  const { result, loading, error, reload } = useAdminQuery<AIModelSettings>(AI_MODEL_PATH);
  const live = useAdminQuery<AIModelCatalog>(AI_MODEL_MODELS_PATH);
  const [key, setKey] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");

  async function send(action: () => Promise<unknown>, done: string) {
    setPending(true);
    setFailure("");
    try {
      await action();
      setKey("");
      setChosen(null);
      reload();
      live.reload();
      toast({ body: done });
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not save the settings.");
    } finally {
      setPending(false);
    }
  }

  const model = chosen ?? (result ? effectiveModel(result) : "");
  const change = result ? aiModelChange(result, key, model) : null;
  const source = result ? SOURCE[aiModelSource(result)] : null;
  const catalog = useMemo(
    () => (result ? modelOptions(result, live.result?.models ?? []) : []),
    [result, live.result?.models],
  );
  const filtered = useMemo(() => {
    const matches = filterCatalog(catalog, query);
    if (!model || matches.some((item) => item.id === model)) return matches;
    const selected = catalogById(catalog, model);
    return selected ? [selected, ...matches] : matches;
  }, [catalog, model, query]);
  const details = catalogById(catalog, model);

  return (
    <Stack gap={5}>
      <PageHeader
        title="AI Model"
        description="The OpenRouter key and default model behind job analysis, company research, company autofill, and Acorn's AI. Saved here, it takes effect within seconds, with no redeploy."
      />
      {error ? <Banner status="error" title={error} /> : null}
      {failure ? <Banner status="error" title={failure} /> : null}
      {result && !result.encryptable ? (
        <Banner
          status="warning"
          title="Set SETTINGS_ENCRYPTION_KEY (openssl rand -base64 32) on the admin API and core API before saving a key. Choosing a model works without it."
        />
      ) : null}
      <SectionCard
        title="OpenRouter"
        description="The key is stored encrypted in the database and is never sent back to this page."
      >
        <Stack gap={4}>
          {source ? (
            <HStack gap={3} vAlign="center" wrap="wrap">
              <Badge label={source.label} variant={source.variant} />
              {result?.configured ? (
                <Text type="supporting" color="secondary">
                  Key ending {result.keyHint}
                  {result.updatedBy ? ` · saved by ${result.updatedBy}` : ""}
                  {result.updatedAt ? ` · ${formatDateTime(result.updatedAt)}` : ""}
                </Text>
              ) : null}
            </HStack>
          ) : null}
          <TextInput
            label="API key"
            type="password"
            value={key}
            onChange={setKey}
            placeholder={result?.configured ? "Paste a new key to replace it" : "sk-or-…"}
            description="Leave blank to keep the current key."
            isDisabled={loading || (result ? !result.encryptable : false)}
          />
          <SearchBox
            value={query}
            label="Search models"
            placeholder="Search OpenRouter models"
            onSearch={setQuery}
          />
          <Selector
            label="Default model"
            description={
              live.result?.reason ||
              (result
                ? `Default: ${result.defaultModel}. Newest first, from OpenRouter.`
                : undefined)
            }
            options={filtered.map((item) => ({
              value: item.id,
              label: optionLabel(item),
            }))}
            value={model}
            onChange={setChosen}
            isDisabled={loading || !result}
          />
          {details ? <ModelDetails model={details} /> : null}
          <HStack gap={2} wrap="wrap">
            <Button
              label="Save"
              variant="primary"
              isDisabled={pending || !change}
              clickAction={async () => {
                if (change) await send(() => adminSend(AI_MODEL_PATH, "PUT", change), "Saved");
              }}
            />
            {result?.configured ? (
              <Button
                label="Remove saved key"
                variant="ghost"
                isDisabled={pending}
                clickAction={() =>
                  send(() => adminSend(AI_MODEL_PATH, "DELETE"), "Saved key removed")
                }
              />
            ) : null}
          </HStack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function ModelDetails({ model }: { model: CatalogModel }) {
  return (
    <Stack gap={3}>
      {model.description ? (
        <Text type="supporting" color="secondary">
          {model.description}
        </Text>
      ) : null}
      <MetadataList columns={2}>
        <MetadataListItem label="Model id">{model.id}</MetadataListItem>
        <MetadataListItem label="Context">
          {formatContextLength(model.contextLength)}
        </MetadataListItem>
        <MetadataListItem label="Input">{formatTokenPrice(model.pricing.prompt)}</MetadataListItem>
        <MetadataListItem label="Output">
          {formatTokenPrice(model.pricing.completion)}
        </MetadataListItem>
        <MetadataListItem label="Modality">{modalityLabel(model.architecture)}</MetadataListItem>
        <MetadataListItem label="Web search">
          {formatTokenPrice(model.pricing.webSearch)}
        </MetadataListItem>
      </MetadataList>
    </Stack>
  );
}
