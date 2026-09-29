"use client";

import {
  AccountSection,
  AvailabilitySection,
  BusinessSection,
  HiringSection,
  NotificationsSection,
  PaymentsSection,
} from "@/src/client/components/profile/ProfileSections";
import { ProfileSidebar } from "@/src/client/components/profile/ProfileSidebar";
import { useProfileForm } from "@/src/client/components/profile/useProfileForm";
import { PageHeader } from "@/src/client/components/ui/PageHeader";
import { Person } from "@/src/client/components/ui/Person";
import { Banner, Button, PageBody } from "@/src/shared/marketplace-ui";

export function ProfileView() {
  const { form, set, dirty, save, reset, notice, checklist, completeness, identity, payment } =
    useProfileForm();

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Job hunter profile"
          title="Your profile"
          description="Bidders read this before they contact you, and your interview calendar uses your availability. A complete profile gets better bidders and faster replies."
          meta={<Person name={form.fullName || "You"} detail={form.company} size={48} />}
        />

        {notice && <Banner tone={notice.tone} title={notice.title} />}

        <div className="hx-split">
          <div className="hx-stack">
            <AccountSection form={form} set={set} />
            <BusinessSection form={form} set={set} />
            <HiringSection form={form} set={set} />
            <AvailabilitySection form={form} set={set} />
            <NotificationsSection form={form} set={set} />
            <PaymentsSection form={form} set={set} identity={identity} payment={payment} />
          </div>
          <ProfileSidebar form={form} checklist={checklist} completeness={completeness} />
        </div>

        {dirty && (
          <div className="hx-savebar">
            <span className="hx-strong">You have unsaved changes</span>
            <div className="hx-row">
              <Button variant="ghost" label="Discard" onClick={reset} />
              <Button variant="primary" label="Save profile" onClick={save} />
            </div>
          </div>
        )}
      </div>
    </PageBody>
  );
}
