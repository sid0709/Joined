import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { EmployerHeader } from "@/components/shell/employer-header";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { isEmployee } from "@/lib/auth/account-type";
import { loadSession } from "@/lib/auth/session";
import { isCompanyModeEnabled } from "@/lib/config";
import { loadCompanyUnread, loadUnread } from "@/lib/me/load";

/**
 * Candidate mode, plus the public job and company pages anyone can open. An
 * employee previewing those pages keeps the hiring header, never the job-search one
 * (unless company mode is disabled, then everyone gets the seeker header).
 * With flag off, employees get guest header actions (Sign in / Create account).
 */
export default async function SeekerLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  const companyModeEnabled = isCompanyModeEnabled();
  const isEmployeeSession = isEmployee(session);

  // Skip loadCompanyUnread when company mode is off; treat employees as guests
  const unread = session
    ? companyModeEnabled && isEmployeeSession
      ? await loadCompanyUnread()
      : isEmployeeSession
        ? 0
        : await loadUnread()
    : 0;

  const header =
    companyModeEnabled && isEmployeeSession ? (
      <EmployerHeader session={session} unread={unread} />
    ) : (
      <SeekerHeader
        session={!companyModeEnabled && isEmployeeSession ? null : session}
        unread={unread}
      />
    );
  return <AppFrame header={header}>{children}</AppFrame>;
}
