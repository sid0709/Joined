"use client";

import { CodeBlock, Stack, Tab, TabList, Text } from "sid-ui";
import { useState } from "react";

import { DEMO_COMPONENTS } from "@/components/demos/load";

export function ComponentDocs({
  slug,
  importName,
  usage,
}: {
  slug: string;
  importName: string;
  usage?: string;
}) {
  const [tab, setTab] = useState("overview");
  const Demo = DEMO_COMPONENTS[slug];

  return (
    <Stack gap={5}>
      <TabList value={tab} onChange={setTab} hasDivider>
        <Tab value="overview" label="Overview" />
        <Tab value="usage" label="Usage" />
      </TabList>
      {tab === "overview" && (Demo ? <Demo /> : <Text color="secondary">No demo yet.</Text>)}
      {tab === "usage" && (
        <Stack gap={4}>
          <CodeBlock
            language="tsx"
            title="Import"
            width="100%"
            code={`import { ${importName} } from "sid-ui";`}
          />
          {usage && <CodeBlock language="tsx" title="Example" width="100%" code={usage} />}
        </Stack>
      )}
    </Stack>
  );
}
