"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  CheckboxInput,
  Divider,
  HStack,
  Icon,
  IconButton,
  Link,
  Popover,
  Stack,
  Switch,
  Text,
  TextInput,
  icons,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

const PLACEMENTS = ["above", "below", "start", "end"] as const;
const STATUSES = ["Open", "Review", "Awarded", "Archived"];

export default function PopoverDemo() {
  const [statuses, setStatuses] = useState<string[]>(["Open"]);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  return (
    <Examples>
      <Preview align="start" label="Placement" description="Opens on click and stays until dismissed — unlike a tooltip.">
        <Row>
          {PLACEMENTS.map((placement) => (
            <Popover key={placement} placement={placement} label={`Placed ${placement}`} content={<Text>Placed {placement}.</Text>}>
              <Button label={placement} />
            </Popover>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Filter panel" description="A small form in a popover — checkboxes and a clear action.">
        <Row>
          <Popover
            width={240}
            label="Filter by status"
            content={
              <Stack gap={2}>
                <Text type="label">Status</Text>
                {STATUSES.map((s) => (
                  <CheckboxInput key={s} label={s} value={statuses.includes(s)} onChange={(on) => setStatuses((c) => (on ? [...c, s] : c.filter((x) => x !== s)))} />
                ))}
                <Divider />
                <Button label="Clear" size="sm" variant="ghost" onClick={() => setStatuses([])} />
              </Stack>
            }
          >
            <Button label="Status" icon={<Icon icon={icons.filter} />} endContent={statuses.length ? <Badge label={statuses.length} variant="info" /> : undefined} />
          </Popover>
          <Caption>{statuses.join(", ") || "All statuses"}</Caption>
        </Row>
      </Preview>

      <Preview align="start" label="Controlled with a close button" description="isOpen and onOpenChange let a form close its own popover on save.">
        <Row>
          <Popover
            isOpen={open}
            onOpenChange={setOpen}
            hasCloseButton
            width={320}
            label="Add a link"
            content={
              <Stack gap={3}>
                <TextInput label="URL" value={link} onChange={setLink} placeholder="https://" hasAutoFocus />
                <HStack hAlign="end">
                  <Button
                    label="Save"
                    size="sm"
                    variant="primary"
                    isDisabled={!link}
                    onClick={() => {
                      setSaved(link);
                      setOpen(false);
                    }}
                  />
                </HStack>
              </Stack>
            }
          >
            <Button label="Add link" icon={<Icon icon={icons.link} />} />
          </Popover>
          {saved && <Link href={saved}>{saved}</Link>}
        </Row>
      </Preview>

      <Preview align="start" label="Profile menu" description="Rich content — identity, a setting, and links.">
        <Popover
          width={260}
          placement="below"
          alignment="end"
          label="Account"
          content={
            <Stack gap={3}>
              <HStack gap={2} vAlign="center">
                <Avatar name={PEOPLE[0].name} tooltip={false} />
                <Stack gap={0}>
                  <Text weight="semibold">{PEOPLE[0].name}</Text>
                  <Text type="supporting" color="secondary">
                    jordan@northwind.co
                  </Text>
                </Stack>
              </HStack>
              <Divider />
              <Switch label="Email me about bids" value={notify} onChange={setNotify} size="sm" />
              <Divider />
              <Stack gap={1}>
                <Link href="#profile" isStandalone>
                  Profile
                </Link>
                <Link href="#billing" isStandalone>
                  Billing
                </Link>
                <Link href="#signout" isStandalone color="secondary">
                  Sign out
                </Link>
              </Stack>
            </Stack>
          }
        >
          <Button label="Jordan" variant="ghost" icon={<Avatar name={PEOPLE[0].name} size={20} tooltip={false} />} />
        </Popover>
      </Preview>

      <Preview align="start" label="Info popover" description="An icon button that explains a term on click — tappable on touch, unlike a tooltip.">
        <HStack gap={1} vAlign="center">
          <Text>Sealed bidding</Text>
          <Popover width={280} label="Sealed bidding" content={<Text>Nobody sees any bid until the room closes. Then every bid is revealed at once.</Text>}>
            <IconButton label="What is sealed bidding?" variant="ghost" size="sm" icon={<Icon icon="info" />} />
          </Popover>
        </HStack>
      </Preview>

      <Preview align="start" label="Modal popover" description="isModal traps focus and blocks the page until closed.">
        <Popover isModal hasCloseButton width={280} label="Required step" content={<Text>Finish this before you continue.</Text>}>
          <Button label="Open modal popover" />
        </Popover>
      </Preview>
    </Examples>
  );
}
