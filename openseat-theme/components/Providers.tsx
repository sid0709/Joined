"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { OpenSeatProvider, type ColorMode as ThemeColorMode } from "@openseat/design-system/theme";

type ColorMode = Exclude<ThemeColorMode, "system">;

const ColorModeContext = createContext<{
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}>({
  mode: "light",
  setMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>("light");
  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <OpenSeatProvider mode={mode} linkComponent={Link}>
      <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
    </OpenSeatProvider>
  );
}
