import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heading, PageContainer, Stack, Text } from "@joined/design-system";
import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await currentAccount()) redirect(ROUTES.home);
  return (
    <PageContainer width="narrow">
      <Stack gap={8}>
        <SiteHeader signedIn={false} />
        <Stack gap={1}>
          <Heading level={1}>Create an Acorn account</Heading>
          <Text color="secondary">The extension uses this same sign-in.</Text>
        </Stack>
        <AuthForm mode="sign-up" />
      </Stack>
    </PageContainer>
  );
}
