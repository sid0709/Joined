"use client";

import { useState } from "react";
import { BreadcrumbItem, Breadcrumbs, Button, Card, HStack, Heading, Icon, Stack, Text, icons } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const PATH = ["Workspace", "Northwind", "Rooms", "Brand refresh"];
const FOLDERS = ["Home", "Clients", "Northwind", "2026", "Q3", "Brand", "Logo round 2"];
const SIBLINGS = ["Brand refresh", "Landing page copy", "Motion system", "Pitch deck"];

export default function BreadcrumbsDemo() {
  const [depth, setDepth] = useState(PATH.length);
  const [room, setRoom] = useState(SIBLINGS[0]);
  const trail = PATH.slice(0, depth);

  return (
    <Examples>
      <Preview label="Basic" description="Every ancestor links; the last item is the current page.">
        <Breadcrumbs>
          {PATH.map((label, index) => (
            <BreadcrumbItem key={label} href={`#${label}`} isCurrent={index === PATH.length - 1}>
              {label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>
      </Preview>

      <Preview label="Supporting variant" description="Smaller and quieter — for the top of dense pages and panels.">
        <Breadcrumbs variant="supporting">
          {PATH.map((label, index) => (
            <BreadcrumbItem key={label} href={`#${label}`} isCurrent={index === PATH.length - 1}>
              {label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>
      </Preview>

      <Preview label="Icons and a custom separator" description="startIcon marks the root; any node can separate items.">
        <Stack gap={3}>
          <Breadcrumbs>
            <BreadcrumbItem href="#home" startIcon={<Icon icon={icons.home} size="sm" />}>
              Home
            </BreadcrumbItem>
            <BreadcrumbItem href="#rooms" startIcon={<Icon icon={icons.seat} size="sm" />}>
              Rooms
            </BreadcrumbItem>
            <BreadcrumbItem isCurrent startIcon={<Icon icon={icons.lock} size="sm" />}>
              Brand refresh
            </BreadcrumbItem>
          </Breadcrumbs>
          <Breadcrumbs separator="/">
            {PATH.map((label, index) => (
              <BreadcrumbItem key={label} href={`#${label}`} isCurrent={index === PATH.length - 1}>
                {label}
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
        </Stack>
      </Preview>

      <Preview label="Sibling menu" description="menu on an item jumps sideways to a sibling page without going up first.">
        <Stack gap={2}>
          <Breadcrumbs>
            <BreadcrumbItem href="#workspace">Workspace</BreadcrumbItem>
            <BreadcrumbItem href="#rooms">Rooms</BreadcrumbItem>
            <BreadcrumbItem isCurrent menu={SIBLINGS.map((label) => ({ label, onClick: () => setRoom(label) }))}>
              {room}
            </BreadcrumbItem>
          </Breadcrumbs>
          <Caption>Open the menu on the last item to switch rooms.</Caption>
        </Stack>
      </Preview>

      <Preview label="Deep paths" description="Long trails collapse the middle so the root and the current page stay visible.">
        <Card maxWidth={420}>
          <Breadcrumbs>
            {FOLDERS.map((label, index) => (
              <BreadcrumbItem key={label} href={`#${label}`} isCurrent={index === FOLDERS.length - 1}>
                {label}
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
        </Card>
      </Preview>

      <Preview label="Click to go up" description="onClick handles client navigation — the trail shortens as you climb.">
        <Stack gap={3}>
          <Breadcrumbs>
            {trail.map((label, index) => (
              <BreadcrumbItem key={label} onClick={() => setDepth(index + 1)} isCurrent={index === trail.length - 1}>
                {label}
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
          <HStack>
            <Button label="Reset" size="sm" variant="ghost" onClick={() => setDepth(PATH.length)} isDisabled={depth === PATH.length} />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Page header" description="Breadcrumbs above the title, the most common placement.">
        <Stack gap={2}>
          <Breadcrumbs variant="supporting">
            {PATH.slice(0, -1).map((label) => (
              <BreadcrumbItem key={label} href={`#${label}`}>
                {label}
              </BreadcrumbItem>
            ))}
          </Breadcrumbs>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <Heading level={2}>Brand refresh</Heading>
            <Button label="Share room" icon={<Icon icon={icons.share} />} />
          </HStack>
          <Text color="secondary">Closes Friday · 6 bids</Text>
        </Stack>
      </Preview>
    </Examples>
  );
}
