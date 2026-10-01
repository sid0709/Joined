"use client";

import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider, type LinkComponentType } from "@astryxdesign/core/Link";
import { Theme, type ThemeMode } from "@astryxdesign/core/theme";
import { ToastViewport, type ToastPosition } from "@astryxdesign/core/Toast";

import { NotificationViewport } from "../components/NotificationTrigger";

import { joinedTheme } from "./joined";

import type { ReactNode } from "react";

export type ColorMode = ThemeMode;

export interface JoinedProviderProps {
  children: ReactNode;
  /** light, dark, or system. */
  mode?: ColorMode;
  /** Router-aware link used by Link and Button `href`, e.g. Next.js `Link`. */
  linkComponent?: LinkComponentType;
  /** Where toasts from useToast stack. */
  toastPosition?: ToastPosition;
}

/**
 * Everything an app needs to render Joined: the Astryx theme, the link
 * component for routing, the layer root for menus and tooltips, and the
 * toast viewport behind useToast.
 * Pair it with `@joined/design-system/styles/joined.css`.
 */
export function JoinedProvider({
  children,
  mode = "system",
  linkComponent,
  toastPosition = "bottomEnd",
}: JoinedProviderProps) {
  const layered = (
    <LayerProvider>
      <ToastViewport position={toastPosition}>
        <NotificationViewport>{children}</NotificationViewport>
      </ToastViewport>
    </LayerProvider>
  );
  return (
    <Theme theme={joinedTheme} mode={mode}>
      {linkComponent ? <LinkProvider component={linkComponent}>{layered}</LinkProvider> : layered}
    </Theme>
  );
}
