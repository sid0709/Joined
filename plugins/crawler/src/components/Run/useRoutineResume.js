import { useCallback, useEffect, useState } from "react";

import { START_FROM_PAGE_ONE_LABEL } from "../../routines/hiringcafe/constants";

/** Saved crawl cursor for routines that expose `resume` (load/reset/label). */
export function useRoutineResume(routine) {
  const [label, setLabel] = useState("");

  const refresh = useCallback(async () => {
    if (typeof routine?.resume?.loadLabel !== "function") {
      setLabel("");
      return;
    }
    try {
      setLabel((await routine.resume.loadLabel()) || "");
    } catch {
      setLabel("");
    }
  }, [routine]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reset = useCallback(async () => {
    if (typeof routine?.resume?.reset === "function") {
      await routine.resume.reset();
    }
    await refresh();
  }, [routine, refresh]);

  return {
    label,
    reset,
    resetLabel: routine?.resume?.resetLabel || START_FROM_PAGE_ONE_LABEL,
    canReset: Boolean(routine?.resume),
  };
}
