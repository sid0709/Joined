"use client";

import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Card, HStack, Heading, Skeleton, Stack, Text } from "@openseat/design-system";
import { Examples, PEOPLE, Preview } from "./shared";

const LOAD_MS = 1600;
const CARD_WIDTH = 260;
const ROWS = 4;

function useFakeLoad() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), LOAD_MS);
    return () => clearTimeout(id);
  }, [loading]);
  return { loading, reload: () => setLoading(true) };
}

export default function SkeletonDemo() {
  const card = useFakeLoad();
  const list = useFakeLoad();

  return (
    <Examples>
      <Preview label="Shapes" description="Width and height draw any block; radius=&quot;rounded&quot; softens it, none keeps it square.">
        <Stack gap={3}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="85%" height={12} />
          <HStack gap={3}>
            <Skeleton width={48} height={48} radius="rounded" />
            <Skeleton width={48} height={48} radius="none" />
            <Skeleton width={120} height={32} radius="rounded" />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Staggered shimmer" description="index offsets each block’s animation so a list shimmers as a wave.">
        <Stack gap={2}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} index={index} height={14} width={`${90 - index * 8}%`} />
          ))}
        </Stack>
      </Preview>

      <Preview label="Card placeholder" description="Match the real layout so nothing jumps when data arrives.">
        <Stack gap={3}>
          <HStack gap={3} wrap="wrap" vAlign="stretch">
            {PEOPLE.slice(0, 3).map((person, index) => (
              <Card key={person.name} width={CARD_WIDTH}>
                {card.loading ? (
                  <Stack gap={3}>
                    <HStack gap={2} vAlign="center">
                      <Skeleton index={index} width={36} height={36} radius="rounded" />
                      <Stack gap={1} width="100%">
                        <Skeleton index={index} width="70%" height={14} />
                        <Skeleton index={index} width="40%" height={10} />
                      </Stack>
                    </HStack>
                    <Skeleton index={index} height={10} />
                    <Skeleton index={index} height={10} width="80%" />
                  </Stack>
                ) : (
                  <Stack gap={3}>
                    <HStack gap={2} vAlign="center">
                      <Avatar name={person.name} />
                      <Stack gap={0}>
                        <Text weight="semibold">{person.name}</Text>
                        <Text type="supporting" color="secondary">
                          {person.role}
                        </Text>
                      </Stack>
                    </HStack>
                    <Text color="secondary">Bid $2,{400 + index * 150} · delivers in {10 + index * 3} days.</Text>
                  </Stack>
                )}
              </Card>
            ))}
          </HStack>
          <HStack>
            <Button label="Reload" size="sm" variant="ghost" onClick={card.reload} isDisabled={card.loading} />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Table rows" description="Row-shaped skeletons keep column widths stable.">
        <Card>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>Rooms</Heading>
              <Button label="Reload" size="sm" variant="ghost" onClick={list.reload} isDisabled={list.loading} />
            </HStack>
            {Array.from({ length: ROWS }, (_, index) =>
              list.loading ? (
                <HStack key={index} gap={4} vAlign="center">
                  <Skeleton index={index} width="35%" height={14} />
                  <Skeleton index={index} width="20%" height={14} />
                  <Skeleton index={index} width={64} height={20} radius="rounded" />
                </HStack>
              ) : (
                <HStack key={index} gap={4} vAlign="center">
                  <Stack width="35%">
                    <Text>{["Brand refresh", "Landing page", "Motion system", "Pitch deck"][index]}</Text>
                  </Stack>
                  <Stack width="20%">
                    <Text color="secondary" hasTabularNumbers>
                      {[6, 2, 0, 11][index]} bids
                    </Text>
                  </Stack>
                  <Badge label={["Open", "Review", "Draft", "Awarded"][index]} variant={(["success", "warning", "neutral", "info"] as const)[index]} />
                </HStack>
              ),
            )}
          </Stack>
        </Card>
      </Preview>

      <Preview label="Article" description="Hero image, title, and paragraph lines.">
        <Stack gap={3} maxWidth={480}>
          <Skeleton height={160} radius="rounded" />
          <Skeleton height={24} width="70%" />
          <Stack gap={2}>
            {[100, 96, 92, 60].map((w, index) => (
              <Skeleton key={w} index={index} height={12} width={`${w}%`} />
            ))}
          </Stack>
        </Stack>
      </Preview>
    </Examples>
  );
}
