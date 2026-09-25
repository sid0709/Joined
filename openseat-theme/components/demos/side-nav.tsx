"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  Icon,
  IconButton,
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
  Text,
  icons,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const NAV_WIDTH = 260;
const NAV_HEIGHT = 420;

export default function SideNavDemo() {
  const [selected, setSelected] = useState("rooms");
  const [collapsed, setCollapsed] = useState(false);

  const item = (id: string, label: string, icon: Parameters<typeof Icon>[0]["icon"], extra?: Partial<Parameters<typeof SideNavItem>[0]>) => (
    <SideNavItem key={id} label={label} icon={<Icon icon={icon} />} isSelected={selected === id} onClick={() => setSelected(id)} {...extra} />
  );

  return (
    <Examples>
      <Preview align="start" label="Sections" description="Titled groups separate the product into areas.">
        <Card width={NAV_WIDTH} height={NAV_HEIGHT} padding={0}>
          <SideNav header={<SideNavHeading heading="OpenSeat" subheading="Northwind" icon={<Icon icon={icons.seat} color="accent" />} />}>
            <SideNavSection title="Work">
              {item("home", "Home", icons.home)}
              {item("rooms", "Rooms", icons.seat, { endContent: <Badge label="24" /> })}
              {item("messages", "Messages", icons.mail, { endContent: <Badge label="3" variant="info" /> })}
            </SideNavSection>
            <SideNavSection title="Money">
              {item("escrow", "Escrow", icons.lock)}
              {item("invoices", "Invoices", icons.file)}
            </SideNavSection>
          </SideNav>
        </Card>
      </Preview>

      <Preview align="start" label="Nested and collapsible" description="Parents fold their children; the chevron remembers state.">
        <Card width={NAV_WIDTH} height={NAV_HEIGHT} padding={0}>
          <SideNav header={<SideNavHeading heading="Library" />}>
            <SideNavItem label="Overview" icon={<Icon icon="viewColumns" />} isSelected={selected === "overview"} onClick={() => setSelected("overview")} />
            <SideNavItem label="Action" icon={<Icon icon="check" />} collapsible>
              <SideNavItem label="Button" isSelected={selected === "button"} onClick={() => setSelected("button")} />
              <SideNavItem label="Link" isSelected={selected === "link"} onClick={() => setSelected("link")} />
            </SideNavItem>
            <SideNavItem label="Layout" icon={<Icon icon="menu" />} collapsible={{ defaultIsCollapsed: true }}>
              <SideNavItem label="Stack" onClick={() => setSelected("stack")} isSelected={selected === "stack"} />
              <SideNavItem label="Grid" onClick={() => setSelected("grid")} isSelected={selected === "grid"} />
            </SideNavItem>
            <SideNavItem label="Archived" icon={<Icon icon={icons.folder} />} isDisabled />
          </SideNav>
        </Card>
      </Preview>

      <Preview align="start" label="Collapsible rail" description="collapsible shrinks the nav to icons; the button or your own state toggles it.">
        <HStack gap={3} vAlign="start">
          <Card height={NAV_HEIGHT} padding={0}>
            <SideNav
              header={<SideNavHeading heading="OpenSeat" icon={<Icon icon={icons.seat} color="accent" />} />}
              collapsible={{ isCollapsed: collapsed, onCollapsedChange: setCollapsed, hasButton: true }}
            >
              {item("home", "Home", icons.home)}
              {item("rooms", "Rooms", icons.seat)}
              {item("messages", "Messages", icons.mail)}
              {item("settings", "Settings", icons.settings)}
            </SideNav>
          </Card>
          <Button label={collapsed ? "Expand" : "Collapse"} size="sm" onClick={() => setCollapsed((c) => !c)} />
        </HStack>
      </Preview>

      <Preview align="start" label="Actions, top content, and footer" description="Per-item actions, a create button on top, and the signed-in person below.">
        <Card width={NAV_WIDTH} height={NAV_HEIGHT} padding={0}>
          <SideNav
            header={<SideNavHeading heading="Rooms" />}
            topContent={<Button label="New room" variant="primary" icon={<Icon icon={icons.plus} />} width="100%" />}
            footer={
              <HStack gap={2} vAlign="center">
                <Avatar name="Jordan Miles" size="sm" tooltip={false} />
                <Text>Jordan Miles</Text>
              </HStack>
            }
          >
            <SideNavSection title="Pinned" endContent={<IconButton label="Add pinned" variant="ghost" size="sm" icon={<Icon icon={icons.plus} />} />}>
              {["Brand refresh", "Motion system"].map((r) => (
                <SideNavItem
                  key={r}
                  label={r}
                  icon={<Icon icon={icons.pin} />}
                  isSelected={selected === r}
                  onClick={() => setSelected(r)}
                  actions={<IconButton label={`Unpin ${r}`} variant="ghost" size="sm" icon={<Icon icon={icons.close} />} />}
                />
              ))}
            </SideNavSection>
            <SideNavSection title="Recent">
              {["Landing page copy", "Pitch deck", "Icon set"].map((r) => (
                <SideNavItem key={r} label={r} isSelected={selected === r} onClick={() => setSelected(r)} />
              ))}
            </SideNavSection>
          </SideNav>
        </Card>
      </Preview>

      <Caption>Selected: {selected}</Caption>
    </Examples>
  );
}
