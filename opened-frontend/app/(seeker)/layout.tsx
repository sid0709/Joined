import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { loadSession } from "@/lib/auth/session";

/** Candidate mode: job search, applications, interviews, and public job and company pages. */
export default async function SeekerLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();
  return <AppFrame header={<SeekerHeader session={session} />}>{children}</AppFrame>;
}
