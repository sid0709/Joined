"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import {
  COMPANIES_PATH,
  COMPANY_SIZES,
  VALUE_ICONS,
  companyWriteFrom,
  type AdminCompany,
  type BenefitCategory,
  type CompanyLeader,
  type CompanyValue,
  type CompanyWrite,
} from "@/lib/company";

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
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await adminFetch<AdminCompany>(`${COMPANIES_PATH}/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setCompany(updated);
      setDraft(companyWriteFrom(updated));
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
                <Field label="Logo URL">
                  <input
                    className={inputClass}
                    value={draft.logo}
                    placeholder="https://"
                    onChange={(event) => set("logo")(event.target.value)}
                  />
                </Field>
                <Field label="Tagline" className="col-span-2">
                  <input
                    className={inputClass}
                    value={draft.tagline}
                    onChange={(event) => set("tagline")(event.target.value)}
                  />
                </Field>
                <Field label="Industry">
                  <input
                    className={inputClass}
                    value={draft.industry}
                    onChange={(event) => set("industry")(event.target.value)}
                  />
                </Field>
                <Field label="Company type">
                  <input
                    className={inputClass}
                    value={draft.companyType}
                    placeholder="Private, public, nonprofit"
                    onChange={(event) => set("companyType")(event.target.value)}
                  />
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
                <Field label="Headquarters">
                  <input
                    className={inputClass}
                    value={draft.headquarters}
                    onChange={(event) => set("headquarters")(event.target.value)}
                  />
                </Field>
                <Field label="Offices" className="col-span-2">
                  <input
                    className={inputClass}
                    value={draft.locations}
                    placeholder="Chicago · New York"
                    onChange={(event) => set("locations")(event.target.value)}
                  />
                </Field>
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
              <ListField
                key={`perks-${resetToken}`}
                label="Perks"
                value={draft.perks}
                onChange={set("perks")}
                placeholder="One perk per line"
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
        <h3 className="text-sm font-medium">Benefits</h3>
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
