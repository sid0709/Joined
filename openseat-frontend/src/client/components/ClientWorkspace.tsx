"use client";

import React, { useState } from "react";
import { Banner, Button, Card, FormLayout, Input, Select, TextArea } from "@/src/shared/marketplace-ui";
import { ClientJobPost } from "@/src/client/types";
import { DEFAULT_JOB_DURATION, DEFAULT_WEEKLY_COMMITMENT } from "@/src/shared/data/mockClientData";

interface ClientWorkspaceProps {
  onPostJob: (job: ClientJobPost) => void;
}

export function ClientWorkspace({ onPostJob }: ClientWorkspaceProps) {
  const [title, setTitle] = useState("");
  const [budgetType, setBudgetType] = useState<"Hourly" | "Fixed-Price">("Hourly");
  const [budgetRange, setBudgetRange] = useState("");
  const [experience, setExperience] = useState<"Entry Level" | "Intermediate" | "Expert">("Intermediate");
  const [description, setDescription] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmitPost = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title || !description || !budgetRange) return;

    onPostJob({
      title,
      budgetType,
      rateOrBudgetRangeText: budgetRange,
      experienceLevelRequired: experience,
      durationEstimateText: DEFAULT_JOB_DURATION,
      weeklyCommitmentText: DEFAULT_WEEKLY_COMMITMENT,
      descriptionParagraph: description,
      skillsTags: skillsText.split(",").map((skill) => skill.trim()).filter(Boolean),
    });

    setSuccess(true);
    setTitle("");
    setDescription("");
    setBudgetRange("");
    setSkillsText("");
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <Card>
      <form onSubmit={handleSubmitPost}>
        <FormLayout>
          <div>
            <h1 className="h1">Post a new job room</h1>
            <p className="body text-ink-muted">Host a focused brief and invite engineering talent to respond.</p>
          </div>
          {success && <Banner tone="success" title="Job room published" description="Your new room is now visible in the marketplace." />}
          <Input label="Job title" placeholder="e.g. Next.js architecture expert needed" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="marketplace-form-grid">
            <Select label="Budget type" value={budgetType} onChange={(event) => setBudgetType(event.target.value as "Hourly" | "Fixed-Price")}>
              <option value="Hourly">Hourly rate</option>
              <option value="Fixed-Price">Fixed-price project</option>
            </Select>
            <Input label="Rate or budget range" placeholder="e.g. $45 - $70" value={budgetRange} onChange={(event) => setBudgetRange(event.target.value)} />
          </div>
          <Select label="Experience level" value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)}>
            <option value="Entry Level">Entry level</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Expert">Expert</option>
          </Select>
          <Input label="Target skills" placeholder="Next.js, TypeScript, Rust" helper="Separate skills with commas." value={skillsText} onChange={(event) => setSkillsText(event.target.value)} />
          <TextArea label="Project brief" placeholder="Describe milestones, constraints, and success criteria." value={description} onChange={(event) => setDescription(event.target.value)} />
          <Button type="submit" variant="primary">Launch sealed room</Button>
        </FormLayout>
      </form>
    </Card>
  );
}
