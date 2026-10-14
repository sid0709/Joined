"use client";

import { Stack, Switch } from "sid-ui";
import { useAutoMarkApplied } from "@/components/jobs/use-auto-mark-applied";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

const AUTO_MARK_LABEL = "Mark jobs as applied automatically";

/** The saved "remember my choice" from the mark-as-applied prompt, with a way to undo it. */
export function ApplySettings() {
  const [autoMark, setAutoMark] = useAutoMarkApplied();

  return (
    <Stack gap={6}>
      <SettingsGroup title="After you apply" description="Changes apply right away.">
        <SettingsRow
          label={AUTO_MARK_LABEL}
          description="On marks a job as applied when you click Apply. Off asks you each time."
          layout="inline"
        >
          <Switch label={AUTO_MARK_LABEL} isLabelHidden value={autoMark} onChange={setAutoMark} />
        </SettingsRow>
      </SettingsGroup>
    </Stack>
  );
}
