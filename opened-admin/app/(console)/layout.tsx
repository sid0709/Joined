import type { ReactNode } from "react";
import type { Overview } from "@openseat/scout";
import { AdminShell } from "@/components/shell/admin-shell";
import { adminGet } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/** Every staff page: the shell with live queue counts. Counts are optional chrome. */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const overview = await adminGet<Overview>("/v1/admin/scout/overview").catch(() => null);
  return <AdminShell overview={overview}>{children}</AdminShell>;
}
