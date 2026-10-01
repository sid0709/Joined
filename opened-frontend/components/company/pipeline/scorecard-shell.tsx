"use client";

import {
  Banner,
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
} from "@joined/design-system";
import { useMemo, useState } from "react";
import {
  MAX_SCORECARD_CRITERIA,
  newCriterion,
  type ScorecardCriterion,
  type ScorecardScore,
  type ScorecardSubmission,
  type ScorecardSubmissionInput,
  type ScorecardTemplate,
} from "@/lib/pipeline-eval";

const NOTE_ROWS = 2;

/** Edit a job's scorecard criteria template (persists via job pipeline PUT). */
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
    </Stack>
  );
}

/** Submit scores after an interview — POST /v1/company/applicants/:id/scorecards via onSubmit. */
export function ScorecardSubmitShell({
  template,
  applicantId,
  existing,
  canScore = true,
  scoreDenial = "",
  onSubmit,
}: {
  template: ScorecardTemplate | null;
  applicantId: string;
  existing: ScorecardSubmission[];
  /** Soft gate — interviews.score. */
  canScore?: boolean;
  scoreDenial?: string;
  onSubmit: (input: ScorecardSubmissionInput) => void | Promise<void>;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Remount via key={applicantId} from parent to clear scores between candidates.
  void applicantId;

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
      {!canScore && scoreDenial ? (
        <Banner status="warning" title="Cannot submit scorecard" description={scoreDenial} />
      ) : null}
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
            isDisabled={!canScore}
          />
          <TextArea
            label={`${criterion.label} note`}
            isLabelHidden
            value={notes[criterion.id] ?? ""}
            onChange={(note) => setNotes((current) => ({ ...current, [criterion.id]: note }))}
            rows={NOTE_ROWS}
            placeholder="Optional note"
            isDisabled={!canScore}
          />
        </Stack>
      ))}
      <Button
        label={busy ? "Submitting…" : "Submit scorecard"}
        variant="secondary"
        size="sm"
        isDisabled={!ready || busy || !canScore}
        onClick={() => {
          if (!canScore) return;
          const payload: ScorecardScore[] = template.criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: scores[criterion.id] ?? 0,
            note: notes[criterion.id]?.trim() || undefined,
          }));
          const overall =
            payload.reduce((sum, item) => sum + item.score, 0) / Math.max(payload.length, 1);
          const input: ScorecardSubmissionInput = {
            templateId: template.id,
            scores: payload,
            overall: Math.round(overall * 10) / 10,
          };
          setBusy(true);
          Promise.resolve(onSubmit(input))
            .then(() => {
              setScores({});
              setNotes({});
            })
            .finally(() => setBusy(false));
        }}
      />
    </Stack>
  );
}
