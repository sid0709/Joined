import {
  Banner,
  Card,
  GoogleSignInButton,
  Heading,
  Link,
  Stack,
  Text,
} from "@joined/design-system";
import { GOOGLE_AUTH_ROUTE } from "@joined/google-signin";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/**
 * Google is the only way in. `googleError` explains why a Google sign-in came back
 * here, when one did.
 */
export function SignInForm({ nextPath, googleError }: { nextPath: string; googleError: string }) {
  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Welcome back</Heading>
          <Text color="secondary" display="block">
            Sign in to {BRAND} with your Google account. A scout account is only for submitting
            jobs.
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
