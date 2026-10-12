"use client";

import { useState, type ReactNode } from "react";
import {
  GridColumn,
  GridSystem,
  Heading,
  Icon,
  SideNav,
  SideNavItem,
  SideNavSection,
  Stack,
  Sticky,
  TIERS,
  Text,
  icons,
  useViewportBreakpoint,
  type GlyphName,
  type Tier,
} from "sid-ui";
import { CONTENT_PADDING } from "@/components/shell/app-frame";

/** From this tier the nav sits beside the panel, so it stays pinned while the panel scrolls. */
const SIDE_BY_SIDE: Tier = "lg";

export type SettingsSectionLink<Id extends string> = {
  id: Id;
  label: string;
  /** Shown under the section title on the right. */
  description: string;
  icon: GlyphName;
};

export type SettingsSectionGroup<Id extends string> = {
  title: string;
  sections: SettingsSectionLink<Id>[];
};

/** A grouped nav on the left; the chosen section's title and panel on the right. */
export function SectionedSettings<Id extends string>({
  nav,
  panels,
}: {
  nav: SettingsSectionGroup<Id>[];
  panels: Record<Id, ReactNode>;
}) {
  const sections = nav.flatMap((group) => group.sections);
  const [sectionId, setSectionId] = useState<Id>(sections[0].id);
  const current = sections.find((item) => item.id === sectionId) ?? sections[0];
  const tier = useViewportBreakpoint();
  const sideBySide = tier !== "base" && TIERS.indexOf(tier) >= TIERS.indexOf(SIDE_BY_SIDE);

  const sideNav = (
    <SideNav>
      {nav.map((group) => (
        <SideNavSection key={group.title} title={group.title}>
          {group.sections.map((item) => (
            <SideNavItem
              key={item.id}
              label={item.label}
              icon={<Icon icon={icons[item.icon]} />}
              isSelected={item.id === current.id}
              onClick={() => setSectionId(item.id)}
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );

  // Columns stretch to the row so the pinned nav has the full panel height to travel.
  return (
    <GridSystem gap={6}>
      <GridColumn span="full" lg={3}>
        {sideBySide ? <Sticky offset={CONTENT_PADDING}>{sideNav}</Sticky> : sideNav}
      </GridColumn>
      <GridColumn span="full" lg={9}>
        <Stack gap={6}>
          <Stack gap={1}>
            <Heading level={2}>{current.label}</Heading>
            <Text color="secondary" display="block">
              {current.description}
            </Text>
          </Stack>
          {panels[current.id]}
        </Stack>
      </GridColumn>
    </GridSystem>
  );
}
