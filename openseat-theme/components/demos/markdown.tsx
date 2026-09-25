"use client";

import { useEffect, useState } from "react";
import { Button, Card, Markdown, Stack, Text, type MarkdownSource } from "@openseat/design-system";
import { Caption, Examples, Preview, SAMPLE_IMAGES } from "./shared";

const INLINE = "Invite **two** people. Use `sealed` rooms. _Do not_ share the link. ~~Old deadline~~ New deadline.";

const DOCUMENT = `# Brand refresh brief

We need a **full identity refresh** for a regional coffee roaster.

## Scope

- Logo and wordmark
- Packaging for three blends
- Signage for two cafés

## Timeline

1. Kickoff on Monday
2. First round in two weeks
3. Final files by the end of the month

> Keep the warmth of the old mark. Lose the clip art.

---

Questions? Reply in the room.`;

const CODE = `Install the package:

\`\`\`bash
bun add @openseat/design-system
\`\`\`

Then render a button:

\`\`\`tsx
import { Button } from "@openseat/design-system";

<Button label="Save" variant="primary" />
\`\`\``;

const TABLE = `| Bidder | Price | Days |
| :-- | --: | --: |
| Jordan Miles | $2,400 | 14 |
| Alex Rivera | $2,150 | 18 |
| Dana Kim | $2,900 | 10 |`;

const LINKS = "Read the [room guide](#guide) or the [pricing page](#pricing). Bare links like https://react.dev stay text unless you opt in.";

const CITED = "Sealed bidding narrows the price spread [pricing]. The component library is open source [astryx].";

const SOURCES: Record<string, MarkdownSource> = {
  pricing: { title: "Pricing memo" },
  astryx: { title: "Astryx", url: "https://astryx.atmeta.com/", src: SAMPLE_IMAGES.globe },
};

const STREAM = "Here’s a summary of the three bids. **Dana Kim** is fastest at 10 days, **Alex Rivera** is cheapest at $2,150, and **Jordan Miles** sits in the middle on both. If the deadline matters most, award Dana.";
const STREAM_STEP = 4;
const STREAM_INTERVAL_MS = 40;
const PROSE_WIDTH = 480;

export default function MarkdownDemo() {
  const [clicked, setClicked] = useState<string | null>(null);
  const [streamed, setStreamed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setStreamed((n) => {
        const next = Math.min(n + STREAM_STEP, STREAM.length);
        if (next === STREAM.length) setRunning(false);
        return next;
      });
    }, STREAM_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running]);

  return (
    <Examples>
      <Preview label="Inline marks" description="Bold, italic, code, and strikethrough.">
        <Markdown>{INLINE}</Markdown>
      </Preview>

      <Preview label="Document" description="Headings, lists, quotes, and rules render as Astryx components.">
        <Markdown>{DOCUMENT}</Markdown>
      </Preview>

      <Preview label="Heading level start" description="headingLevelStart shifts # down to fit the page outline — here # renders as h3.">
        <Markdown headingLevelStart={3}>{DOCUMENT}</Markdown>
      </Preview>

      <Preview label="Code" description="Fenced blocks become Code Blocks with highlighting and copy.">
        <Markdown>{CODE}</Markdown>
      </Preview>

      <Preview label="Tables" description="GitHub-style tables with column alignment.">
        <Markdown>{TABLE}</Markdown>
      </Preview>

      <Preview label="Links" description="onLinkClick intercepts navigation — return false to stop it. autolink=&quot;gfm&quot; links bare URLs.">
        <Stack gap={3}>
          <Markdown
            onLinkClick={(href) => {
              setClicked(href);
              return false;
            }}
          >
            {LINKS}
          </Markdown>
          <Markdown autolink="gfm">{LINKS}</Markdown>
          <Caption>{clicked ? `Intercepted ${clicked}` : "Click a link in the first paragraph."}</Caption>
        </Stack>
      </Preview>

      <Preview label="Citations" description="[id] markers that match sources render as citation chips, as labels or numbers.">
        <Stack gap={3}>
          <Markdown sources={SOURCES}>{CITED}</Markdown>
          <Markdown sources={SOURCES} citationStyle="number">
            {CITED}
          </Markdown>
        </Stack>
      </Preview>

      <Preview label="Density" description="compact tightens block spacing for side panels and chat.">
        <Stack gap={3}>
          <Card>
            <Markdown density="compact">{DOCUMENT}</Markdown>
          </Card>
        </Stack>
      </Preview>

      <Preview label="Content width" description="contentWidth caps prose for readable lines; tables and code still use the full width.">
        <Stack gap={3}>
          <Markdown contentWidth={PROSE_WIDTH}>{DOCUMENT}</Markdown>
          <Markdown contentWidth={PROSE_WIDTH} contentAlign="center">
            {INLINE}
          </Markdown>
        </Stack>
      </Preview>

      <Preview label="Inline display" description="display=&quot;inline&quot; renders a span inside surrounding text.">
        <Text>
          Status: <Markdown display="inline">{"**Open** · closes _Friday_"}</Markdown>
        </Text>
      </Preview>

      <Preview label="Streaming" description="isStreaming fades new text in as it arrives — for AI answers and live logs.">
        <Stack gap={3}>
          <Button
            label={running ? "Streaming…" : streamed ? "Replay" : "Start"}
            size="sm"
            variant="secondary"
            isDisabled={running}
            onClick={() => {
              setStreamed(0);
              setRunning(true);
            }}
          />
          <Markdown isStreaming={running}>{STREAM.slice(0, streamed) || "_Press start to stream an answer._"}</Markdown>
        </Stack>
      </Preview>
    </Examples>
  );
}
