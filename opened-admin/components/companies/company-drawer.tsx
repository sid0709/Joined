"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AddressSelector,
  Banner,
  Button,
  Card,
  CitySelector,
  Divider,
  Drawer,
  FileInput,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Link,
  NumberInput,
  Selector,
  Skeleton,
  Stack,
  Text,
  TextArea,
  TextInput,
  Token,
  formatAddress,
  joinLocations,
  parseAddress,
  splitLocations,
} from "@openseat/design-system";
import { companySizeLabel } from "@openseat/job-schema";
import { CompanyMark } from "@/components/jobs/company-mark";
import { ListField } from "@/components/list-field";
import { adminFetch, adminSend } from "@/lib/api";
import {
  COMPANIES_PATH,
  COMPANY_SIZES,
  COMPANY_TYPES,
  INDUSTRIES,
  LOGO_ACCEPT,
  VALUE_ICONS,
  applyAutofill,
  autofillPath,
  companyLogoSrc,
  companyWriteFrom,
  type AdminCompany,
  type BenefitCategory,
  type CompanyAutofill,
  type CompanyValue,
  type CompanyWrite,
} from "@/lib/company";

const TAGLINE_MAX = 140;
const TAGLINE_SEPARATOR = " · ";
const DRAWER_SIZE = 760;
const LOADING_HEIGHT = 200;
const NOT_SET = { value: "", label: "Not set" };

function options(
  values: readonly string[],
  current: string,
  label: (value: string) => string = (value) => value,
) {
  const list = current && !values.includes(current) ? [current, ...values] : [...values];
  return [NOT_SET, ...list.map((value) => ({ value, label: label(value) }))];
}

/** Edit the public company page. Logo files upload after the profile saves. */
export function CompanyDrawer({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <CompanyDetail key={companyId} companyId={companyId} onClose={onClose} onSaved={onSaved} />
  );
}

