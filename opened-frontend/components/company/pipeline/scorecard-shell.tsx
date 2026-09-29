"use client";

import {
  Button,
  Heading,
  HStack,
  Icon,
  IconButton,
  NumberInput,
  Stack,
  Text,
  TextArea,
  TextInput,
  icons,
} from "@openseat/design-system";
import { useMemo, useState } from "react";
import {
  MAX_SCORECARD_CRITERIA,
  newCriterion,
  type ScorecardCriterion,
  type ScorecardScore,
  type ScorecardSubmission,
  type ScorecardTemplate,
  newId,
} from "@/lib/pipeline-eval";

const NOTE_ROWS = 2;

/** Edit a job's scorecard criteria template (local until Einstein persists). */
export function ScorecardTemplateEditor({
  value,
  onChange,
}: {
  value: ScorecardTemplate;
  onChange: (next: ScorecardTemplate) => void;
}) {
  const updateCriterion = (id: string, patch: Partial<ScorecardCriterion>) =>
    onChange({
      ...value,
      criteria: value.criteria.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });

  return (
    <Stack gap={3}>
      <TextInput
        label="Template name"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
      />
      {value.criteria.map((criterion, index) => (
        <HStack key={criterion.id} gap={2} vAlign="end">
          <TextInput
            label={`Criterion ${index + 1}`}
            value={criterion.label}
            onChange={(label) => updateCriterion(criterion.id, { label })}
            placeholder="Communication"
          />
          <NumberInput
            label="Max"
            value={criterion.maxScore}
            onChange={(maxScore) =>
              updateCriterion(criterion.id, { maxScore: maxScore && maxScore > 0 ? maxScore : 5 })
            }
            min={1}
            max={10}
            isIntegerOnly
          />
          <IconButton
            label={`Remove criterion ${index + 1}`}
            icon={<Icon icon={icons.trash} />}
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                criteria: value.criteria.filter((item) => item.id !== criterion.id),
              })
            }
          />
        </HStack>
      ))}
      <Button
        label="Add criterion"
        variant="secondary"
        size="sm"
        icon={<Icon icon={icons.plus} />}
        isDisabled={value.criteria.length >= MAX_SCORECARD_CRITERIA}
        onClick={() => onChange({ ...value, criteria: [...value.criteria, newCriterion()] })}
      />
      {/* TODO(einstein): PUT /v1/company/jobs/:id/pipeline { scorecardTemplate } */}
    </Stack>
  );
}

/** Submit scores after an interview — optimistic local; POST when Einstein lands. */
export function ScorecardSubmitShell({
  template,
  applicantId,
  existing,
  onSubmit,
}: {
  template: ScorecardTemplate | null;
  applicantId: string;
  existing: ScorecardSubmission[];
  onSubmit: (submission: ScorecardSubmission) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const ready = useMemo(() => {
    if (!template || template.criteria.length === 0) return false;
    return template.criteria.every((criterion) => (scores[criterion.id] ?? 0) > 0);
  }, [template, scores]);

  if (!template) {
    return (
      <Text type="supporting" color="secondary">
        No scorecard template on this job yet. Add criteria in the job pipeline settings.
      </Text>
    );
  }

  const latest = existing[0];

  return (
    <Stack gap={3}>
      <Heading level={3}>{template.name}</Heading>
      {latest ? (
        <Text type="supporting" color="secondary">
          Last submitted {new Date(latest.submittedAt).toLocaleString()}. Submitting again adds
          another read for the team.
        </Text>
      ) : (
        <Text type="supporting" color="secondary">
          Score each criterion after the interview.
        </Text>
      )}
      {template.criteria.map((criterion) => (
        <Stack key={criterion.id} gap={2}>
          <NumberInput
            label={criterion.label}
            value={scores[criterion.id] ?? 0}
            onChange={(score) =>
              setScores((current) => ({ ...current, [criterion.id]: score ?? 0 }))
            }
            min={0}
            max={criterion.maxScore}
            isIntegerOnly
          />
          <TextArea
            label={`${criterion.label} note`}
            isLabelHidden
            value={notes[criterion.id] ?? ""}
            onChange={(note) => setNotes((current) => ({ ...current, [criterion.id]: note }))}
            rows={NOTE_ROWS}
            placeholder="Optional note"
          />
        </Stack>
      ))}
      <Button
        label="Submit scorecard"
        variant="secondary"
        size="sm"
        isDisabled={!ready}
        onClick={() => {
          const payload: ScorecardScore[] = template.criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: scores[criterion.id] ?? 0,
            note: notes[criterion.id]?.trim() || undefined,
          }));
          const overall =
            payload.reduce((sum, item) => sum + item.score, 0) / Math.max(payload.length, 1);
          onSubmit({
            id: newId("sc"),
            applicantId,
            templateId: template.id,
            scores: payload,
            overall: Math.round(overall * 10) / 10,
            submittedAt: new Date().toISOString(),
          });
          // TODO(einstein): POST /v1/company/applicants/:id/scorecards
        }}
      />
    </Stack>
  );
}
