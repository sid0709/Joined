"use client";

import { useState } from "react";
import { Button, Stack, TextArea, useToast } from "sid-ui";
import { parseJobDescription } from "@/lib/company/api";
import { SettingsGroup } from "@/components/settings-group";

const PASTE_ROWS = 8;

export type ParsedJob = Awaited<ReturnType<typeof parseJobDescription>>;

/** Paste a job description and fill the form. Nothing is published. */
export function JobAiPaste({ onParsed }: { onParsed: (draft: ParsedJob) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  const fill = () => {
    const description = text.trim();
    if (!description || pending) return;
    setPending(true);
    parseJobDescription(description)
      .then((draft) => {
        onParsed(draft);
        toast({ body: "Fields filled from the job description" });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }))
      .finally(() => setPending(false));
  };

  return (
    <SettingsGroup
      title="Post with AI"
      description="Paste the posting. We fill the fields; you review, then publish."
    >
      <TextArea
        label="Job description"
        value={text}
        onChange={setText}
        rows={PASTE_ROWS}
        placeholder="Paste the full job description"
      />
      <Stack hAlign="end">
        <Button
          label="Fill the form"
          variant="secondary"
          size="sm"
          onClick={fill}
          isDisabled={!text.trim() || pending}
        />
      </Stack>
    </SettingsGroup>
  );
}
