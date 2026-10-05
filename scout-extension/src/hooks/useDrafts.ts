import { useCallback, useEffect, useRef, useState } from "react";

import { ScoutApiClient, UNKNOWN_API_ERROR_MESSAGE } from "../api";
import type { CapturedJob } from "../capture";
import {
  DRAFT_QUEUE_STORAGE_KEY,
  beginSubmit,
  chromeLocalStore,
  completeSubmit,
  createDraftIds,
  editDraft,
  enqueueDraft,
  failSubmit,
  loadRecoveredDraftQueue,
  newIdempotencyKey,
  parseDrafts,
  removeDraft,
  replaceDraft,
  saveDraftQueue,
  submittableDrafts,
  toExtensionInput,
  type JobDraft,
} from "../drafts";

const client = new ScoutApiClient();
const store = chromeLocalStore();

function nowIso(): string {
  return new Date().toISOString();
}

export function useDrafts() {
  const [drafts, setDrafts] = useState<JobDraft[]>([]);
  const draftsRef = useRef<JobDraft[]>([]);

  const commit = useCallback(async (next: JobDraft[]) => {
    draftsRef.current = next;
    setDrafts(next);
    await saveDraftQueue(store, next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadRecoveredDraftQueue(store, nowIso()).then((loaded) => {
      if (cancelled) {
        return;
      }
      draftsRef.current = loaded;
      setDrafts(loaded);
    });

    const handleChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== "local" || !changes[DRAFT_QUEUE_STORAGE_KEY]) {
        return;
      }
      const next = parseDrafts(changes[DRAFT_QUEUE_STORAGE_KEY].newValue);
      draftsRef.current = next;
      setDrafts(next);
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  const saveCapturedJob = useCallback(
    async (job: CapturedJob) => {
      const result = enqueueDraft(draftsRef.current, job, nowIso(), createDraftIds());
      if (result.added) {
        await commit(result.drafts);
      }
      return result.draft;
    },
    [commit],
  );

  const updateDraft = useCallback(
    async (id: string, fields: CapturedJob) => {
      const current = draftsRef.current.find((draft) => draft.id === id);
      if (!current) {
        return;
      }
      const next = editDraft(current, fields, nowIso(), newIdempotencyKey());
      if (!next) {
        return;
      }
      await commit(replaceDraft(draftsRef.current, next));
    },
    [commit],
  );

  const deleteDraft = useCallback(
    async (id: string) => {
      await commit(removeDraft(draftsRef.current, id));
    },
    [commit],
  );

  const submitDraft = useCallback(
    async (id: string) => {
      const current = draftsRef.current.find((draft) => draft.id === id);
      if (!current) {
        return;
      }
      const started = beginSubmit(current, nowIso());
      if (!started) {
        return;
      }
      await commit(replaceDraft(draftsRef.current, started));
      try {
        const result = await client.submitExtension(
          toExtensionInput(started.fields),
          started.idempotencyKey,
        );
        await commit(
          replaceDraft(draftsRef.current, completeSubmit(started, result.submission.id, nowIso())),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : UNKNOWN_API_ERROR_MESSAGE;
        await commit(replaceDraft(draftsRef.current, failSubmit(started, message, nowIso())));
      }
    },
    [commit],
  );

  const submitAll = useCallback(async () => {
    const ids = submittableDrafts(draftsRef.current).map((draft) => draft.id);
    for (const id of ids) {
      await submitDraft(id);
    }
  }, [submitDraft]);

  return { drafts, saveCapturedJob, updateDraft, deleteDraft, submitDraft, submitAll };
}
