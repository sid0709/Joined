"use client";

import { usePathname } from "next/navigation";
import { PageTabs } from "sid-ui";
import { ROUTES } from "@/lib/routes";

const TABS = [
  { value: ROUTES.resume, label: "Generate", href: ROUTES.resume },
  { value: ROUTES.resumeLibrary, label: "Library", href: ROUTES.resumeLibrary },
  { value: ROUTES.resumeHistory, label: "History", href: ROUTES.resumeHistory },
];

/** Generate, Library, and History are separate pages; these tabs move between them. */
export function ResumeTabs() {
  const pathname = usePathname();
  const value = TABS.some((tab) => tab.value === pathname) ? pathname : ROUTES.resume;
  return <PageTabs label="Resume" tabs={TABS} value={value} />;
}
