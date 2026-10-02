import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Overview } from "@joined/scout";
import { AdminShell } from "@/components/shell/admin-shell";
import { signInHref } from "@/lib/nav";
import { adminGet } from "@/lib/server/api";
import { loadStaffAccess } from "@/lib/server/staff";
import { trustNavCounts } from "@/lib/server/trust-counts";
import { REQUEST_PATH_HEADER } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/**
 * Every staff page: signed-in staff only, in the shell with live queue counts.
 * Anything short of a live session goes to sign-in, which says why. Counts are
 * optional chrome.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const access = await loadStaffAccess();
  if (access.status !== "signed-in") {
    redirect(signInHref((await headers()).get(REQUEST_PATH_HEADER)));
  }
  const [overview, trust] = await Promise.all([
    adminGet<Overview>("/v1/admin/scout/overview").catch(() => null),
    trustNavCounts(),
  ]);
  return (
    <AdminShell overview={overview} trust={trust} staff={access.staff}>
      {children}
    </AdminShell>
  );
}
