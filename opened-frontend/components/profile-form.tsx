"use client";

import { useState } from "react";
import { Button, FormLayout, HStack, Selector, Stack, Text, TextInput } from "@openseat/design-system";

const FORM_WIDTH = 560;

const REMOTE = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export function ProfileForm() {
  const [headline, setHeadline] = useState("Product designer focused on hiring tools");
  const [roles, setRoles] = useState("Product designer, Content designer");
  const [locations, setLocations] = useState("Chicago, Remote");
  const [workplace, setWorkplace] = useState("hybrid");
  const [salary, setSalary] = useState("140000");
  const [authorization, setAuthorization] = useState("Authorized to work in the United States");
  const [saved, setSaved] = useState(false);

  return (
    <Stack gap={4} maxWidth={FORM_WIDTH}>
      <FormLayout>
        <TextInput label="Headline" value={headline} onChange={setHeadline} />
        <TextInput label="Target roles" value={roles} onChange={setRoles} />
        <TextInput label="Locations" value={locations} onChange={setLocations} />
        <Selector label="Workplace" options={REMOTE} value={workplace} onChange={setWorkplace} />
        <TextInput label="Salary floor" value={salary} onChange={setSalary} description="Yearly, in USD. Stored as a whole number." />
        <TextInput label="Work authorization" value={authorization} onChange={setAuthorization} />
        <HStack gap={2} vAlign="center">
          <Button label="Save profile" variant="primary" onClick={() => setSaved(true)} />
          {saved ? <Text color="secondary">Saved on this page.</Text> : null}
        </HStack>
      </FormLayout>
    </Stack>
  );
}
