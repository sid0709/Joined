import type { ReactNode } from "react";
import { Card, HStack, Heading, Section, Stack, Text } from "sid-ui";

/**
 * A titled card: heading, quiet description, optional action, then content.
 * The footer is the same muted strip settings groups use, so Save sits in one
 * place on every form.
 */
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
  children: ReactNode;
}) {
  return (
    <Card padding={0}>
      <Stack>
        <Stack gap={5} padding={6}>
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
        </Stack>
        {footer ? (
          <Section variant="muted" dividers={["top"]} paddingInline={6} paddingBlock={4}>
            {footer}
          </Section>
        ) : null}
      </Stack>
    </Card>
  );
}
