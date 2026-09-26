"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Badge, Button, Card, FormLayout, Input, PageBody, Stack, TextArea } from "@/src/shared/marketplace-ui";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export function CandidateProfileForm() {
  const router = useRouter();
  const { currentUser, profile, updateProfile } = useMockAuth();
  const [title, setTitle] = useState(profile.title);
  const [hourlyRate, setHourlyRate] = useState(profile.hourlyRate);
  const [bio, setBio] = useState(profile.bio);
  const [skillsText, setSkillsText] = useState(profile.skills.join(", "));
  const [specialty, setSpecialty] = useState(profile.specialty);
  const [yearsExperience, setYearsExperience] = useState(profile.yearsExperience);
  const [availability, setAvailability] = useState(profile.availability);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [workExamplesText, setWorkExamplesText] = useState(profile.workExamples.join("\n"));
  const [success, setSuccess] = useState(false);

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile({ title, hourlyRate, bio, skills: skillsText.split(",").map((skill) => skill.trim()).filter(Boolean), specialty, yearsExperience, availability, timezone, workExamples: workExamplesText.split("\n").map((url) => url.trim()).filter(Boolean) });
    setSuccess(true);
    setTimeout(() => router.push("/marketplace/candidate/bids"), 1200);
  };

  return (
    <PageBody>
      <div className="marketplace-narrow-page">
        <Button variant="secondary" onClick={() => router.push("/marketplace/candidate/bids")}>
          Back to my bids
        </Button>
        <div className="marketplace-page-header marketplace-page-intro"><div><span className="label text-primary">BIDDER PROFILE</span><h1 className="h1">Your professional bidder profile</h1><p className="body text-ink-muted">Job hunters use this page to decide whether to approve you, invite you to an evaluation, or assign you a job link.</p></div><Badge label={profile.verificationStatus} tone={profile.verificationStatus === "Verified" ? "success" : "neutral"} /></div>
        <div className="marketplace-dashboard-grid">
          <Card title="Public decision signals" meta="These are the first things a job hunter should understand"><Stack gap={12}><div className="marketplace-profile-row"><span>Performance score</span><strong>{profile.performanceScore}</strong></div><div className="marketplace-profile-row"><span>Scheduling reliability</span><strong>{profile.schedulingReliability}</strong></div><div className="marketplace-profile-row"><span>Availability</span><strong>{profile.availability}</strong></div><div className="marketplace-profile-row"><span>Rate</span><strong>{profile.hourlyRate}</strong></div></Stack></Card>
          <Card title="Why this profile matters" meta="Profile exposure is the bidder's first workflow"><p className="body-sm">A strong profile helps clients find you, understand your fit, and make a fair-rate decision before messaging or approving you.</p><p className="body-sm text-ink-muted">Keep your performance results, schedule, examples, and rate current.</p></Card>
        </div>
        <Card className="marketplace-form-card">
          <form onSubmit={handleSaveProfile}>
            <FormLayout>
              <div><h2 className="h2">Profile details</h2><p className="body text-ink-muted">Make your capability, working conditions, and proof easy to evaluate.</p></div>
              {success && <Banner tone="success" title="Profile saved" description="Returning you to your bids and assigned job links." />}
              <Input label="Account holder" value={currentUser?.fullName ?? ""} disabled />
              <Input label="Bidder headline" placeholder="e.g. Senior Frontend Engineer" helper="Describe the outcome you are trusted to deliver." value={title} onChange={(event) => setTitle(event.target.value)} />
              <Input label="Primary specialty" placeholder="e.g. Product systems and workflow automation" value={specialty} onChange={(event) => setSpecialty(event.target.value)} />
              <Input label="Skills" placeholder="Next.js, TypeScript, React" helper="Separate skills with commas." value={skillsText} onChange={(event) => setSkillsText(event.target.value)} />
              <Input label="Experience" placeholder="e.g. 5+ years" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} />
              <Input label="Fair-rate expectation" placeholder="e.g. $50.00/hr" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />
              <Input label="Working availability" placeholder="e.g. 20+ hrs/week · Starts next Monday" value={availability} onChange={(event) => setAvailability(event.target.value)} />
              <Input label="Working timezone" placeholder="e.g. Eastern Time (ET)" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
              <TextArea label="Bidder introduction" placeholder="Explain your relevant experience, communication style, and the type of job-room outcomes you deliver." value={bio} onChange={(event) => setBio(event.target.value)} />
              <TextArea label="Relevant work links" placeholder="One portfolio, case study, or work link per line." value={workExamplesText} onChange={(event) => setWorkExamplesText(event.target.value)} />
              <Button type="submit" variant="primary" className="marketplace-full-width">Save profile</Button>
            </FormLayout>
          </form>
        </Card>
      </div>
    </PageBody>
  );
}
