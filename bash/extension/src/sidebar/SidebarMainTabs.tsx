export type OakMainTab = "fill" | "qa" | "custom";

type SidebarMainTabsProps = {
  value: OakMainTab;
  onChange: (next: OakMainTab) => void;
};

export function SidebarMainTabs({ value, onChange }: SidebarMainTabsProps) {
  return (
    <div className="sidebar-tabs" role="tablist" aria-label="Oak tools">
      <button
        type="button"
        role="tab"
        id="oak-tab-fill"
        aria-controls="oak-panel-fill"
        aria-selected={value === "fill"}
        className={value === "fill" ? "active" : undefined}
        onClick={() => onChange("fill")}
      >
        Fill
      </button>
      <button
        type="button"
        role="tab"
        id="oak-tab-qa"
        aria-controls="oak-panel-qa"
        aria-selected={value === "qa"}
        className={value === "qa" ? "active" : undefined}
        onClick={() => onChange("qa")}
      >
        Q&amp;A
      </button>
      <button
        type="button"
        role="tab"
        id="oak-tab-custom"
        aria-controls="oak-panel-custom"
        aria-selected={value === "custom"}
        className={value === "custom" ? "active" : undefined}
        onClick={() => onChange("custom")}
      >
        Custom
      </button>
    </div>
  );
}
