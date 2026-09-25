"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Card,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
  Typeahead,
  createStaticSource,
  icons,
  type SearchSource,
  type SearchableItem,
  type TypeaheadProps,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

type Person = SearchableItem<{ role: string }>;
type Room = SearchableItem<{ budget: number; status: "Open" | "Review" | "Awarded" }>;
type Size = NonNullable<TypeaheadProps<SearchableItem>["size"]>;

const SIZES: Size[] = ["sm", "md", "lg"];
const FIELD_WIDTH = 360;
const LATENCY_MS = 500;
const MIN_QUERY = 2;

const PEOPLE_ITEMS: Person[] = PEOPLE.map((p) => ({ id: p.name, label: p.name, auxiliaryData: { role: p.role } }));
const CITIES: SearchableItem[] = ["Amsterdam", "Austin", "Berlin", "Lagos", "Lisbon", "London", "Mexico City", "Seoul", "Singapore", "Tokyo", "Toronto"].map((c) => ({ id: c, label: c }));
const ROOMS: Room[] = [
  { id: "brand", label: "Brand refresh", auxiliaryData: { budget: 2400, status: "Open" } },
  { id: "landing", label: "Landing page copy", auxiliaryData: { budget: 1800, status: "Review" } },
  { id: "motion", label: "Motion system", auxiliaryData: { budget: 3200, status: "Open" } },
  { id: "deck", label: "Pitch deck", auxiliaryData: { budget: 950, status: "Awarded" } },
  { id: "onboard", label: "Onboarding flow", auxiliaryData: { budget: 4100, status: "Review" } },
];
const STATUS_VARIANT = { Open: "success", Review: "warning", Awarded: "info" } as const;

/** A search source that answers after a delay, like a real API. */
function remoteRooms(): SearchSource<Room> {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  return {
    bootstrap: () => [],
    search: async (query) => {
      await wait(LATENCY_MS);
      const q = query.toLowerCase();
      return ROOMS.filter((r) => r.label.toLowerCase().includes(q));
    },
  };
}

export default function TypeaheadDemo() {
  const citySource = useMemo(() => createStaticSource(CITIES), []);
  const peopleSource = useMemo(() => createStaticSource(PEOPLE_ITEMS, { keywords: (p) => [p.auxiliaryData?.role ?? ""] }), []);
  const roomSource = useMemo(() => remoteRooms(), []);

  const [sizes, setSizes] = useState<Record<Size, SearchableItem | null>>({ sm: null, md: CITIES[5], lg: null });
  const [city, setCity] = useState<SearchableItem | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="Filter a list as you type and pick one result.">
        <Stack gap={3} width={FIELD_WIDTH}>
          {SIZES.map((size) => (
            <Typeahead key={size} size={size} label={`Size ${size}`} searchSource={citySource} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))} placeholder="City" />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Show entries on focus" description="hasEntriesOnFocus lists options before typing; hasClear resets the pick.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <Typeahead label="Based in" searchSource={citySource} value={city} onChange={setCity} hasEntriesOnFocus hasClear startIcon={<Icon icon={icons.home} />} maxMenuItems={5} />
          <Caption>{city ? `Selected ${city.label}` : "Nothing selected"}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="People" description="renderItem adds avatars and roles; keywords match on role too.">
        <Stack width={FIELD_WIDTH}>
          <Typeahead
            label="Assign to"
            description="Try “copy” or “engineer”."
            searchSource={peopleSource}
            value={person}
            onChange={setPerson}
            hasEntriesOnFocus
            startIcon={<Icon icon={icons.user} />}
            renderItem={(p) => (
              <HStack gap={2} vAlign="center">
                <Avatar name={p.label} size="xsm" tooltip={false} />
                <Text>{p.label}</Text>
                <Text type="supporting" color="secondary">
                  {p.auxiliaryData?.role}
                </Text>
              </HStack>
            )}
          />
        </Stack>
      </Preview>

      <Preview align="start" label="Async search" description="A remote source with latency, a minimum query length, and an empty message.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <Typeahead
            label="Find a room"
            searchSource={roomSource}
            value={room}
            onChange={setRoom}
            minQueryLength={MIN_QUERY}
            debounceMs={200}
            emptySearchResultsText="No rooms match."
            placeholder={`Type ${MIN_QUERY}+ letters`}
            onChangeQuery={setQuery}
            onOpenChange={setOpen}
            startIcon={<Icon icon={icons.search} />}
            renderItem={(r) => (
              <HStack gap={2} vAlign="center" hAlign="between">
                <Text>{r.label}</Text>
                {r.auxiliaryData && <Badge label={r.auxiliaryData.status} variant={STATUS_VARIANT[r.auxiliaryData.status]} />}
              </HStack>
            )}
          />
          <Caption>
            Query “{query}” · menu {open ? "open" : "closed"}
          </Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Status and states">
        <Stack gap={3} width={FIELD_WIDTH}>
          <Typeahead label="Billing city" isRequired searchSource={citySource} value={null} onChange={() => undefined} status={{ type: "error", message: "Choose a city from the list." }} />
          <Typeahead label="Office" searchSource={citySource} value={CITIES[0]} onChange={() => undefined} isDisabled disabledMessage="Set by your admin." />
        </Stack>
      </Preview>

      {room?.auxiliaryData && (
        <Preview label="Selected room" description="The pick drives the rest of the page.">
          <Card maxWidth={FIELD_WIDTH}>
            <Stack gap={1}>
              <HStack hAlign="between" vAlign="center">
                <Heading level={4}>{room.label}</Heading>
                <Badge label={room.auxiliaryData.status} variant={STATUS_VARIANT[room.auxiliaryData.status]} />
              </HStack>
              <Text color="secondary">Budget ${room.auxiliaryData.budget.toLocaleString()}</Text>
            </Stack>
          </Card>
        </Preview>
      )}
    </Examples>
  );
}
