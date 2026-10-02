import { redirect } from "next/navigation";
import { GOOGLE_ERROR_PARAM, googleErrorMessage, sameSiteNextPath } from "@joined/google-signin";
import { StaffSignIn } from "@/components/auth/staff-sign-in";
import { ROUTES } from "@/lib/nav";
import { param, type SearchParams } from "@/lib/page";
import { loadStaffSession } from "@/lib/server/staff";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Staff never have a password here, so a refused account gets its own message. */
const WRONG_ACCOUNT = "That Google account isn’t on the team’s Workspace. Use your work account.";

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = sameSiteNextPath(param(params.next), ROUTES.scouting);
  // Signed in already, or the API does not ask staff to sign in.
  if (await loadStaffSession()) redirect(next);
  const code = param(params[GOOGLE_ERROR_PARAM]);
  return (
    <StaffSignIn
      next={next}
      error={code === "wrong_account" ? WRONG_ACCOUNT : googleErrorMessage(code)}
    />
  );
}
