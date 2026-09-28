"use client";

import { useEffect, useState } from "react";
import {
  US_CITIES,
  US_STATES,
  formatAddress,
  joinLocations,
  parseAddress,
  splitLocations,
  type Address,
} from "@openseat/design-system/places";
import { adminFetch } from "@/lib/api";
import { CompanyMark } from "@/components/jobs/company-mark";
import {
  COMPANIES_PATH,
  COMPANY_SIZES,
  COMPANY_TYPES,
  INDUSTRIES,
  LOGO_ACCEPT,
  VALUE_ICONS,
  companyLogoSrc,
  companyWriteFrom,
  type AdminCompany,
  type BenefitCategory,
  type CompanyLeader,
  type CompanyValue,
  type CompanyWrite,
} from "@/lib/company";

const TAGLINE_MAX = 140;
const TAGLINE_SEPARATOR = " · ";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
const labelClass = "flex flex-col gap-1 text-sm";
const labelTextClass = "text-xs font-medium text-muted";

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<AdminCompany>(`${COMPANIES_PATH}/${companyId}`, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setCompany(body);
        setDraft(companyWriteFrom(body));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load company");
      });
    return () => controller.abort();
  }, [companyId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const set =
    <K extends keyof CompanyWrite>(key: K) =>
    (value: CompanyWrite[K]) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    };

  async function save() {
    if (!draft || !company) return;
    setSaving(true);
    setSaveError(null);
    try {
      let updated = await adminFetch<AdminCompany>(`${COMPANIES_PATH}/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (logoFile) {
        const body = new FormData();
        body.append("logo", logoFile);
        updated = await adminFetch<AdminCompany>(`${COMPANIES_PATH}/${companyId}/logo`, {
          method: "POST",
          body,
        });
      } else if (logoCleared && company.hasLogoFile) {
        updated = await adminFetch<AdminCompany>(`${COMPANIES_PATH}/${companyId}/logo`, {
          method: "DELETE",
        });
      }
      setCompany(updated);
      setDraft(companyWriteFrom(updated));
      setLogoFile(null);
      setLogoCleared(false);
      setResetToken((token) => token + 1);
      setSaved(true);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save company");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-edit-title"
        className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">Company</p>
            <h2
              id="company-edit-title"
              className="mt-1 text-lg font-semibold leading-6 tracking-tight"
            >
              {draft?.name || (error ? "Company" : "Loading company")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!draft || saving}
              className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-surface disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-muted hover:bg-paper hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {!draft && !error ? <div className="h-40 animate-pulse rounded-lg bg-paper" /> : null}
          {saveError ? (
            <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {saveError}
            </p>
          ) : null}
          {saved ? (
            <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
              Company saved. The public page and job cards use this record.
            </p>
          ) : null}
          {draft && company ? (
            <div className="flex flex-col gap-6">
              <p className="text-xs text-muted">
                {company.jobCount} linked {company.jobCount === 1 ? "job" : "jobs"}. Renaming
                updates the company name on each of them.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" className="col-span-2">
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(event) => set("name")(event.target.value)}
                  />
                </Field>
                <Field label="Website">
                  <input
                    className={inputClass}
                    value={draft.url}
                    placeholder="acme.example"
                    onChange={(event) => set("url")(event.target.value)}
                  />
                </Field>
                <div className="col-span-2">
                  <LogoField
                    companyId={companyId}
                    name={draft.name}
                    url={draft.logo}
                    savedUrl={company.logo}
                    hasLogoFile={company.hasLogoFile}
                    cleared={logoCleared}
                    file={logoFile}
                    version={resetToken}
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
                </div>
                <div className="col-span-2">
                  <TaglineField
                    key={`tagline-${resetToken}`}
                    value={draft.tagline}
                    onChange={set("tagline")}
                  />
                </div>
                <Field label="Industry">
                  <select
                    className={inputClass}
                    value={draft.industry}
                    onChange={(event) => set("industry")(event.target.value)}
                  >
                    <option value="">Not set</option>
                    {optionsWithCurrent(INDUSTRIES, draft.industry).map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Company type">
                  <select
                    className={inputClass}
                    value={draft.companyType}
                    onChange={(event) => set("companyType")(event.target.value)}
                  >
                    <option value="">Not set</option>
                    {optionsWithCurrent(COMPANY_TYPES, draft.companyType).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Size">
                  <select
                    className={inputClass}
                    value={draft.size}
                    onChange={(event) => set("size")(event.target.value)}
                  >
                    <option value="">Not set</option>
                    {COMPANY_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} people
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="col-span-2">
                  <AddressField
                    key={`hq-${resetToken}`}
                    value={draft.headquarters}
                    onChange={set("headquarters")}
                  />
                </div>
                <div className="col-span-2">
                  <OfficesField
                    key={`offices-${resetToken}`}
                    value={draft.locations}
                    onChange={set("locations")}
                  />
                </div>
                <Field label="Founded">
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.founded || ""}
                    placeholder="Year"
                    onChange={(event) =>
                      set("founded")(event.target.value === "" ? 0 : Number(event.target.value))
                    }
                  />
                </Field>
                <Field label="Typical reply, days">
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.replyDays || ""}
                    onChange={(event) =>
                      set("replyDays")(event.target.value === "" ? 0 : Number(event.target.value))
                    }
                  />
                </Field>
              </div>

              <Field label="About">
                <textarea
                  className={textareaClass}
                  rows={4}
                  value={draft.about}
                  onChange={(event) => set("about")(event.target.value)}
                />
              </Field>
              <Field label="Mission">
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={draft.mission}
                  onChange={(event) => set("mission")(event.target.value)}
                />
              </Field>

              <ListField
                key={`specialties-${resetToken}`}
                label="Specialties"
                value={draft.specialties}
                onChange={set("specialties")}
                placeholder="One specialty per line"
              />
              <ValuesField values={draft.values} onChange={set("values")} />
              <LeadersField leaders={draft.leadership} onChange={set("leadership")} />
              <BenefitsField
                key={`benefits-${resetToken}`}
                groups={draft.benefitCategories}
                onChange={set("benefitCategories")}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function LogoField({
  companyId,
  name,
  url,
  savedUrl,
  hasLogoFile,
  cleared,
  file,
  version,
  onUrl,
  onFile,
  onClear,
}: {
  companyId: string;
  name: string;
  url: string;
  savedUrl: string;
  hasLogoFile?: boolean;
  cleared: boolean;
  file: File | null;
  version: number;
  onUrl: (value: string) => void;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setObjectUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const stored =
    !file && !cleared && (hasLogoFile || savedUrl)
      ? companyLogoSrc({ id: companyId, logo: savedUrl, hasLogoFile }, version)
      : undefined;
  const typed = !file && url && (cleared || url !== savedUrl) ? url : undefined;
  const preview = objectUrl ?? typed ?? stored;
  const canRemove = Boolean(file || (hasLogoFile && !cleared));

  return (
    <div className="flex flex-col gap-3">
      <span className={labelTextClass}>Logo</span>
      <div className="flex items-center gap-4">
        <CompanyMark key={preview ?? "empty"} name={name} logo={preview} size="lg" />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-ink">
            <input
              key={version}
              type="file"
              accept={LOGO_ACCEPT}
              className="text-sm"
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {canRemove ? (
            <button
              type="button"
              className="text-left text-sm text-muted hover:text-ink"
              onClick={onClear}
            >
              Remove uploaded logo
            </button>
          ) : null}
        </div>
      </div>
      <Field label="Logo URL">
        <input
          className={inputClass}
          value={url}
          placeholder="https://"
          onChange={(event) => onUrl(event.target.value)}
        />
      </Field>
    </div>
  );
}

function optionsWithCurrent(options: readonly string[], current: string) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

function TaglineField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const chips = value
    ? value
        .split(TAGLINE_SEPARATOR)
        .map((chip) => chip.trim())
        .filter(Boolean)
    : [];
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = raw.trim();
    if (!next || chips.includes(next)) {
      setDraft("");
      return;
    }
    const joined = [...chips, next].join(TAGLINE_SEPARATOR);
    if (joined.length > TAGLINE_MAX) return;
    onChange(joined);
    setDraft("");
  }

  return (
    <label className={labelClass}>
      <span className={labelTextClass}>Tagline</span>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-ink">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-0.5 text-sm"
          >
            {chip}
            <button
              type="button"
              className="text-muted hover:text-ink"
              aria-label={`Remove ${chip}`}
              onClick={() =>
                onChange(chips.filter((item) => item !== chip).join(TAGLINE_SEPARATOR))
              }
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none"
          value={draft}
          placeholder={chips.length ? "Add another, then Enter" : "Type a phrase and press Enter"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && !draft && chips.length) {
              onChange(chips.slice(0, -1).join(TAGLINE_SEPARATOR));
            }
          }}
        />
      </div>
      <span className="text-xs text-muted">
        Type a phrase and press Enter to create a chip. {value.length}/{TAGLINE_MAX}
      </span>
    </label>
  );
}

function AddressField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [address, setAddress] = useState<Address>(() => parseAddress(value));
  const cities = optionsWithCurrent(
    US_CITIES.map((city) => city.name),
    address.city,
  );

  function update(patch: Partial<Address>) {
    const next = { ...address, ...patch };
    setAddress(next);
    onChange(formatAddress(next));
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Headquarters">
        <input
          className={inputClass}
          value={address.line1}
          placeholder="Street address"
          onChange={(event) => update({ line1: event.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <select
            className={inputClass}
            value={address.city}
            onChange={(event) => update({ city: event.target.value })}
          >
            <option value="">Select a city</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </Field>
        <Field label="State">
          <select
            className={inputClass}
            value={address.state}
            onChange={(event) => update({ state: event.target.value })}
          >
            <option value="">Select a state</option>
            {US_STATES.map((state) => (
              <option key={state.abbreviation} value={state.abbreviation}>
                {state.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Postal code">
        <input
          className={inputClass}
          value={address.postalCode}
          placeholder="ZIP code"
          onChange={(event) => update({ postalCode: event.target.value })}
        />
      </Field>
    </div>
  );
}

function OfficesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = splitLocations(value);
  const remaining = US_CITIES.map((city) => city.name).filter((city) => !selected.includes(city));

  return (
    <div className={labelClass}>
      <span className={labelTextClass}>Offices</span>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((city) => (
            <button
              key={city}
              type="button"
              className="rounded-md bg-paper px-2 py-0.5 text-sm text-ink hover:text-danger"
              aria-label={`Remove ${city}`}
              onClick={() => onChange(joinLocations(selected.filter((item) => item !== city)))}
            >
              {city} ×
            </button>
          ))}
        </div>
      ) : null}
      <select
        className={inputClass}
        value=""
        onChange={(event) => {
          const city = event.target.value;
          if (!city || selected.includes(city)) return;
          onChange(joinLocations([...selected, city]));
        }}
      >
        <option value="">Add a city</option>
        {remaining.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted">Select every city with an office.</span>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`${labelClass} ${className ?? ""}`}>
      <span className={labelTextClass}>{label}</span>
      {children}
    </label>
  );
}

function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(() => value.join("\n"));
  return (
    <label className={labelClass}>
      <span className={labelTextClass}>{label}</span>
      <textarea
        className={textareaClass}
        rows={Math.min(8, Math.max(3, value.length + 1))}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const cleaned = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          setText(cleaned.join("\n"));
          onChange(cleaned);
        }}
      />
    </label>
  );
}

function ValuesField({
  values,
  onChange,
}: {
  values: CompanyValue[];
  onChange: (values: CompanyValue[]) => void;
}) {
  function update(index: number, patch: Partial<CompanyValue>) {
    onChange(values.map((value, item) => (item === index ? { ...value, ...patch } : value)));
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Values</h3>
        <button
          type="button"
          className="text-sm text-muted hover:text-ink"
          onClick={() => onChange([...values, { icon: "star", title: "", description: "" }])}
        >
          Add value
        </button>
      </div>
      {values.length === 0 ? <p className="text-sm text-muted">None yet.</p> : null}
      {values.map((value, index) => (
        <div key={index} className="grid grid-cols-6 gap-2 rounded-lg border border-line p-3">
          <label className={`${labelClass} col-span-2`}>
            <span className={labelTextClass}>Icon</span>
            <select
              className={inputClass}
              value={
                VALUE_ICONS.includes(value.icon as (typeof VALUE_ICONS)[number])
                  ? value.icon
                  : "star"
              }
              onChange={(event) => update(index, { icon: event.target.value })}
            >
              {VALUE_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} col-span-3`}>
            <span className={labelTextClass}>Title</span>
            <input
              className={inputClass}
              value={value.title}
              onChange={(event) => update(index, { title: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="mt-5 h-10 text-sm text-muted hover:text-ink"
            onClick={() => onChange(values.filter((_, item) => item !== index))}
          >
            Remove
          </button>
          <label className={`${labelClass} col-span-6`}>
            <span className={labelTextClass}>Description</span>
            <textarea
              className={textareaClass}
              rows={2}
              value={value.description}
              onChange={(event) => update(index, { description: event.target.value })}
            />
          </label>
        </div>
      ))}
    </section>
  );
}

