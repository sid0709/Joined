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
  Text,
  icons,
  type GlyphName,
} from "@joined/design-system";

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

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={3}>
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
