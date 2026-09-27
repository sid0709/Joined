"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  GridColumn,
  GridSystem,
  HStack,
  NumberInput,
  Selector,
  Stack,
  Sticky,
  Text,
  TextArea,
  TextInput,
  Tokenizer,
  createStaticSource,
  type SearchableItem,
} from "@openseat/design-system";
import { CompanyCard } from "@/components/jobs/company-card";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { WORKSPACE, type Workspace } from "@/lib/company";

const TAGLINE_MAX = 90;
const ABOUT_MAX = 400;
const ABOUT_ROWS = 4;
const MAX_PERKS = 6;
const SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,000+"].map(
  (value) => ({ value, label: `${value} people` }),
);
const PERK_SUGGESTIONS = [
  "Hybrid, 2 days in office",
  "Remote-first",
  "Learning budget $2,000/yr",
  "16 weeks parental leave",
  "Home office stipend",
  "4-day summer weeks",
  "Visa sponsorship",
];

const toItems = (labels: string[]): SearchableItem[] =>
  labels.map((label) => ({ id: label, label }));

/** Edit the public company page on the left; see the card candidates get on the right. */
export function CompanyPageEditor() {
  const [draft, setDraft] = useState<Workspace>(WORKSPACE);
  const perkSource = useMemo(() => createStaticSource(toItems(PERK_SUGGESTIONS)), []);
  const set =
    <K extends keyof Workspace>(key: K) =>
    (value: Workspace[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));
  const footer = (
    <SaveFooter
      hint="Changes go live on your public page and every job card."
      message="Company page published"
    />
  );

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={7}>
        <Stack gap={6}>
          <SettingsGroup
            title="Identity"
            description="How candidates recognise you."
            footer={footer}
          >
            <SettingsRow label="Company name">
              <TextInput
                label="Company name"
                isLabelHidden
                value={draft.name}
                onChange={set("name")}
              />
            </SettingsRow>
            <SettingsRow label="Tagline" description={`One line, up to ${TAGLINE_MAX} characters.`}>
              <TextInput
                label="Tagline"
                isLabelHidden
                value={draft.tagline}
                onChange={(value) => set("tagline")(value.slice(0, TAGLINE_MAX))}
              />
            </SettingsRow>
            <SettingsRow
              label="Website"
              description={
                <HStack gap={2} vAlign="center">
                  <span>Used to verify your team.</span>
                  <Badge label="Verified" variant="success" />
                </HStack>
              }
            >
              <TextInput
                label="Website"
                isLabelHidden
                value={draft.website}
                onChange={set("website")}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="About" description="The facts on your card." footer={footer}>
            <TextArea
              label="About"
              value={draft.about}
              onChange={set("about")}
              rows={ABOUT_ROWS}
              maxLength={ABOUT_MAX}
            />
            <SettingsRow label="Industry">
              <TextInput
                label="Industry"
                isLabelHidden
                value={draft.industry}
                onChange={set("industry")}
              />
            </SettingsRow>
            <SettingsRow label="Size">
              <Selector
                label="Size"
                isLabelHidden
                options={SIZES}
                value={draft.size}
                onChange={set("size")}
              />
            </SettingsRow>
            <SettingsRow label="Founded">
              <NumberInput
                label="Founded"
                isLabelHidden
                value={draft.founded}
                onChange={set("founded")}
                isIntegerOnly
              />
            </SettingsRow>
            <SettingsRow label="Locations" description="Offices, separated by ·">
              <TextInput
                label="Locations"
                isLabelHidden
                value={draft.locations}
                onChange={set("locations")}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup
            title="Perks"
            description={`Up to ${MAX_PERKS}. Specific beats generic.`}
            footer={footer}
          >
            <Tokenizer
              label="Perks"
              isLabelHidden
              searchSource={perkSource}
              value={toItems(draft.perks)}
              onChange={(items) => set("perks")(items.map((item) => item.label))}
              maxEntries={MAX_PERKS}
              hasCreate
              hasEntriesOnFocus
              placeholder="Add a perk"
            />
          </SettingsGroup>
        </Stack>
      </GridColumn>

      <GridColumn span="full" lg={5}>
        <Sticky offset={4}>
          <Stack gap={3}>
            <HStack gap={2} vAlign="center">
              <Text type="label">Live preview</Text>
              <Text type="supporting" color="secondary">
                · as candidates see it
              </Text>
            </HStack>
            <CompanyCard company={draft} hasActions={false} />
          </Stack>
        </Sticky>
      </GridColumn>
    </GridSystem>
  );
}
