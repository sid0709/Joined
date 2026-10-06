import { Banner, Button, Card, Heading, Link, Stack, Text } from "sid-ui";
import { BILLING_MESSAGES, PRICING_PAGE } from "@/lib/billing";
import { settingsSectionHref } from "@/lib/routes";

export function CheckoutResultCard({
  status,
  title,
  description,
}: {
  status: "success" | "info";
  title: string;
  description: string;
}) {
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>{title}</Heading>
          <Text color="secondary" display="block">
            {description}
          </Text>
        </Stack>
        <Banner status={status} title={title} />
        <Button
          label={BILLING_MESSAGES.manageBilling}
          variant="primary"
          href={settingsSectionHref("billing")}
        />
        <Text color="secondary">
          Or see <Link href={PRICING_PAGE.href}>{PRICING_PAGE.label}</Link> plans.
        </Text>
      </Stack>
    </Card>
  );
}
