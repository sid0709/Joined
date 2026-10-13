import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Text, VStack } from "sid-ui";

import {
  CLEAR_HANDLED_CONFIRM,
  CLEAR_HANDLED_LABEL,
  resumeCursorLabel,
  START_FROM_PAGE_1_HINT,
  START_FROM_PAGE_1_LABEL,
} from "../../routines/builtin/constants";
import { createBuiltinStore } from "../../routines/builtin/store";

/** Reset the Built In page cursor, then start the run. */
export async function resetCursorAndStart(store, onStart) {
  await store.resetToPage1();
  await onStart?.();
}

/** Resume page/card plus reset controls for the Built In Run panel. */
export default function BuiltinResume({ hidden = false, onStart, isDisabled = false }) {
  const store = useMemo(() => createBuiltinStore(), []);
  const [cursor, setCursor] = useState(null);

  const refresh = useCallback(async () => {
    setCursor(await store.loadCursor());
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (hidden) return null;

  const resetAndStart = async () => {
    await resetCursorAndStart(store, onStart);
    await refresh();
  };

  const resetHandled = async () => {
    if (!globalThis.confirm(CLEAR_HANDLED_CONFIRM)) return;
    await store.clearHandled();
    await refresh();
  };

  return (
    <VStack gap={1.5}>
      <Text type="supporting" color="secondary" justify="center" hasTabularNumbers>
        {resumeCursorLabel(cursor)}
      </Text>
      <Button
        variant="secondary"
        size="sm"
        label={START_FROM_PAGE_1_LABEL}
        onClick={resetAndStart}
        isDisabled={isDisabled}
        width="100%"
      />
      <Text type="supporting" color="secondary" justify="center">
        {START_FROM_PAGE_1_HINT}
      </Text>
      <Button
        variant="ghost"
        size="sm"
        label={CLEAR_HANDLED_LABEL}
        onClick={resetHandled}
        width="100%"
      />
    </VStack>
  );
}
