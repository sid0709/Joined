"use client";

import { Tab, TabList } from "./Navigation";

export type PageTab = { value: string; label: string; href: string };

/**
 * Tabs that switch a page's view by navigating (each tab is a link), so the view is
 * server-rendered and shareable. Pass the current tab's `value`.
 */
export function PageTabs({
  tabs,
  value,
  label,
}: {
  tabs: PageTab[];
  value: string;
  /** Names the tab group for screen readers. */
  label?: string;
}) {
  return (
    <TabList value={value} onChange={() => {}} hasDivider overflow="scroll" aria-label={label}>
      {tabs.map((tab) => (
        <Tab key={tab.value} value={tab.value} label={tab.label} href={tab.href} />
      ))}
    </TabList>
  );
}
