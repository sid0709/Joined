import { Tab, TabList } from "@joined/design-system";

export type AcornMainTab = "fill" | "qa" | "custom";

type SidebarMainTabsProps = {
  value: AcornMainTab;
  onChange: (next: AcornMainTab) => void;
};

export function SidebarMainTabs({ value, onChange }: SidebarMainTabsProps) {
  return (
    <TabList
      value={value}
      onChange={(next) => onChange(next as AcornMainTab)}
      layout="fill"
      aria-label="Acorn tools"
    >
      <Tab id="acorn-tab-fill" value="fill" label="Fill" panelId="acorn-panel-fill" />
      <Tab id="acorn-tab-qa" value="qa" label="Q&A" panelId="acorn-panel-qa" />
      <Tab id="acorn-tab-custom" value="custom" label="Custom" panelId="acorn-panel-custom" />
    </TabList>
  );
}
