"use client";

import { useId, useState } from "react";
import {
  Field,
  FieldStatus,
  HStack,
  Icon,
  Rating,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
  TextInput,
  icons,
  type FieldStatusVariant,
} from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const FIELD_WIDTH = 360;
const VARIANTS: FieldStatusVariant[] = ["attached", "detached", "tooltip"];

export default function FieldDemo() {
  const ids = {
    urgency: useId(),
    rating: useId(),
    size: useId(),
    hidden: useId(),
  };
  const [urgency, setUrgency] = useState("normal");
  const [score, setScore] = useState(0);
  const [size, setSize] = useState("md");
  const [name, setName] = useState("");

  return (
    <Examples>
      <Preview align="start" label="Wrap any control" description="Field gives a custom control the same label, description, and status as built-in inputs.">
        <Stack gap={4} width={FIELD_WIDTH}>
          <Field label="Urgency" inputID={ids.urgency} description="How soon do you need bids?">
            <SegmentedControl label="Urgency" value={urgency} onChange={setUrgency}>
              <SegmentedControlItem value="low" label="Low" />
              <SegmentedControlItem value="normal" label="Normal" />
              <SegmentedControlItem value="high" label="High" />
            </SegmentedControl>
          </Field>
          <Field
            label="Rate the bidder"
            inputID={ids.rating}
            isRequired
            status={score === 0 ? { type: "error", message: "Pick at least one star." } : { type: "success", message: "Thanks for the feedback." }}
          >
            <Rating value={score} onChange={setScore} label="Rate the bidder" />
          </Field>
        </Stack>
      </Preview>

      <Preview align="start" label="Label options" description="Optional and required markers, an icon, and a tooltip for the fine print.">
        <Stack gap={4} width={FIELD_WIDTH}>
          <TextInput label="Nickname" isOptional value={name} onChange={setName} />
          <TextInput label="Legal name" isRequired value={name} onChange={setName} />
          <Field label="Room size" inputID={ids.size} labelIcon={<Icon icon={icons.user} size="sm" />} labelTooltip="How many people you’ll invite.">
            <SegmentedControl label="Room size" value={size} onChange={setSize}>
              <SegmentedControlItem value="sm" label="1–3" />
              <SegmentedControlItem value="md" label="4–8" />
              <SegmentedControlItem value="lg" label="9+" />
            </SegmentedControl>
          </Field>
        </Stack>
      </Preview>

      <Preview align="start" label="Status placement" description="attached sits under the control, detached leaves a gap, tooltip saves space in dense forms.">
        <Stack gap={4} width={FIELD_WIDTH}>
          {VARIANTS.map((variant) => (
            <TextInput key={variant} label={`statusVariant="${variant}"`} value="2400" onChange={() => undefined} statusVariant={variant} status={{ type: "warning", message: "Above the typical budget for this category." }} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Status types" description="FieldStatus on its own — for messages that belong to a whole group.">
        <Stack gap={2}>
          <FieldStatus type="error" message="Two fields need attention." />
          <FieldStatus type="warning" message="Unsaved changes." />
          <FieldStatus type="success" message="All fields look good." />
        </Stack>
      </Preview>

      <Preview align="start" label="Hidden label" description="isLabelHidden keeps the label for screen readers when the layout already names the control.">
        <HStack gap={3} vAlign="center">
          <Text weight="semibold">Priority</Text>
          <Field label="Priority" inputID={ids.hidden} isLabelHidden>
            <SegmentedControl label="Priority" size="sm" value={urgency} onChange={setUrgency}>
              <SegmentedControlItem value="low" label="Low" />
              <SegmentedControlItem value="normal" label="Normal" />
              <SegmentedControlItem value="high" label="High" />
            </SegmentedControl>
          </Field>
        </HStack>
      </Preview>

      <Preview align="start" label="Disabled" description="Disables the label with the control and says why.">
        <Stack width={FIELD_WIDTH}>
          <TextInput label="Workspace" value="Northwind" onChange={() => undefined} isDisabled disabledMessage="Managed by your organization." />
        </Stack>
      </Preview>
    </Examples>
  );
}
