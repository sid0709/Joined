"use client";

import { useState } from "react";
import { Card, CodeBlock, Heading, Stack, Text } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const TSX = `import { Button } from "@openseat/design-system";

export function SaveBar({ onSave }: { onSave: () => void }) {
  return <Button label="Save" variant="primary" onClick={onSave} />;
}`;

const CSS = `@import "@openseat/design-system/styles/openseat.css";

html,
body {
  height: 100%;
  font-family: var(--font-family-body);
}`;

const BASH = `bun install
bun run --filter openseat-theme dev`;

const JSON_SAMPLE = `{
  "id": "room_1043",
  "sealed": true,
  "deadline": "2026-10-01T17:00:00Z",
  "invitees": ["jordan", "alex", "dana"]
}`;

const LONG_LINE = `const summary = rooms.filter((room) => room.sealed && room.invitees.length > 2).map((room) => \`\${room.title} closes \${room.deadline}\`).join(", ");`;

const LONG = Array.from({ length: 40 }, (_, i) => `console.log("line ${i + 1}");`).join("\n");

export default function CodeBlockDemo() {
  const [copies, setCopies] = useState(0);

  return (
    <Examples>
      <Preview label="Default" description="Fits the longest line, with syntax highlighting and a copy button.">
        <CodeBlock language="tsx" code={TSX} />
      </Preview>

      <Preview label="Languages" description="The tokenizer covers the languages these docs use.">
        <Stack gap={3}>
          <CodeBlock language="css" title="globals.css" width="100%" code={CSS} />
          <CodeBlock language="bash" title="Terminal" width="100%" code={BASH} />
          <CodeBlock language="json" title="room.json" width="100%" code={JSON_SAMPLE} />
        </Stack>
      </Preview>

      <Preview label="Title and language label" description="title names the file; hasLanguageLabel shows the language in the header.">
        <Stack gap={3}>
          <CodeBlock language="tsx" title="SaveBar.tsx" width="100%" code={TSX} />
          <CodeBlock language="tsx" title="SaveBar.tsx" hasLanguageLabel width="100%" code={TSX} />
        </Stack>
      </Preview>

      <Preview label="Line numbers and highlights" description="Point the reader at the lines that matter.">
        <CodeBlock language="tsx" title="SaveBar.tsx" hasLineNumbers highlightLines={[1, 4]} width="100%" code={TSX} />
      </Preview>

      <Preview label="Copy" description="The copy button is on by default. onCopy lets you confirm or log it.">
        <Stack gap={2}>
          <CodeBlock language="bash" width="100%" code={BASH} onCopy={() => setCopies((n) => n + 1)} />
          <Caption>{copies === 0 ? "Not copied yet." : `Copied ${copies} time${copies === 1 ? "" : "s"}.`}</Caption>
          <CodeBlock language="bash" width="100%" hasCopyButton={false} code={BASH} />
        </Stack>
      </Preview>

      <Preview label="Wrapping" description="Long lines scroll by default; isWrapped wraps them instead.">
        <Stack gap={3}>
          <CodeBlock language="ts" title="Scrolls" width="100%" code={LONG_LINE} />
          <CodeBlock language="ts" title="Wraps" width="100%" isWrapped code={LONG_LINE} />
        </Stack>
      </Preview>

      <Preview label="Max height and collapsing" description="maxHeight scrolls inside the block; isCollapsible folds long samples behind a toggle.">
        <Stack gap={3}>
          <CodeBlock language="ts" title="maxHeight 160" width="100%" maxHeight={160} hasLineNumbers code={LONG} />
          <CodeBlock language="ts" title="Collapsible after 8 lines" width="100%" isCollapsible collapsibleThreshold={8} code={LONG} />
        </Stack>
      </Preview>

      <Preview label="Sizes" description="sm for dense docs and side panels; md is the default.">
        <Stack gap={3}>
          <CodeBlock language="tsx" size="sm" title="sm" width="100%" code={TSX} />
          <CodeBlock language="tsx" size="md" title="md" width="100%" code={TSX} />
        </Stack>
      </Preview>

      <Preview label="Width" description="fit-content (default), 100%, or any CSS width.">
        <Stack gap={3}>
          <CodeBlock language="bash" code={BASH} />
          <CodeBlock language="bash" width="360px" code={BASH} />
          <CodeBlock language="bash" width="100%" code={BASH} />
        </Stack>
      </Preview>

      <Preview label="Section container" description="container=&quot;section&quot; drops the border and background to blend into a card.">
        <Card>
          <Stack gap={2}>
            <Heading level={4}>Usage</Heading>
            <Text color="secondary" display="block">
              Render a save bar at the bottom of the form.
            </Text>
            <CodeBlock language="tsx" container="section" width="100%" code={TSX} />
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
