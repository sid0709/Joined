"use client";

import { Code, Heading, HStack, Link, Stack, Text, type CodeColor } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const COLORS: CodeColor[] = ["primary", "secondary", "inherit"];
const ENV = [
  ["API_BASE_URL", "Where the app sends requests"],
  ["ROOM_TTL_HOURS", "How long a room stays open"],
  ["SEALED_BY_DEFAULT", "New rooms start sealed"],
];

export default function CodeDemo() {
  return (
    <Examples>
      <Preview label="Inline" description="A filename, a prop, or a short snippet inside a sentence. For whole samples, use Code Block.">
        <Text display="block">
          Import <Code>Button</Code> from <Code>@openseat/design-system</Code> and pass <Code>variant=&quot;primary&quot;</Code>.
        </Text>
      </Preview>

      <Preview label="Colors" description="Mirrors the Text colors: primary (default), secondary, and inherit.">
        <Stack gap={2}>
          {COLORS.map((color) => (
            <Text key={color} color="secondary" display="block">
              {color}: run <Code color={color}>bun run dev</Code> to start the docs.
            </Text>
          ))}
        </Stack>
      </Preview>

      <Preview label="Inherit size" description="size=&quot;inherit&quot; adopts the surrounding type size — for headings and large copy.">
        <Stack gap={3}>
          <Heading level={3}>
            The <Code size="inherit">Room</Code> object
          </Heading>
          <Text type="large" display="block">
            Every room has a <Code size="inherit">deadline</Code> and a list of <Code size="inherit">invitees</Code>.
          </Text>
          <Text type="supporting" color="secondary" display="block">
            Supporting copy: <Code size="inherit">inherit</Code> next to the default <Code>size</Code>.
          </Text>
        </Stack>
      </Preview>

      <Preview label="Commands and paths">
        <Stack gap={2}>
          <Text display="block">
            Install with <Code>bun add @openseat/design-system</Code>.
          </Text>
          <Text display="block">
            Tokens live in <Code>packages/design-system/src/styles/tokens.css</Code>.
          </Text>
          <Text display="block">
            Press <Code>Ctrl</Code> + <Code>C</Code> to stop the server.
          </Text>
        </Stack>
      </Preview>

      <Preview label="In a link" description="Code inside a Link keeps the link color and underline.">
        <Text display="block">
          See <Link href="#use-room">
            <Code color="inherit">useRoom()</Code>
          </Link>{" "}
          for the hook reference.
        </Text>
      </Preview>

      <Preview label="Key and description" description="A settings reference — code on the left, meaning on the right.">
        <Stack gap={2}>
          {ENV.map(([name, description]) => (
            <HStack key={name} gap={3} vAlign="center" wrap="wrap">
              <Code>{name}</Code>
              <Text type="supporting" color="secondary">
                {description}
              </Text>
            </HStack>
          ))}
        </Stack>
      </Preview>
    </Examples>
  );
}
