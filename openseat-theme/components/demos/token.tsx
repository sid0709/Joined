"use client";

import { useState } from "react";
import { Avatar, Button, Icon, Stack, Text, Token, icons, type TokenColor, type TokenSize } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SIZES: TokenSize[] = ["sm", "md", "lg"];
const COLORS: TokenColor[] = ["default", "gray", "red", "orange", "yellow", "green", "teal", "cyan", "blue", "purple", "pink"];
const TAGS = ["Design", "Copy", "Motion", "Research", "Brand"];
const FILTERS = [
  { id: "open", label: "Open", count: 12 },
  { id: "sealed", label: "Sealed", count: 8 },
  { id: "closing", label: "Closing soon", count: 3 },
  { id: "awarded", label: "Awarded", count: 21 },
];

export default function TokenDemo() {
  const [tags, setTags] = useState(TAGS);
  const [active, setActive] = useState<string[]>(["open"]);

  const toggle = (id: string) => setActive((all) => (all.includes(id) ? all.filter((a) => a !== id) : [...all, id]));

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="sm for dense tables, md default, lg beside large controls.">
        <Row>
          {SIZES.map((size) => (
            <Token key={size} label={`Size ${size}`} size={size} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Colors" description="Color categorizes. It never replaces the label.">
        <Row>
          {COLORS.map((color) => (
            <Token key={color} label={color} color={color} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="With an icon" description="A leading icon or avatar names the kind of entity.">
        <Row>
          <Token label="Sealed" icon={<Icon icon={icons.lock} />} color="blue" />
          <Token label="Due Friday" icon={<Icon icon="calendar" />} color="orange" />
          <Token label="brief.pdf" icon={<Icon icon={icons.file} />} />
          <Token label="Jordan Miles" icon={<Avatar name="Jordan Miles" size={16} tooltip={false} />} />
          <Token label="Featured" icon={<Icon icon={icons.star} />} color="yellow" />
        </Row>
      </Preview>

      <Preview align="start" label="Removable" description="onRemove adds an X button labelled with the token.">
        <Stack gap={3} hAlign="start">
          <Row>
            {tags.map((tag) => (
              <Token key={tag} label={tag} onRemove={() => setTags((all) => all.filter((t) => t !== tag))} />
            ))}
            {tags.length === 0 && <Caption>No tags.</Caption>}
          </Row>
          <Row>
            {SIZES.map((size) => (
              <Token key={size} label={`Removable ${size}`} size={size} color="purple" onRemove={() => undefined} />
            ))}
          </Row>
          <Button label="Reset tags" size="sm" variant="ghost" onClick={() => setTags(TAGS)} />
        </Stack>
      </Preview>

      <Preview align="start" label="Clickable filters" description="onClick makes the whole token a button. Toggle color to show the active state.">
        <Stack gap={2} hAlign="start">
          <Row>
            {FILTERS.map((filter) => (
              <Token
                key={filter.id}
                label={filter.label}
                color={active.includes(filter.id) ? "blue" : "default"}
                icon={active.includes(filter.id) ? <Icon icon={icons.check} /> : undefined}
                endContent={<Text type="supporting" color="inherit">{filter.count}</Text>}
                onClick={() => toggle(filter.id)}
              />
            ))}
          </Row>
          <Caption>{active.length ? `Showing: ${active.join(", ")}` : "No filters applied."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Links" description="href renders an anchor; it can still be removable.">
        <Row>
          <Token label="Room #1043" href="#room-1043" icon={<Icon icon={icons.seat} />} />
          <Token label="Northwind" href="#northwind" color="teal" />
          <Token label="Linked and removable" href="#linked" onRemove={() => undefined} />
        </Row>
      </Preview>

      <Preview align="start" label="End content" description="Counts or hints after the label, before the remove button.">
        <Row>
          <Token label="Bids" endContent={<Text type="supporting" color="inherit">6</Text>} />
          <Token label="Invitees" color="green" endContent={<Text type="supporting" color="inherit">3/5</Text>} onRemove={() => undefined} />
        </Row>
      </Preview>

      <Preview align="start" label="Disabled">
        <Row>
          <Token label="Archived" isDisabled />
          <Token label="Locked" isDisabled icon={<Icon icon={icons.lock} />} onRemove={() => undefined} />
          <Token label="Unavailable" isDisabled color="red" onClick={() => undefined} />
        </Row>
      </Preview>

      <Preview align="start" label="Icon only" description="isLabelHidden keeps the label for screen readers; description adds context.">
        <Row>
          <Token label="Sealed" isLabelHidden icon={<Icon icon={icons.lock} />} description="Bids are hidden until the deadline" />
          <Token label="Pinned" isLabelHidden icon={<Icon icon={icons.pin} />} color="purple" />
          <Token label="Favorite" isLabelHidden icon={<Icon icon={icons.heart} />} color="pink" />
        </Row>
      </Preview>
    </Examples>
  );
}
