"use client";

import { useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { CodeBlock, Spinner, Stack, Tab, TabList, Text } from "@openseat/design-system";
import { DEMO_LOADERS } from "@/components/demos/load";

const DEMOS = Object.fromEntries(
  Object.entries(DEMO_LOADERS).map(([slug, loader]) => [
    slug,
    dynamic(loader, {
      ssr: false,
      loading: () => <Spinner label="Loading example" />,
    }),
  ])
) as Record<string, ComponentType>;

export function ComponentDocs({ slug, importName }: { slug: string; importName: string }) {
  const [tab, setTab] = useState("overview");
  const Demo = DEMOS[slug];

  return (
    <Stack gap={5}>
      <TabList value={tab} onChange={setTab} hasDivider>
        <Tab value="overview" label="Overview" />
        <Tab value="usage" label="Usage" />
      </TabList>
      {tab === "overview" &&
        (Demo ? <Demo /> : <Text color="secondary">No demo yet.</Text>)}
      {tab === "usage" && (
        <CodeBlock
          language="tsx"
          title="Import"
          width="100%"
          code={`import { ${importName} } from "@openseat/design-system";`}
        />
      )}
    </Stack>
  );
}
