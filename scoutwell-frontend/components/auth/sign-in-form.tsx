import { Banner, Card, GoogleSignInButton, Heading, Link, Stack, Text } from "sid-ui";
import { GOOGLE_AUTH_ROUTE } from "@joined/google-signin";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/**
 * Google is the only way in. `googleError` explains why a Google sign-in came back
 * here, when one did.
 */
export function SignInForm({
  nextPath,
  googleError,
  title = "Welcome back",
  description = `Sign in to ${BRAND} with your Google account. A scout account is only for submitting jobs.`,
}: {
  nextPath: string;
  googleError: string;
  title?: string;
  description?: string;
}) {
  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>{title}</Heading>
          <Text color="secondary" display="block">
            {description}
          </Text>
        </Stack>
        {googleError ? <Banner status="error" title={googleError} /> : null}
        <GoogleSignInButton action={GOOGLE_AUTH_ROUTE} next={nextPath} />
        <Text color="secondary">
          New to scouting? <Link href={ROUTES.signUp}>Create an account</Link>
        </Text>
      </Stack>
    </Card>
  );
}
