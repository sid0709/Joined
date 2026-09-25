"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
  Token,
  Tokenizer,
  createStaticSource,
  icons,
  type SearchableItem,
  type TokenizerOverflowBehavior,
  type TokenizerSize,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

type Person = SearchableItem<{ role: string }>;

const SIZES: TokenizerSize[] = ["sm", "md", "lg"];
const OVERFLOW: TokenizerOverflowBehavior[] = ["none", "unfocusedInline", "unfocusedLayer"];
const FIELD_WIDTH = 380;
const MAX_INVITES = 3;

const PEOPLE_ITEMS: Person[] = PEOPLE.map((p) => ({ id: p.name, label: p.name, auxiliaryData: { role: p.role } }));
const SKILLS: SearchableItem[] = ["Branding", "Packaging", "Motion", "Copywriting", "Illustration", "UI design", "Research", "Photography", "Web", "Mobile"].map((s) => ({ id: s, label: s }));

export default function TokenizerDemo() {
  const peopleSource = useMemo(() => createStaticSource(PEOPLE_ITEMS, { keywords: (p) => [p.auxiliaryData?.role ?? ""] }), []);
  const skillSource = useMemo(() => createStaticSource(SKILLS), []);

  const [sizes, setSizes] = useState<Record<TokenizerSize, SearchableItem[]>>({ sm: SKILLS.slice(0, 2), md: SKILLS.slice(0, 2), lg: SKILLS.slice(0, 2) });
  const [invitees, setInvitees] = useState<Person[]>(PEOPLE_ITEMS.slice(0, 2));
  const [capped, setCapped] = useState<Person[]>([]);
  const [tags, setTags] = useState<SearchableItem[]>([SKILLS[0]]);
  const [overflow, setOverflow] = useState<SearchableItem[]>(SKILLS.slice(0, 7));
  const [log, setLog] = useState<string[]>([]);

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="Search a list and turn each pick into a token.">
        <Stack gap={3} width={FIELD_WIDTH}>
          {SIZES.map((size) => (
            <Tokenizer key={size} size={size} label={`Size ${size}`} searchSource={skillSource} value={sizes[size]} onChange={(items) => setSizes((c) => ({ ...c, [size]: items }))} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="People with avatars" description="renderItem draws menu rows; keywords let a role find a person.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <Tokenizer
            label="Invite people"
            description="Try typing “designer”."
            searchSource={peopleSource}
            value={invitees}
            onChange={(items, change) => {
              setInvitees(items);
              const entry = change.type === "reorder" ? "Reordered" : `${change.type === "remove" ? "Removed" : "Added"} ${change.item.label}`;
              setLog((l) => [entry, ...l].slice(0, 3));
            }}
            hasEntriesOnFocus
            placeholder="Search by name or role"
            startIcon={<Icon icon={icons.user} />}
            renderItem={(p) => (
              <HStack gap={2} vAlign="center">
                <Avatar name={p.label} size="xsm" tooltip={false} />
                <Stack gap={0}>
                  <Text>{p.label}</Text>
                  <Text type="supporting" color="secondary">
                    {p.auxiliaryData?.role}
                  </Text>
                </Stack>
              </HStack>
            )}
          />
          <Caption>{log.length ? log.join(" · ") : "onChange reports each add and remove."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Custom tokens" description="renderToken swaps the chip — here, an avatar token.">
        <Stack width={FIELD_WIDTH}>
          <Tokenizer
            label="Reviewers"
            searchSource={peopleSource}
            value={invitees}
            onChange={setInvitees}
            renderToken={(p, onRemove) => <Token label={p.label} icon={<Avatar name={p.label} size={16} tooltip={false} />} onRemove={onRemove} color="blue" size="sm" />}
          />
        </Stack>
      </Preview>

      <Preview align="start" label="Limit and create" description="maxEntries caps the list; hasCreate turns unknown text into a new token.">
        <Stack gap={4} width={FIELD_WIDTH}>
          <Tokenizer
            label={`Shortlist (max ${MAX_INVITES})`}
            searchSource={peopleSource}
            value={capped}
            onChange={setCapped}
            maxEntries={MAX_INVITES}
            status={capped.length === MAX_INVITES ? { type: "warning", message: "Shortlist is full." } : undefined}
          />
          <Tokenizer label="Tags" searchSource={skillSource} value={tags} onChange={setTags} hasCreate hasClear description="Type a new tag and press Enter." />
        </Stack>
      </Preview>

      <Preview align="start" label="Overflow" description="When not focused, extra tokens can stay on one line, collapse inline, or open in a layer.">
        <Stack gap={4} width={FIELD_WIDTH}>
          {OVERFLOW.map((behavior) => (
            <Tokenizer key={behavior} label={behavior} searchSource={skillSource} value={overflow} onChange={setOverflow} tokenOverflowBehavior={behavior} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Disabled">
        <Stack width={FIELD_WIDTH}>
          <Tokenizer label="Required skills" searchSource={skillSource} value={SKILLS.slice(0, 3)} onChange={() => undefined} isDisabled disabledMessage="Locked once bidding opens." />
        </Stack>
      </Preview>

      <Preview label="Invite flow" description="A tokenizer with an action beside it — the heart of opening a room.">
        <Card maxWidth={480}>
          <Stack gap={3}>
            <Heading level={4}>Who should bid?</Heading>
            <Tokenizer
              label="Invitees"
              isLabelHidden
              searchSource={peopleSource}
              value={invitees}
              onChange={setInvitees}
              placeholder="Add people"
              endContent={<Text type="supporting" color="secondary">{invitees.length}</Text>}
            />
            <HStack hAlign="between" vAlign="center">
              <Caption>Each invitee gets a private link.</Caption>
              <Button label={`Send ${invitees.length} invite${invitees.length === 1 ? "" : "s"}`} variant="primary" isDisabled={!invitees.length} icon={<Icon icon={icons.send} />} />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
