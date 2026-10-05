import { BrandFooter, Button, EmptyState, PageContainer, Stack } from "@joined/design-system";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { SiteHeader } from "./site-header";

export function SignInPlaceholder({
  signedIn,
  joinedSignInHref,
}: {
  signedIn: boolean;
  joinedSignInHref: string | null;
}) {
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader signedIn={signedIn} />
        {signedIn ? (
          <EmptyState
            title="Signed in with Joined"
            description={`${BRAND} will use this joined_session cookie for profile, resume, and billing. Those pages are not here yet.`}
            actions={<Button label="Back to home" variant="primary" href={ROUTES.home} />}
          />
        ) : (
          <EmptyState
            title={`Sign in to ${BRAND}`}
            description={`${BRAND} has no separate accounts. Sign in on Joined in this browser, then come back. This site reads the joined_session cookie and does not run its own auth backend.`}
            actions={
              joinedSignInHref ? (
                <Button label="Sign in on Joined" variant="primary" href={joinedSignInHref} />
              ) : (
                <Button label="Back to home" variant="secondary" href={ROUTES.home} />
              )
            }
          />
        )}
        <BrandFooter lead={`${BRAND} is part of`} />
      </Stack>
    </PageContainer>
  );
}
