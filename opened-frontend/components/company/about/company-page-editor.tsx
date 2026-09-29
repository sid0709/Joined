"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
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
  useToast,
  type SearchableItem,
} from "@openseat/design-system";
import { CompanyCard } from "@/components/jobs/company-card";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { emptyWorkspace, type Workspace } from "@/lib/company";
import {
  fetchCompanyPage,
  pageToWorkspace,
  saveCompanyPage,
  workspaceToPage,
  type CompanyPage,
} from "@/lib/company/api";
import type { AuthCompany } from "@/lib/auth/types";
import { COMPANY_PAGE_VIEW_NOTE } from "@/lib/company/access";

const TAGLINE_MAX = 90;
const ABOUT_MAX = 400;
const ABOUT_ROWS = 4;
const MAX_BENEFITS = 6;
const SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,000+"].map(
  (value) => ({ value, label: `${value} people` }),
);
const BENEFIT_SUGGESTIONS = [
  "Hybrid, 2 days in office",
  "Remote-first",
  "Learning budget $2,000/yr",
  "16 weeks parental leave",
  "Home office stipend",
  "4-day summer weeks",
  "Visa sponsorship",
];

const NOT_SET = "Not set";

const toItems = (labels: string[]): SearchableItem[] =>
  labels.map((label) => ({ id: label, label }));

function shown(value: string) {
  const text = value.trim();
  return text || NOT_SET;
}

/** Edit the public company page on the left; see the card candidates get on the right. */
export function CompanyPageEditor({
  company,
  canEdit,
}: {
  company: AuthCompany;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState<CompanyPage | null>(null);
  const [draft, setDraft] = useState<Workspace>(emptyWorkspace(company));
  const benefitSource = useMemo(() => createStaticSource(toItems(BENEFIT_SUGGESTIONS)), []);
  const set =
    <K extends keyof Workspace>(key: K) =>
    (value: Workspace[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    fetchCompanyPage()
      .then((loaded) => {
        if (!active) return;
        setPage(loaded);
        setDraft(pageToWorkspace(loaded));
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const save = () => {
    saveCompanyPage(workspaceToPage(draft, page))
      .then((saved) => {
        setPage(saved);
        setDraft(pageToWorkspace(saved));
        toast({ body: "Company page published" });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };
  const footer = canEdit ? (
    <SaveFooter
      hint="Changes go live on your public page and every job card."
      message="Company page published"
      action={<Button label="Save" variant="primary" size="sm" onClick={save} />}
    />
  ) : undefined;
  const founded = draft.founded > 0 ? String(draft.founded) : "";

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={7}>
        <Stack gap={6}>
          {canEdit ? null : (
            <Text type="supporting" color="secondary">
              {COMPANY_PAGE_VIEW_NOTE}
            </Text>
          )}
          <SettingsGroup
            title="Identity"
            description="How candidates recognise you."
            footer={footer}
          >
            <SettingsRow label="Company name">
              {canEdit ? (
                <TextInput
                  label="Company name"
                  isLabelHidden
                  value={draft.name}
                  onChange={set("name")}
                />
              ) : (
                <Text display="block">{shown(draft.name)}</Text>
              )}
            </SettingsRow>
            <SettingsRow label="Tagline" description={`One line, up to ${TAGLINE_MAX} characters.`}>
              {canEdit ? (
                <TextInput
                  label="Tagline"
                  isLabelHidden
                  value={draft.tagline}
                  onChange={(value) => set("tagline")(value.slice(0, TAGLINE_MAX))}
                />
              ) : (
                <Text display="block">{shown(draft.tagline)}</Text>
              )}
            </SettingsRow>
            <SettingsRow label="Website" description="Shown on your public page.">
              {canEdit ? (
                <TextInput
                  label="Website"
                  isLabelHidden
                  value={draft.website}
                  onChange={set("website")}
                />
              ) : (
                <Text display="block">{shown(draft.website)}</Text>
              )}
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="About" description="The facts on your card." footer={footer}>
            {canEdit ? (
              <TextArea
                label="About"
                value={draft.about}
                onChange={set("about")}
                rows={ABOUT_ROWS}
                maxLength={ABOUT_MAX}
              />
            ) : (
              <Text display="block">{shown(draft.about)}</Text>
            )}
            <SettingsRow label="Industry">
              {canEdit ? (
                <TextInput
                  label="Industry"
                  isLabelHidden
                  value={draft.industry}
                  onChange={set("industry")}
                />
              ) : (
                <Text display="block">{shown(draft.industry)}</Text>
              )}
            </SettingsRow>
            <SettingsRow label="Size">
              {canEdit ? (
                <Selector
                  label="Size"
                  isLabelHidden
                  options={SIZES}
                  value={draft.size}
                  onChange={set("size")}
                />
              ) : (
                <Text display="block">{shown(draft.size)}</Text>
              )}
            </SettingsRow>
            <SettingsRow label="Founded">
              {canEdit ? (
                <NumberInput
                  label="Founded"
                  isLabelHidden
                  value={draft.founded}
                  onChange={set("founded")}
                  isIntegerOnly
                />
              ) : (
                <Text display="block">{shown(founded)}</Text>
              )}
            </SettingsRow>
            <SettingsRow label="Locations" description="Offices, separated by ·">
              {canEdit ? (
                <TextInput
                  label="Locations"
                  isLabelHidden
                  value={draft.locations}
                  onChange={set("locations")}
                />
              ) : (
                <Text display="block">{shown(draft.locations)}</Text>
              )}
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup
            title="Benefits & Perks"
            description={
              canEdit ? `Up to ${MAX_BENEFITS}. Specific beats generic.` : "What candidates see."
            }
            footer={footer}
          >
            {canEdit ? (
              <Tokenizer
                label="Benefits & Perks"
                isLabelHidden
                searchSource={benefitSource}
                value={toItems(draft.benefits)}
                onChange={(items) => set("benefits")(items.map((item) => item.label))}
                maxEntries={MAX_BENEFITS}
                hasCreate
                hasEntriesOnFocus
                placeholder="Add a benefit or perk"
              />
            ) : (
              <Text display="block">{shown(draft.benefits.join(" · "))}</Text>
            )}
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
