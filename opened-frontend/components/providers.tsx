"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OpenSeatProvider } from "@openseat/design-system/theme";
import { modeFromPath, type WorkspaceMode } from "@/lib/routes";

const WorkspaceModeContext = createContext<{
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
}>({
  mode: "hunter",
  setMode: () => {},
});

export function useWorkspaceMode() {
  return useContext(WorkspaceModeContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathMode = modeFromPath(pathname);
  const [mode, setMode] = useState<WorkspaceMode>(pathMode ?? "hunter");

  useEffect(() => {
    if (pathMode) setMode(pathMode);
  }, [pathMode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <OpenSeatProvider mode="light" linkComponent={Link}>
      <WorkspaceModeContext.Provider value={value}>{children}</WorkspaceModeContext.Provider>
    </OpenSeatProvider>
  );
}
