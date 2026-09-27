import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";

/** Candidate mode: job search, applications, interviews, and public job and company pages. */
export default function SeekerLayout({ children }: { children: ReactNode }) {
  return <AppFrame header={<SeekerHeader />}>{children}</AppFrame>;
}
