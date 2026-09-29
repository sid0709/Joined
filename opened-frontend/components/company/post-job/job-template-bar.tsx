"use client";

import { useEffect, useState } from "react";
import {
  Button,
  HStack,
  Selector,
  Stack,
  Text,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { fetchJobTemplates, saveJobTemplates } from "@/lib/company/api";
import {
  MAX_JOB_TEMPLATES,
  MAX_TEMPLATE_NAME,
  newJobTemplate,
  templateToDraft,
  type JobTemplate,
  type JobTemplateDraft,
} from "@/lib/layer-a";

/** Save the current draft as a reusable template, or load one into the editor. */
export function JobTemplateBar({
  draft,
  onApply,
}: {
  draft: JobTemplateDraft;
  onApply: (draft: JobTemplateDraft) => void;
}) {
  const toast = useToast();
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchJobTemplates()
      .then((loaded) => {
        if (active) setTemplates(loaded);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const options = [
    { value: "", label: "Load a template…" },
    ...templates.map((item) => ({ value: item.id, label: item.name })),
  ];

  const persist = (next: JobTemplate[], message: string) => {
    setBusy(true);
    saveJobTemplates(next)
      .then((saved) => {
        setTemplates(saved);
        toast({ body: message });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }))
      .finally(() => setBusy(false));
  };

  return (
    <Stack gap={3}>
      <Text type="label">Job templates</Text>
      <Text type="supporting" color="secondary">
        Reuse a past posting. Templates stay on this device until Einstein lands GET/PUT
        /v1/company/job-templates.
      </Text>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <Selector
          label="Load template"
          isLabelHidden
          options={options}
          value={selectedId}
          onChange={(value) => {
            setSelectedId(value);
            const match = templates.find((item) => item.id === value);
            if (!match) return;
            onApply(templateToDraft(match));
            toast({ body: `Loaded “${match.name}”.` });
          }}
        />
        <TextInput
          label="Template name"
          isLabelHidden
          value={name}
          onChange={(value) => setName(value.slice(0, MAX_TEMPLATE_NAME))}
          placeholder="Name this template"
        />
        <Button
          label="Save as template"
          variant="secondary"
          isDisabled={!name.trim() || !draft.title.trim() || busy}
          onClick={() => {
            if (templates.length >= MAX_JOB_TEMPLATES) {
              toast({
                body: `You can keep up to ${MAX_JOB_TEMPLATES} templates.`,
                type: "error",
              });
              return;
            }
            const created = newJobTemplate(name, draft);
            setName("");
            setSelectedId(created.id);
            persist([...templates, created], `Saved “${created.name}”.`);
          }}
        />
        {selectedId ? (
          <Button
            label="Delete"
            variant="ghost"
            isDisabled={busy}
            onClick={() => {
              const match = templates.find((item) => item.id === selectedId);
              const next = templates.filter((item) => item.id !== selectedId);
              setSelectedId("");
              persist(next, match ? `Deleted “${match.name}”.` : "Template deleted.");
            }}
          />
        ) : null}
      </HStack>
    </Stack>
  );
}
