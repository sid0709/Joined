"use client";

import { useState } from "react";
import { FormLayout, Selector, TextInput } from "@openseat/design-system";
import { FormDialog } from "@/components/form-dialog";
import { STAGES, type Application, type ApplicationStage } from "@/lib/applications";

const STAGE_OPTIONS = STAGES.filter((stage) => stage.id !== "closed").map((stage) => ({
  value: stage.id,
  label: stage.title,
}));
const DEFAULT_RESUME = "General";
const UNKNOWN_MATCH = 0;

/** Track a job you applied to somewhere else. */
export function AddApplicationDialog({
  isOpen,
  onOpenChange,
  onAdd,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdd: (application: Application) => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [stage, setStage] = useState<ApplicationStage>("applied");

  const submit = () => {
    const now = new Date();
    onAdd({
      id: `app-${now.getTime()}`,
      columnId: stage,
      jobId: "",
      title: title.trim(),
      company: company.trim(),
      location: location.trim() || "—",
      salary: "—",
      source: "scouted",
      resume: DEFAULT_RESUME,
      match: UNKNOWN_MATCH,
      updated: now,
      activity: [{ id: `evt-${now.getTime()}`, label: "Added to tracker", date: now }],
    });
    setTitle("");
    setCompany("");
    setLocation("");
    setStage("applied");
    onOpenChange(false);
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Track an application"
      subtitle="For jobs you applied to outside Opened."
      submitLabel="Add to tracker"
      onSubmit={submit}
      isSubmitDisabled={!title.trim() || !company.trim()}
    >
      <FormLayout>
        <TextInput
          label="Role"
          value={title}
          onChange={setTitle}
          isRequired
          placeholder="Product Designer"
        />
        <TextInput
          label="Company"
          value={company}
          onChange={setCompany}
          isRequired
          placeholder="Acme"
        />
        <TextInput
          label="Location"
          value={location}
          onChange={setLocation}
          isOptional
          placeholder="Remote"
        />
        <Selector
          label="Stage"
          options={STAGE_OPTIONS}
          value={stage}
          onChange={(value) => setStage(value as ApplicationStage)}
        />
      </FormLayout>
    </FormDialog>
  );
}
