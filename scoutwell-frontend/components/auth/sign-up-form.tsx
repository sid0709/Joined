import { Card, GoogleSignInButton, Heading, Link, Stack, Text } from "sid-ui";
import { GOOGLE_AUTH_ROUTE } from "@joined/google-signin";
import { ROUTES } from "@/lib/routes";

/**
 * Sign up with Google, the only way in. Everyone lands on the dashboard, whose
 * layout sends a new scout through onboarding first.
 */
export function SignUpForm() {
  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Become a scout</Heading>
          <Text color="secondary" display="block">
            Find official openings the big boards miss. Earn when job hunters actually use them.
          </Text>
        </Stack>
        <GoogleSignInButton action={GOOGLE_AUTH_ROUTE} label="Sign up with Google" />
        <Text color="secondary">
          Already a scout? <Link href={ROUTES.signIn}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
