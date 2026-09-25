"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "./Action";

type Theme = "dark" | "light";

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: "Meta blue ramp",
    tokens: [
      "meta-blue-50",
      "meta-blue-100",
      "meta-blue-200",
      "meta-blue-300",
      "meta-blue-400",
      "meta-blue-500",
      "meta-blue-600",
      "meta-blue-700",
      "meta-blue-800",
      "meta-blue-900",
      "meta-blue-950",
    ],
  },
  { title: "Canvas & surface", tokens: ["canvas", "surface", "surface-sunken", "surface-hover", "surface-selected"] },
  { title: "Border", tokens: ["border-subtle", "border-default", "border-strong", "border-focus"] },
  { title: "Ink", tokens: ["ink", "ink-muted", "ink-faint", "on-primary"] },
  { title: "Primary & link", tokens: ["primary", "primary-hover", "primary-active", "primary-bg", "link", "link-hover"] },
  { title: "Status", tokens: ["success", "success-bg", "warning", "warning-bg", "danger", "danger-hover", "danger-bg"] },
  { title: "Overlay", tokens: ["overlay"] },
];

const RADII = ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-pill", "radius-full"];
const ELEVATIONS = ["elevation-0", "elevation-1", "elevation-2", "elevation-3"];
const BORDER_WIDTHS = ["border-width-hairline", "border-width-thick"];
const OPACITIES = ["opacity-disabled", "opacity-overlay", "opacity-hover-scrim"];
const DURATIONS = ["duration-fast", "duration-normal", "duration-slow"];
const EASINGS = ["ease-standard", "ease-decelerate", "ease-accelerate"];
const TYPE_STYLES = [
  "display",
  "h1",
  "h2",
  "h3",
  "body-lg",
  "body",
  "body-strong",
  "body-sm",
  "label",
  "caption",
  "button",
];

const ALL_TOKENS = [
  ...COLOR_GROUPS.flatMap((g) => g.tokens),
  ...RADII,
  ...ELEVATIONS,
  ...BORDER_WIDTHS,
  ...OPACITIES,
  ...DURATIONS,
  ...EASINGS,
];

/** Reads every token's resolved value off <html> so the table shows what the
    active theme actually paints, not the source-file default. */
