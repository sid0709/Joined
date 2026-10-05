import { Glyph, HStack, Tab, TabList, Text, VStack } from "sid-ui";
import { useState } from "react";

import packageJson from "../../package.json";

import BackendStatus from "./BackendStatus";
import ColorModeToggle from "./ColorModeToggle";
import Inspector from "./Inspector";
import RoutineLibrary from "./Routines";
import RunPanel from "./Run";

/** The one tab panel; each tab swaps what it shows. */
const PANEL_ID = "crawler-panel";

const TABS = {
  run: { label: "Run", icon: "play" },
  routines: { label: "Routines", icon: "list" },
  inspector: { label: "Inspector", icon: "search" },
};

function formatReleaseDate(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const releaseDateLabel = formatReleaseDate(packageJson.releaseDate);
const versionLabel = [`v${packageJson.version}`, releaseDateLabel].filter(Boolean).join(" · ");

function Header() {
  return (
    <header className="crawler-header">
      <HStack gap={3} align="center" justify="between">
        <HStack gap={2} align="center">
          <img className="crawler-logo" src="/logo.png" alt="" />
          <VStack gap={0}>
            <Text as="h1" weight="semibold">
              Avalon Scrapper
            </Text>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {versionLabel}
            </Text>
          </VStack>
        </HStack>
        <HStack gap={2} align="center">
          <BackendStatus />
          <ColorModeToggle />
        </HStack>
      </HStack>
    </header>
  );
}

export default function LayoutPage() {
  const [tab, setTab] = useState("run");

  return (
    <div className="crawler-layout">
      <div className="crawler-top">
        <Header />
        <nav className="crawler-tabs">
          <TabList
            value={tab}
            onChange={setTab}
            layout="fill"
            size="sm"
            role="tablist"
            aria-label="Panels"
          >
            {Object.entries(TABS).map(([value, { label, icon }]) => (
              <Tab
                key={value}
                value={value}
                label={label}
                icon={<Glyph name={icon} />}
                panelId={PANEL_ID}
              />
            ))}
          </TabList>
        </nav>
      </div>
      <main id={PANEL_ID} className="crawler-main" role="tabpanel" aria-label={TABS[tab].label}>
        {tab === "run" ? <RunPanel onBrowseRoutines={() => setTab("routines")} /> : null}
        {tab === "routines" ? <RoutineLibrary /> : null}
        {tab === "inspector" ? <Inspector /> : null}
      </main>
    </div>
  );
}
