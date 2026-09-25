import type { ReactNode } from "react";
import {
  Button,
  JobCard,
  Badge,
  Nav,
  EmptyState,
  TokenDemo,
} from "@/components/ui";
import { AvatarSamples } from "./_components/AvatarSamples";
import { InputSamples } from "./_components/InputSamples";
import { ToastSamples } from "./_components/ToastSamples";

const CARD_WIDTH = 208;

const SWATCHES = [
  "canvas",
  "surface",
  "surface-sunken",
  "surface-hover",
  "surface-selected",
  "border-subtle",
  "border-default",
  "border-strong",
  "border-focus",
  "ink",
  "ink-muted",
  "ink-faint",
  "primary",
  "primary-hover",
  "primary-active",
  "primary-bg",
  "success",
  "success-bg",
  "warning",
  "warning-bg",
  "danger",
  "danger-bg",
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-12">
      <h2 className="h2 mb-1">{title}</h2>
      {description && <p className="body-sm text-ink-muted mb-4">{description}</p>}
      {children}
    </section>
  );
}

export const metadata = {
  title: "Style guide — OpenSeat",
};

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-canvas px-6 py-8 md:px-12">
      <h1 className="h1 mb-8">OpenSeat style guide</h1>

      <Section
        id="tokens"
        title="Design tokens"
        description="Every token rendered as a sample beside its live value. Toggle it on and switch themes to compare."
      >
        <TokenDemo />
      </Section>

      <Section
        title="Color"
        description='Semantic tokens, reading live from the active theme (data-theme="dark" on <html>).'
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {SWATCHES.map((name) => (
            <div
              key={name}
              className="overflow-hidden rounded-lg border border-border-subtle bg-surface"
            >
              <div className="h-11 border-b border-border-subtle" style={{ background: `var(--${name})` }} />
              <div className="p-2">
                <span className="caption block text-ink">{name}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" description="One family — Inter — separated by size, weight and tracking.">
        <div className="flex flex-col gap-3">
          <p className="display">Sealed rooms, invited bidders.</p>
          <p className="h1">Brand refresh brief</p>
          <p className="h2">Proof of fit</p>
          <p className="h3">Landing page copy</p>
          <p className="body-lg text-ink-muted">
            Scope: a full identity refresh across the marketing site and product UI.
          </p>
          <p className="body">
            Invited bidders can see this room and will show up here once they respond.
          </p>
          <p className="label text-ink-muted">When can you start</p>
          <p className="caption text-ink-muted">Posted 2 days ago</p>
        </div>
      </Section>

      <Section title="Buttons" description="32px by default, 28px in dense rows, 40px for a hero CTA.">
        <div className="flex flex-wrap items-center gap-3">
          <Button label="Post a sealed job" variant="primary" />
          <Button label="Save as draft" variant="secondary" />
          <Button label="Cancel" variant="ghost" />
          <Button label="Close this room" variant="destructive" />
          <Button label="Disabled" variant="primary" isDisabled />
        </div>
      </Section>

      <Section title="Inputs">
        <div className="flex max-w-sm flex-col gap-4">
          <InputSamples />
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge label="Invited" variant="neutral" />
          <Badge label="Selected" variant="info" />
          <Badge label="Bid submitted" variant="success" />
          <Badge label="Pending review" variant="warning" />
          <Badge label="Revoked" variant="error" />
          <Badge label="Design" variant="purple" />
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-wrap items-center gap-3">
          <AvatarSamples />
        </div>
      </Section>

      <Section title="Cards">
        <div className="flex flex-wrap gap-3">
          <JobCard title="Brand refresh brief" meta="Fixed · $2,400" footer="Posted 2 days ago" width={CARD_WIDTH} />
          <JobCard title="Landing page copy" meta="Hourly · $65/hr" href="#landing" width={CARD_WIDTH} />
          <JobCard title="Selected bid" meta="Chosen for this room" selected width={CARD_WIDTH} />
        </div>
      </Section>

      <Section title="Nav">
        <Nav
          brand="OpenSeat"
          items={[{ label: "Dashboard", active: true }, { label: "Job rooms" }, { label: "Messages" }]}
          cta="Post a sealed job"
          showAvatar
        />
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="No bids yet"
          description="Invited bidders can see this room and will show up here once they respond."
          actions={<Button label="Invite a bidder" variant="secondary" />}
        />
      </Section>

      <Section title="Toasts">
        <div className="flex flex-wrap items-center gap-2">
          <ToastSamples />
        </div>
      </Section>
    </div>
  );
}
