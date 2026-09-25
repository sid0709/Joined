"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, FormLayout, Input, PageBody, TextArea } from "@openseat/design-system";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export function CandidateProfileForm() {
  const router = useRouter();
  const { currentUser, profile, updateProfile } = useMockAuth();
  const [title, setTitle] = useState(profile.title);
  const [hourlyRate, setHourlyRate] = useState(profile.hourlyRate);
  const [bio, setBio] = useState(profile.bio);
  const [success, setSuccess] = useState(false);

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile({ title, hourlyRate, bio });
    setSuccess(true);
    setTimeout(() => router.push("/marketplace/candidate/dashboard"), 1200);
  };

  return (
    <PageBody>
      <div className="marketplace-narrow-page">
        <Button variant="secondary" onClick={() => router.push("/marketplace/candidate/dashboard")}>
          Skip to dashboard
        </Button>
        <Card className="marketplace-form-card">
          <form onSubmit={handleSaveProfile}>
            <FormLayout>
              <div>
                <h1 className="h1">Set up your bidder profile</h1>
                <p className="body text-ink-muted">Configure the professional details clients will see when you bid.</p>
              </div>
              {success && <Banner tone="success" title="Profile saved" description="Forwarding you to the candidate dashboard." />}
              <Input label="Account holder" value={currentUser?.fullName ?? ""} disabled />
              <Input label="Professional title" placeholder="e.g. Senior Frontend Engineer" value={title} onChange={(event) => setTitle(event.target.value)} />
              <Input label="Hourly rate" placeholder="e.g. $50.00" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
              <TextArea label="Professional biography" placeholder="Describe your engineering expertise, background, and goals." value={bio} onChange={(event) => setBio(event.target.value)} />
              <Button type="submit" variant="primary" className="marketplace-full-width">Save profile</Button>
            </FormLayout>
          </form>
        </Card>
      </div>
    </PageBody>
  );
}
