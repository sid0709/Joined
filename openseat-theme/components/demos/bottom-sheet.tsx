"use client";

import { useState } from "react";
import {
  Avatar,
  BottomSheet,
  BottomSheetSwitcher,
  Button,
  HStack,
  Icon,
  List,
  ListItem,
  RadioList,
  RadioListItem,
  Stack,
  Text,
  TextInput,
  icons,
  type BottomSheetHeight,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

const HEIGHTS: BottomSheetHeight[] = ["hug", "capped", "tall"];
const SHARE = [
  { label: "Copy link", icon: icons.link },
  { label: "Email", icon: icons.mail },
  { label: "Download PDF", icon: icons.download },
];

export default function BottomSheetDemo() {
  const [open, setOpen] = useState<BottomSheetHeight | null>(null);
  const [share, setShare] = useState(false);
  const [snap, setSnap] = useState(false);
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState("newest");
  const [active, setActive] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  return (
    <Examples>
      <Preview align="start" label="Heights" description="hug fits the content, capped stops at half the screen, tall nearly fills it.">
        <Row>
          {HEIGHTS.map((h) => (
            <Button key={h} label={h} onClick={() => setOpen(h)} />
          ))}
        </Row>
        {HEIGHTS.map((h) => (
          <BottomSheet key={h} label={`${h} sheet`} height={h} isOpen={open === h} onOpenChange={(o) => setOpen(o ? h : null)}>
            <Stack gap={2} padding={4}>
              <Text weight="semibold">height=&quot;{h}&quot;</Text>
              {Array.from({ length: h === "hug" ? 2 : 12 }, (_, i) => (
                <Text key={i} color="secondary">
                  Row {i + 1}
                </Text>
              ))}
            </Stack>
          </BottomSheet>
        ))}
      </Preview>

      <Preview align="start" label="Action sheet" description="A short list of actions — the mobile answer to a menu.">
        <Row>
          <Button label="Share room" icon={<Icon icon={icons.share} />} onClick={() => setShare(true)} />
        </Row>
        <BottomSheet label="Share room" isOpen={share} onOpenChange={setShare}>
          <List hasDividers>
            {SHARE.map((s) => (
              <ListItem key={s.label} label={s.label} startContent={<Icon icon={s.icon} />} onClick={() => setShare(false)} />
            ))}
          </List>
        </BottomSheet>
      </Preview>

      <Preview align="start" label="Snap points" description="Drag between a peek, half, and full height.">
        <Row>
          <Button label="Open with snap points" onClick={() => setSnap(true)} />
        </Row>
        <BottomSheet label="Nearby rooms" isOpen={snap} onOpenChange={setSnap} snapPoints={["25%", "50%", "90%"]}>
          <Stack gap={2} padding={4}>
            <Text weight="semibold">Drag the handle</Text>
            {Array.from({ length: 15 }, (_, i) => (
              <Text key={i} color="secondary">
                Room #{1040 + i}
              </Text>
            ))}
          </Stack>
        </BottomSheet>
      </Preview>

      <Preview align="start" label="Filters" description="A form in a sheet — sort and filter a list on small screens.">
        <Row>
          <Button label="Sort and filter" icon={<Icon icon={icons.filter} />} onClick={() => setFilters(true)} />
          <Caption>Sorted by {sort}</Caption>
        </Row>
        <BottomSheet label="Sort and filter" isOpen={filters} onOpenChange={setFilters} purpose="form">
          <Stack gap={4} padding={4}>
            <RadioList label="Sort by" value={sort} onChange={setSort}>
              <RadioListItem value="newest" label="Newest" />
              <RadioListItem value="closing" label="Closing soon" />
              <RadioListItem value="budget" label="Highest budget" />
            </RadioList>
            <Button label="Apply" variant="primary" onClick={() => setFilters(false)} />
          </Stack>
        </BottomSheet>
      </Preview>

      <Preview align="start" label="Switching sheets" description="BottomSheetSwitcher moves between related sheets without closing — pick a person, then confirm.">
        <Row>
          <Button label="Assign reviewer" icon={<Icon icon={icons.users} />} onClick={() => setActive("people")} />
          <Caption>{picked ? `Reviewer: ${picked}` : "No reviewer"}</Caption>
        </Row>
        <BottomSheetSwitcher activeSheet={active} onActiveSheetChange={setActive}>
          <BottomSheet sheetId="people" label="Choose a reviewer">
            <Stack gap={3} padding={4}>
              <TextInput label="Search people" isLabelHidden placeholder="Search people" value={query} onChange={setQuery} startIcon={<Icon icon={icons.search} />} />
              <List>
                {PEOPLE.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).map((p) => (
                  <ListItem
                    key={p.name}
                    label={p.name}
                    description={p.role}
                    startContent={<Avatar name={p.name} size="sm" tooltip={false} />}
                    onClick={() => {
                      setPicked(p.name);
                      setActive("confirm");
                    }}
                  />
                ))}
              </List>
            </Stack>
          </BottomSheet>
          <BottomSheet sheetId="confirm" label="Confirm reviewer">
            <Stack gap={3} padding={4}>
              <Text>Assign {picked} to review Brand refresh?</Text>
              <HStack gap={2}>
                <Button label="Back" variant="ghost" onClick={() => setActive("people")} />
                <Button label="Assign" variant="primary" onClick={() => setActive(null)} />
              </HStack>
            </Stack>
          </BottomSheet>
        </BottomSheetSwitcher>
      </Preview>
    </Examples>
  );
}
