"use client";

import { useState } from "react";
import { Button, RadioList, RadioListItem, Stack, Switch, useToast } from "@openseat/design-system";
import { AUDIENCES, type ProfileAudience } from "@/lib/settings";
import { SaveFooter } from "./save-footer";
import { SettingsGroup, SettingsRow } from "./settings-group";

export function PrivacySettings() {
  const toast = useToast();
  const [audience, setAudience] = useState<ProfileAudience>("recruiters");
  const [salary, setSalary] = useState(false);
  const [activity, setActivity] = useState(true);

  return (
    <Stack gap={6}>
      <SettingsGroup
        title="Profile visibility"
        description="Who can find your profile in search."
        footer={
          <SaveFooter
            hint="Companies you apply to always see your application."
            message="Visibility saved"
          />
        }
      >
        <RadioList
          label="Who can see your profile"
          isLabelHidden
          value={audience}
          onChange={(value) => setAudience(value as ProfileAudience)}
        >
          {AUDIENCES.map((option) => (
            <RadioListItem
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
            />
          ))}
        </RadioList>
      </SettingsGroup>

      <SettingsGroup title="How we use your data" description="Changes apply right away.">
        <SettingsRow
          label="Show my salary floor to companies"
          description="Off keeps it private and only uses it to rank jobs for you."
          layout="inline"
        >
          <Switch
            label="Show my salary floor to companies"
            isLabelHidden
            value={salary}
            onChange={setSalary}
          />
        </SettingsRow>
        <SettingsRow
          label="Improve matches with my activity"
          description="Use the jobs you save and skip to tune your ranking."
          layout="inline"
        >
          <Switch
            label="Improve matches with my activity"
            isLabelHidden
            value={activity}
            onChange={setActivity}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Your data">
        <SettingsRow
          label="Export everything"
          description="Profile, resumes, applications, and messages as a ZIP."
          layout="inline"
        >
          <Button
            label="Request export"
            variant="secondary"
            size="sm"
            onClick={() => toast({ body: "We’ll email you a download link within a few minutes." })}
          />
        </SettingsRow>
      </SettingsGroup>
    </Stack>
  );
}
