import type { Metadata } from "next";
import { PageHeader, SectionCard, Stack } from "sid-ui";
import { DownloadCards } from "@/components/apps/download-cards";
import { extensionDownloadUrl, extensionInstallUrl } from "@/lib/config";

export const metadata: Metadata = { title: "Apps" };

export default function AppsPage() {
  const installUrl = extensionInstallUrl();
  return (
    <Stack gap={6}>
      <PageHeader title="Apps" description="Get Acorn for your browser." />
      <SectionCard
        title="Get Acorn"
        description={
          installUrl
            ? "Install once per browser. Your profile and settings follow your account."
            : "The store listing isn't live yet. Set ACORN_EXTENSION_INSTALL_URL and ACORN_EXTENSION_DOWNLOAD_URL to turn these on."
        }
      >
        <DownloadCards installUrl={installUrl} downloadUrl={extensionDownloadUrl()} />
      </SectionCard>
    </Stack>
  );
}
