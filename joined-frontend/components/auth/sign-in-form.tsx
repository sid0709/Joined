import { Banner, Card, Divider, GoogleSignInButton, Heading, Link, Stack, Text } from "sid-ui";
import { GOOGLE_SIGNIN_ROUTE } from "@joined/google-signin";
import { isCompanyModeEnabled } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { EmailSignInForm } from "./email-sign-in-form";

/**
 * Email + Google sign-in. `googleError` explains why a Google sign-in came back
 * here, when one did. Email errors stay generic so login cannot reveal an account.
 */
export function SignInForm({
  nextPath,
  googleError,
  resetNotice,
}: {
  nextPath: string;
  googleError: string;
  resetNotice: boolean;
}) {
  const companyModeEnabled = isCompanyModeEnabled();
  const signUpHref = `${ROUTES.signUp}?next=${encodeURIComponent(nextPath)}`;
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Sign in</Heading>
          <Text color="secondary">
            {companyModeEnabled
              ? "Use your email or Google, whether you’re looking for work or hiring."
              : "Use your email or Google account."}
          </Text>
        </Stack>
        {resetNotice ? (
          <Banner status="success" title="Password updated. Sign in with your new password." />
        ) : null}
        {googleError ? <Banner status="error" title={googleError} /> : null}
        <EmailSignInForm nextPath={nextPath} />
        <Divider label="or" />
        <GoogleSignInButton action={GOOGLE_SIGNIN_ROUTE} next={nextPath} />
        <Text color="secondary">
          New here? <Link href={signUpHref}>Create an account</Link>
        </Text>
      </Stack>
    </Card>
  );
}
