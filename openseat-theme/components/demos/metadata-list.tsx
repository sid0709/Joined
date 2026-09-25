"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Code,
  HStack,
  Heading,
  Icon,
  Link,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
  Timestamp,
  icons,
} from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const CREATED = "2026-09-18T15:04:00Z";
const CLOSES = "2026-09-26T17:00:00Z";

function RoomDetails() {
  return (
    <>
      <MetadataListItem label="Status">
        <Badge label="Open" variant="success" />
      </MetadataListItem>
      <MetadataListItem label="Budget">$2,400 fixed</MetadataListItem>
      <MetadataListItem label="Owner">
        <HStack gap={2} vAlign="center">
          <Avatar name="Jordan Miles" size="xsm" tooltip={false} />
          <Text>Jordan Miles</Text>
        </HStack>
      </MetadataListItem>
      <MetadataListItem label="Closes">
        <Timestamp value={CLOSES} format="date_time" color="primary" />
      </MetadataListItem>
      <MetadataListItem label="Room ID">
        <Code>room_1043</Code>
      </MetadataListItem>
      <MetadataListItem label="Created">
        <Timestamp value={CREATED} format="date" color="primary" />
      </MetadataListItem>
    </>
  );
}

export default function MetadataListDemo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Examples>
      <Preview label="Labels on top" description="The default — label above each value, flowing into columns.">
        <MetadataList>
          <RoomDetails />
        </MetadataList>
      </Preview>

      <Preview label="Labels at the start" description="label position start with a fixed width lines values up in one column.">
        <Card maxWidth={420}>
          <MetadataList columns="single" label={{ position: "start", width: 120 }}>
            <RoomDetails />
          </MetadataList>
        </Card>
      </Preview>

      <Preview label="Fixed columns" description="columns as a number, for dashboards with a known grid.">
        <MetadataList columns={3} title={<Heading level={4}>Room summary</Heading>}>
          <RoomDetails />
        </MetadataList>
      </Preview>

      <Preview label="Horizontal" description="A single row of key facts — the header of a detail page.">
        <MetadataList orientation="horizontal">
          <MetadataListItem label="Bids">6</MetadataListItem>
          <MetadataListItem label="Lowest">$2,150</MetadataListItem>
          <MetadataListItem label="Median">$2,600</MetadataListItem>
          <MetadataListItem label="Closes">Fri, 5 PM</MetadataListItem>
        </MetadataList>
      </Preview>

      <Preview label="With icons" description="icon beside each label for scannable facts.">
        <Card maxWidth={420}>
          <MetadataList columns="single" label={{ position: "start", width: 120 }}>
            <MetadataListItem label="Location" icon={<Icon icon={icons.home} size="sm" />}>
              Portland, OR
            </MetadataListItem>
            <MetadataListItem label="Email" icon={<Icon icon={icons.mail} size="sm" />}>
              <Link href="mailto:dana@example.com">dana@example.com</Link>
            </MetadataListItem>
            <MetadataListItem label="Reply time" icon={<Icon icon={icons.clock} size="sm" />}>
              About 2 days
            </MetadataListItem>
            <MetadataListItem label="Verified" icon={<Icon icon={icons.check} size="sm" />}>
              <Badge label="Identity" variant="success" />
            </MetadataListItem>
          </MetadataList>
        </Card>
      </Preview>

      <Preview label="Show more" description="maxNumOfItems keeps long lists short until people ask for the rest.">
        <Card maxWidth={420}>
          <Stack gap={3}>
            <MetadataList columns="single" label={{ position: "start", width: 120 }} maxNumOfItems={expanded ? undefined : 3}>
              <RoomDetails />
            </MetadataList>
            <Button label={expanded ? "Show less" : "Show all details"} size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)} />
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
