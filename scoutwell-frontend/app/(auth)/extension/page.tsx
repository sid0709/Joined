import type { Metadata } from "next";
import { GOOGLE_ERROR_PARAM, googleErrorMessage } from "@joined/google-signin";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ExtensionSignedIn } from "@/components/site/extension-signed-in";
import { loadSession } from "@/lib/auth/session";
import { param, type SearchParams } from "@/lib/page";
import { EXTENSION_PAGE, ROUTES } from "@/lib/routes";
import { EXTENSION_SIGN_IN_BODY, EXTENSION_SIGN_IN_TITLE } from "@/lib/site-copy";

export const metadata: Metadata = {
  title: EXTENSION_PAGE.label,
  description: EXTENSION_PAGE.description,
};

export default async function ExtensionSignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  if (await loadSession()) return <ExtensionSignedIn />;
  return (
    <SignInForm
      nextPath={ROUTES.extension}
      googleError={googleErrorMessage(param(params[GOOGLE_ERROR_PARAM]))}
      title={EXTENSION_SIGN_IN_TITLE}
      description={EXTENSION_SIGN_IN_BODY}
    />
  );
}
