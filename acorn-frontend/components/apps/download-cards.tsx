import { Badge, Button, Card, Glyph, Grid, HStack, Heading, Stack, Text } from "sid-ui";
import { DOWNLOADS } from "@/lib/apps";

const CARD_MIN_WIDTH = 240;
const CARD_COLUMNS = 4;

/** Acorn for each browser: install from the store, or download the packed build. */
export function DownloadCards({
  installUrl,
  downloadUrl,
}: {
  installUrl: string | null;
  downloadUrl: string | null;
}) {
  return (
    <Grid columns={{ minWidth: CARD_MIN_WIDTH, max: CARD_COLUMNS }} gap={4}>
      {DOWNLOADS.map((target) => {
        const available = target.availability === "available";
        const storeUrl = target.usesChromeListing ? installUrl : null;
        return (
          <Card key={target.id} padding={5}>
            <Stack gap={4}>
              <HStack hAlign="between" vAlign="center" gap={2}>
                <HStack gap={2} vAlign="center">
                  <Glyph name={target.icon} />
                  <Heading level={3}>{target.name}</Heading>
                </HStack>
                <Badge
                  label={available ? "Available" : "Coming soon"}
                  variant={available ? "success" : "neutral"}
                />
              </HStack>
              <Text color="secondary">{target.description}</Text>
              {available ? (
                <Stack gap={2}>
                  <Button
                    label="Add to browser"
                    variant="primary"
                    icon={<Glyph name="plus" />}
                    href={storeUrl ?? undefined}
                    isDisabled={!storeUrl}
                  />
                  <Button
                    label="Download .zip"
                    variant="secondary"
                    icon={<Glyph name="download" />}
                    href={downloadUrl ?? undefined}
                    isDisabled={!downloadUrl}
                  />
                </Stack>
              ) : (
                <Button label="Notify me" variant="secondary" isDisabled />
              )}
            </Stack>
          </Card>
        );
      })}
    </Grid>
  );
}
