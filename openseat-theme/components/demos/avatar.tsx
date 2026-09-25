"use client";

import { useState } from "react";
import {
  Avatar,
  AvatarGroup,
  AvatarGroupOverflow,
  AvatarStatusDot,
  HStack,
  Icon,
  Stack,
  Text,
  icons,
  type AvatarShape,
  type AvatarSize,
  type AvatarStatusDotVariant,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row, SAMPLE_IMAGES } from "./shared";

const NAMED_SIZES: AvatarSize[] = ["xsm", "sm", "md", "lg", "xl"];
const PIXEL_SIZES: AvatarSize[] = [16, 20, 24, 32, 40, 48, 64, 96];
const SHAPES: AvatarShape[] = ["circle", "rounded", "square"];
const STATUSES: { variant: AvatarStatusDotVariant; label: string }[] = [
  { variant: "success", label: "Online" },
  { variant: "neutral", label: "Away" },
  { variant: "error", label: "Busy" },
];
const GROUP_VISIBLE = 3;

export default function AvatarDemo() {
  const [opened, setOpened] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? PEOPLE : PEOPLE.slice(0, GROUP_VISIBLE);

  return (
    <Examples>
      <Preview align="start" label="Named sizes" description="xsm 20 · sm 24 · md 36 (default) · lg 48 · xl 128.">
        <Row>
          {NAMED_SIZES.map((size) => (
            <Avatar key={String(size)} name="Jordan Miles" size={size} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Pixel sizes" description="Any step of the avatar scale when a named size does not fit the media next to it.">
        <Row>
          {PIXEL_SIZES.map((size) => (
            <Avatar key={String(size)} name="Alex Rivera" size={size} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Shapes" description="Circle for people; rounded or square for teams, companies, and bots.">
        <Row>
          {SHAPES.map((shape) => (
            <Avatar key={shape} name="Dana Kim" shape={shape} size="lg" />
          ))}
          {SHAPES.map((shape) => (
            <Avatar key={`img-${shape}`} name="OpenSeat" src={SAMPLE_IMAGES.globe} shape={shape} size="lg" />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Image, initials, and fallbacks" description="src first, then fallbackSrc, then initials from name, then a person glyph.">
        <Row>
          <Stack gap={1} hAlign="center">
            <Avatar name="Riley Chen" src={SAMPLE_IMAGES.window} size="lg" />
            <Caption>src</Caption>
          </Stack>
          <Stack gap={1} hAlign="center">
            <Avatar name="Riley Chen" src={SAMPLE_IMAGES.missing} fallbackSrc={SAMPLE_IMAGES.file} size="lg" />
            <Caption>fallbackSrc</Caption>
          </Stack>
          <Stack gap={1} hAlign="center">
            <Avatar name="Riley Chen" src={SAMPLE_IMAGES.missing} size="lg" />
            <Caption>initials</Caption>
          </Stack>
          <Stack gap={1} hAlign="center">
            <Avatar name="Priya" size="lg" />
            <Caption>one word</Caption>
          </Stack>
          <Stack gap={1} hAlign="center">
            <Avatar size="lg" alt="Unknown person" />
            <Caption>no name</Caption>
          </Stack>
        </Row>
      </Preview>

      <Preview align="start" label="Status" description="Each variant pairs color with a shape, and the label joins the avatar’s accessible name.">
        <Stack gap={3} hAlign="start">
          {(["sm", "md", "lg", "xl"] as AvatarSize[]).map((size) => (
            <Row key={String(size)}>
              {STATUSES.map(({ variant, label }, index) => (
                <Avatar
                  key={variant}
                  name={PEOPLE[index].name}
                  size={size}
                  status={<AvatarStatusDot variant={variant} label={label} />}
                />
              ))}
            </Row>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Status with an icon" description="Use a different icon per status so it never relies on color alone.">
        <Row>
          <Avatar name="Jordan Miles" size="xl" status={<AvatarStatusDot variant="success" label="Verified" icon={<Icon icon={icons.check} />} />} />
          <Avatar name="Alex Rivera" size="xl" status={<AvatarStatusDot variant="error" label="Blocked" icon={<Icon icon={icons.lock} />} />} />
          <Avatar name="Dana Kim" size="xl" status={<AvatarStatusDot variant="neutral" label="Idle" icon={<Icon icon={icons.clock} />} />} />
        </Row>
      </Preview>

      <Preview align="start" label="Tooltip" description="Shows the name by default. Pass a string to say more, or false when you add your own overlay.">
        <Row>
          <Avatar name="Sam Okafor" />
          <Avatar name="Sam Okafor" tooltip="Sam Okafor · Producer" />
          <Avatar name="Sam Okafor" tooltip={false} />
        </Row>
      </Preview>

      <Preview align="start" label="Interactive" description="href renders a link; onClick renders a button. Static avatars are not focusable.">
        <Stack gap={2} hAlign="start">
          <Row>
            {PEOPLE.slice(0, 4).map((person) => (
              <Avatar key={person.name} name={person.name} onClick={() => setOpened(person.name)} />
            ))}
            <Avatar name="Morgan Lee" href="#morgan" />
          </Row>
          <Caption>{opened ? `Opened ${opened}’s profile` : "Click an avatar to open a profile."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Group" description="The group sizes and shapes every member. Slice to the visible count and add an overflow.">
        <Stack gap={3} hAlign="start">
          {(["xsm", "sm", "md", "lg"] as AvatarSize[]).map((size) => (
            <AvatarGroup key={String(size)} size={size}>
              {PEOPLE.slice(0, 4).map((person) => (
                <Avatar key={person.name} name={person.name} />
              ))}
              <AvatarGroupOverflow count={PEOPLE.length - 4} />
            </AvatarGroup>
          ))}
          <AvatarGroup size="md" shape="rounded">
            {PEOPLE.slice(0, 3).map((person) => (
              <Avatar key={person.name} name={person.name} />
            ))}
            <AvatarGroupOverflow count={9} />
          </AvatarGroup>
        </Stack>
      </Preview>

      <Preview align="start" label="Expandable group" description="An interactive overflow is part of the group’s single Tab stop.">
        <AvatarGroup size="md">
          {visible.map((person) => (
            <Avatar key={person.name} name={person.name} onClick={() => setOpened(person.name)} />
          ))}
          {expanded ? (
            <AvatarGroupOverflow count={0} onClick={() => setExpanded(false)}>
              <Icon icon={icons.minus} size="sm" />
            </AvatarGroupOverflow>
          ) : (
            <AvatarGroupOverflow count={PEOPLE.length - GROUP_VISIBLE} onClick={() => setExpanded(true)} />
          )}
        </AvatarGroup>
      </Preview>

      <Preview align="start" label="In a list" description="Avatar next to a name and role — the common people row.">
        <Stack gap={3}>
          {PEOPLE.slice(0, 4).map((person, index) => (
            <HStack key={person.name} gap={3} vAlign="center">
              <Avatar name={person.name} size="md" status={<AvatarStatusDot {...STATUSES[index % STATUSES.length]} />} tooltip={false} />
              <Stack gap={0}>
                <Text weight="semibold">{person.name}</Text>
                <Text type="supporting" color="secondary">
                  {person.role}
                </Text>
              </Stack>
            </HStack>
          ))}
        </Stack>
      </Preview>
    </Examples>
  );
}
