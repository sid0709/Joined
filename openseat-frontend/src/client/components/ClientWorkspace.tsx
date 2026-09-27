"use client";

import React, { useState } from "react";

import { ClientJobPost } from "@/src/client/types";
import { DEFAULT_JOB_DURATION, DEFAULT_WEEKLY_COMMITMENT } from "@/src/shared/data/mockClientData";
import {
  Banner,
  Button,
  Card,
  FormLayout,
  Input,
  Select,
  TextArea,
} from "@/src/shared/marketplace-ui";

interface ClientWorkspaceProps {
  onPostJob: (job: ClientJobPost) => void;
}

export function ClientWorkspace({ onPostJob }: ClientWorkspaceProps) {
  const [title, setTitle] = useState("");
  const [sourceCompany, setSourceCompany] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [budgetType, setBudgetType] = useState<"Hourly" | "Fixed-Price">("Hourly");
  const [budgetRange, setBudgetRange] = useState("");
  const [experience, setExperience] = useState<"Entry Level" | "Intermediate" | "Expert">(
    "Intermediate",
  );
  const [description, setDescription] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmitPost = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title || !sourceCompany || !sourceUrl || !description || !budgetRange) return;

    onPostJob({
      title,
      sourceCompany,
      sourceUrl,
      applicationDeadline,
      budgetType,
      rateOrBudgetRangeText: budgetRange,
      experienceLevelRequired: experience,
      durationEstimateText: DEFAULT_JOB_DURATION,
      weeklyCommitmentText: DEFAULT_WEEKLY_COMMITMENT,
      descriptionParagraph: description,
      skillsTags: skillsText
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    });

    setSuccess(true);
    setTitle("");
    setSourceCompany("");
    setSourceUrl("");
    setApplicationDeadline("");
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
            <h1 className="h1">Add an external job</h1>
            <p className="body text-ink-muted">
              Bring a company job link into your pool, then assign the right bidders to apply and
              track the outcome.
            </p>
          </div>
          {success && (
            <Banner
              tone="success"
              title="External job added"
              description="The job link is now available in your pool for bidder assignment."
            />
          )}
          <Input
            label="Company"
            placeholder="e.g. Meta, Uber, Amazon, Capital One"
            value={sourceCompany}
            onChange={(event) => setSourceCompany(event.target.value)}
          />
          <Input
            label="Original job link"
            placeholder="https://company.com/jobs/..."
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
          <div className="marketplace-form-grid">
            <Input
              label="Job title"
              placeholder="e.g. Senior Backend Engineer"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Input
              label="Application deadline"
              placeholder="YYYY-MM-DD"
              value={applicationDeadline}
              onChange={(event) => setApplicationDeadline(event.target.value)}
            />
          </div>
          <div className="marketplace-form-grid">
            <Select
              label="Budget type"
              value={budgetType}
              onChange={(event) => setBudgetType(event.target.value as "Hourly" | "Fixed-Price")}
            >
              <option value="Hourly">Hourly rate</option>
              <option value="Fixed-Price">Fixed-price project</option>
            </Select>
            <Input
              label="Rate or budget range"
              placeholder="e.g. $45 - $70"
              value={budgetRange}
              onChange={(event) => setBudgetRange(event.target.value)}
            />
          </div>
          <Select
            label="Experience level"
            value={experience}
            onChange={(event) => setExperience(event.target.value as typeof experience)}
          >
            <option value="Entry Level">Entry level</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Expert">Expert</option>
          </Select>
          <Input
            label="Target skills"
            placeholder="Next.js, TypeScript, Rust"
            helper="Separate skills with commas."
            value={skillsText}
            onChange={(event) => setSkillsText(event.target.value)}
          />
          <TextArea
            label="Job requirements and notes"
            placeholder="Capture the company requirements, location, salary, and the details bidders need before applying."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button type="submit" variant="primary">
            Add to job pool
          </Button>
        </FormLayout>
      </form>
    </Card>
  );
}
