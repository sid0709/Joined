import { Banner } from "@joined/design-system";
import { MIGRATION_KEY_ENV, type MigrationStatus } from "@/lib/migration";

/** Warns when the AI steps cannot run because the model has no API key. */
export function ModelBanner({ status }: { status: MigrationStatus | null }) {
  if (!status || status.modelReady) return null;
  return (
    <Banner
      status="warning"
      title={`Set ${MIGRATION_KEY_ENV} in the admin API environment to analyze and research with ${status.model || "DeepSeek"}. Copying works without it.`}
    />
  );
}
