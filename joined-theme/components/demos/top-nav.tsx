"use client";

import {
  Avatar,
  BRAND_NAME,
  Badge,
  Button,
  Card,
  Icon,
  IconButton,
  JoinedMark,
  Nav,
  TextInput,
  TopNav,
  TopNavHeading,
  TopNavItem,
  TopNavMegaMenu,
  TopNavMegaMenuFeaturedCard,
  TopNavMegaMenuItem,
  TopNavMenu,
  icons,
  BrandHeading,
} from "@joined/design-system";
import { useState } from "react";

import { Examples, Preview, SAMPLE_IMAGES } from "./shared";

const LINKS = ["Dashboard", "Rooms", "Messages", "Reports"];

export default function TopNavDemo() {
  const [current, setCurrent] = useState("Rooms");
  const [query, setQuery] = useState("");

  return (
    <Examples>
      <Preview label="Product bar" description="Heading, primary links, and one action.">
        <TopNav
          label="Product"
          heading={<BrandHeading />}
          startContent={
            <>
              {LINKS.map((l) => (
                <TopNavItem
                  key={l}
                  label={l}
                  href={`#${l}`}
                  isSelected={current === l}
                  onClick={() => setCurrent(l)}
                />
              ))}
            </>
          }
          endContent={
            <Button
              label="Post a room"
              variant="primary"
              size="sm"
              icon={<Icon icon={icons.plus} />}
            />
          }
        />
      </Preview>

      <Preview
        label="Logo and workspace"
        description="A logo, a superheading for the workspace, and a subheading for the product area."
      >
        <TopNav
          label="Workspace"
          heading={
            <TopNavHeading
              logo={<JoinedMark label="" />}
              logoLabel={BRAND_NAME}
              superheading="Northwind"
              heading="Rooms"
              subheading="Sealed bidding"
            />
          }
          endContent={<Avatar name="Jordan Miles" size="sm" />}
        />
      </Preview>

      <Preview
        label="Search, icons, and the user"
        description="centerContent for search; icon-only items for alerts and help."
      >
        <TopNav
          label="App"
          heading={<BrandHeading />}
          centerContent={
            <TextInput
              label="Search"
              isLabelHidden
              size="sm"
              placeholder="Search rooms, people, files"
              value={query}
              onChange={setQuery}
              startIcon={<Icon icon={icons.search} />}
              width={320}
            />
          }
          endContent={
            <>
              <TopNavItem
                label="Notifications"
                isIconOnly
                icon={<Icon icon={icons.bell} />}
                href="#alerts"
              />
              <TopNavItem label="Help" isIconOnly icon={<Icon icon="info" />} href="#help" />
              <Avatar name="Jordan Miles" size="sm" />
            </>
          }
        />
      </Preview>

      <Preview
        label="Dropdown menus"
        description="TopNavMenu for a short list; TopNavMegaMenu for rich product navigation."
      >
        <TopNav
          label="Marketing"
          heading={<BrandHeading />}
          startContent={
            <>
              <TopNavMegaMenu
                label="Product"
                items={
                  <>
                    <TopNavMegaMenuItem
                      title="Sealed rooms"
                      description="Private bids until the deadline."
                      icon={<Icon icon={icons.lock} />}
                      href="#rooms"
                    />
                    <TopNavMegaMenuItem
                      title="Escrow"
                      description="Pay when the work is done."
                      icon={<Icon icon={icons.seat} />}
                      href="#escrow"
                    />
                    <TopNavMegaMenuItem
                      title="Shortlists"
                      description="Share picks with your team."
                      icon={<Icon icon={icons.users} />}
                      href="#shortlists"
                    />
                  </>
                }
                featured={
                  <TopNavMegaMenuFeaturedCard
                    title="What’s new"
                    description="Rooms now close automatically."
                    image={SAMPLE_IMAGES.window}
                    imageAlt=""
                    linkLabel="Read the notes"
                    linkHref="#notes"
                  />
                }
              />
              <TopNavMenu
                label="Resources"
                items={[
                  { title: "Guides", description: "Run your first room", href: "#guides" },
                  { title: "Templates", description: "Briefs that work", href: "#templates" },
                  { title: "Community", href: "#community" },
                ]}
              />
              <TopNavItem label="Pricing" href="#pricing" />
            </>
          }
          endContent={
            <>
              <Button label="Sign in" variant="ghost" size="sm" />
              <Button label="Start free" variant="primary" size="sm" />
            </>
          }
        />
      </Preview>

      <Preview label="Disabled and badged items">
        <TopNav
          label="Settings"
          heading={<TopNavHeading heading="Settings" />}
          startContent={
            <>
              <TopNavItem label="Profile" href="#profile" isSelected />
              <TopNavItem label="Billing" href="#billing">
                <Badge label="Due" variant="warning" />
              </TopNavItem>
              <TopNavItem label="Audit log" isDisabled />
            </>
          }
          endContent={
            <IconButton
              label="Close settings"
              variant="ghost"
              size="sm"
              icon={<Icon icon={icons.close} />}
            />
          }
        />
      </Preview>

      <Preview
        label="Joined Nav"
        description="Nav composes TopNav for the product: brand, links, one call to action, and the signed-in person."
      >
        <Card padding={0}>
          <Nav
            brand="Joined"
            items={[
              { label: "Dashboard", active: true },
              { label: "Job rooms" },
              { label: "Messages" },
            ]}
            cta="Post a sealed job"
            showAvatar
            userName="Dana Kim"
          />
        </Card>
      </Preview>
    </Examples>
  );
}
