export type BashMainTab = "fill" | "qa" | "custom";

type SidebarMainTabsProps = {
  value: BashMainTab;
  onChange: (next: BashMainTab) => void;
};

export function SidebarMainTabs({ value, onChange }: SidebarMainTabsProps) {
  return (
    <div className="sidebar-tabs" role="tablist" aria-label="Bash tools">
      <button
        type="button"
        role="tab"
        id="bash-tab-fill"
        aria-controls="bash-panel-fill"
        aria-selected={value === "fill"}
        className={value === "fill" ? "active" : undefined}
        onClick={() => onChange("fill")}
      >
        Fill
      </button>
      <button
        type="button"
        role="tab"
        id="bash-tab-qa"
        aria-controls="bash-panel-qa"
        aria-selected={value === "qa"}
        className={value === "qa" ? "active" : undefined}
        onClick={() => onChange("qa")}
      >
        Q&amp;A
      </button>
      <button
        type="button"
        role="tab"
        id="bash-tab-custom"
        aria-controls="bash-panel-custom"
        aria-selected={value === "custom"}
        className={value === "custom" ? "active" : undefined}
        onClick={() => onChange("custom")}
      >
        Custom
      </button>
    </div>
  );
}
