"use client";

import { useState } from "react";
import { Icon, Stack, ToggleButton, icons, type ButtonSize } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const SYNC_MS = 900;

export default function ToggleButtonDemo() {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(true);
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [watching, setWatching] = useState(false);
  const [sizes, setSizes] = useState<Record<ButtonSize, boolean>>({ sm: false, md: true, lg: false });
  const [format, setFormat] = useState({ bold: true, italic: false, underline: false });

  return (
    <Examples>
      <Preview align="start" label="Label and icon" description="A binary on/off control shaped like a Button. The pressed icon swaps in when on.">
        <Row>
          <ToggleButton label="Like" icon={<Icon icon={icons.heart} />} isPressed={liked} onPressedChange={setLiked} />
          <ToggleButton label={saved ? "Saved" : "Save"} icon={<Icon icon={icons.bookmark} />} pressedIcon={<Icon icon={icons.check} />} isPressed={saved} onPressedChange={setSaved} />
          <ToggleButton label={pinned ? "Pinned" : "Pin"} icon={<Icon icon={icons.pin} />} isPressed={pinned} onPressedChange={setPinned} />
        </Row>
      </Preview>

      <Preview align="start" label="Icon only" description="Tooltips carry the name for sighted users.">
        <Row>
          <ToggleButton label="Mute" tooltip={muted ? "Unmute" : "Mute"} isIconOnly icon={<Icon icon={icons.bell} />} pressedIcon={<Icon icon={icons.minus} />} isPressed={muted} onPressedChange={setMuted} />
          <ToggleButton label="Show preview" tooltip={visible ? "Hide preview" : "Show preview"} isIconOnly icon={<Icon icon={icons.eye} />} isPressed={visible} onPressedChange={setVisible} />
          <ToggleButton label="Favorite" tooltip="Favorite" isIconOnly icon={<Icon icon={icons.star} />} isPressed={liked} onPressedChange={setLiked} />
        </Row>
      </Preview>

      <Preview align="start" label="Sizes">
        <Row>
          {SIZES.map((size) => (
            <ToggleButton
              key={size}
              size={size}
              label={`${size.toUpperCase()} toggle`}
              icon={<Icon icon={icons.sparkle} />}
              isPressed={sizes[size]}
              onPressedChange={(on) => setSizes((c) => ({ ...c, [size]: on }))}
            />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="States">
        <Row>
          <ToggleButton label="Off" isPressed={false} onPressedChange={() => {}} />
          <ToggleButton label="On" isPressed onPressedChange={() => {}} />
          <ToggleButton label="Disabled off" isPressed={false} isDisabled onPressedChange={() => {}} />
          <ToggleButton label="Disabled on" isPressed isDisabled onPressedChange={() => {}} />
          <ToggleButton label="Loading" isPressed={false} isLoading onPressedChange={() => {}} />
        </Row>
      </Preview>

      <Preview align="start" label="Async" description="pressedChangeAction shows a spinner while the change saves.">
        <Stack gap={2} hAlign="start">
          <ToggleButton
            label={watching ? "Watching room" : "Watch room"}
            icon={<Icon icon={icons.eye} />}
            isPressed={watching}
            pressedChangeAction={async (on) => {
              await new Promise((resolve) => setTimeout(resolve, SYNC_MS));
              setWatching(on);
            }}
          />
          <Caption>{watching ? "You’ll be notified about new bids." : "Not watching."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Elevation">
        <Row>
          <ToggleButton label="Floating" elevation="med" isIconOnly icon={<Icon icon={icons.star} />} isPressed={liked} onPressedChange={setLiked} />
          <ToggleButton label="Show grid" elevation="low" icon={<Icon icon={icons.grid} />} isPressed={visible} onPressedChange={setVisible} />
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — independent formatting" description="Each toggle is its own on/off. For one-of-many, use a ToggleButtonGroup or SegmentedControl.">
        <Stack gap={2} hAlign="start">
          <Row>
            {(["bold", "italic", "underline"] as const).map((key) => (
              <ToggleButton
                key={key}
                label={key[0].toUpperCase() + key.slice(1)}
                tooltip={key}
                isIconOnly
                icon={<Icon icon={icons[key]} />}
                isPressed={format[key]}
                onPressedChange={(on) => setFormat((c) => ({ ...c, [key]: on }))}
              />
            ))}
          </Row>
          <Caption>
            Active: {Object.entries(format).filter(([, on]) => on).map(([k]) => k).join(", ") || "none"}
          </Caption>
        </Stack>
      </Preview>
    </Examples>
  );
}
