import { Button, HStack, Text } from "@joined/design-system";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
      <Text type="large" weight="semibold">
        {BRAND}
      </Text>
      <Button
        label={signedIn ? "Signed in" : "Sign in"}
        variant={signedIn ? "secondary" : "primary"}
        size="sm"
        href={ROUTES.signIn}
      />
    </HStack>
  );
}
