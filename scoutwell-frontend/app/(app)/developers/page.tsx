import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stack, PageHeader, SectionCard } from "sid-ui";
import type { ApiKey } from "@joined/scout";
import { ApiDocs } from "@/components/developers/api-docs";
import { ApiKeys } from "@/components/developers/api-keys";
import { publicApiUrl } from "@/lib/config";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadMeta } from "@/lib/scout/load";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "API access" };

export default async function DevelopersPage() {
  const [keys, meta] = await Promise.all([scoutGet<{ data: ApiKey[] }>("/api-keys"), loadMeta()]);
  if (!keys) redirect(signInHref(ROUTES.developers));
  return (
    <Stack gap={6}>
      <PageHeader
        title="API access"
        description="Submit jobs from your own sourcing pipeline. Same checks, levels, and rewards as the web form."
      />
      <SectionCard title="API keys">
        <ApiKeys keys={keys.data} />
      </SectionCard>
      <ApiDocs baseUrl={publicApiUrl()} meta={meta} />
    </Stack>
  );
}
