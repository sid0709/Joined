"use client";

import { Card, PillNav, Text, type PillNavItem } from "@joined/design-system";

import { Examples, Preview } from "./shared";

const PHONE_WIDTH = 360;

const ITEMS: PillNavItem[] = [
  { href: "#home", label: "Home", icon: "home" },
  { href: "#rooms", label: "Rooms", icon: "seat", count: 4 },
  { href: "#messages", label: "Messages", icon: "mail", count: 12 },
  { href: "#files", label: "Files", icon: "folder" },
  { href: "#alerts", label: "Alerts", icon: "bell", count: 128 },
];

export default function PillNavDemo() {
  return (
    <Examples>
      <Preview
        align="start"
        label="Header"
        description="Each page is an icon. The current one opens to icon and label, and the highlight slides with it. Counts above 99 read as 99+."
      >
        <PillNav label="App" items={ITEMS} activeHref="#rooms" />
      </Preview>

      <Preview
        align="start"
        label="Bottom bar"
        description="On small screens the same pills pin to the bottom edge and share the width."
      >
        <Card padding={0} width={PHONE_WIDTH}>
          <div className="os-pill-nav-stage">
            <Text type="supporting" color="secondary" display="block">
              Page content stays above the bar.
            </Text>
            <PillNav label="App" items={ITEMS} activeHref="#home" placement="bottom" />
          </div>
        </Card>
      </Preview>
    </Examples>
  );
}
