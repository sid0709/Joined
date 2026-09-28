"use client";

import { useState } from "react";
import { Stack, Switch, useToast } from "@openseat/design-system";
import type { Profile, VisibilityKey, VisibilitySetting } from "@/lib/profile";
import { normalizeProfile } from "@/lib/profile";
import { SectionCard } from "@/components/section-card";
import { saveProfile } from "@/lib/me/pipeline";

/** Who can find you, toggled in place. */
export function ProfileVisibility({
  profile,
  settings,
  onSaved,
}: {
  profile: Profile;
  settings: VisibilitySetting[];
  onSaved: (profile: Profile) => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState(profile.visibility);

  const set = async (key: VisibilityKey, value: boolean) => {
    const visibility = { ...values, [key]: value };
    setValues(visibility);
    try {
      onSaved(normalizeProfile(await saveProfile({ visibility })));
    } catch (error) {
      setValues(profile.visibility);
      toast({
        body: error instanceof Error ? error.message : "Could not save visibility",
        type: "error",
      });
    }
  };

  return (
    <SectionCard title="Visibility" description="Changes apply right away.">
      <Stack gap={4}>
        {settings.map((setting) => (
          <Switch
            key={setting.key}
            label={setting.label}
            description={setting.description}
            value={values[setting.key]}
            onChange={(checked) => void set(setting.key, checked)}
          />
        ))}
      </Stack>
    </SectionCard>
  );
}
