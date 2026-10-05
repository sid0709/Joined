import { useCallback, useEffect, useState } from "react";

import { chromeLocalStore } from "../drafts";
import {
  DESKTOP_NOTIFICATIONS_STORAGE_KEY,
  isDesktopNotificationsEnabled,
  parseDesktopNotificationsEnabled,
  saveDesktopNotificationsEnabled,
} from "../settings/desktopNotifications";

const store = chromeLocalStore();

export function useDesktopNotifications() {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void isDesktopNotificationsEnabled(store).then((value) => {
      if (!cancelled) {
        setEnabledState(value);
      }
    });

    const handleChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== "local" || !changes[DESKTOP_NOTIFICATIONS_STORAGE_KEY]) {
        return;
      }
      setEnabledState(
        parseDesktopNotificationsEnabled(changes[DESKTOP_NOTIFICATIONS_STORAGE_KEY].newValue),
      );
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await saveDesktopNotificationsEnabled(store, value);
  }, []);

  return { enabled, setEnabled };
}