function LeadersField({
  leaders,
  onChange,
}: {
  leaders: CompanyLeader[];
  onChange: (leaders: CompanyLeader[]) => void;
}) {
  function update(index: number, patch: Partial<CompanyLeader>) {
    onChange(leaders.map((leader, item) => (item === index ? { ...leader, ...patch } : leader)));
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Leadership</h3>
        <button
          type="button"
          className="text-sm text-muted hover:text-ink"
          onClick={() => onChange([...leaders, { name: "", title: "" }])}
        >
          Add person
        </button>
      </div>
      {leaders.length === 0 ? <p className="text-sm text-muted">None yet.</p> : null}
      {leaders.map((leader, index) => (
        <div key={index} className="grid grid-cols-5 gap-2">
          <input
            className={`${inputClass} col-span-2`}
            value={leader.name}
            placeholder="Name"
            aria-label="Leader name"
            onChange={(event) => update(index, { name: event.target.value })}
          />
          <input
            className={`${inputClass} col-span-2`}
            value={leader.title}
            placeholder="Title"
            aria-label="Leader title"
            onChange={(event) => update(index, { title: event.target.value })}
          />
          <button
            type="button"
            className="h-10 text-sm text-muted hover:text-ink"
            onClick={() => onChange(leaders.filter((_, item) => item !== index))}
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}

function BenefitsField({
  groups,
  onChange,
}: {
  groups: BenefitCategory[];
  onChange: (groups: BenefitCategory[]) => void;
}) {
  function update(index: number, patch: Partial<BenefitCategory>) {
    onChange(groups.map((group, item) => (item === index ? { ...group, ...patch } : group)));
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Benefits & Perks</h3>
        <button
          type="button"
          className="text-sm text-muted hover:text-ink"
          onClick={() => onChange([...groups, { label: "", items: [] }])}
        >
          Add category
        </button>
      </div>
      {groups.length === 0 ? <p className="text-sm text-muted">None yet.</p> : null}
      {groups.map((group, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={group.label}
              placeholder="Category, such as Health"
              aria-label="Benefit category"
              onChange={(event) => update(index, { label: event.target.value })}
            />
            <button
              type="button"
              className="h-10 shrink-0 px-2 text-sm text-muted hover:text-ink"
              onClick={() => onChange(groups.filter((_, item) => item !== index))}
            >
              Remove
            </button>
          </div>
          <ListField
            label="Items"
            value={group.items}
            placeholder="One benefit per line"
            onChange={(items) => update(index, { items })}
          />
        </div>
      ))}
    </section>
  );
}
