"use client";

import { Button, HStack, Icon, IconButton, Stack, Text, TextArea, TextInput, icons } from "sid-ui";
import {
  MAX_GUIDE_PROMPTS,
  MAX_GUIDE_SECTIONS,
  newGuideSection,
  type InterviewGuide,
  type InterviewGuideSection,
} from "@/lib/pipeline-eval";

const PROMPT_ROWS = 2;

/** Structured interview guide editor. */
export function InterviewGuideShell({
  value,
  onChange,
}: {
  value: InterviewGuide;
  onChange: (next: InterviewGuide) => void;
}) {
  const updateSection = (id: string, patch: Partial<InterviewGuideSection>) =>
    onChange({
      ...value,
      sections: value.sections.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });

  return (
    <Stack gap={3}>
      <Text type="supporting" color="secondary">
        Prompts interviewers see before and during the round. Not shown to candidates.
      </Text>
      <TextInput
        label="Guide title"
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
      />
      {value.sections.map((section, index) => (
        <Stack key={section.id} gap={2}>
          <HStack gap={2} vAlign="end">
            <TextInput
              label={`Section ${index + 1}`}
              value={section.title}
              onChange={(title) => updateSection(section.id, { title })}
              placeholder="Depth"
            />
            <IconButton
              label={`Remove section ${index + 1}`}
              icon={<Icon icon={icons.trash} />}
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  sections: value.sections.filter((item) => item.id !== section.id),
                })
              }
            />
          </HStack>
          {section.prompts.map((prompt, promptIndex) => (
            <HStack key={`${section.id}-${promptIndex}`} gap={2} vAlign="end">
              <TextArea
                label={`Prompt ${promptIndex + 1}`}
                value={prompt}
                onChange={(next) => {
                  const prompts = [...section.prompts];
                  prompts[promptIndex] = next;
                  updateSection(section.id, { prompts });
                }}
                rows={PROMPT_ROWS}
                placeholder="What tradeoffs did you make?"
              />
              <IconButton
                label={`Remove prompt ${promptIndex + 1}`}
                icon={<Icon icon={icons.trash} />}
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateSection(section.id, {
                    prompts: section.prompts.filter((_, i) => i !== promptIndex),
                  })
                }
              />
            </HStack>
          ))}
          <Button
            label="Add prompt"
            variant="ghost"
            size="sm"
            icon={<Icon icon={icons.plus} />}
            isDisabled={section.prompts.length >= MAX_GUIDE_PROMPTS}
            onClick={() => updateSection(section.id, { prompts: [...section.prompts, ""] })}
          />
        </Stack>
      ))}
      <Button
        label="Add section"
        variant="secondary"
        size="sm"
        icon={<Icon icon={icons.plus} />}
        isDisabled={value.sections.length >= MAX_GUIDE_SECTIONS}
        onClick={() => onChange({ ...value, sections: [...value.sections, newGuideSection()] })}
      />
    </Stack>
  );
}

/** Read-only prompts for interviewers opening a candidate. */
export function InterviewGuideView({ guide }: { guide: InterviewGuide | null }) {
  if (!guide) {
    return (
      <Text type="supporting" color="secondary">
        No interview guide on this job yet.
      </Text>
    );
  }
  return (
    <Stack gap={3}>
      <Text type="label">{guide.title}</Text>
      {guide.sections.map((section) => (
        <Stack key={section.id} gap={1}>
          <Text weight="medium">{section.title}</Text>
          {section.prompts.map((prompt) => (
            <Text key={prompt} type="supporting" color="secondary">
              • {prompt}
            </Text>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
