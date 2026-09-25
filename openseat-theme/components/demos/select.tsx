"use client";

import { useState } from "react";
import {
  Avatar,
  Card,
  HStack,
  Heading,
  Icon,
  MultiSelector,
  Selector,
  Stack,
  Text,
  icons,
  type SelectorOptionData,
  type SelectorSection,
  type SelectorSize,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

const SIZES: SelectorSize[] = ["sm", "md", "lg"];
const FIELD_WIDTH = 300;

const STATUS: SelectorOptionData[] = [
  { value: "open", label: "Open" },
  { value: "review", label: "In review" },
  { value: "awarded", label: "Awarded" },
  { value: "archived", label: "Archived", disabled: true },
];
const VISIBILITY: SelectorOptionData[] = [
  { value: "sealed", label: "Sealed", description: "Invitees can’t see each other’s bids.", icon: <Icon icon={icons.lock} /> },
  { value: "open", label: "Open", description: "Everyone sees the lowest bid.", icon: <Icon icon={icons.eye} /> },
  { value: "public", label: "Public", description: "Anyone with the link can bid.", icon: <Icon icon={icons.link} /> },
];
const CATEGORIES: SelectorSection[] = [
  { type: "section", title: "Design", options: [{ value: "brand", label: "Branding" }, { value: "ui", label: "UI design" }, { value: "illus", label: "Illustration" }] },
  { type: "section", title: "Writing", options: [{ value: "copy", label: "Copywriting" }, { value: "tech", label: "Technical writing" }] },
  { type: "section", title: "Engineering", options: [{ value: "web", label: "Web" }, { value: "mobile", label: "Mobile" }, { value: "data", label: "Data" }] },
];
const TIMEZONES: SelectorOptionData[] = [
  "Pacific/Honolulu",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
].map((tz) => ({ value: tz, label: tz.replace("_", " ").split("/")[1] }));
const OWNERS: SelectorOptionData[] = PEOPLE.map((p) => ({ value: p.name, label: p.name, description: p.role }));
const SKILLS = CATEGORIES.flatMap((s) => s.options);

export default function SelectDemo() {
  const [sizes, setSizes] = useState<Record<SelectorSize, string>>({ sm: "open", md: "open", lg: "open" });
  const [visibility, setVisibility] = useState("sealed");
  const [category, setCategory] = useState("brand");
  const [tz, setTz] = useState<string | null>("America/New_York");
  const [owner, setOwner] = useState(PEOPLE[0].name);
  const [sort, setSort] = useState("newest");
  const [skills, setSkills] = useState<string[]>(["brand", "copy"]);
  const [skillsCount, setSkillsCount] = useState<string[]>(["brand", "ui", "web"]);
  const [skillsBadges, setSkillsBadges] = useState<string[]>(["brand", "ui", "copy", "web", "data"]);
  const [role, setRole] = useState("");

  return (
    <Examples>
      <Preview align="start" label="Sizes">
        <Stack gap={3} width={FIELD_WIDTH}>
          {SIZES.map((size) => (
            <Selector key={size} size={size} label={`Size ${size}`} options={STATUS} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Icons and descriptions" description="Each option explains itself; the trigger shows the chosen icon.">
        <Stack width={FIELD_WIDTH}>
          <Selector label="Visibility" options={VISIBILITY} value={visibility} onChange={setVisibility} />
        </Stack>
      </Preview>

      <Preview align="start" label="Sections" description="Group long lists under headings.">
        <Stack width={FIELD_WIDTH}>
          <Selector label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
        </Stack>
      </Preview>

      <Preview align="start" label="Search and clear" description="hasSearch filters long lists; hasClear lets the value go back to empty.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <Selector label="Time zone" options={TIMEZONES} value={tz} onChange={setTz} hasSearch searchPlaceholder="Search cities" hasClear placeholder="Choose a time zone" emptySearchText="No city matches." />
          <Caption>{tz ?? "No time zone"}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Custom rendering" description="renderOption and renderValue draw people with avatars.">
        <Stack width={FIELD_WIDTH}>
          <Selector
            label="Room owner"
            options={OWNERS}
            value={owner}
            onChange={setOwner}
            renderOption={(o) => (
              <HStack gap={2} vAlign="center">
                <Avatar name={o.label} size="xsm" tooltip={false} />
                <Stack gap={0}>
                  <Text>{o.label}</Text>
                  <Text type="supporting" color="secondary">
                    {o.description}
                  </Text>
                </Stack>
              </HStack>
            )}
            renderValue={(o) => (
              <HStack gap={2} vAlign="center">
                <Avatar name={o.label} size={16} tooltip={false} />
                <Text>{o.label}</Text>
              </HStack>
            )}
          />
        </Stack>
      </Preview>

      <Preview align="start" label="Ghost variant" description="variant=&quot;ghost&quot; for inline sort and filter menus inside headers.">
        <Card width={420}>
          <HStack hAlign="between" vAlign="center">
            <Heading level={4}>Bids</Heading>
            <Selector
              label="Sort"
              isLabelHidden
              variant="ghost"
              size="sm"
              width="auto"
              startIcon={<Icon icon={icons.sort} />}
              value={sort}
              onChange={setSort}
              options={[
                { value: "newest", label: "Newest" },
                { value: "lowest", label: "Lowest price" },
                { value: "fastest", label: "Fastest delivery" },
              ]}
            />
          </HStack>
        </Card>
      </Preview>

      <Preview align="start" label="Status and required">
        <Stack gap={3} width={FIELD_WIDTH}>
          <Selector
            label="Your role"
            isRequired
            placeholder="Choose a role"
            options={[
              { value: "owner", label: "Room owner" },
              { value: "bidder", label: "Bidder" },
            ]}
            value={role}
            onChange={setRole}
            status={role ? { type: "success", message: "Thanks!" } : { type: "error", message: "Choose a role to continue." }}
          />
          <Selector label="Currency" options={[{ value: "usd", label: "USD" }]} value="usd" isDisabled disabledMessage="Set by your workspace." />
        </Stack>
      </Preview>

      <Preview align="start" label="Multi-select" description="MultiSelector picks several — with search and select-all.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <MultiSelector label="Skills (labels)" options={SKILLS} value={skills} onChange={setSkills} hasSearch hasSelectAll triggerDisplay="labels" />
          <MultiSelector label="Skills (count)" options={SKILLS} value={skillsCount} onChange={setSkillsCount} triggerDisplay="count" hasClear />
          <MultiSelector label="Skills (badges)" options={SKILLS} value={skillsBadges} onChange={setSkillsBadges} triggerDisplay="badges" maxBadges={3} />
        </Stack>
      </Preview>
    </Examples>
  );
}
