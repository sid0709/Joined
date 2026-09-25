"use client";

import type { ReactNode } from "react";
import { Theme, type ThemeMode } from "@astryxdesign/core/theme";
import { LinkProvider, type LinkComponentType } from "@astryxdesign/core/Link";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { ToastViewport, type ToastPosition } from "@astryxdesign/core/Toast";
import { openseatTheme } from "./openseat";

export type ColorMode = ThemeMode;

export interface OpenSeatProviderProps {
  children: ReactNode;
  /** light, dark, or system. */
  mode?: ColorMode;
  /** Router-aware link used by Link and Button `href`, e.g. Next.js `Link`. */
  linkComponent?: LinkComponentType;
  /** Where toasts from useToast stack. */
  toastPosition?: ToastPosition;
}

/**
 * Everything an app needs to render OpenSeat: the Astryx theme, the link
 * component for routing, the layer root for menus and tooltips, and the
 * toast viewport behind useToast.
 * Pair it with `@openseat/design-system/styles/openseat.css`.
 */
export function OpenSeatProvider({ children, mode = "system", linkComponent, toastPosition = "bottomEnd" }: OpenSeatProviderProps) {
  const layered = (
    <LayerProvider>
      <ToastViewport position={toastPosition}>{children}</ToastViewport>
    </LayerProvider>
  );
  return (
    <Theme theme={openseatTheme} mode={mode}>
      {linkComponent ? <LinkProvider component={linkComponent}>{layered}</LinkProvider> : layered}
    </Theme>
  );
}
