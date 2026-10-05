import type { Metadata } from "next";
import { PageHeader, SectionCard, Stack, Timeline } from "@joined/design-system";
import { DownloadCards } from "@/components/apps/download-cards";
import { PluginGrid } from "@/components/apps/plugin-grid";
import { extensionDownloadUrl, extensionInstallUrl } from "@/lib/config";

export const metadata: Metadata = { title: "Apps & plugins" };

const INSTALL_STEPS = [
  {
    id: "add",
    title: "Add Acorn",
    description: "From the store, or load the .zip unpacked.",
    status: "done" as const,
  },
  {
    id: "pin",
    title: "Pin it",
    description: "Keep the acorn in your toolbar.",
    status: "done" as const,
  },
  {
    id: "sign-in",
    title: "Continue",
    description: "It signs in with this account.",
    status: "current" as const,
  },
  {
    id: "apply",
    title: "Open a posting",
    description: "Acorn fills it from your profile.",
    status: "upcoming" as const,
  },
];

export default function AppsPage() {
  const installUrl = extensionInstallUrl();
  return (
    <Stack gap={6}>
      <PageHeader
        title="Apps & plugins"
        description="Get Acorn for your browser and choose which sites and services it works with."
      />
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
      <SectionCard title="Install in four steps">
        <Timeline label="Install steps" items={INSTALL_STEPS} variant="horizontal" />
      </SectionCard>
      <SectionCard
        title="Plugins"
        description="Autofill support for each hiring system, and services Acorn reports to."
      >
        <PluginGrid />
      </SectionCard>
    </Stack>
  );
}
