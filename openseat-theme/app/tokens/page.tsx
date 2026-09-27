import {
  Card,
  Grid,
  Heading,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "@openseat/design-system";

const TOKEN_GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: "Color",
    tokens: [
      "--color-accent",
      "--color-background-body",
      "--color-background-surface",
      "--color-background-card",
      "--color-background-muted",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-disabled",
      "--color-border",
      "--color-success",
      "--color-error",
      "--color-warning",
    ],
  },
  {
    title: "Radius",
    tokens: ["--radius-element", "--radius-container", "--radius-inner", "--radius-page"],
  },
  {
    title: "Space",
    tokens: [
      "--spacing-1",
      "--spacing-2",
      "--spacing-3",
      "--spacing-4",
      "--spacing-6",
      "--spacing-8",
    ],
  },
  {
    title: "Type",
    tokens: ["--font-family-body", "--font-family-heading", "--font-size-base", "--text-body-size"],
  },
];

export default function TokensPage() {
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={1}>Tokens</Heading>
        <Text color="secondary" display="block">
          OpenSeat theme tokens — Neutral structure with Meta blue accent and system fonts.
        </Text>
      </Stack>
      {TOKEN_GROUPS.map((group) => (
        <Stack key={group.title} gap={3}>
          <Heading level={2}>{group.title}</Heading>
          <Grid columns={{ minWidth: 220 }} gap={3}>
            {group.tokens.map((token) => (
              <Card key={token}>
                <MetadataList>
                  <MetadataListItem label="Token">
                    <Text type="code">{token}</Text>
                  </MetadataListItem>
                </MetadataList>
              </Card>
            ))}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );
}
