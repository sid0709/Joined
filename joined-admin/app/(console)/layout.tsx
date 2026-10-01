import type { ReactNode } from "react";
import type { Overview } from "@joined/scout";
import { AdminShell } from "@/components/shell/admin-shell";
import { adminGet } from "@/lib/server/api";
import { trustNavCounts } from "@/lib/server/trust-counts";

export const dynamic = "force-dynamic";

/** Every staff page: the shell with live queue counts. Counts are optional chrome. */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const [overview, trust] = await Promise.all([
    adminGet<Overview>("/v1/admin/scout/overview").catch(() => null),
    trustNavCounts(),
  ]);
  return (
    <AdminShell overview={overview} trust={trust}>
      {children}
    </AdminShell>
  );
}
