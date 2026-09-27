"use client";

import { useState } from "react";
import { Stack, Switch } from "@openseat/design-system";
import type { Profile, VisibilityKey, VisibilitySetting } from "@/lib/profile";
import { SectionCard } from "@/components/section-card";

/** Who can find you, toggled in place. */
export function ProfileVisibility({
  profile,
  settings,
}: {
  profile: Profile;
  settings: VisibilitySetting[];
}) {
  const [values, setValues] = useState(profile.visibility);
  const set = (key: VisibilityKey, value: boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <SectionCard title="Visibility" description="Changes apply right away.">
      <Stack gap={4}>
        {settings.map((setting) => (
          <Switch
            key={setting.key}
            label={setting.label}
            description={setting.description}
            value={values[setting.key]}
            onChange={(checked) => set(setting.key, checked)}
          />
        ))}
      </Stack>
    </SectionCard>
  );
}
