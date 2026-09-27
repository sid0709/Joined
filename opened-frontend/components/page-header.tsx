import type { ReactNode } from "react";
import { HStack, Heading, Stack, Text } from "@openseat/design-system";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
      <Stack gap={1}>
        <Heading level={1}>{title}</Heading>
        {description ? (
          <Text color="secondary" display="block">
            {description}
          </Text>
        ) : null}
      </Stack>
      {action}
    </HStack>
  );
}
