"use client";

import { useState } from "react";
import { Banner, Button, Card, FormLayout, Input, Stack, TextArea } from "@/src/shared/marketplace-ui";
import { CandidateProfile } from "@/src/shared/types/auth";
import { JobRoomRecord, ProposalDraft, ProposalMilestone, WorkExample } from "@/src/shared/types/job-room";

interface ProposalFormProps {
  room: JobRoomRecord;
  profile: CandidateProfile;
  onSubmit: (proposal: ProposalDraft) => void;
  onCancel: () => void;
}

function makeMilestone(index: number): ProposalMilestone {
  return {
    id: `proposal-milestone-${Date.now()}-${index}`,
    title: index === 1 ? "Discovery and plan" : "Build and handoff",
    deliverable: index === 1 ? "Align on requirements, risks, and the first delivery plan." : "Deliver the agreed implementation, walkthrough, and handoff notes.",
    amountText: index === 1 ? "25% of project" : "75% of project",
    dueDate: index === 1 ? "Week 1" : "Final week",
  };
}

export function ProposalForm({ room, profile, onSubmit, onCancel }: ProposalFormProps) {
  const [candidateRate, setCandidateRate] = useState(room.budgetType === "Hourly" ? `${profile.hourlyRate}/hr` : room.rateOrBudgetRangeText);
  const [estimatedTimelineText, setEstimatedTimelineText] = useState(room.durationEstimateText);
  const [availabilityText, setAvailabilityText] = useState("20+ hrs/week · Available to start soon");
  const [coverLetterText, setCoverLetterText] = useState(profile.bio);
  const [milestones, setMilestones] = useState<ProposalMilestone[]>([makeMilestone(1), makeMilestone(2)]);
  const [workExamples, setWorkExamples] = useState<WorkExample[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMilestone = (id: string, field: keyof ProposalMilestone, value: string) => {
    setMilestones((current) => current.map((milestone) => milestone.id === id ? { ...milestone, [field]: value } : milestone));
  };

  const updateExample = (id: string, field: keyof WorkExample, value: string) => {
    setWorkExamples((current) => current.map((example) => example.id === id ? { ...example, [field]: value } : example));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!candidateRate.trim() || !estimatedTimelineText.trim() || !availabilityText.trim() || !coverLetterText.trim()) {
      setErrorMessage("Complete your rate, timeline, availability, and cover letter before submitting.");
      return;
    }
    const completeMilestones = milestones.filter((milestone) => milestone.title.trim() && milestone.deliverable.trim());
    if (!completeMilestones.length) {
      setErrorMessage("Add at least one milestone with a deliverable.");
      return;
    }
    setErrorMessage(null);
    onSubmit({
      candidateRate: candidateRate.trim(),
      estimatedTimelineText: estimatedTimelineText.trim(),
      availabilityText: availabilityText.trim(),
      coverLetterText: coverLetterText.trim(),
      milestones: completeMilestones,
      workExamples: workExamples.filter((example) => example.title.trim() && example.summary.trim()),
    });
  };

  return (
    <form onSubmit={submit} className="marketplace-proposal-form">
      <FormLayout>
        <div>
          <span className="label text-primary">PROPOSAL</span>
          <h2 className="h2">Make your case clearly</h2>
          <p className="body-sm text-ink-muted">Clients compare the commercial terms and delivery plan before they compare the prose.</p>
        </div>
        {errorMessage && <Banner tone="danger" title={errorMessage} />}
        <div className="marketplace-form-grid">
          <Input label={room.budgetType === "Hourly" ? "Your hourly rate" : "Your project price"} value={candidateRate} onChange={(event) => setCandidateRate(event.target.value)} placeholder="$65/hr or $8,000" />
          <Input label="Estimated timeline" value={estimatedTimelineText} onChange={(event) => setEstimatedTimelineText(event.target.value)} placeholder="e.g. 4 weeks" />
        </div>
        <Input label="Availability" value={availabilityText} onChange={(event) => setAvailabilityText(event.target.value)} placeholder="e.g. 30+ hrs/week · Starts Monday" />
        <TextArea label="Cover letter" value={coverLetterText} onChange={(event) => setCoverLetterText(event.target.value)} placeholder="Explain how you will solve this specific brief." />

        <div className="marketplace-proposal-form-section">
          <div className="marketplace-section-heading">
            <div><span className="label text-primary">DELIVERY PLAN</span><h3 className="h2">Milestones</h3></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setMilestones((current) => [...current, makeMilestone(current.length + 1)])}>Add milestone</Button>
          </div>
          <Stack gap={12}>
            {milestones.map((milestone, index) => (
              <Card key={milestone.id} title={`Milestone ${index + 1}`} meta="A reviewable outcome with a clear handoff">
                <div className="marketplace-form-grid">
                  <Input label="Milestone title" value={milestone.title} onChange={(event) => updateMilestone(milestone.id, "title", event.target.value)} />
                  <Input label="Amount or share" value={milestone.amountText} onChange={(event) => updateMilestone(milestone.id, "amountText", event.target.value)} placeholder="$2,000 or 25%" />
                </div>
                <div className="marketplace-form-grid">
                  <Input label="Due date" value={milestone.dueDate} onChange={(event) => updateMilestone(milestone.id, "dueDate", event.target.value)} placeholder="e.g. Week 2" />
                  <Input label="Deliverable" value={milestone.deliverable} onChange={(event) => updateMilestone(milestone.id, "deliverable", event.target.value)} />
                </div>
                {milestones.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setMilestones((current) => current.filter((item) => item.id !== milestone.id))}>Remove milestone</Button>}
              </Card>
            ))}
          </Stack>
        </div>

        <div className="marketplace-proposal-form-section">
          <div className="marketplace-section-heading">
            <div><span className="label text-primary">PROOF OF WORK</span><h3 className="h2">Relevant examples</h3></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setWorkExamples((current) => [...current, { id: `example-${Date.now()}`, title: "", url: "", summary: "" }])}>Add example</Button>
          </div>
          {!workExamples.length && <p className="body-sm text-ink-muted">Optional, but strong examples make comparison faster for the client.</p>}
          <Stack gap={12}>
            {workExamples.map((example) => (
              <Card key={example.id}>
                <div className="marketplace-form-grid">
                  <Input label="Example title" value={example.title} onChange={(event) => updateExample(example.id, "title", event.target.value)} placeholder="e.g. Subscription checkout rebuild" />
                  <Input label="Link" value={example.url} onChange={(event) => updateExample(example.id, "url", event.target.value)} placeholder="https://..." />
                </div>
                <TextArea label="What is relevant?" value={example.summary} onChange={(event) => updateExample(example.id, "summary", event.target.value)} placeholder="Describe the result and your contribution." />
                <Button type="button" variant="ghost" size="sm" onClick={() => setWorkExamples((current) => current.filter((item) => item.id !== example.id))}>Remove example</Button>
              </Card>
            ))}
          </Stack>
        </div>

        <div className="marketplace-modal-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary">Submit complete proposal</Button>
        </div>
      </FormLayout>
    </form>
  );
}
