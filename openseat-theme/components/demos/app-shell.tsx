"use client";

import { useState, type ReactNode } from "react";
import {
  AppShell,
  Banner,
  Button,
  Card,
  Grid,
  GridColumn,
  GridSystem,
  Icon,
  IconButton,
  SideNav,
  SideNavItem,
  SideNavSection,
  Stack,
  Text,
  Tile,
  TopNav,
  TopNavHeading,
  TopNavItem,
  icons,
  type AppShellBreakpoint,
  type AppShellVariant,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const VARIANTS: AppShellVariant[] = ["elevated", "surface", "section", "wash"];
const SHELL_HEIGHT = 300;

const PAGES = [
  { id: "home", label: "Home", icon: icons.home },
  { id: "rooms", label: "Rooms", icon: icons.seat },
  { id: "bids", label: "Bids", icon: icons.list },
  { id: "inbox", label: "Inbox", icon: icons.mail },
];

function Top({ current = "Rooms" }: { current?: string }) {
  return (
    <TopNav
      label="Product navigation"
      heading={<TopNavHeading heading="OpenSeat" />}
      startContent={
        <>
          <TopNavItem label="Rooms" href="#rooms" isSelected={current === "Rooms"} />
          <TopNavItem label="Bidders" href="#bidders" isSelected={current === "Bidders"} />
        </>
      }
      endContent={<IconButton label="Notifications" variant="ghost" icon={<Icon icon={icons.bell} />} />}
    />
  );
}

function Side({ page, onPage, collapsible }: { page: string; onPage: (id: string) => void; collapsible?: boolean }) {
  return (
    <SideNav collapsible={collapsible} resizable={collapsible}>
      <SideNavSection title="Workspace">
        {PAGES.map((p) => (
          <SideNavItem key={p.id} label={p.label} icon={p.icon} isSelected={page === p.id} onClick={() => onPage(p.id)} />
        ))}
      </SideNavSection>
      <SideNavSection title="Account">
        <SideNavItem label="Settings" icon={icons.settings} onClick={() => onPage("settings")} isSelected={page === "settings"} />
      </SideNavSection>
    </SideNav>
  );
}

function Frame({ children, height = SHELL_HEIGHT }: { children: ReactNode; height?: number }) {
  return (
    <Card height={height} padding={0} width="100%">
      {children}
    </Card>
  );
}

function BreakpointShell({ breakpoint }: { breakpoint: AppShellBreakpoint }) {
  const [page, setPage] = useState("rooms");
  return (
    <Frame height={260}>
      <AppShell mobileNav={{ breakpoint }} topNav={<Top />} sideNav={<Side page={page} onPage={setPage} />} contentPadding={4}>
        <Text>breakpoint “{breakpoint}”</Text>
      </AppShell>
    </Frame>
  );
}

export default function AppShellDemo() {
  const [page, setPage] = useState("rooms");

  return (
    <Examples>
      <Preview label="Product frame" description="Top nav, side nav, and content — the content area scrolls on its own and holds any responsive layout.">
        <Frame height={420}>
          <AppShell topNav={<Top />} sideNav={<Side page={page} onPage={setPage} collapsible />} contentPadding={5}>
            <Stack gap={4}>
              <Text type="large" weight="semibold">
                {PAGES.find((p) => p.id === page)?.label ?? "Settings"}
              </Text>
              <GridSystem gap={3}>
                {["Open", "In review", "Awarded", "Archived"].map((label) => (
                  <GridColumn key={label} span={12} sm={6} lg={3}>
                    <Tile tone="neutral" meta="rooms">
                      {label}
                    </Tile>
                  </GridColumn>
                ))}
                <GridColumn span={12} lg={8}>
                  <Tile height={160}>Room list</Tile>
                </GridColumn>
                <GridColumn span={12} lg={4}>
                  <Tile tone="neutral" height={160}>
                    Activity
                  </Tile>
                </GridColumn>
              </GridSystem>
            </Stack>
          </AppShell>
        </Frame>
        <Caption>The side nav is collapsible and resizable — drag its edge or use its collapse control.</Caption>
      </Preview>

      <Preview label="Variants" description="How the content area separates from the chrome.">
        <Grid columns={{ minWidth: 320 }} gap={4}>
          {VARIANTS.map((variant) => (
            <Stack key={variant} gap={2}>
              <Text type="label" color="secondary">
                {variant}
              </Text>
              <Frame height={220}>
                <AppShell variant={variant} topNav={<Top />} sideNav={<Side page={page} onPage={setPage} />} contentPadding={4}>
                  <Tile height={80}>{variant}</Tile>
                </AppShell>
              </Frame>
            </Stack>
          ))}
        </Grid>
      </Preview>

      <Preview
        label="Responsive — where the side nav becomes a drawer"
        description="mobileNav.breakpoint is a viewport tier. Below it, the side nav moves into a toggleable mobile drawer."
      >
        <Grid columns={{ minWidth: 320 }} gap={4}>
          <Stack gap={2}>
            <Text type="label" color="secondary">
              none — always a sidebar
            </Text>
            <BreakpointShell breakpoint="none" />
          </Stack>
          <Stack gap={2}>
            <Text type="label" color="secondary">
              md (default) — drawer on phones
            </Text>
            <BreakpointShell breakpoint="md" />
          </Stack>
          <Stack gap={2}>
            <Text type="label" color="secondary">
              2xl — drawer below 1536px, so on most laptops
            </Text>
            <BreakpointShell breakpoint="2xl" />
          </Stack>
        </Grid>
      </Preview>

      <Preview label="With a banner" description="A shell-wide message sits above everything.">
        <Frame>
          <AppShell
            banner={<Banner status="warning" title="Scheduled maintenance tonight" description="Bidding pauses from 1–2 AM." />}
            topNav={<Top />}
            sideNav={<Side page={page} onPage={setPage} />}
            contentPadding={4}
          >
            <Tile height={100}>Content</Tile>
          </AppShell>
        </Frame>
      </Preview>

      <Preview label="Top nav only" description="Marketing pages and simple tools skip the side nav.">
        <Frame height={240}>
          <AppShell topNav={<Top current="Bidders" />} contentPadding={5}>
            <Stack gap={3} hAlign="start">
              <Text type="large" weight="semibold">
                Find the right bidder
              </Text>
              <Button label="Post a room" variant="primary" icon={<Icon icon={icons.plus} />} />
            </Stack>
          </AppShell>
        </Frame>
      </Preview>

      <Preview label="Side nav only, full-bleed content" description="contentPadding 0 lets a canvas or map run to the edges.">
        <Frame height={240}>
          <AppShell sideNav={<Side page={page} onPage={setPage} />} contentPadding={0}>
            <Tile tone="neutral" height={240}>
              Full-bleed canvas
            </Tile>
          </AppShell>
        </Frame>
      </Preview>
    </Examples>
  );
}
