import { Card, Heading, Link, Stack, Text } from "sid-ui";
import { EMAIL_MESSAGES } from "@/lib/auth/email";
import { ROUTES } from "@/lib/routes";

export function CheckEmailCard({ email }: { email: string }) {
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Check your email</Heading>
          <Text color="secondary">
            {email ? `Look for a message at ${email}. ` : ""}
            {EMAIL_MESSAGES.checkEmail}
          </Text>
        </Stack>
        <Text color="secondary">
          Already verified? <Link href={ROUTES.signIn}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
