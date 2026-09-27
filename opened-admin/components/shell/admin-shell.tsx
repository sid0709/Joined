import Link from "next/link";
import { JobsNav } from "@/components/shell/jobs-nav";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-black/10 bg-sidebar px-4 py-6 md:flex">
        <Link href="/jobs/temp" className="px-2">
          <span className="block text-lg font-semibold tracking-tight text-surface">Opened</span>
          <span className="block text-xs text-sidebar-muted">Admin</span>
        </Link>
        <div className="mt-8">
          <JobsNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Link href="/jobs/temp" className="font-semibold tracking-tight">
            Opened Admin
          </Link>
          <JobsNav horizontal />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
