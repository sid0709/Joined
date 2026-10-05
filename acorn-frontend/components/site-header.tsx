import { HStack, Text } from "@joined/design-system";
import { BRAND } from "@/lib/config";
import { SignOutButton } from "./sign-out-button";

export function SiteHeader({
  signedIn,
  accountLabel,
}: {
  signedIn: boolean;
  accountLabel?: string;
}) {
  return (
    <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
      <Text type="large" weight="semibold">
        {BRAND}
      </Text>
      {signedIn ? (
        <HStack gap={3} vAlign="center" wrap="wrap">
          {accountLabel ? <Text color="secondary">{accountLabel}</Text> : null}
          <SignOutButton />
        </HStack>
      ) : null}
    </HStack>
  );
}
