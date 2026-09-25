"use client";

import { useState } from "react";
import { Button, ButtonGroup, DropdownMenu, Icon, IconButton, Stack, icons, type ButtonSize } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const PAGE_COUNT = 5;

export default function ButtonGroupDemo() {
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(2);
  const [merge, setMerge] = useState("Merge");

  return (
    <Examples>
      <Preview align="start" label="Connected actions" description="Related buttons share one surface and a single hairline divider.">
        <Row>
          <ButtonGroup label="History">
            <Button label="Undo" icon={<Icon icon={icons.undo} />} />
            <Button label="Redo" icon={<Icon icon={icons.redo} />} />
          </ButtonGroup>
          <ButtonGroup label="File actions">
            <Button label="Import" />
            <Button label="Export" />
            <Button label="Print" />
          </ButtonGroup>
        </Row>
      </Preview>

      <Preview align="start" label="Variants" description="Every child keeps its own variant; ghost reads as a quiet toolbar.">
        <Stack gap={3} hAlign="start">
          <ButtonGroup label="Primary group">
            <Button label="Publish" variant="primary" />
            <Button label="Schedule" variant="primary" />
          </ButtonGroup>
          <ButtonGroup label="Ghost group">
            <Button label="Day" variant="ghost" />
            <Button label="Week" variant="ghost" />
            <Button label="Month" variant="ghost" />
          </ButtonGroup>
        </Stack>
      </Preview>

      <Preview align="start" label="Sizes" description="The group sets a default size for every child.">
        <Stack gap={3} hAlign="start">
          {SIZES.map((size) => (
            <ButtonGroup key={size} label={`${size} group`} size={size}>
              <Button label="Left" icon={<Icon icon={icons.alignLeft} />} />
              <Button label="Center" icon={<Icon icon={icons.alignCenter} />} />
              <Button label="Right" icon={<Icon icon={icons.alignRight} />} />
            </ButtonGroup>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Icon only">
        <Row>
          <ButtonGroup label="Text style">
            <IconButton label="Bold" tooltip="Bold" icon={<Icon icon={icons.bold} />} />
            <IconButton label="Italic" tooltip="Italic" icon={<Icon icon={icons.italic} />} />
            <IconButton label="Underline" tooltip="Underline" icon={<Icon icon={icons.underline} />} />
            <IconButton label="Strikethrough" tooltip="Strikethrough" icon={<Icon icon={icons.strike} />} />
          </ButtonGroup>
          <ButtonGroup label="Media">
            <IconButton label="Play" icon={<Icon icon={icons.play} />} />
            <IconButton label="Pause" icon={<Icon icon={icons.pause} />} />
          </ButtonGroup>
        </Row>
      </Preview>

      <Preview align="start" label="Vertical">
        <Row>
          <ButtonGroup label="Map zoom" orientation="vertical">
            <IconButton label="Zoom in" icon={<Icon icon={icons.plus} />} />
            <IconButton label="Zoom out" icon={<Icon icon={icons.minus} />} />
          </ButtonGroup>
          <ButtonGroup label="Stacked actions" orientation="vertical">
            <Button label="Approve" />
            <Button label="Request changes" />
            <Button label="Decline" />
          </ButtonGroup>
        </Row>
      </Preview>

      <Preview align="start" label="Split button" description="A default action plus a menu of alternatives.">
        <Stack gap={2} hAlign="start">
          <ButtonGroup label="Merge options">
            <Button label={merge} variant="primary" />
            <DropdownMenu
              button={{ label: "More merge options", variant: "primary", isIconOnly: true, icon: <Icon icon={icons.chevronDown} /> }}
              hasChevron={false}
              items={[
                { label: "Merge", onClick: () => setMerge("Merge") },
                { label: "Squash and merge", onClick: () => setMerge("Squash and merge") },
                { label: "Rebase and merge", onClick: () => setMerge("Rebase and merge") },
              ]}
            />
          </ButtonGroup>
          <Caption>Pick an option to change the default action.</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Pattern — pager">
        <Stack gap={2} hAlign="start">
          <ButtonGroup label="Pages" size="sm">
            <IconButton label="Previous page" icon={<Icon icon={icons.chevronLeft} />} isDisabled={page === 1} onClick={() => setPage(page - 1)} />
            {Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).map((n) => (
              <Button key={n} label={String(n)} variant={n === page ? "primary" : "secondary"} onClick={() => setPage(n)} />
            ))}
            <IconButton label="Next page" icon={<Icon icon={icons.chevronRight} />} isDisabled={page === PAGE_COUNT} onClick={() => setPage(page + 1)} />
          </ButtonGroup>
          <Caption>Page {page} of {PAGE_COUNT}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Pattern — quantity">
        <ButtonGroup label="Seats">
          <IconButton label="Remove a seat" icon={<Icon icon={icons.minus} />} isDisabled={count <= 1} onClick={() => setCount(count - 1)} />
          <Button label={`${count} seats`} />
          <IconButton label="Add a seat" icon={<Icon icon={icons.plus} />} onClick={() => setCount(count + 1)} />
        </ButtonGroup>
      </Preview>

      <Preview align="start" label="Disabled group">
        <ButtonGroup label="Locked actions" isDisabled>
          <Button label="Approve" />
          <Button label="Reject" />
        </ButtonGroup>
      </Preview>

      <Preview align="start" label="Elevated" description="The whole group lifts as one surface.">
        <ButtonGroup label="Floating controls" elevation="med">
          <IconButton label="Previous" icon={<Icon icon={icons.arrowLeft} />} />
          <Button label="3 of 12" />
          <IconButton label="Next" icon={<Icon icon={icons.arrowRight} />} />
        </ButtonGroup>
      </Preview>
    </Examples>
  );
}
