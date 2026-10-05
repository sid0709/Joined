import { Banner, Card, Heading, Link, Stack, Text } from "@joined/design-system";
import { ROUTES } from "@/lib/routes";

export function VerifyEmailCard({ ok, message }: { ok: boolean; message: string }) {
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Verify email</Heading>
          <Text color="secondary">
            {ok
              ? "Your email is verified. Sign in to continue."
              : "This link could not verify the account."}
          </Text>
        </Stack>
        <Banner status={ok ? "success" : "error"} title={message} />
        <Text color="secondary">
          {ok ? (
            <Link href={ROUTES.signIn}>Continue to sign in</Link>
          ) : (
            <>
              <Link href={ROUTES.signUp}>Create an account</Link>
              {" · "}
              <Link href={ROUTES.signIn}>Sign in</Link>
            </>
          )}
        </Text>
      </Stack>
    </Card>
  );
}
