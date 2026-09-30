"use client";

import { useEffect, useState } from "react";

import { IconButton } from "./Action";

export type ThemeName = "dark" | "light";

function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll<HTMLElement>("[data-astryx-theme]").forEach((element) => {
    element.setAttribute("data-theme", theme);
  });
}

/** `onChange` lets an app that renders its theme on the server re-render after a switch. */
export function ThemeToggle({ onChange }: { onChange?: (theme: ThemeName) => void } = {}) {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    const stored = window.localStorage.getItem("openseat-theme");
    const next = stored === "light" || stored === "dark" ? stored : current;
    if (next === "light" || next === "dark") {
      applyTheme(next);
      setTheme(next);
    }
  }, []);

  const switchTheme = (next: ThemeName) => {
    applyTheme(next);
    window.localStorage.setItem("openseat-theme", next);
    document.cookie = `openseat-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(next);
    onChange?.(next);
  };

  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton
      label={`Switch to ${next} mode`}
      variant="ghost"
      onClick={() => switchTheme(next)}
      icon={
        theme === "dark" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
          </svg>
        )
      }
    />
  );
}
