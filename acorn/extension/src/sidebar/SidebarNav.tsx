import { useEffect } from "react";
import { PillNav } from "sid-ui";

export type AcornMainTab = "fill" | "qa" | "custom";

const TABS: AcornMainTab[] = ["fill", "qa", "custom"];

function tabFromHash(): AcornMainTab | null {
  const hash = window.location.hash.slice(1);
  return (TABS as string[]).includes(hash) ? (hash as AcornMainTab) : null;
}

type SidebarNavProps = {
  value: AcornMainTab;
  onChange: (next: AcornMainTab) => void;
  /** Fill jobs and Custom tabs with work in flight. */
  busyJobs: number;
  rememberedTabs: number;
};

/**
 * Jobs / Ask / Tabs as a Joined PillNav. The pills are hash links, so the side panel
 * needs no router: the hash is the selected tab.
 */
export function SidebarNav({ value, onChange, busyJobs, rememberedTabs }: SidebarNavProps) {
  useEffect(() => {
    const sync = () => {
      const next = tabFromHash();
      if (next) onChange(next);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [onChange]);

  return (
    <PillNav
      label="Acorn"
      activeHref={`#${value}`}
      items={[
        { href: "#fill", label: "Jobs", icon: "list", count: busyJobs },
        { href: "#qa", label: "Ask", icon: "chat" },
        { href: "#custom", label: "Tabs", icon: "pin", count: rememberedTabs },
      ]}
    />
  );
}
