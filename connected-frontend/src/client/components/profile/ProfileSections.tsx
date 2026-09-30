"use client";

import { Switch } from "@openseat/design-system";

import type { ProfileForm } from "@/src/client/components/profile/useProfileForm";
import type {
  InterviewAvailability,
  NotificationPreferences,
} from "@/src/shared/types/marketplace";

import { Panel } from "@/src/shared/kit/Panel";
import { Badge, Input, Select, TextArea } from "@/src/shared/marketplace-ui";

interface SectionProps {
  form: ProfileForm;
  set: <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LENGTHS = [15, 30, 45, 60];
const BUFFERS = [0, 5, 10, 15, 30];
const TIMEZONES = [
  "Eastern Time (ET)",
  "Central Time (CT)",
  "Mountain Time (MT)",
  "Pacific Time (PT)",
  "UTC",
  "Central European Time (CET)",
  "India Standard Time (IST)",
];

const hourLabel = (hour: number) => `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`;

const NOTIFICATION_ROWS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "inquiries",
    label: "New bidder inquiries",
    description: "When a bidder contacts you about a task.",
  },
  {
    key: "interviews",
    label: "Interview reminders",
    description: "One hour before each scheduled interview, and when an outcome is due.",
  },
  {
    key: "qa",
    label: "QA and delivery alerts",
    description: "Applications waiting for review, returned links, and pace warnings.",
  },
  {
    key: "billing",
    label: "Billing and invoices",
    description: "New invoices, due dates, and low wallet balance.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly summary email",
    description: "A Monday recap of hires, interviews, and spend.",
  },
];

export function AccountSection({ form, set }: SectionProps) {
  return (
    <Panel title="Account" subtitle="How you sign in and how bidders address you">
      <div className="hx-field-grid">
        <Input
          label="Full name"
          value={form.fullName}
          onChange={(event) => set("fullName", event.target.value)}
        />
        <Input
          label="Email address"
          type="email"
          value={form.email}
          onChange={(event) => set("email", event.target.value)}
        />
      </div>
    </Panel>
  );
}

export function BusinessSection({ form, set }: SectionProps) {
  return (
    <Panel
      title="Business profile"
      subtitle="Bidders see this before they contact you about a task"
    >
      <div className="hx-field-grid">
        <Input
          label="Business or brand name"
          value={form.company}
          onChange={(event) => set("company", event.target.value)}
        />
        <Input
          label="Type of business"
          placeholder="Coaching practice, agency, recruiter…"
          value={form.organizationType}
          onChange={(event) => set("organizationType", event.target.value)}
        />
        <Input
          label="Industry focus"
          placeholder="Product and operations leaders"
          value={form.industry}
          onChange={(event) => set("industry", event.target.value)}
        />
        <Input
          label="Location"
          value={form.location}
          onChange={(event) => set("location", event.target.value)}
        />
        <Input
          label="Website"
          placeholder="https://"
          value={form.website}
          onChange={(event) => set("website", event.target.value)}
        />
      </div>
      <Input
        label="Headline"
        helper="One sentence that appears on every task you post"
        value={form.headline}
        onChange={(event) => set("headline", event.target.value)}
      />
      <TextArea
        label="About your work"
        placeholder="Who you help and how you run your job search service"
        value={form.description}
        onChange={(event) => set("description", event.target.value)}
      />
    </Panel>
  );
}

export function HiringSection({ form, set }: SectionProps) {
  return (
    <Panel title="How you hire bidders" subtitle="Set expectations before the first message">
      <TextArea
        label="What you need from bidders"
        placeholder="Experience, daily pace, tools, response times"
        value={form.hiringNeeds}
        onChange={(event) => set("hiringNeeds", event.target.value)}
      />
      <TextArea
        label="How you evaluate bidders"
        placeholder="Screening chat, interview, then a paid trial batch"
        value={form.evaluationApproach}
        onChange={(event) => set("evaluationApproach", event.target.value)}
      />
    </Panel>
  );
}

