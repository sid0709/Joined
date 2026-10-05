import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heading, PageContainer, Stack } from "@joined/design-system";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await currentAccount()) redirect(ROUTES.home);
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader signedIn={false} />
        <Heading level={1}>Sign in</Heading>
        <AuthForm mode="sign-in" />
      </Stack>
    </PageContainer>
  );
}
