import { Banner, Button, Heading, Stack, Text } from "@joined/design-system";

import type { CapturedJob } from "../capture";
import { submittableDrafts, type JobDraft } from "../drafts";
import { COPY } from "./copy";
import { DraftRow } from "./DraftRow";

export function DraftQueuePanel({
  drafts,
  signedIn,
  onEdit,
  onDelete,
  onSubmit,
  onSubmitAll,
}: {
  drafts: JobDraft[];
  signedIn: boolean;
  onEdit: (id: string, fields: CapturedJob) => void;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
  onSubmitAll: () => void;
}) {
  const pending = submittableDrafts(drafts);

  return (
    <Stack gap={2}>
      <Heading level={4}>{COPY.DRAFTS}</Heading>
      {drafts.length === 0 ? <Text color="secondary">{COPY.NO_DRAFTS}</Text> : null}
      {drafts.length > 0 && !signedIn ? (
        <Banner status="warning" title={COPY.SIGN_IN_TO_SUBMIT} />
      ) : null}
      {pending.length > 1 ? (
        <Button
          size="sm"
          variant="secondary"
          label={COPY.SUBMIT_ALL}
          isDisabled={!signedIn}
          onClick={onSubmitAll}
        />
      ) : null}
      {drafts.map((draft) => (
        <DraftRow
          key={draft.id}
          draft={draft}
          signedIn={signedIn}
          onEdit={onEdit}
          onDelete={onDelete}
          onSubmit={onSubmit}
        />
      ))}
    </Stack>
  );
}