export function AvailabilitySection({ form, set }: SectionProps) {
  const availability = form.availability;
  const update = (patch: Partial<InterviewAvailability>) =>
    set("availability", { ...availability, ...patch });
  const toggleDay = (day: number) =>
    update({
      days: availability.days.includes(day)
        ? availability.days.filter((item) => item !== day)
        : [...availability.days, day].sort(),
    });

  return (
    <Panel
      title="Interview availability"
      subtitle="The interview calendar only offers slots inside these hours"
    >
      <div className="hx-stack hx-stack-sm">
        <strong className="hx-strong">Working days</strong>
        <div className="hx-chip-row">
          {DAYS.map((label, day) => (
            <button
              key={label}
              type="button"
              className="hx-chip hx-day"
              aria-pressed={availability.days.includes(day)}
              onClick={() => toggleDay(day)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="hx-field-grid">
        <Select
          label="Start of day"
          value={String(availability.startHour)}
          onChange={(event) => update({ startHour: Number(event.target.value) })}
        >
          {HOURS.filter((hour) => hour < availability.endHour).map((hour) => (
            <option key={hour} value={String(hour)}>
              {hourLabel(hour)}
            </option>
          ))}
        </Select>
        <Select
          label="End of day"
          value={String(availability.endHour)}
          onChange={(event) => update({ endHour: Number(event.target.value) })}
        >
          {HOURS.filter((hour) => hour > availability.startHour).map((hour) => (
            <option key={hour} value={String(hour)}>
              {hourLabel(hour)}
            </option>
          ))}
        </Select>
        <Select
          label="Default interview length"
          value={String(availability.defaultDurationMin)}
          onChange={(event) => update({ defaultDurationMin: Number(event.target.value) })}
        >
          {LENGTHS.map((minutes) => (
            <option key={minutes} value={String(minutes)}>
              {minutes} minutes
            </option>
          ))}
        </Select>
        <Select
          label="Buffer between interviews"
          value={String(availability.bufferMin)}
          onChange={(event) => update({ bufferMin: Number(event.target.value) })}
        >
          {BUFFERS.map((minutes) => (
            <option key={minutes} value={String(minutes)}>
              {minutes ? `${minutes} minutes` : "No buffer"}
            </option>
          ))}
        </Select>
        <Select
          label="Timezone"
          value={availability.timezone}
          onChange={(event) => update({ timezone: event.target.value })}
        >
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Video meeting link"
        helper="Shared with bidders when you book a video interview"
        value={availability.meetingLink}
        onChange={(event) => update({ meetingLink: event.target.value })}
      />
    </Panel>
  );
}

export function NotificationsSection({ form, set }: SectionProps) {
  return (
    <Panel title="Notifications" subtitle="Choose what reaches your inbox">
      <div className="hx-stack">
        {NOTIFICATION_ROWS.map((row) => (
          <Switch
            key={row.key}
            label={row.label}
            description={row.description}
            value={form.notifications[row.key]}
            onChange={(checked) =>
              set("notifications", { ...form.notifications, [row.key]: checked })
            }
          />
        ))}
      </div>
    </Panel>
  );
}

export function PaymentsSection({
  form,
  set,
  identity,
  payment,
}: SectionProps & { identity: string; payment: string }) {
  return (
    <Panel
      title="Verification and payments"
      subtitle="Bidders trust job hunters who are verified and pay on time"
    >
      <dl className="hx-kv">
        <dt>Identity</dt>
        <dd>
          <Badge label={identity} tone={identity === "Verified" ? "success" : "warning"} />
        </dd>
        <dt>Payment method</dt>
        <dd>
          <Badge label={payment} tone={payment === "Verified" ? "success" : "warning"} />
        </dd>
        <dt>Card on file</dt>
        <dd>Visa ending 4417</dd>
      </dl>
      <Switch
        label="Top up my wallet automatically"
        description="Adds funds when your balance cannot cover the next invoice."
        value={form.autoTopUp}
        onChange={(checked) => set("autoTopUp", checked)}
      />
    </Panel>
  );
}
