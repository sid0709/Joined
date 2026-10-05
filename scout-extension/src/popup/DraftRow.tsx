import {
  Badge,
  Banner,
  Button,
  HStack,
  JobCard,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@joined/design-system";
import { useState } from "react";

import type { CapturedJob } from "../capture";
import { canDelete, canEdit, canSubmit, type JobDraft } from "../drafts";
import {
  COPY,
  draftStatusBadgeVariant,
  draftStatusLabel,
  jobBoardLabel,
  jobMetaLine,
  previewText,
  submitActionLabel,
} from "./copy";

export function DraftRow({
  draft,
  signedIn,
  onEdit,
  onDelete,
  onSubmit,
}: {
  draft: JobDraft;
  signedIn: boolean;
  onEdit: (id: string, fields: CapturedJob) => void;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<CapturedJob>(draft.fields);

  const startEdit = () => {
    setFields(draft.fields);
    setEditing(true);
  };

  const saveEdit = () => {
    onEdit(draft.id, fields);
    setEditing(false);
  };

  const setField = <K extends keyof CapturedJob>(key: K, value: CapturedJob[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  if (editing) {
    return (
      <JobCard title={COPY.EDIT} meta={jobMetaLine(fields)}>
        <Stack gap={2}>
          <TextInput
            label={COPY.FIELD_TITLE}
            value={fields.title}
            onChange={(value) => setField("title", value)}
          />
          <TextInput
            label={COPY.FIELD_COMPANY}
            value={fields.company}
            onChange={(value) => setField("company", value)}
          />
          <TextInput
            label={COPY.FIELD_LOCATION}
            value={fields.location}
            onChange={(value) => setField("location", value)}
          />
          <TextInput
            label={COPY.FIELD_APPLY_URL}
            value={fields.applyUrl}
            onChange={(value) => setField("applyUrl", value)}
          />
          <TextArea
            label={COPY.FIELD_DESCRIPTION}
            value={fields.description}
            onChange={(value) => setField("description", value)}
          />
          <HStack gap={2} wrap="wrap">
            <Button size="sm" variant="primary" label={COPY.SAVE} onClick={saveEdit} />
            <Button
              size="sm"
              variant="ghost"
              label={COPY.CANCEL}
              onClick={() => setEditing(false)}
            />
          </HStack>
        </Stack>
      </JobCard>
    );
  }

  return (
    <JobCard title={draft.fields.title} meta={jobMetaLine(draft.fields)}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Badge label={jobBoardLabel(draft.fields.board)} variant="neutral" />
        <Badge
          label={draftStatusLabel(draft.status)}
          variant={draftStatusBadgeVariant(draft.status)}
        />
      </HStack>
      {draft.fields.description ? (
        <Text type="supporting" color="secondary">
          {previewText(draft.fields.description)}
        </Text>
      ) : null}
      <Text type="supporting" color="secondary">
        {draft.fields.applyUrl}
      </Text>
      {draft.error ? <Banner status="error" title={draft.error} /> : null}
      <HStack gap={2} wrap="wrap">
        {canEdit(draft) ? (
          <Button size="sm" variant="ghost" label={COPY.EDIT} onClick={startEdit} />
        ) : null}
        {canDelete(draft) ? (
          <Button
            size="sm"
            variant="ghost"
            label={COPY.DELETE}
            onClick={() => onDelete(draft.id)}
          />
        ) : null}
        {canSubmit(draft) ? (
          <Button
            size="sm"
            variant="primary"
            label={submitActionLabel(draft)}
            isDisabled={!signedIn}
            onClick={() => onSubmit(draft.id)}
          />
        ) : null}
      </HStack>
    </JobCard>
  );
}
