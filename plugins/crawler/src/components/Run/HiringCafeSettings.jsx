import { useCallback, useEffect, useMemo, useState } from "react";
import { Selector } from "sid-ui";

import { MARK_APPLIED_LABEL } from "../../routines/hiringcafe/constants";
import { createHiringCafeStore } from "../../routines/hiringcafe/store";

/** Persisted Mark Applied toggle. On by default; the choice survives reloads. */
export default function HiringCafeSettings({ hidden = false }) {
  const store = useMemo(() => createHiringCafeStore(), []);
  const [enabled, setEnabled] = useState(true);

  const refresh = useCallback(async () => {
    setEnabled(await store.loadMarkAppliedEnabled());
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (hidden) return null;

  return (
    <Selector
      label={MARK_APPLIED_LABEL}
      description="After the server accepts a job, hover the card and mark it applied."
      options={[
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ]}
      value={enabled ? "on" : "off"}
      onChange={(value) => {
        const next = value === "on";
        setEnabled(next);
        void store.saveMarkAppliedEnabled(next);
      }}
    />
  );
}
