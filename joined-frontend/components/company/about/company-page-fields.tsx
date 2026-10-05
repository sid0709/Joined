"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AddressSelector,
  Avatar,
  Button,
  Card,
  CitySelector,
  FileInput,
  GridColumn,
  GridSystem,
  HStack,
  NumberInput,
  Selector,
  Stack,
  Text,
  TextArea,
  TextInput,
  Token,
  Tokenizer,
  createStaticSource,
  formatAddress,
  joinLocations,
  parseAddress,
  splitLocations,
  type SearchableItem,
} from "sid-ui";
import { companySizeLabel } from "@joined/job-schema";
import { SettingsGroup } from "@/components/settings-group";
import {
  ABOUT_MAX,
  COMPANY_SIZES,
  COMPANY_TYPES,
  INDUSTRIES,
  LOGO_ACCEPT,
  LOGO_MARK_SIZE,
  MAX_BENEFITS,
  MAX_SPECIALTIES,
  MAX_VALUES,
  MISSION_MAX,
  TAGLINE_MAX,
  TAGLINE_SEPARATOR,
  VALUE_ICONS,
  selectOptions,
  type BenefitCategory,
  type CompanyPageWrite,
  type CompanyValue,
} from "@/lib/company/page";

const ICON_OPTIONS = VALUE_ICONS.map((icon) => ({ value: icon, label: icon }));

const toItems = (labels: string[]): SearchableItem[] =>
  labels.map((label) => ({ id: label, label }));

