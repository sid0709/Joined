import {
  Banner,
  Card,
  GoogleSignInButton,
  Heading,
  Link,
  Stack,
  Text,
} from "@joined/design-system";
import { GOOGLE_SIGNIN_ROUTE } from "@joined/google-signin";
import { ROUTES } from "@/lib/routes";

/**
 * Google is the only way in, for job hunters and recruiters alike. `googleError`
 * explains why a Google sign-in came back here, when one did.
 */
export function SignInForm({ nextPath, googleError }: { nextPath: string; googleError: string }) {
  const signUpHref = `${ROUTES.signUp}?next=${encodeURIComponent(nextPath)}`;
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Sign in</Heading>
          <Text color="secondary">
            Sign in with your Google account, whether you’re looking for work or hiring.
          </Text>
        </Stack>
        {googleError ? <Banner status="error" title={googleError} /> : null}
        <GoogleSignInButton action={GOOGLE_SIGNIN_ROUTE} next={nextPath} />
        <Text color="secondary">
          New here? <Link href={signUpHref}>Create an account</Link>
        </Text>
      </Stack>
    </Card>
  );
}
