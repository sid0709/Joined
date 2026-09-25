"use client";

import { useState } from "react";
import { Badge, Button, HStack, Icon, Stack, Text, icons, type ButtonSize, type ButtonVariant } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const SAVE_DELAY_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ButtonDemo() {
  const [saves, setSaves] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [following, setFollowing] = useState(false);

  return (
    <Examples>
      <Preview align="start" label="Variants" description="One primary per view. Secondary and ghost for everything else; destructive only for irreversible work.">
        <Row>
          {VARIANTS.map((variant) => (
            <Button key={variant} label={variant[0].toUpperCase() + variant.slice(1)} variant={variant} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Sizes" description="sm 28px for dense rows, md 32px default, lg 36px for hero actions.">
        <Stack gap={3} hAlign="start">
          {SIZES.map((size) => (
            <Row key={size}>
              {VARIANTS.map((variant) => (
                <Button key={variant} label={`${size.toUpperCase()} ${variant}`} variant={variant} size={size} />
              ))}
            </Row>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Leading icon">
        <Row>
          <Button label="Post a room" variant="primary" icon={<Icon icon={icons.plus} />} />
          <Button label="Share" icon={<Icon icon={icons.share} />} />
          <Button label="Download" variant="ghost" icon={<Icon icon={icons.download} />} />
          <Button label="Delete" variant="destructive" icon={<Icon icon={icons.trash} />} />
        </Row>
      </Preview>

      <Preview align="start" label="End content" description="Counts, shortcuts, and chevrons sit after the label and inherit its color.">
        <Row>
          <Button label="Bids" endContent={<Badge label="6" variant="info" />} />
          <Button label="Inbox" variant="ghost" icon={<Icon icon={icons.mail} />} endContent={<Badge label="12" />} />
          <Button label="Search" variant="secondary" icon={<Icon icon={icons.search} />} endContent={<Text type="supporting" color="secondary">⌘K</Text>} />
          <Button label="Continue" variant="primary" endContent={<Icon icon={icons.arrowRight} />} />
        </Row>
      </Preview>

      <Preview align="start" label="Icon only" description="The label becomes the accessible name and the tooltip.">
        <Row>
          {VARIANTS.map((variant) => (
            <Button key={variant} label={`Edit (${variant})`} tooltip="Edit" variant={variant} isIconOnly icon={<Icon icon={icons.edit} />} />
          ))}
          {SIZES.map((size) => (
            <Button key={size} label={`Settings ${size}`} tooltip={`Settings · ${size}`} size={size} isIconOnly icon={<Icon icon={icons.settings} />} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Loading and async" description="clickAction shows a spinner until the promise settles and ignores repeat clicks.">
        <Stack gap={3} hAlign="start">
          <Row>
            <Button label="Saving" variant="primary" isLoading />
            <Button label="Syncing" isLoading />
            <Button
              label="Save draft"
              variant="primary"
              clickAction={async () => {
                await wait(SAVE_DELAY_MS);
                setSaves((n) => n + 1);
              }}
            />
          </Row>
          <Caption>{saves === 0 ? "Not saved yet." : `Saved ${saves} ${saves === 1 ? "time" : "times"}.`}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Disabled">
        <Row>
          {VARIANTS.map((variant) => (
            <Button key={variant} label={variant} variant={variant} isDisabled />
          ))}
          <Button label="Locked" isDisabled icon={<Icon icon={icons.lock} />} />
        </Row>
      </Preview>

      <Preview align="start" label="Full width" description="Pass width to fill a form column or a mobile sheet.">
        <Stack gap={2} width={320}>
          <Button label="Submit bid" variant="primary" width="100%" size="lg" />
          <Button label="Save for later" width="100%" />
        </Stack>
      </Preview>

      <Preview align="start" label="As a link" description="href renders an anchor through the app's link component.">
        <Row>
          <Button label="Open catalog" href="/" variant="secondary" icon={<Icon icon={icons.home} />} />
          <Button label="Astryx docs" href="https://astryx.atmeta.com" target="_blank" variant="ghost" endContent={<Icon icon={icons.arrowRight} />} />
        </Row>
      </Preview>

      <Preview align="start" label="Elevation" description="Floating actions lift off the page with low, med, or high.">
        <Row>
          <Button label="Low" elevation="low" />
          <Button label="Medium" elevation="med" />
          <Button label="New room" variant="primary" elevation="high" icon={<Icon icon={icons.plus} />} />
          <Button label="Compose" variant="primary" elevation="high" isIconOnly icon={<Icon icon={icons.edit} />} />
        </Row>
      </Preview>

      <Preview label="Pattern — form footer">
        <HStack gap={2} hAlign="end">
          <Button label="Cancel" variant="ghost" />
          <Button label="Save as draft" />
          <Button label="Publish room" variant="primary" />
        </HStack>
      </Preview>

      <Preview align="start" label="Pattern — confirm before destroying">
        <Stack gap={3} hAlign="start">
          {deleted ? (
            <Row>
              <Caption>Room deleted.</Caption>
              <Button label="Undo" size="sm" variant="ghost" icon={<Icon icon={icons.undo} />} onClick={() => setDeleted(false)} />
            </Row>
          ) : confirming ? (
            <Row>
              <Text>Delete “Brand refresh” and its six bids?</Text>
              <Button label="Keep it" size="sm" variant="ghost" onClick={() => setConfirming(false)} />
              <Button
                label="Delete room"
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirming(false);
                  setDeleted(true);
                }}
              />
            </Row>
          ) : (
            <Button label="Delete room" variant="destructive" icon={<Icon icon={icons.trash} />} onClick={() => setConfirming(true)} />
          )}
        </Stack>
      </Preview>

      <Preview align="start" label="Pattern — stateful label">
        <Row>
          <Button
            label={following ? "Following" : "Follow"}
            variant={following ? "secondary" : "primary"}
            icon={<Icon icon={following ? icons.check : icons.plus} />}
            onClick={() => setFollowing(!following)}
          />
          <Caption>{following ? "You’ll get updates on new rooms." : "Follow to hear about new rooms."}</Caption>
        </Row>
      </Preview>
    </Examples>
  );
}
