"use client";

import { useMemo, useState } from "react";

import type {
  InterviewAvailability,
  NotificationPreferences,
} from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export interface ProfileForm {
  fullName: string;
  email: string;
  company: string;
  organizationType: string;
  industry: string;
  location: string;
  website: string;
  headline: string;
  description: string;
  hiringNeeds: string;
  evaluationApproach: string;
  availability: InterviewAvailability;
  notifications: NotificationPreferences;
  autoTopUp: boolean;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

const MIN_TEXT = 20;

/** One form over three sources: the account, the organisation profile, and hunter preferences. */
export function useProfileForm() {
  const { currentUser, clientProfile, updateAccount, updateClientProfile } = useMockAuth();
  const { profile, updateProfile } = useHunter();

  const initial = useMemo<ProfileForm>(
    () => ({
      fullName: currentUser?.fullName ?? profile.name,
      email: currentUser?.email ?? "",
      company: clientProfile.organizationName,
      organizationType: clientProfile.organizationType,
      industry: clientProfile.industry,
      location: clientProfile.location,
      website: profile.website,
      headline: profile.headline,
      description: clientProfile.description,
      hiringNeeds: clientProfile.hiringNeeds,
      evaluationApproach: clientProfile.evaluationApproach,
      availability: profile.availability,
      notifications: profile.notifications,
      autoTopUp: profile.autoTopUp,
    }),
    // Snapshot once; later edits live in the form until saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [form, setForm] = useState<ProfileForm>(initial);
  const [saved, setSaved] = useState<ProfileForm>(initial);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string } | null>(null);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const save = () => {
    const account = updateAccount({ fullName: form.fullName, email: form.email });
    if (!account.success)
      return setNotice({
        tone: "danger",
        title: account.error ?? "Could not update your account.",
      });
    updateClientProfile({
      organizationName: form.company,
      organizationType: form.organizationType,
      industry: form.industry,
      location: form.location,
      description: form.description,
      hiringNeeds: form.hiringNeeds,
      evaluationApproach: form.evaluationApproach,
    });
    updateProfile({
      name: form.fullName,
      company: form.company,
      headline: form.headline,
      website: form.website,
      availability: form.availability,
      notifications: form.notifications,
      autoTopUp: form.autoTopUp,
    });
    setSaved(form);
    setNotice({
      tone: "success",
      title: "Profile saved. Bidders and your interview calendar use the new details.",
    });
  };

  const reset = () => {
    setForm(saved);
    setNotice(null);
  };

  const checklist: ChecklistItem[] = [
    { label: "Add your name and email", done: Boolean(form.fullName.trim() && form.email.trim()) },
    { label: "Name your business", done: Boolean(form.company.trim()) },
    { label: "Write a headline bidders will read", done: form.headline.trim().length >= MIN_TEXT },
    { label: "Describe how you work", done: form.description.trim().length >= MIN_TEXT },
    {
      label: "Explain what you need from bidders",
      done: form.hiringNeeds.trim().length >= MIN_TEXT,
    },
    {
      label: "Explain how you evaluate bidders",
      done: form.evaluationApproach.trim().length >= MIN_TEXT,
    },
    {
      label: "Set interview availability",
      done: form.availability.days.length > 0 && Boolean(form.availability.meetingLink.trim()),
    },
    { label: "Verify your identity", done: clientProfile.identityStatus === "Verified" },
    { label: "Verify a payment method", done: clientProfile.paymentStatus === "Verified" },
  ];
  const completeness = Math.round(
    (checklist.filter((item) => item.done).length / checklist.length) * 100,
  );

  return {
    form,
    set,
    dirty,
    save,
    reset,
    notice,
    checklist,
    completeness,
    identity: clientProfile.identityStatus,
    payment: clientProfile.paymentStatus,
  };
}