function CompanyDetail({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [company, setCompany] = useState<AdminCompany | null>(null);
  const [draft, setDraft] = useState<CompanyWrite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [autofillSources, setAutofillSources] = useState<string[] | null>(null);
  // The form as it was before the last autofill, so a run can be undone.
  const [beforeAutofill, setBeforeAutofill] = useState<CompanyWrite | null>(null);
  // Bumped after an autofill so fields that keep their own text restart from the new draft.
  const [fillKey, setFillKey] = useState(0);
  const path = `${COMPANIES_PATH}/${encodeURIComponent(companyId)}`;

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<AdminCompany>(path, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setCompany(body);
        setDraft(companyWriteFrom(body));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load company");
        }
      });
    return () => controller.abort();
  }, [path]);

  const set =
    <K extends keyof CompanyWrite>(key: K) =>
    (value: CompanyWrite[K]) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    };

  async function autofill() {
    if (!draft || !company) return;
    setAutofillError(null);
    setAutofilling(true);
    try {
      const found = await adminSend<CompanyAutofill>(autofillPath(company.id), "POST", {
        name: draft.name,
        url: draft.url,
      });
      setBeforeAutofill(draft);
      setDraft((current) => (current ? applyAutofill(current, found.company) : current));
      setAutofillSources(found.sources);
      setFillKey((token) => token + 1);
      setSaved(false);
    } catch (cause) {
      setAutofillSources(null);
      setAutofillError(cause instanceof Error ? cause.message : "Could not autofill this company");
    } finally {
      setAutofilling(false);
    }
  }

  function undoAutofill() {
    if (!beforeAutofill) return;
    setDraft(beforeAutofill);
    setBeforeAutofill(null);
    setAutofillSources(null);
    setFillKey((token) => token + 1);
  }

  async function save() {
    if (!draft || !company) return;
    setSaveError(null);
    try {
      let updated = await adminSend<AdminCompany>(path, "PATCH", draft);
      if (logoFile) {
        const body = new FormData();
        body.append("logo", logoFile);
        updated = await adminFetch<AdminCompany>(`${path}/logo`, { method: "POST", body });
      } else if (logoCleared && company.hasLogoFile) {
        updated = await adminFetch<AdminCompany>(`${path}/logo`, { method: "DELETE" });
      }
      setCompany(updated);
      setDraft(companyWriteFrom(updated));
      setLogoFile(null);
      setLogoCleared(false);
      setBeforeAutofill(null);
      setAutofillSources(null);
      setVersion((token) => token + 1);
      setSaved(true);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save company");
    }
  }

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={draft?.name || (error ? "Company" : "Loading company")}
      subtitle={
        company
          ? `${company.jobCount} linked ${company.jobCount === 1 ? "job" : "jobs"} · renaming updates each of them`
          : "Company page"
      }
      headerStart={
        draft ? (
          <CompanyMark
            name={draft.name}
            logo={company ? companyLogoSrc(company, version) : undefined}
          />
        ) : undefined
      }
      size={DRAWER_SIZE}
      purpose="form"
      footer={
        <HStack gap={2} hAlign="end">
          <Button label="Close" variant="ghost" clickAction={onClose} />
          <Button label="Save company" variant="primary" clickAction={save} isDisabled={!draft} />
        </HStack>
      }
    >
      <Stack gap={5}>
        {error ? <Banner status="error" title={error} /> : null}
        {saveError ? <Banner status="error" title={saveError} /> : null}
        {autofillError ? <Banner status="error" title={autofillError} /> : null}
        {autofillSources ? (
          <Stack gap={2}>
            <Banner
              status="info"
              title="Filled in from the web. Review it, then save."
              description="Fields the search could not confirm were left as they were. Nothing is saved until you press Save company."
            />
            {beforeAutofill ? (
              <HStack>
                <Button
                  label="Undo autofill"
                  variant="ghost"
                  size="sm"
                  clickAction={undoAutofill}
                />
              </HStack>
            ) : null}
            {autofillSources.length ? (
              <Stack gap={1}>
                <Text type="supporting" color="secondary">
                  Sources
                </Text>
                {autofillSources.map((source) => (
                  <Link key={source} href={source} target="_blank">
                    {source}
                  </Link>
                ))}
              </Stack>
            ) : null}
          </Stack>
        ) : null}
        {saved ? (
          <Banner
            status="success"
            title="Company saved"
            description="The public page and job cards use this record."
          />
        ) : null}
        {!draft && !error ? <Skeleton width="100%" height={LOADING_HEIGHT} /> : null}
        {draft && company ? (
          <Stack gap={6}>
            <Group
              title="Identity"
              action={
                <Button
                  label={
                    autofilling
                      ? "Researching…"
                      : autofillSources
                        ? "Autofill again"
                        : "Autofill with AI"
                  }
                  variant="secondary"
                  size="sm"
                  clickAction={autofill}
                  isDisabled={autofilling || (!draft.name.trim() && !draft.url.trim())}
                />
              }
            >
              <GridSystem gap={4}>
                <GridColumn span="full" md={6}>
                  <TextInput label="Name" value={draft.name} onChange={set("name")} />
                </GridColumn>
                <GridColumn span="full" md={6}>
                  <TextInput
                    label="Website"
                    value={draft.url}
                    onChange={set("url")}
                    placeholder="acme.example"
                  />
                </GridColumn>
              </GridSystem>
              <LogoField
                company={company}
                name={draft.name}
                url={draft.logo}
                file={logoFile}
                cleared={logoCleared}
                version={version}
                onUrl={set("logo")}
                onFile={(file) => {
                  setLogoFile(file);
                  setLogoCleared(false);
                  setSaved(false);
                }}
                onClear={() => {
                  setLogoFile(null);
                  setLogoCleared(true);
                  setSaved(false);
                }}
              />
              <TaglineField
                key={`tagline-${version}-${fillKey}`}
                value={draft.tagline}
                onChange={set("tagline")}
              />
            </Group>

            <Group title="Profile">
              <GridSystem gap={4}>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Industry"
                    options={options(INDUSTRIES, draft.industry)}
                    value={draft.industry}
                    onChange={set("industry")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Company type"
                    options={options(COMPANY_TYPES, draft.companyType)}
                    value={draft.companyType}
                    onChange={set("companyType")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Size"
                    options={options(COMPANY_SIZES, draft.size, companySizeLabel)}
                    value={draft.size}
                    onChange={set("size")}
                  />
                </GridColumn>
                <GridColumn span="full" md={6}>
                  <NumberInput
                    label="Founded"
                    value={draft.founded || null}
                    onChange={set("founded")}
                  />
                </GridColumn>
                <GridColumn span="full" md={6}>
                  <NumberInput
                    label="Typical reply, days"
                    value={draft.replyDays || null}
                    onChange={set("replyDays")}
                  />
                </GridColumn>
              </GridSystem>
              <TextArea label="About" value={draft.about} onChange={set("about")} />
              <TextArea label="Mission" value={draft.mission} onChange={set("mission")} />
              <ListField
                key={`specialties-${version}-${fillKey}`}
                label="Specialties"
                value={draft.specialties}
                onChange={set("specialties")}
                placeholder="Payments infrastructure"
              />
            </Group>

            <Group title="Places">
              <AddressSelector
                key={`hq-${version}-${fillKey}`}
                label="Headquarters"
                value={parseAddress(draft.headquarters)}
                onChange={(address) => set("headquarters")(formatAddress(address))}
              />
              <CitySelector
                key={`offices-${fillKey}`}
                multiple
                label="Offices"
                value={splitLocations(draft.locations)}
                onChange={(cities) => set("locations")(joinLocations(cities))}
              />
            </Group>

            <ValuesField values={draft.values} onChange={set("values")} />
            <BenefitsField
              key={`benefits-${version}-${fillKey}`}
              groups={draft.benefitCategories}
              onChange={set("benefitCategories")}
            />
          </Stack>
        ) : null}
      </Stack>
    </Drawer>
  );
}

function Group({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap={4}>
      <Divider />
      <HStack hAlign="between" vAlign="center">
        <Heading level={3}>{title}</Heading>
        {action}
      </HStack>
      {children}
    </Stack>
  );
}