export function CompanyPageFields({
  draft,
  onChange,
  footer,
  logoPreview,
  logoFile,
  canRemoveLogo,
  onLogoFile,
  onLogoClear,
  taglineKey,
  canEdit,
}: {
  draft: CompanyPageWrite;
  onChange: (patch: Partial<CompanyPageWrite>) => void;
  footer: ReactNode;
  logoPreview?: string;
  logoFile: File | null;
  canRemoveLogo: boolean;
  onLogoFile: (file: File | null) => void;
  onLogoClear: () => void;
  taglineKey: number;
  canEdit: boolean;
}) {
  const specialtySource = useMemo(() => createStaticSource([]), []);

  return (
    <Stack gap={6}>
      <SettingsGroup title="Identity" description="How candidates recognise you." footer={footer}>
        <GridSystem gap={4}>
          <GridColumn span="full" md={6}>
            <TextInput
              label="Company name"
              value={draft.name}
              onChange={(name) => onChange({ name })}
              isReadOnly={!canEdit}
            />
          </GridColumn>
          <GridColumn span="full" md={6}>
            <TextInput
              label="Website"
              value={draft.url}
              onChange={(url) => onChange({ url })}
              placeholder="acme.example"
              isReadOnly={!canEdit}
            />
          </GridColumn>
        </GridSystem>
        <HStack gap={4} vAlign="start" wrap="wrap">
          <Avatar
            name={draft.name.trim() || "Company"}
            src={logoPreview}
            size={LOGO_MARK_SIZE}
            shape="rounded"
            tooltip={false}
          />
          <Stack gap={3}>
            <FileInput
              label="Upload a logo"
              accept={LOGO_ACCEPT}
              value={logoFile}
              onChange={(value) => onLogoFile(Array.isArray(value) ? (value[0] ?? null) : value)}
              description="PNG, JPEG, WebP, or GIF under 2 MB. Replaces the logo URL."
              isDisabled={!canEdit}
            />
            {canEdit && canRemoveLogo ? (
              <Button
                label="Remove uploaded logo"
                variant="ghost"
                size="sm"
                onClick={onLogoClear}
              />
            ) : null}
            <TextInput
              label="Logo URL"
              value={draft.logo}
              onChange={(logo) => onChange({ logo })}
              placeholder="https://"
              isReadOnly={!canEdit}
            />
          </Stack>
        </HStack>
        <TaglineField
          key={taglineKey}
          value={draft.tagline}
          canEdit={canEdit}
          onChange={(tagline) => onChange({ tagline })}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Profile"
        description="Facts candidates see on your page and job card."
        footer={footer}
      >
        <GridSystem gap={4}>
          <GridColumn span="full" md={4}>
            <Selector
              label="Industry"
              options={selectOptions(INDUSTRIES, draft.industry)}
              value={draft.industry}
              onChange={(industry) => onChange({ industry })}
              isDisabled={!canEdit}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <Selector
              label="Company type"
              options={selectOptions(COMPANY_TYPES, draft.companyType)}
              value={draft.companyType}
              onChange={(companyType) => onChange({ companyType })}
              isDisabled={!canEdit}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <Selector
              label="Size"
              options={selectOptions(COMPANY_SIZES, draft.size, companySizeLabel)}
              value={draft.size}
              onChange={(size) => onChange({ size })}
              isDisabled={!canEdit}
            />
          </GridColumn>
          <GridColumn span="full" md={6}>
            <NumberInput
              label="Founded"
              value={draft.founded || null}
              onChange={(founded) => onChange({ founded: founded ?? 0 })}
              isIntegerOnly
              isDisabled={!canEdit}
            />
          </GridColumn>
          <GridColumn span="full" md={6}>
            <NumberInput
              label="Typical reply, days"
              value={draft.replyDays || null}
              onChange={(replyDays) => onChange({ replyDays: replyDays ?? 0 })}
              isIntegerOnly
              description="Shown as Replies in on your card."
              isDisabled={!canEdit}
            />
          </GridColumn>
        </GridSystem>
        <TextArea
          label="About"
          value={draft.about}
          onChange={(about) => onChange({ about })}
          maxLength={ABOUT_MAX}
          isReadOnly={!canEdit}
        />
        <TextArea
          label="Mission"
          value={draft.mission}
          onChange={(mission) => onChange({ mission })}
          maxLength={MISSION_MAX}
          isReadOnly={!canEdit}
        />
        <Tokenizer
          label="Specialties"
          searchSource={specialtySource}
          value={toItems(draft.specialties)}
          onChange={(items) =>
            onChange({ specialties: items.map((item) => item.label).slice(0, MAX_SPECIALTIES) })
          }
          maxEntries={MAX_SPECIALTIES}
          hasCreate={canEdit}
          isDisabled={!canEdit}
          placeholder="Payments infrastructure"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Places"
        description="Where you are based, and where you work."
        footer={footer}
      >
        <AddressSelector
          label="Headquarters"
          value={parseAddress(draft.headquarters)}
          onChange={(address) => onChange({ headquarters: formatAddress(address) })}
          isDisabled={!canEdit}
        />
        <CitySelector
          multiple
          label="Offices"
          value={splitLocations(draft.locations)}
          onChange={(cities) => onChange({ locations: joinLocations(cities) })}
          isDisabled={!canEdit}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Values"
        description="What working here is like."
        footer={footer}
        action={
          canEdit && draft.values.length < MAX_VALUES ? (
            <Button
              label="Add value"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  values: [...draft.values, { icon: "star", title: "", description: "" }],
                })
              }
            />
          ) : null
        }
      >
        {draft.values.length === 0 ? <Text color="secondary">None yet.</Text> : null}
        {draft.values.map((value, index) => (
          <ValueCard
            key={index}
            value={value}
            onChange={(next) =>
              onChange({
                values: draft.values.map((item, itemIndex) => (itemIndex === index ? next : item)),
              })
            }
            onRemove={
              canEdit
                ? () =>
                    onChange({ values: draft.values.filter((_, itemIndex) => itemIndex !== index) })
                : undefined
            }
          />
        ))}
      </SettingsGroup>

      <SettingsGroup
        title="Benefits & Perks"
        description="One benefit per category, so candidates see a varied list."
        footer={footer}
        action={
          canEdit && draft.benefitCategories.length < MAX_BENEFITS ? (
            <Button
              label="Add benefit"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  benefitCategories: [...draft.benefitCategories, { label: "", items: [] }],
                })
              }
            />
          ) : null
        }
      >
        {draft.benefitCategories.length === 0 ? <Text color="secondary">None yet.</Text> : null}
        {draft.benefitCategories.map((group, index) => (
          <BenefitCard
            key={index}
            group={group}
            onChange={(next) =>
              onChange({
                benefitCategories: draft.benefitCategories.map((item, itemIndex) =>
                  itemIndex === index ? next : item,
                ),
              })
            }
            onRemove={
              canEdit
                ? () =>
                    onChange({
                      benefitCategories: draft.benefitCategories.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                : undefined
            }
          />
        ))}
      </SettingsGroup>
    </Stack>
  );
}

