"use client";

import { useState } from "react";
import { Button, Grid, Stack, TextInput, useToast } from "sid-ui";
import { SaveFooter } from "@/components/save-footer";
import { SectionCard } from "@/components/section-card";
import { saveProfile } from "@/lib/me/pipeline";
import { normalizeProfile, type Profile } from "@/lib/profile";

const FIELD_MIN_WIDTH = 220;

/** Email, phone, and the city used for job search. */
export function ProfileContact({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState(profile.phone);
  const [location, setLocation] = useState(profile.location);

  const save = async () => {
    const next = normalizeProfile(await saveProfile({ phone, location }));
    onSaved(next);
    toast({ body: "Contact details saved" });
  };

  return (
    <SectionCard
      title="Contact"
      description="Email is your sign-in. Your phone stays on your profile until you apply."
      footer={
        <SaveFooter
          action={<Button label="Save" variant="primary" size="sm" clickAction={save} />}
        />
      }
    >
      <Stack gap={5}>
        <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
          <TextInput label="Email" value={profile.email} isReadOnly />
          <TextInput
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+1 312 555 0100"
          />
        </Grid>
        <TextInput
          label="Location"
          description="City shown on your profile and used to rank jobs."
          value={location}
          onChange={setLocation}
          placeholder="Chicago, IL"
        />
      </Stack>
    </SectionCard>
  );
}
