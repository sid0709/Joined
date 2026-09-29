"use client";

import {
  Button,
  CheckboxInput,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  TextInput,
  icons,
} from "@openseat/design-system";
import { MAX_CUSTOM_STAGES, newCustomStage, type PipelineStageDef } from "@/lib/pipeline-eval";

/** Employer-authored pipeline stages beyond the fixed six. */
export function CustomStagesEditor({
  value,
  onChange,
}: {
  value: PipelineStageDef[];
  onChange: (next: PipelineStageDef[]) => void;
}) {
  const update = (id: string, patch: Partial<PipelineStageDef>) =>
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <Stack gap={3}>
      <Text type="supporting" color="secondary">
        Fixed stages stay New → Screening → Interview → Offer → Hired / Rejected. Add extras for
        this job (for example Take-home or Onsite).
      </Text>
      {value.map((stage, index) => (
        <Stack key={stage.id} gap={2}>
          <HStack gap={2} vAlign="end">
            <TextInput
              label={`Custom stage ${index + 1}`}
              value={stage.title}
              onChange={(title) => update(stage.id, { title })}
              placeholder="Take-home"
            />
            <IconButton
              label={`Remove stage ${index + 1}`}
              icon={<Icon icon={icons.trash} />}
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((item) => item.id !== stage.id))}
            />
          </HStack>
          <HStack gap={3} wrap="wrap">
            <CheckboxInput
              label="Require notes to enter"
              value={Boolean(stage.requiresFeedback)}
              onChange={(requiresFeedback) => update(stage.id, { requiresFeedback })}
            />
            <CheckboxInput
              label="Require scorecard to enter"
              value={Boolean(stage.requiresScorecard)}
              onChange={(requiresScorecard) => update(stage.id, { requiresScorecard })}
            />
          </HStack>
        </Stack>
      ))}
      <Button
        label="Add custom stage"
        variant="secondary"
        size="sm"
        icon={<Icon icon={icons.plus} />}
        isDisabled={value.length >= MAX_CUSTOM_STAGES}
        onClick={() => onChange([...value, newCustomStage()])}
      />
    </Stack>
  );
}
