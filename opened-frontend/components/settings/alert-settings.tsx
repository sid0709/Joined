"use client";

import { useState } from "react";
import {
  CheckboxList,
  CheckboxListItem,
  SegmentedControl,
  SegmentedControlItem,
  Slider,
  Stack,
} from "@openseat/design-system";
import {
  ALERT_FREQUENCIES,
  ALERT_SOURCES,
  DEFAULT_MIN_MATCH,
  MATCH_MAX,
  MATCH_MIN,
  MATCH_STEP,
  estimateWeeklyMatches,
} from "@/lib/settings";
import { SaveFooter } from "./save-footer";
import { SettingsGroup, SettingsRow } from "./settings-group";

const DEFAULT_SOURCES = ["direct", "scouted"];

export function AlertSettings() {
  const [frequency, setFrequency] = useState("daily");
  const [minMatch, setMinMatch] = useState(DEFAULT_MIN_MATCH);
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const isOff = frequency === "off";

  return (
    <Stack gap={6}>
      <SettingsGroup
        title="Alert schedule"
        description="Alerts use the target roles and locations on your profile."
        footer={
          <SaveFooter
            hint={
              isOff
                ? "Alerts are off. You can still search any time."
                : `About ${estimateWeeklyMatches(minMatch)} new matches a week at this setting.`
            }
            message="Job alerts saved"
          />
        }
      >
        <SettingsRow label="How often" description="Instant alerts arrive as jobs are posted.">
          <SegmentedControl
            label="How often"
            value={frequency}
            onChange={setFrequency}
            layout="fill"
          >
            {ALERT_FREQUENCIES.map((option) => (
              <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
            ))}
          </SegmentedControl>
        </SettingsRow>
        <SettingsRow label="Minimum match" description="Skip jobs that fit you less than this.">
          <Slider
            label="Minimum match"
            isLabelHidden
            min={MATCH_MIN}
            max={MATCH_MAX}
            step={MATCH_STEP}
            value={minMatch}
            onChange={setMinMatch}
            formatValue={(value) => `${value}%`}
            valueDisplay="text"
            isDisabled={isOff}
          />
        </SettingsRow>
        <SettingsRow label="Include" description="Where the jobs come from.">
          <CheckboxList
            label="Include"
            isLabelHidden
            value={sources}
            onChange={setSources}
            isDisabled={isOff}
          >
            {ALERT_SOURCES.map((option) => (
              <CheckboxListItem key={option.value} value={option.value} label={option.label} />
            ))}
          </CheckboxList>
        </SettingsRow>
      </SettingsGroup>
    </Stack>
  );
}
