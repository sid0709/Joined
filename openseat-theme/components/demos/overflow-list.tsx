"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  Icon,
  OverflowList,
  Popover,
  Slider,
  Stack,
  Text,
  Token,
  icons,
  type OverflowItem,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

const TAGS = ["Design", "Copy", "Motion", "Research", "Brand", "Packaging", "Illustration", "Web", "Mobile", "Photography"];
const COLORS = ["blue", "purple", "teal", "orange", "pink", "cyan", "yellow", "green", "red", "gray"] as const;
const MIN_WIDTH = 160;
const MAX_WIDTH = 640;

function MoreBadge({ items }: { items: OverflowItem[] }) {
  return <Badge label={`+${items.length}`} />;
}

export default function OverflowListDemo() {
  const [width, setWidth] = useState(360);
  const [hidden, setHidden] = useState(0);

  return (
    <Examples>
      <Preview label="Fits the space" description="Items that don’t fit collapse into a count. Drag the slider to resize the container.">
        <Stack gap={3}>
          <Slider label="Container width" value={width} onChange={setWidth} min={MIN_WIDTH} max={MAX_WIDTH} valueDisplay="text" formatValue={(v) => `${v}px`} />
          <Card width={width}>
            <OverflowList gap={1} overflowRenderer={(items) => <MoreBadge items={items} />} onOverflowChange={(items) => setHidden(items.length)}>
              {TAGS.map((t, i) => (
                <Badge key={t} label={t} variant={COLORS[i]} />
              ))}
            </OverflowList>
          </Card>
          <Caption>{hidden} hidden</Caption>
        </Stack>
      </Preview>

      <Preview label="Overflow menu" description="Show the hidden items in a popover instead of just counting them.">
        <Card width={width}>
          <OverflowList
            gap={1}
            overflowRenderer={(items) => (
              <Popover
                width={220}
                label="Hidden tags"
                content={
                  <HStack gap={1} wrap="wrap">
                    {items.map(({ child, index }) => (
                      <span key={index}>{child}</span>
                    ))}
                  </HStack>
                }
              >
                <Button label={`+${items.length} more`} size="sm" variant="ghost" />
              </Popover>
            )}
          >
            {TAGS.map((t) => (
              <Token key={t} label={t} size="sm" />
            ))}
          </OverflowList>
        </Card>
      </Preview>

      <Preview label="Collapse from the start" description="collapseFrom=&quot;start&quot; keeps the latest items — useful for breadcrumbs and activity.">
        <Card width={width}>
          <OverflowList gap={1} collapseFrom="start" overflowRenderer={(items) => <MoreBadge items={items} />}>
            {TAGS.map((t) => (
              <Badge key={t} label={t} />
            ))}
          </OverflowList>
        </Card>
      </Preview>

      <Preview label="Limits" description="minVisibleItems always shows a few; maxVisibleItems caps them even with room to spare; maxRows allows wrapping.">
        <Stack gap={3}>
          <Card width={width}>
            <OverflowList gap={1} maxVisibleItems={3} overflowRenderer={(items) => <MoreBadge items={items} />}>
              {TAGS.map((t) => (
                <Badge key={t} label={t} />
              ))}
            </OverflowList>
          </Card>
          <Card width={width}>
            <OverflowList gap={1} maxRows={2} overflowRenderer={(items) => <MoreBadge items={items} />}>
              {TAGS.map((t, i) => (
                <Badge key={t} label={t} variant={COLORS[i]} />
              ))}
            </OverflowList>
          </Card>
        </Stack>
      </Preview>

      <Preview label="People and actions" description="Any children — avatars in a header, or buttons in a toolbar that folds into a menu.">
        <Stack gap={3}>
          <Card width={width}>
            <HStack gap={2} vAlign="center">
              <Text type="label">Invited</Text>
              <OverflowList gap={1} overflowRenderer={(items) => <Badge label={`+${items.length}`} variant="info" />}>
                {PEOPLE.map((p) => (
                  <Avatar key={p.name} name={p.name} size="sm" />
                ))}
              </OverflowList>
            </HStack>
          </Card>
          <Card width={width}>
            <OverflowList gap={1} overflowRenderer={(items) => <Button label={`${items.length} more`} size="sm" variant="ghost" icon={<Icon icon="moreHorizontal" />} />}>
              <Button label="Share" size="sm" icon={<Icon icon={icons.share} />} />
              <Button label="Duplicate" size="sm" icon={<Icon icon={icons.plus} />} />
              <Button label="Export" size="sm" icon={<Icon icon={icons.download} />} />
              <Button label="Archive" size="sm" icon={<Icon icon={icons.folder} />} />
              <Button label="Delete" size="sm" variant="destructive" icon={<Icon icon={icons.trash} />} />
            </OverflowList>
          </Card>
        </Stack>
      </Preview>
    </Examples>
  );
}
