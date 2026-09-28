import type { ReactNode } from "react";
import { Card, Divider, HStack, Heading, Stack, Text } from "@openseat/design-system";

export function SectionCard({
  title,
  description,
  action,
  footer,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
          <Stack gap={1}>
            <Heading level={2}>{title}</Heading>
            {description ? (
              <Text type="supporting" color="secondary" display="block">
                {description}
              </Text>
            ) : null}
          </Stack>
          {action}
        </HStack>
        {children}
        {footer ? (
          <Stack gap={4}>
            <Divider />
            {footer}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
