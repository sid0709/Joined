"use client";

import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonLinkVariant = "primary" | "secondary" | "ghost";
type ButtonLinkSize = "sm" | "md" | "lg";

const BUTTON_LINK_VARIANT_CLASS: Record<ButtonLinkVariant, string> = {
  primary: "os-btn-primary",
  secondary: "os-btn-secondary",
  ghost: "os-btn-ghost",
};

const BUTTON_LINK_SIZE_CLASS: Record<ButtonLinkSize, string> = {
  sm: "os-btn-sm",
  md: "",
  lg: "os-btn-lg",
};

/** Groups related Buttons into one visually joined cluster. */
export function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="os-button-group">{children}</div>;
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** required — the accessible name, since there is no visible label */
  label: string;
  size?: "sm" | "md" | "lg";
}

const ICON_SIZE_CLASS: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "os-icon-btn-sm",
  md: "",
  lg: "os-icon-btn-lg",
};

/** A button whose only content is an icon. Always pass `label`. */
export function IconButton({ label, size = "md", className = "", children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={["os-icon-btn", ICON_SIZE_CLASS[size], className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {}

/** Navigation, never an action — use Button for actions. */
export function Link({ className = "", ...props }: LinkProps) {
  return <a className={["body", "os-link", className].filter(Boolean).join(" ")} {...props} />;
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
}

/** A navigation link with Button styling; unlike Button it remains a valid anchor. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={["button", "os-btn", BUTTON_LINK_VARIANT_CLASS[variant], BUTTON_LINK_SIZE_CLASS[size], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** A closed set of mutually exclusive views — never more than a handful of options. */
export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="os-segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={"label os-segmented-item" + (o.value === value ? " os-segmented-item-active" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface ToggleButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

/** A binary on/off control shaped like a Button — for view options like "Show completed". */
export function ToggleButton({ pressed, onPressedChange, className = "", children, ...props }: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={["label os-toggle-btn", pressed && "os-toggle-btn-active", className].filter(Boolean).join(" ")}
      onClick={() => onPressedChange(!pressed)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface ToggleButtonGroupProps {
  options: { label: string; value: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

/** Multiple independent ToggleButtons that share one value array — for filters. */
export function ToggleButtonGroup({ options, value, onChange }: ToggleButtonGroupProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="os-toggle-group">
      {options.map((o) => (
        <ToggleButton key={o.value} pressed={value.includes(o.value)} onPressedChange={() => toggle(o.value)}>
          {o.label}
        </ToggleButton>
      ))}
    </div>
  );
}

/** A row that holds a set of related controls — Buttons, IconButtons, a Toolbar Divider. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="os-toolbar">{children}</div>;
}

export function ToolbarDivider() {
  return <div className="os-toolbar-divider" />;
}
