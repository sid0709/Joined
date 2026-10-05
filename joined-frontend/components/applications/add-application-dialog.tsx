"use client";

import { useState } from "react";
import { FormLayout, Selector, TextInput } from "@joined/design-system";
import { FormDialog } from "@/components/form-dialog";
import { ADD_STAGES, stageOptions, type ApplicationStage } from "@/lib/applications";

const STAGE_OPTIONS = stageOptions(ADD_STAGES);

export type ApplicationDraft = {
  title: string;
  company: string;
  location: string;
  columnId: ApplicationStage;
};

/** Track a job you applied to somewhere else. */
export function AddApplicationDialog({
  isOpen,
  onOpenChange,
  onAdd,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdd: (draft: ApplicationDraft) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [stage, setStage] = useState<ApplicationStage>("applied");

  const submit = async () => {
    await onAdd({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      columnId: stage,
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
      subtitle="For jobs you applied to outside Joined."
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
