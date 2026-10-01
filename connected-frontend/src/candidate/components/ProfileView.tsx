"use client";

import { Glyph } from "@joined/design-system";
import { useState } from "react";

import type { Ats, BidderProfile } from "@/src/candidate/types/workspace";

import { ACCOUNT_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { bidderQa } from "@/src/candidate/lib/derive";
import { NumberField } from "@/src/shared/kit/Fields";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { longDate, percent } from "@/src/shared/lib/format";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Input,
  PageBody,
  Select,
  TextArea,
} from "@/src/shared/marketplace-ui";

const ATS_LIST: Ats[] = ["Greenhouse", "Lever", "Ashby", "Workday", "iCIMS", "SmartRecruiters"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMEZONES = [
  "EST · UTC−5",
  "CST · UTC−6",
  "MST · UTC−7",
  "PST · UTC−8",
  "GMT · UTC+0",
  "CET · UTC+1",
  "IST · UTC+5:30",
];

export function ProfileView() {
  const { profile, updateProfile, applications } = useBidderWorkspace();
  const [draft, setDraft] = useState<BidderProfile>(profile);
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [saved, setSaved] = useState(false);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(profile) || languages !== profile.languages.join(", ");
  const set = <K extends keyof BidderProfile>(key: K, value: BidderProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const toggleAts = (ats: Ats) =>
    set(
      "specialties",
      draft.specialties.includes(ats)
        ? draft.specialties.filter((item) => item !== ats)
        : [...draft.specialties, ats],
    );
  const toggleDay = (day: number) =>
    set(
      "workingDays",
      draft.workingDays.includes(day)
        ? draft.workingDays.filter((item) => item !== day)
        : [...draft.workingDays, day].sort(),
    );

  const save = () => {
    updateProfile({
      ...draft,
      languages: languages
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setSaved(true);
  };
  const reset = () => {
    setDraft(profile);
    setLanguages(profile.languages.join(", "));
  };

  const doneCount = draft.verifications.filter((item) => item.done).length;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Profile"
          title="Your bidder profile"
          description="Hunters read this before they accept your message or invite you. Keep it honest, specific and up to date."
        />
        <SectionNav label="Account sections" links={ACCOUNT_LINKS} />

        <div className="hx-split">
          <div className="hx-stack">
            <Panel>
              <div className="hx-profile-hero">
                <Avatar name={profile.name} size={48} />
                <div className="hx-stack hx-stack-sm hx-grow">
                  <div className="hx-row">
                    <h2 className="hx-panel-title">{profile.name}</h2>
                    <Badge label={`${profile.level} bidder`} tone="purple" />
                    {draft.openToNewTasks ? (
                      <Badge label="Open to new tasks" tone="success" />
                    ) : (
                      <Badge label="Not taking tasks" tone="neutral" />
                    )}
                  </div>
                  <span className="hx-muted">
                    {profile.handle} · Joined {longDate(profile.joinedAt)}
                  </span>
                </div>
              </div>
            </Panel>

            <Panel title="About you" subtitle="What a job hunter sees first">
              <div className="hx-inline-form">
                <Input
                  label="Headline"
                  value={draft.headline}
                  onChange={(event) => set("headline", event.target.value)}
                />
                <TextArea
                  label="About your work"
                  value={draft.bio}
                  onChange={(event) => set("bio", event.target.value)}
                  rows={5}
                />
                <div className="hx-field-grid">
                  <Input
                    label="Languages (comma separated)"
                    value={languages}
                    onChange={(event) => {
                      setLanguages(event.target.value);
                      setSaved(false);
                    }}
                  />
                  <Select
                    label="Timezone"
                    value={draft.timezone}
                    onChange={(event) => set("timezone", event.target.value)}
                  >
                    {TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Panel>

            <Panel
              title="Skills and minimum rates"
              subtitle="Tasks under your minimum are flagged before you contact the hunter"
            >
              <div className="hx-inline-form">
                <div className="hx-chip-row">
                  {ATS_LIST.map((ats) => (
                    <button
                      key={ats}
                      type="button"
                      className="hx-chip hx-day"
                      aria-pressed={draft.specialties.includes(ats)}
                      onClick={() => toggleAts(ats)}
                    >
                      {ats}
                    </button>
                  ))}
                </div>
                <div className="hx-field-grid">
                  {draft.specialties.map((ats) => (
                    <NumberField
                      key={ats}
                      label={`${ats} minimum per link`}
                      value={String(draft.minRates[ats] ?? "")}
                      min={0}
                      step={0.05}
                      onChange={(value) =>
                        set("minRates", { ...draft.minRates, [ats]: Number(value) })
                      }
                    />
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Availability" subtitle="Used when hunters plan weekly drops">
              <div className="hx-inline-form">
                <div className="hx-chip-row">
                  {DAYS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      className="hx-chip hx-day"
                      aria-pressed={draft.workingDays.includes(index)}
                      onClick={() => toggleDay(index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <NumberField
                  label="Links per week you can handle"
                  value={String(draft.weeklyCapacity)}
                  min={1}
                  step={5}
                  onChange={(value) => set("weeklyCapacity", Number(value))}
                />
                <Checkbox
                  label="I'm open to new tasks"
                  checked={draft.openToNewTasks}
                  onChange={(event) => set("openToNewTasks", event.target.checked)}
                />
              </div>
            </Panel>

            <Panel title="Notifications and payouts">
              <div className="hx-stack hx-stack-sm">
                <Checkbox
                  label="Invitations from job hunters"
                  checked={draft.notifications.invitations}
                  onChange={(event) =>
                    set("notifications", {
                      ...draft.notifications,
                      invitations: event.target.checked,
                    })
                  }
                />
                <Checkbox
                  label="New messages"
                  checked={draft.notifications.messages}
                  onChange={(event) =>
                    set("notifications", { ...draft.notifications, messages: event.target.checked })
                  }
                />
                <Checkbox
                  label="Reviews and corrections"
                  checked={draft.notifications.reviews}
                  onChange={(event) =>
                    set("notifications", { ...draft.notifications, reviews: event.target.checked })
                  }
                />
                <Checkbox
                  label="Payout updates"
                  checked={draft.notifications.payouts}
                  onChange={(event) =>
                    set("notifications", { ...draft.notifications, payouts: event.target.checked })
                  }
                />
                <Checkbox
                  label="Send payouts automatically every Friday"
                  checked={draft.autoPayout}
                  onChange={(event) => set("autoPayout", event.target.checked)}
                />
                <span className="hx-small hx-muted">Payout method: {profile.payoutMethod}</span>
              </div>
            </Panel>
          </div>

          <div className="hx-stack">
            <div className="hx-preview-card hx-sticky">
              <span className="hx-eyebrow">How hunters see you</span>
              <div className="hx-person">
                <Avatar name={draft.name} size={48} />
                <div className="hx-person-text">
                  <strong>{draft.name}</strong>
                  <span className="hx-small hx-muted">{draft.timezone}</span>
                </div>
              </div>
              <p style={{ margin: 0 }}>{draft.headline}</p>
              <div className="hx-chip-row">
                {draft.specialties.map((ats) => (
                  <span key={ats} className="hx-chip">
                    {ats}
                  </span>
                ))}
              </div>
              <dl className="hx-kv">
                <dt>Level</dt>
                <dd>{draft.level}</dd>
                <dt>QA pass rate</dt>
                <dd>{percent(bidderQa(applications), 1)}</dd>
                <dt>Links delivered</dt>
                <dd>{applications.filter((item) => item.status === "qa_passed").length}</dd>
                <dt>Capacity</dt>
                <dd>{draft.weeklyCapacity} links / week</dd>
              </dl>
              <div className="hx-stack hx-stack-sm">
                <span className="hx-eyebrow">
                  Trust checklist · {doneCount}/{draft.verifications.length}
                </span>
                {draft.verifications.map((item) => (
                  <div key={item.id} className="hx-check-row" data-done={item.done}>
                    <span className="hx-check-mark">
                      <Glyph name={item.done ? "check" : "dot"} size="0.9em" />
                    </span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {(dirty || saved) && (
          <div className="hx-savebar">
            <span className="hx-small">
              {saved && !dirty ? "Profile saved." : "You have unsaved changes."}
            </span>
            <div className="hx-row">
              <Button variant="ghost" label="Discard" disabled={!dirty} onClick={reset} />
              <Button variant="primary" label="Save profile" disabled={!dirty} onClick={save} />
            </div>
          </div>
        )}
      </div>
    </PageBody>
  );
}
