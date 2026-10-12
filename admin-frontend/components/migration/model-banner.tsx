import { Banner } from "sid-ui";
import type { MigrationStatus } from "@/lib/migration";

/** Warns when the AI steps cannot run because OpenRouter has no API key. */
export function ModelBanner({ status }: { status: MigrationStatus | null }) {
  if (!status || status.modelReady) return null;
  return (
    <Banner
      status="warning"
      title={`Save an OpenRouter key under Settings → AI Model to analyze and research with ${status.model || "the default model"}.`}
    />
  );
}
