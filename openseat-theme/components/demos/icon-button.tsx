"use client";

import { useState } from "react";
import { Card, HStack, Icon, IconButton, Stack, Text, icons, type ButtonSize, type ButtonVariant } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const REFRESH_MS = 1000;

const COMMON = [
  { label: "Add", icon: icons.plus },
  { label: "Edit", icon: icons.edit },
  { label: "Share", icon: icons.share },
  { label: "Download", icon: icons.download },
  { label: "Copy link", icon: icons.link },
  { label: "Notifications", icon: icons.bell },
  { label: "Settings", icon: icons.settings },
  { label: "Delete", icon: icons.trash },
];

export default function IconButtonDemo() {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(true);
  const [refreshed, setRefreshed] = useState(0);
  const [zoom, setZoom] = useState(100);

  return (
    <Examples>
      <Preview align="start" label="Variants" description="Every icon button needs a label — it becomes the aria-label and the tooltip.">
        <Row>
          {VARIANTS.map((variant) => (
            <IconButton key={variant} label={`Add (${variant})`} tooltip={variant} variant={variant} icon={<Icon icon={icons.plus} />} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Sizes">
        <Stack gap={3} hAlign="start">
          {VARIANTS.map((variant) => (
            <Row key={variant}>
              {SIZES.map((size) => (
                <IconButton key={size} label={`${variant} ${size}`} tooltip={`${variant} · ${size}`} variant={variant} size={size} icon={<Icon icon={icons.edit} />} />
              ))}
            </Row>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Icon set" description="OpenSeat icons drop into any icon slot.">
        <Row>
          {COMMON.map((item) => (
            <IconButton key={item.label} label={item.label} tooltip={item.label} variant="ghost" icon={<Icon icon={item.icon} />} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="States">
        <Row>
          <IconButton label="Loading" isLoading icon={<Icon icon={icons.refresh} />} />
          <IconButton label="Loading primary" variant="primary" isLoading icon={<Icon icon={icons.send} />} />
          <IconButton label="Disabled" isDisabled icon={<Icon icon={icons.lock} />} />
          <IconButton label="Disabled ghost" variant="ghost" isDisabled icon={<Icon icon={icons.trash} />} />
          <IconButton
            label="Refresh"
            tooltip="Refresh"
            icon={<Icon icon={icons.refresh} />}
            clickAction={async () => {
              await new Promise((resolve) => setTimeout(resolve, REFRESH_MS));
              setRefreshed((n) => n + 1);
            }}
          />
          <Caption>Refreshed {refreshed}×</Caption>
        </Row>
      </Preview>

      <Preview align="start" label="Floating action" description="Elevation turns an icon button into a FAB.">
        <Row>
          <IconButton label="New room" tooltip="New room" variant="primary" size="lg" elevation="high" icon={<Icon icon={icons.plus} />} />
          <IconButton label="Compose" tooltip="Compose" elevation="med" icon={<Icon icon={icons.edit} />} />
          <IconButton label="Back to top" tooltip="Back to top" elevation="low" size="sm" icon={<Icon icon={icons.arrowUp} />} />
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — reactions">
        <Row>
          <IconButton
            label={liked ? "Unlike" : "Like"}
            tooltip={liked ? "Unlike" : "Like"}
            variant={liked ? "primary" : "ghost"}
            icon={<Icon icon={icons.heart} />}
            onClick={() => setLiked(!liked)}
          />
          <IconButton
            label={saved ? "Remove bookmark" : "Bookmark"}
            tooltip={saved ? "Saved" : "Save"}
            variant={saved ? "secondary" : "ghost"}
            icon={<Icon icon={icons.bookmark} />}
            onClick={() => setSaved(!saved)}
          />
          <IconButton label="Share" tooltip="Share" variant="ghost" icon={<Icon icon={icons.share} />} />
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — stepper">
        <Row>
          <IconButton label="Zoom out" size="sm" icon={<Icon icon={icons.minus} />} isDisabled={zoom <= 50} onClick={() => setZoom(zoom - 10)} />
          <Text hasTabularNumbers>{zoom}%</Text>
          <IconButton label="Zoom in" size="sm" icon={<Icon icon={icons.plus} />} isDisabled={zoom >= 200} onClick={() => setZoom(zoom + 10)} />
        </Row>
      </Preview>

      <Preview label="Pattern — card actions">
        <Card>
          <HStack gap={3} vAlign="center" hAlign="between">
            <Stack gap={0} hAlign="start">
              <Text weight="medium">Brand refresh</Text>
              <Text type="supporting" color="secondary">
                Fixed · $2,400 · 6 bids
              </Text>
            </Stack>
            <HStack gap={1} vAlign="center">
              <IconButton label="Edit room" tooltip="Edit" variant="ghost" size="sm" icon={<Icon icon={icons.edit} />} />
              <IconButton label="Pin room" tooltip="Pin" variant="ghost" size="sm" icon={<Icon icon={icons.pin} />} />
              <IconButton label="Delete room" tooltip="Delete" variant="ghost" size="sm" icon={<Icon icon={icons.trash} />} />
            </HStack>
          </HStack>
        </Card>
      </Preview>
    </Examples>
  );
}
