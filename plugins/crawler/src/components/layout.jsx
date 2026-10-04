import { Badge, Glyph, HStack, Tab, TabList, Text, VStack } from "@joined/design-system";
import * as React from "react";

import packageJson from "../../package.json";

import BackendTrafficLight from "./BackendTrafficLight";
import ColorModeToggle from "./ColorModeToggle";
import ScrapeSourceBadge from "./ScrapeSourceBadge";
import ScrapperPage from "./Scrapper";
import ComponentTracker from "./Tracker";

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      className="crawler-tab-panel"
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const TabInfo = [
  {
    value: "scrap",
    label: "Scrap",
    content: <ScrapperPage />,
    icon: <Glyph name="search" />,
  },
  {
    value: "tracker",
    label: "Tracker",
    content: <ComponentTracker />,
    icon: <Glyph name="eye" />,
  },
];

function formatReleaseDate(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const releaseDateLabel = formatReleaseDate(packageJson.releaseDate);

export default function LayoutPage() {
  const [value, setValue] = React.useState(TabInfo[0].value);

  return (
    <div className="crawler-layout">
      <HStack gap={3} align="center" justify="between" className="crawler-header">
        <HStack gap={3} align="center">
          <img className="crawler-logo" src="/logo.png" alt="Avalon Scrapper" />
          <VStack gap={1} align="start">
            <Text as="h1" type="large" weight="semibold">
              Avalon Scrapper
            </Text>
            <Text type="supporting" color="secondary">
              Extension · v{packageJson.version}
            </Text>
            <ScrapeSourceBadge compact />
            {releaseDateLabel && <Badge variant="purple" label={releaseDateLabel} />}
          </VStack>
        </HStack>
        <VStack gap={2} align="end">
          <ColorModeToggle />
          <BackendTrafficLight />
        </VStack>
      </HStack>

      <TabList value={value} onChange={setValue} layout="fill" aria-label="extension tabs">
        {TabInfo.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            icon={tab.icon}
            panelId={`simple-tabpanel-${tab.value}`}
          />
        ))}
      </TabList>

      {TabInfo.map((tab) => (
        <CustomTabPanel key={tab.value} value={value} index={tab.value}>
          {tab.content}
        </CustomTabPanel>
      ))}
    </div>
  );
}
