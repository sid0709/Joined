import { useCallback, useEffect, useState } from "react";

import { requestDetectedJob, shouldRefreshDetectedJob, type DetectedJobState } from "./detectedJob";

export function useDetectedJob(): DetectedJobState {
  const [state, setState] = useState<DetectedJobState>({ status: "loading" });

  const refresh = useCallback(async () => {
    const next = await requestDetectedJob((message) => chrome.runtime.sendMessage(message));
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();
    const handleMessage = (message: unknown) => {
      if (shouldRefreshDetectedJob(message)) {
        void refresh();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [refresh]);

  return state;
}
