import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Text, VStack } from "sid-ui";

import {
  CLEAR_HANDLED_CONFIRM,
  CLEAR_HANDLED_LABEL,
  resumeCursorLabel,
  START_FROM_PAGE_1_LABEL,
} from "../../routines/builtin/constants";
import { createBuiltinStore } from "../../routines/builtin/store";

/** Resume page/card plus reset controls for the Built In Run panel. */
export default function BuiltinResume({ hidden = false }) {
  const store = useMemo(() => createBuiltinStore(), []);
  const [cursor, setCursor] = useState(null);

  const refresh = useCallback(async () => {
    setCursor(await store.loadCursor());
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (hidden) return null;

  const resetCursor = async () => {
    await store.clearCursor();
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
        onClick={resetCursor}
        width="100%"
      />
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
