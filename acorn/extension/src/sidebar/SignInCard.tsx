import { Button, Card, Text, VStack } from "@joined/design-system";

type SignInCardProps = {
  authBusy: boolean;
  onSignIn: () => void;
};

/** Signed-out card: Acorn shares the Joined session, so sign-in is one button. */
export function SignInCard({ authBusy, onSignIn }: SignInCardProps) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="supporting">
          Acorn uses your Joined account. Sign in to Joined in this browser, then continue.
        </Text>
        <Button
          variant="primary"
          label={authBusy ? "Connecting…" : "Continue with Joined"}
          isLoading={authBusy}
          isDisabled={authBusy}
          width="100%"
          onClick={onSignIn}
        />
      </VStack>
    </Card>
  );
}
