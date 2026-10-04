import { Banner } from "@joined/design-system";
import type { MigrationStatus } from "@/lib/migration";

/** Warns when the AI steps cannot run because DeepSeek has no API key. */
export function ModelBanner({ status }: { status: MigrationStatus | null }) {
  if (!status || status.modelReady) return null;
  return (
    <Banner
      status="warning"
      title={`Save a DeepSeek key under Settings → DeepSeek to analyze and research with ${status.model || "DeepSeek"}. Copying works without a key.`}
    />
  );
}
