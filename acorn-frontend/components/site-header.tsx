import { HStack, Text } from "@joined/design-system";
import { BRAND } from "@/lib/config";
import { SignOutButton } from "./sign-out-button";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
      <Text type="large" weight="semibold">
        {BRAND}
      </Text>
      {signedIn ? <SignOutButton /> : null}
    </HStack>
  );
}
