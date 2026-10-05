import { Card, Heading, Stack, Text } from "@joined/design-system";
import { EXTENSION_SIGNED_IN_BODY, EXTENSION_SIGNED_IN_TITLE } from "@/lib/site-copy";

/** After the extension's sign-in tab finishes, tell the scout they can leave. */
export function ExtensionSignedIn() {
  return (
    <Card padding={8}>
      <Stack gap={3}>
        <Heading level={1}>{EXTENSION_SIGNED_IN_TITLE}</Heading>
        <Text color="secondary" display="block">
          {EXTENSION_SIGNED_IN_BODY}
        </Text>
      </Stack>
    </Card>
  );
}
