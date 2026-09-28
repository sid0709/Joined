"use client";

import { useState } from "react";
import { Button, Grid, Stack, Text, TextInput, useToast } from "@openseat/design-system";
import { SectionCard } from "@/components/section-card";
import { saveProfile } from "@/lib/me/pipeline";
import { normalizeProfile, type HomeAddress, type Profile } from "@/lib/profile";

const FIELD_MIN_WIDTH = 220;

/** Email, phone, home address, and the city used for job search. */
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
  const [address, setAddress] = useState<HomeAddress>(profile.homeAddress);

  const setField = (key: keyof HomeAddress, value: string) =>
    setAddress((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const next = normalizeProfile(await saveProfile({ phone, location, homeAddress: address }));
    onSaved(next);
    toast({ body: "Contact details saved" });
  };

  return (
    <SectionCard
      title="Contact"
      description="Email is your sign-in. Phone and home address stay on your profile until you share them."
      action={<Button label="Save" variant="secondary" size="sm" clickAction={save} />}
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
        <Stack gap={3}>
          <Text type="label" display="block">
            Home address
          </Text>
          <TextInput
            label="Street"
            value={address.line}
            onChange={(value) => setField("line", value)}
          />
          <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
            <TextInput
              label="City"
              value={address.city}
              onChange={(value) => setField("city", value)}
            />
            <TextInput
              label="State / region"
              value={address.region}
              onChange={(value) => setField("region", value)}
            />
            <TextInput
              label="Postal code"
              value={address.postalCode}
              onChange={(value) => setField("postalCode", value)}
            />
            <TextInput
              label="Country"
              value={address.country}
              onChange={(value) => setField("country", value)}
            />
          </Grid>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
