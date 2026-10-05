"use client";

import { useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  Glyph,
  Grid,
  HStack,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@joined/design-system";
import { PLUGINS, isPluginOn, type Plugin } from "@/lib/apps";
import { useWorkspace } from "@/components/workspace/use-workspace";

const CARD_MIN_WIDTH = 260;
const CARD_COLUMNS = 3;
const SEARCH_MAX = 60;

type Filter = "all" | "autofill" | "integration" | "on";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "autofill", label: "Autofill" },
  { value: "integration", label: "Integrations" },
  { value: "on", label: "On" },
];

/** Plugins you can turn on or off; the extension reads these settings. */
export function PluginGrid() {
  const { workspace, update } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const settings = workspace.plugins;

  const matches = (plugin: Plugin) => {
    if (filter === "on" && !isPluginOn(plugin, settings)) return false;
    if ((filter === "autofill" || filter === "integration") && plugin.category !== filter) {
      return false;
    }
    const needle = query.trim().toLowerCase();
    return !needle || `${plugin.name} ${plugin.description}`.toLowerCase().includes(needle);
  };
  const shown = PLUGINS.filter(matches);
  const onCount = PLUGINS.filter((plugin) => isPluginOn(plugin, settings)).length;

  const toggle = (plugin: Plugin, on: boolean) =>
    update({ ...workspace, plugins: { ...settings, [plugin.id]: on } });

  return (
    <Stack gap={4}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <SegmentedControl
          label="Plugin filter"
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
        >
          {FILTERS.map((item) => (
            <SegmentedControlItem
              key={item.value}
              value={item.value}
              label={item.value === "on" ? `On · ${onCount}` : item.label}
            />
          ))}
        </SegmentedControl>
        <TextInput
          label="Search plugins"
          isLabelHidden
          startIcon={<Glyph name="search" />}
          value={query}
          onChange={(value) => setQuery(value.slice(0, SEARCH_MAX))}
          placeholder="Search plugins"
        />
      </HStack>
      {shown.length === 0 ? (
        <EmptyState isCompact icon={<Glyph name="search" />} title="No plugins match" />
      ) : (
        <Grid columns={{ minWidth: CARD_MIN_WIDTH, max: CARD_COLUMNS }} gap={4}>
          {shown.map((plugin) => {
            const available = plugin.availability === "available";
            return (
              <Card key={plugin.id} padding={5}>
                <Stack gap={3}>
                  <HStack hAlign="between" vAlign="center" gap={2}>
                    <HStack gap={2} vAlign="center">
                      <Glyph name={plugin.icon} />
                      <Heading level={3}>{plugin.name}</Heading>
                    </HStack>
                    <Badge
                      label={plugin.category === "autofill" ? "Autofill" : "Integration"}
                      variant={plugin.category === "autofill" ? "blue" : "purple"}
                    />
                  </HStack>
                  <Text color="secondary">{plugin.description}</Text>
                  {available ? (
                    <Switch
                      label={isPluginOn(plugin, settings) ? "On" : "Off"}
                      value={isPluginOn(plugin, settings)}
                      onChange={(on) => toggle(plugin, on)}
                    />
                  ) : (
                    <HStack>
                      <Badge label="Coming soon" variant="neutral" icon={<Glyph name="clock" />} />
                    </HStack>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}
