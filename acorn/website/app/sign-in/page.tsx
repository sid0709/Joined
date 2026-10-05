import type { Metadata } from "next";
import { SignInPlaceholder } from "@/components/sign-in-placeholder";
import { hasJoinedSession } from "@/lib/auth/session";
import { joinedSignInUrl } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const signedIn = await hasJoinedSession();
  return <SignInPlaceholder signedIn={signedIn} joinedSignInHref={joinedSignInUrl()} />;
}