function readTokens(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const t of ALL_TOKENS) out[t] = style.getPropertyValue(`--${t}`).trim();
  return out;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="os-token-group">
      <h3 className="h3" style={{ marginBottom: 12 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Value({ children }: { children: string }) {
  return <code className="caption text-ink-muted">{children || "—"}</code>;
}

/**
 * A toggleable, self-describing demo of every OpenSeat design token: a sample
 * rendered with the token beside its name and live resolved value. Includes a
 * dark/light switch because most values differ per theme.
 */
export function TokenDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [theme, setTheme] = useState<Theme>("dark");
  const [values, setValues] = useState<Record<string, string>>({});
  const [motionKey, setMotionKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setTheme(current);
    setValues(readTokens());
  }, [open]);

  const show = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setTheme(current);
    setValues(readTokens());
  };

  const switchTheme = (next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    setValues(readTokens());
  };

  return (
    <div className="os-token-demo">
      <div className="os-token-demo-toolbar">
        <label className="os-check">
          <input type="checkbox" checked={open} onChange={(e) => show(e.target.checked)} />
          <span className="body-strong">Show design token demo</span>
        </label>
        {open && (
          <div role="group" aria-label="Theme">
            <Button label="Dark" size="sm" variant={theme === "dark" ? "secondary" : "ghost"} onClick={() => switchTheme("dark")} />
            <Button label="Light" size="sm" variant={theme === "light" ? "secondary" : "ghost"} onClick={() => switchTheme("light")} />
          </div>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 24 }}>
          <Group title="Color">
            {COLOR_GROUPS.map((g) => (
              <div key={g.title} style={{ marginBottom: 16 }}>
                <p className="label text-ink-muted" style={{ marginBottom: 8 }}>
                  {g.title}
                </p>
                <div className="os-swatch-grid">
                  {g.tokens.map((t) => (
                    <div key={t} className="os-swatch">
                      <div className="os-swatch-chip" style={{ background: `var(--${t})` }} />
                      <div className="os-swatch-body">
                        <span className="caption text-ink">--{t}</span>
                        <Value>{values[t]}</Value>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Group>

          <Group title="Radius">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {RADII.map((t) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      border: "1px solid var(--border-default)",
                      background: "var(--primary-bg)",
                      borderRadius: `var(--${t})`,
                    }}
                  />
                  <span className="caption text-ink">--{t}</span>
                  <Value>{values[t]}</Value>
                </div>
              ))}
            </div>
          </Group>

          <Group title="Elevation">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 24, background: "var(--canvas)", borderRadius: 8 }}>
              {ELEVATIONS.map((t) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 96,
                      height: 64,
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--surface)",
                      boxShadow: `var(--${t})`,
                    }}
                  />
                  <span className="caption text-ink">--{t}</span>
                  <Value>{values[t]}</Value>
                </div>
              ))}
            </div>
          </Group>

          <Group title="Border width">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              {BORDER_WIDTHS.map((t) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 96,
                      height: 48,
                      borderRadius: 6,
                      background: "var(--surface-sunken)",
                      borderStyle: "solid",
                      borderColor: "var(--border-strong)",
                      borderWidth: `var(--${t})`,
                    }}
                  />
                  <span className="caption text-ink">--{t}</span>
                  <Value>{values[t]}</Value>
                </div>
              ))}
            </div>
          </Group>

          <Group title="Opacity">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              {OPACITIES.map((t) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative", width: 96, height: 48, overflow: "hidden", borderRadius: 6, background: "var(--primary)" }}>
                    <div style={{ position: "absolute", inset: 0, background: "var(--ink)", opacity: `var(--${t})` }} />
                  </div>
                  <span className="caption text-ink">--{t}</span>
                  <Value>{values[t]}</Value>
                </div>
              ))}
            </div>
          </Group>

          <Group title="Motion">
            <p className="body-sm text-ink-muted" style={{ marginBottom: 12 }}>
              Each row pairs a duration with an easing. Press play to run them all.
            </p>
            <Button label="Play" size="sm" variant="secondary" onClick={() => setMotionKey((k) => k + 1)} />
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {DURATIONS.map((d, i) => {
                const e = EASINGS[i];
                return (
                  <div key={d} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 220, flex: "none" }}>
                      <span className="caption text-ink">
                        --{d} / --{e}
                      </span>
                      <Value>{`${values[d]} · ${values[e]}`}</Value>
                    </div>
                    <div style={{ position: "relative", height: 24, flex: 1, borderRadius: 999, background: "var(--surface-sunken)" }}>
                      <div
                        key={motionKey}
                        style={
                          {
                            position: "absolute",
                            top: 4,
                            height: 16,
                            width: 16,
                            borderRadius: 999,
                            background: "var(--primary)",
                            left: "4px",
                            animation: motionKey > 0 ? `os-token-slide var(--${d}) var(--${e}) forwards` : "none",
                          } as CSSProperties
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <style>{`@keyframes os-token-slide { to { left: calc(100% - 20px); } }`}</style>
          </Group>

          <Group title="Type styles">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TYPE_STYLES.map((cls) => (
                <div
                  key={cls}
                  style={{ display: "flex", alignItems: "baseline", gap: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}
                >
                  <code className="caption text-ink-muted" style={{ width: 96, flex: "none" }}>
                    .{cls}
                  </code>
                  <span className={cls}>Sealed rooms, invited bidders.</span>
                </div>
              ))}
            </div>
          </Group>
        </div>
      )}
    </div>
  );
}
