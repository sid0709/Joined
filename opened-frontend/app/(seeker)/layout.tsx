import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { EmployerHeader } from "@/components/shell/employer-header";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { isEmployee } from "@/lib/auth/account-type";
import { loadSession } from "@/lib/auth/session";

/**
 * Candidate mode, plus the public job and company pages anyone can open. An
 * employee previewing those pages keeps the hiring header, never the job-search one.
 */
export default async function SeekerLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  const header = isEmployee(session) ? (
    <EmployerHeader session={session} />
  ) : (
    <SeekerHeader session={session} />
  );
  return <AppFrame header={header}>{children}</AppFrame>;
}
