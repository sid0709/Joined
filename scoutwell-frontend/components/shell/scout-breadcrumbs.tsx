"use client";

import { usePathname } from "next/navigation";
import { BreadcrumbItem, Breadcrumbs } from "@openseat/design-system";
import { breadcrumbs } from "@/lib/nav";

/** Where you are, ending on the current page. */
export function ScoutBreadcrumbs() {
  const crumbs = breadcrumbs(usePathname());
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumbs label="You are here">
      {crumbs.map((crumb, index) => (
        <BreadcrumbItem key={crumb.label} href={crumb.href} isCurrent={index === crumbs.length - 1}>
          {crumb.label}
        </BreadcrumbItem>
      ))}
    </Breadcrumbs>
  );
}
