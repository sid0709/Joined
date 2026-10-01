"use client";

import { useEffect, useState } from "react";

import { IconButton } from "./Action";
import { Glyph } from "./Glyph";

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
    const stored = window.localStorage.getItem("joined-theme");
    const next = stored === "light" || stored === "dark" ? stored : current;
    if (next === "light" || next === "dark") {
      applyTheme(next);
      setTheme(next);
    }
  }, []);

  const switchTheme = (next: ThemeName) => {
    applyTheme(next);
    window.localStorage.setItem("joined-theme", next);
    document.cookie = `joined-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(next);
    onChange?.(next);
  };

  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton
      label={`Switch to ${next} mode`}
      variant="ghost"
      onClick={() => switchTheme(next)}
      icon={<Glyph name={theme === "dark" ? "sun" : "moon"} />}
    />
  );
}