function TaglineField({
  value,
  canEdit,
  onChange,
}: {
  value: string;
  canEdit: boolean;
  onChange: (value: string) => void;
}) {
  const chips = value
    .split(TAGLINE_SEPARATOR)
    .map((chip) => chip.trim())
    .filter(Boolean);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const next = draft.trim();
    if (!next || chips.includes(next)) {
      setDraft("");
      return;
    }
    const joined = [...chips, next].join(TAGLINE_SEPARATOR);
    if (joined.length > TAGLINE_MAX) return;
    onChange(joined);
    setDraft("");
  };

  return (
    <Stack gap={2}>
      <TextInput
        label="Tagline"
        value={draft}
        onChange={setDraft}
        onEnter={commit}
        placeholder={
          chips.length ? "Add another phrase, then Enter" : "Type a phrase and press Enter"
        }
        description={`Short phrases shown under the name. ${value.length}/${TAGLINE_MAX}`}
        isReadOnly={!canEdit}
      />
      {chips.length ? (
        <HStack gap={1.5} wrap="wrap">
          {chips.map((chip) => (
            <Token
              key={chip}
              label={chip}
              onRemove={
                canEdit
                  ? () => onChange(chips.filter((item) => item !== chip).join(TAGLINE_SEPARATOR))
                  : undefined
              }
            />
          ))}
        </HStack>
      ) : null}
    </Stack>
  );
}

function ValueCard({
  value,
  onChange,
  onRemove,
}: {
  value: CompanyValue;
  onChange: (value: CompanyValue) => void;
  onRemove?: () => void;
}) {
  const icon = VALUE_ICONS.some((name) => name === value.icon) ? value.icon : "star";
  return (
    <Card padding={4} variant="muted">
      <Stack gap={3}>
        <GridSystem gap={3}>
          <GridColumn span="full" md={4}>
            <Selector
              label="Icon"
              options={ICON_OPTIONS}
              value={icon}
              onChange={(next) => onChange({ ...value, icon: next })}
              isDisabled={!onRemove}
            />
          </GridColumn>
          <GridColumn span="full" md={8}>
            <TextInput
              label="Title"
              value={value.title}
              onChange={(title) => onChange({ ...value, title })}
              isReadOnly={!onRemove}
            />
          </GridColumn>
        </GridSystem>
        <TextArea
          label="Description"
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
          isReadOnly={!onRemove}
        />
        {onRemove ? (
          <HStack hAlign="end">
            <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} />
          </HStack>
        ) : null}
      </Stack>
    </Card>
  );
}

/** One benefit: its category and a single line. */
function BenefitCard({
  group,
  onChange,
  onRemove,
}: {
  group: BenefitCategory;
  onChange: (group: BenefitCategory) => void;
  onRemove?: () => void;
}) {
  return (
    <Card padding={4} variant="muted">
      <Stack gap={3}>
        <TextInput
          label="Category"
          value={group.label}
          onChange={(label) => onChange({ ...group, label })}
          placeholder="Health insurance"
          isReadOnly={!onRemove}
        />
        <TextInput
          label="Benefit"
          value={group.items[0] ?? ""}
          onChange={(item) => onChange({ ...group, items: item ? [item] : [] })}
          placeholder="Medical, dental, and vision for you and dependents"
          description="One line."
          isReadOnly={!onRemove}
        />
        {onRemove ? (
          <HStack hAlign="end">
            <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} />
          </HStack>
        ) : null}
      </Stack>
    </Card>
  );
}
