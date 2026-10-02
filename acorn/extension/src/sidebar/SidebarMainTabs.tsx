export type AcornMainTab = "fill" | "qa" | "custom";

type SidebarMainTabsProps = {
  value: AcornMainTab;
  onChange: (next: AcornMainTab) => void;
};

export function SidebarMainTabs({ value, onChange }: SidebarMainTabsProps) {
  return (
    <div className="sidebar-tabs" role="tablist" aria-label="Acorn tools">
      <button
        type="button"
        role="tab"
        id="acorn-tab-fill"
        aria-controls="acorn-panel-fill"
        aria-selected={value === "fill"}
        className={value === "fill" ? "active" : undefined}
        onClick={() => onChange("fill")}
      >
        Fill
      </button>
      <button
        type="button"
        role="tab"
        id="acorn-tab-qa"
        aria-controls="acorn-panel-qa"
        aria-selected={value === "qa"}
        className={value === "qa" ? "active" : undefined}
        onClick={() => onChange("qa")}
      >
        Q&amp;A
      </button>
      <button
        type="button"
        role="tab"
        id="acorn-tab-custom"
        aria-controls="acorn-panel-custom"
        aria-selected={value === "custom"}
        className={value === "custom" ? "active" : undefined}
        onClick={() => onChange("custom")}
      >
        Custom
      </button>
    </div>
  );
}