function LogoField({
  company,
  name,
  url,
  file,
  cleared,
  version,
  onUrl,
  onFile,
  onClear,
}: {
  company: AdminCompany;
  name: string;
  url: string;
  file: File | null;
  cleared: boolean;
  version: number;
  onUrl: (value: string) => void;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const stored =
    !file && !cleared && (company.hasLogoFile || company.logo)
      ? companyLogoSrc(
          { id: company.id, logo: company.logo, hasLogoFile: company.hasLogoFile },
          version,
        )
      : undefined;
  const preview = objectUrl ?? (!cleared && url ? url : undefined) ?? stored;
  const canRemove = Boolean(file || (company.hasLogoFile && !cleared));

  return (
    <HStack gap={4} vAlign="start" wrap="wrap">
      <CompanyMark key={preview ?? "empty"} name={name} logo={preview ?? undefined} size="lg" />
      <Stack gap={3}>
        <FileInput
          label="Upload a logo"
          accept={LOGO_ACCEPT}
          value={file}
          onChange={(value) => onFile(Array.isArray(value) ? (value[0] ?? null) : value)}
          description="PNG, JPEG, WebP, or GIF under 2 MB. Replaces the logo URL."
        />
        {canRemove ? (
          <Button label="Remove uploaded logo" variant="ghost" size="sm" clickAction={onClear} />
        ) : null}
        <TextInput label="Logo URL" value={url} onChange={onUrl} placeholder="https://" />
      </Stack>
    </HStack>
  );
}

function TaglineField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
      />
      {chips.length ? (
        <HStack gap={1.5} wrap="wrap">
          {chips.map((chip) => (
            <Token
              key={chip}
              label={chip}
              onRemove={() =>
                onChange(chips.filter((item) => item !== chip).join(TAGLINE_SEPARATOR))
              }
            />
          ))}
        </HStack>
      ) : null}
    </Stack>
  );
}

const ICON_OPTIONS = VALUE_ICONS.map((icon) => ({ value: icon, label: icon }));

function ValuesField({
  values,
  onChange,
}: {
  values: CompanyValue[];
  onChange: (values: CompanyValue[]) => void;
}) {
  const update = (index: number, patch: Partial<CompanyValue>) =>
    onChange(values.map((value, item) => (item === index ? { ...value, ...patch } : value)));
  return (
    <Group
      title="Values"
      action={
        <Button
          label="Add value"
          variant="ghost"
          size="sm"
          clickAction={() => onChange([...values, { icon: "star", title: "", description: "" }])}
        />
      }
    >
      {values.length === 0 ? <Text color="secondary">None yet.</Text> : null}
      {values.map((value, index) => (
        <Card key={index} padding={4} variant="muted">
          <Stack gap={3}>
            <GridSystem gap={3}>
              <GridColumn span="full" md={4}>
                <Selector
                  label="Icon"
                  options={ICON_OPTIONS}
                  value={VALUE_ICONS.some((icon) => icon === value.icon) ? value.icon : "star"}
                  onChange={(icon) => update(index, { icon })}
                />
              </GridColumn>
              <GridColumn span="full" md={8}>
                <TextInput
                  label="Title"
                  value={value.title}
                  onChange={(title) => update(index, { title })}
                />
              </GridColumn>
            </GridSystem>
            <TextArea
              label="Description"
              value={value.description}
              onChange={(description) => update(index, { description })}
            />
            <HStack hAlign="end">
              <Button
                label="Remove"
                variant="ghost"
                size="sm"
                clickAction={() => onChange(values.filter((_, item) => item !== index))}
              />
            </HStack>
          </Stack>
        </Card>
      ))}
    </Group>
  );
}

function BenefitsField({
  groups,
  onChange,
}: {
  groups: BenefitCategory[];
  onChange: (groups: BenefitCategory[]) => void;
}) {
  const update = (index: number, patch: Partial<BenefitCategory>) =>
    onChange(groups.map((group, item) => (item === index ? { ...group, ...patch } : group)));
  return (
    <Group
      title="Benefits & perks"
      action={
        <Button
          label="Add category"
          variant="ghost"
          size="sm"
          clickAction={() => onChange([...groups, { label: "", items: [] }])}
        />
      }
    >
      {groups.length === 0 ? <Text color="secondary">None yet.</Text> : null}
      {groups.map((group, index) => (
        <Card key={index} padding={4} variant="muted">
          <Stack gap={3}>
            <TextInput
              label="Category"
              value={group.label}
              onChange={(label) => update(index, { label })}
              placeholder="Health"
            />
            <ListField
              label="Items"
              value={group.items}
              onChange={(items) => update(index, { items })}
              placeholder="Medical, dental, vision"
            />
            <HStack hAlign="end">
              <Button
                label="Remove"
                variant="ghost"
                size="sm"
                clickAction={() => onChange(groups.filter((_, item) => item !== index))}
              />
            </HStack>
          </Stack>
        </Card>
      ))}
    </Group>
  );
}
