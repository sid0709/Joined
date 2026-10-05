"use client";

import {
  Button,
  CheckboxInput,
  HStack,
  Icon,
  IconButton,
  Selector,
  Stack,
  TextInput,
  icons,
} from "sid-ui";
import {
  MAX_SCREENING_QUESTIONS,
  newScreeningQuestion,
  type ScreeningQuestion,
  type ScreeningQuestionKind,
} from "@/lib/intake";

const KIND_OPTIONS: { value: ScreeningQuestionKind; label: string }[] = [
  { value: "yes_no", label: "Yes / No" },
  { value: "short_text", label: "Short text" },
];

const KNOCKOUT_OPTIONS = [
  { value: "", label: "No knockout" },
  { value: "no", label: "Knock out on No" },
  { value: "yes", label: "Knock out on Yes" },
];

/** Employer-authored screening / knockout questions for a job posting. */
export function ScreeningQuestionsEditor({
  value,
  onChange,
}: {
  value: ScreeningQuestion[];
  onChange: (next: ScreeningQuestion[]) => void;
}) {
  const update = (id: string, patch: Partial<ScreeningQuestion>) =>
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <Stack gap={3}>
      {value.map((question, index) => (
        <Stack key={question.id} gap={2}>
          <HStack gap={2} vAlign="end">
            <TextInput
              label={`Question ${index + 1}`}
              value={question.prompt}
              onChange={(prompt) => update(question.id, { prompt })}
              placeholder="Are you authorized to work in the US?"
            />
            <IconButton
              label={`Remove question ${index + 1}`}
              icon={<Icon icon={icons.trash} />}
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((item) => item.id !== question.id))}
            />
          </HStack>
          <HStack gap={3} wrap="wrap" vAlign="end">
            <Selector
              label="Answer type"
              options={KIND_OPTIONS}
              value={question.kind}
              onChange={(kind) =>
                update(question.id, {
                  kind: kind as ScreeningQuestionKind,
                  knockoutAnswer: kind === "yes_no" ? question.knockoutAnswer || "no" : undefined,
                })
              }
            />
            {question.kind === "yes_no" ? (
              <Selector
                label="Knockout"
                options={KNOCKOUT_OPTIONS}
                value={question.knockoutAnswer ?? ""}
                onChange={(knockoutAnswer) =>
                  update(question.id, { knockoutAnswer: knockoutAnswer || undefined })
                }
              />
            ) : null}
            <CheckboxInput
              label="Required"
              value={question.required}
              onChange={(required) => update(question.id, { required })}
            />
          </HStack>
        </Stack>
      ))}
      <Button
        label="Add screening question"
        variant="secondary"
        size="sm"
        icon={<Icon icon={icons.plus} />}
        isDisabled={value.length >= MAX_SCREENING_QUESTIONS}
        onClick={() => onChange([...value, newScreeningQuestion()])}
      />
    </Stack>
  );
}
