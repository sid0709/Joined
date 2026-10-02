"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  HStack,
  PageHeader,
  SectionCard,
  Selector,
  Stack,
  Text,
  TextInput,
  useToast,
} from "@joined/design-system";
import { adminSend } from "@/lib/api";
import {
  ACORN_AI_MODELS_PATH,
  ACORN_AI_PATH,
  acornAIChange,
  acornAISource,
  effectiveModel,
  modelOptions,
  type AcornAIModels,
  type AcornAISettings,
} from "@/lib/acorn-ai";
import { formatDateTime } from "@/lib/format";
import { useAdminQuery } from "@/lib/use-admin-query";

const SOURCE_BADGE = {
  saved: { label: "Using the saved key", variant: "success" },
  environment: { label: "Using the API's OPENAI_API_KEY", variant: "blue" },
  none: { label: "No key — Acorn's AI is off", variant: "error" },
} as const;

/** Staff set the OpenAI key and model Acorn's AI routes use. The key is never shown again. */
export function AcornAISettingsForm() {
  const toast = useToast();
  const { result, loading, error, reload } = useAdminQuery<AcornAISettings>(ACORN_AI_PATH);
  const live = useAdminQuery<AcornAIModels>(ACORN_AI_MODELS_PATH);
  const [key, setKey] = useState("");
  // The dropdown shows the saved model until staff pick another.
  const [chosen, setChosen] = useState<string | null>(null);
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
  const change = result ? acornAIChange(result, key, model) : null;
  const source = result ? SOURCE_BADGE[acornAISource(result)] : null;

  return (
    <Stack gap={5}>
      <PageHeader
        title="Acorn AI"
        description="The OpenAI key and model behind Acorn's AI Analyze, Q&A, and option matching. Saved here, it takes effect within seconds, with no redeploy."
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
        title="OpenAI"
        description="The key is stored encrypted and is never sent back to this page."
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
            placeholder={result?.configured ? "Paste a new key to replace it" : "sk-…"}
            description="Leave blank to keep the current key."
            isDisabled={loading || (result ? !result.encryptable : false)}
          />
          <Selector
            label="Model"
            description={
              live.result?.reason ||
              (result
                ? `Default: ${result.defaultModel}. Newest first, from your OpenAI account.`
                : undefined)
            }
            options={(result ? modelOptions(result, live.result?.models ?? []) : []).map(
              (value) => ({ value, label: value }),
            )}
            value={model}
            onChange={setChosen}
            isDisabled={loading || !result}
          />
          <HStack gap={2} wrap="wrap">
            <Button
              label="Save"
              variant="primary"
              isDisabled={pending || !change}
              clickAction={async () => {
                if (change) await send(() => adminSend(ACORN_AI_PATH, "PUT", change), "Saved");
              }}
            />
            {result?.configured ? (
              <Button
                label="Remove saved key"
                variant="ghost"
                isDisabled={pending}
                clickAction={() =>
                  send(() => adminSend(ACORN_AI_PATH, "DELETE"), "Saved key removed")
                }
              />
            ) : null}
          </HStack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
