import { JoinedProvider } from "sid-ui/theme";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Where the side panel remembers a light/dark choice. Without one it follows the system. */
const COLOR_MODE_STORAGE_KEY = "crawler-color-mode";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

const ColorModeContext = createContext({ mode: "light", toggleMode: () => {} });

function readChosenMode() {
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function readSystemMode() {
  return window.matchMedia?.(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

/** Joined theme in the system's light/dark mode until the user picks one. */
export function ColorModeProvider({ children }) {
  const [chosenMode, setChosenMode] = useState(readChosenMode);
  const [systemMode, setSystemMode] = useState(readSystemMode);

  useEffect(() => {
    const query = window.matchMedia?.(DARK_SCHEME_QUERY);
    if (!query) return undefined;
    const onChange = () => setSystemMode(readSystemMode());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const mode = chosenMode ?? systemMode;

  const toggleMode = useCallback(() => {
    const next = mode === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session.
    }
    setChosenMode(next);
  }, [mode]);

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return (
    <ColorModeContext.Provider value={value}>
      <JoinedProvider mode={mode} toastPosition="topEnd">
        {children}
      </JoinedProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  return useContext(ColorModeContext);
}
