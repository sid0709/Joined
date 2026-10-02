import { Banner, Card, GoogleSignInButton, Heading, Stack, Text } from "@joined/design-system";
import { GOOGLE_AUTH_ROUTE } from "@joined/google-signin";
import { BRAND } from "@/lib/config";

const CARD_WIDTH = 440;

/** The staff console's only way in: the team's Google Workspace account. */
export function StaffSignIn({ next, error }: { next: string; error: string }) {
  return (
    <Stack hAlign="center" vAlign="center" minHeight="100vh" padding={4}>
      <Stack width="100%" maxWidth={CARD_WIDTH}>
        <Card padding={8}>
          <Stack gap={6}>
            <Stack gap={1}>
              <Heading level={1}>{BRAND}</Heading>
              <Text color="secondary" display="block">
                Sign in with your work Google account. Only the team&apos;s Google Workspace can
                open the staff console.
              </Text>
            </Stack>
            {error ? <Banner status="error" title={error} /> : null}
            <GoogleSignInButton action={GOOGLE_AUTH_ROUTE} next={next} />
          </Stack>
        </Card>
      </Stack>
    </Stack>
  );
}
