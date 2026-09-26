"use client";

import React, { useState } from "react";
import { Banner, Badge, Button, Card, FormLayout, Input, PageBody, Stack, TextArea } from "@/src/shared/marketplace-ui";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export default function ClientProfilePage() {
  const { currentUser, clientProfile, updateClientProfile, updateAccount } = useMockAuth();
  const [fullName, setFullName] = useState(() => currentUser?.fullName ?? "");
  const [email, setEmail] = useState(() => currentUser?.email ?? "");
  const [organizationName, setOrganizationName] = useState(clientProfile.organizationName);
  const [organizationType, setOrganizationType] = useState(clientProfile.organizationType);
  const [industry, setIndustry] = useState(clientProfile.industry);
  const [location, setLocation] = useState(clientProfile.location);
  const [description, setDescription] = useState(clientProfile.description);
  const [hiringNeeds, setHiringNeeds] = useState(clientProfile.hiringNeeds);
  const [evaluationApproach, setEvaluationApproach] = useState(clientProfile.evaluationApproach);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; description?: string } | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = updateAccount({ fullName, email });
    if (result.success) updateClientProfile({ organizationName, organizationType, industry, location, description, hiringNeeds, evaluationApproach });
    setNotice(result.success
      ? { tone: "success", title: "Profile updated", description: "Your account details are saved." }
      : { tone: "danger", title: result.error ?? "Could not update profile" });
  };

  return (
    <PageBody>
      <div className="marketplace-profile-layout">
        <div>
          <span className="label text-primary">JOB HUNTER PROFILE</span>
          <h1 className="h1">Your hiring profile</h1>
          <p className="body text-ink-muted">Give bidders enough context to trust your briefs, understand your evaluation process, and see that payment and delivery are handled professionally.</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit}>
            <FormLayout>
              {notice && <Banner tone={notice.tone} title={notice.title} description={notice.description} />}
              <div><h2 className="h2">Account and organization</h2><p className="body-sm text-ink-muted">This information appears around your job rooms and applicant conversations.</p></div>
              <Input label="Job hunter name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <Input label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Input label="Organization or project name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
              <Input label="Organization type" placeholder="e.g. Startup, agency, enterprise team" value={organizationType} onChange={(event) => setOrganizationType(event.target.value)} />
              <Input label="Industry or domain" placeholder="e.g. Healthcare technology" value={industry} onChange={(event) => setIndustry(event.target.value)} />
              <Input label="Location" placeholder="e.g. United States · Remote-first" value={location} onChange={(event) => setLocation(event.target.value)} />
              <TextArea label="About the job hunter" placeholder="Explain what your team builds and the kinds of outcomes you hire bidders to deliver." value={description} onChange={(event) => setDescription(event.target.value)} />
              <TextArea label="Typical hiring needs" placeholder="What skills, roles, and project types do you usually need?" value={hiringNeeds} onChange={(event) => setHiringNeeds(event.target.value)} />
              <TextArea label="Evaluation and collaboration approach" placeholder="Describe how you schedule tests, review milestones, communicate, and make decisions." value={evaluationApproach} onChange={(event) => setEvaluationApproach(event.target.value)} />
              <Button type="submit" variant="primary">Save profile</Button>
            </FormLayout>
          </form>
        </Card>
        <Card title="Trust signals for bidders" meta="These signals help strong bidders decide whether to respond.">
          <Stack gap={12}>
            <div className="marketplace-profile-row"><span>Identity verification</span><Badge label={clientProfile.identityStatus} tone={clientProfile.identityStatus === "Verified" ? "success" : "neutral"} /></div>
            <div className="marketplace-profile-row"><span>Payment verification</span><Badge label={clientProfile.paymentStatus} tone={clientProfile.paymentStatus === "Verified" ? "success" : "neutral"} /></div>
            <div className="marketplace-profile-row"><span>Evaluation method</span><strong>Structured and room-linked</strong></div>
            <div className="marketplace-profile-row"><span>Hiring workflow</span><strong>Brief → evaluation → milestones</strong></div>
            <div className="marketplace-profile-row"><span>Bidder communication</span><strong>Messages and notifications in every room</strong></div>
          </Stack>
        </Card>
      </div>
    </PageBody>
  );
}
