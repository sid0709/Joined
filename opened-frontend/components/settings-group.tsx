import { Children, Fragment, type ReactNode } from "react";
import {
  Card,
  Divider,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Section,
  Stack,
  Text,
} from "@openseat/design-system";

/**
 * A titled settings card: header, rows split by hairlines, and an optional
 * muted footer strip for the hint and Save — the Stripe/Vercel pattern.
 */
export function SettingsGroup({
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
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <Card padding={0}>
      <Stack>
        <HStack hAlign="between" vAlign="start" gap={3} padding={6}>
          <Stack gap={1}>
            <Heading level={3}>{title}</Heading>
            {description ? (
              <Text type="supporting" color="secondary" display="block">
                {description}
              </Text>
            ) : null}
          </Stack>
          {action}
        </HStack>
        {rows.map((row, index) => (
          <Fragment key={index}>
            <Divider />
            <Stack paddingInline={6} paddingBlock={5}>
              {row}
            </Stack>
          </Fragment>
        ))}
        {footer ? (
          <Section variant="muted" dividers={["top"]} paddingInline={6} paddingBlock={4}>
            {footer}
          </Section>
        ) : null}
      </Stack>
    </Card>
  );
}

/**
 * One setting. `split` puts the label on the left and a field on the right;
 * `inline` keeps a compact control (switch, button) at the far end of the row.
 */
export function SettingsRow({
  label,
  description,
  layout = "split",
  children,
}: {
  label: string;
  description?: ReactNode;
  layout?: "split" | "inline";
  children: ReactNode;
}) {
  const text = (
    <Stack gap={1}>
      <Text weight="semibold" display="block">
        {label}
      </Text>
      {description ? (
        <Text type="supporting" color="secondary" display="block">
          {description}
        </Text>
      ) : null}
    </Stack>
  );

  if (layout === "inline") {
    return (
      <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
        {text}
        {children}
      </HStack>
    );
  }

  return (
    <GridSystem gap={4} align="start">
      <GridColumn span="full" md={5}>
        {text}
      </GridColumn>
      <GridColumn span="full" md={7}>
        {children}
      </GridColumn>
    </GridSystem>
  );
}
