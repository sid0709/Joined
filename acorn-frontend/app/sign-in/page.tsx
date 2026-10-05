import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GOOGLE_ERROR_PARAM, googleErrorMessage } from "@joined/google-signin";
import { Heading, PageContainer, Stack } from "sid-ui";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [GOOGLE_ERROR_PARAM]?: string }>;
}) {
  const params = await searchParams;
  if (await currentAccount()) redirect(ROUTES.overview);
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader />
        <Heading level={1}>Sign in</Heading>
        <AuthForm mode="sign-in" googleError={googleErrorMessage(params[GOOGLE_ERROR_PARAM])} />
      </Stack>
    </PageContainer>
  );
}
