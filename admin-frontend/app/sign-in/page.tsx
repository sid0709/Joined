import { redirect } from "next/navigation";
import { GOOGLE_ERROR_PARAM, googleErrorMessage, sameSiteNextPath } from "@joined/google-signin";
import { StaffSignIn } from "@/components/auth/staff-sign-in";
import { ROUTES } from "@/lib/nav";
import { param, type SearchParams } from "@/lib/page";
import { loadStaffAccess, type StaffAccess } from "@/lib/server/staff";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** Staff never have a password here, so a refused account gets its own message. */
const WRONG_ACCOUNT = "That Google account isn’t on the team’s Workspace. Use your work account.";

/** Why the console cannot be opened right now, before anyone tries to sign in. */
const BLOCKED: Partial<Record<StaffAccess["status"], string>> = {
  unreachable: "The admin API isn’t answering. Check that it is running, then reload this page.",
  "not-set-up":
    "Google sign-in isn’t set up on the admin API. Set its Google client and ADMIN_GOOGLE_DOMAIN (see admin-backend/.env.example).",
};

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = sameSiteNextPath(param(params.next), ROUTES.scouting);
  const access = await loadStaffAccess();
  if (access.status === "signed-in") redirect(next);
  const code = param(params[GOOGLE_ERROR_PARAM]);
  return (
    <StaffSignIn
      next={next}
      error={
        BLOCKED[access.status] ??
        (code === "wrong_account" ? WRONG_ACCOUNT : googleErrorMessage(code))
      }
    />
  );
}
