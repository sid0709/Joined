"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Grid,
  HStack,
  NumberInput,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Text,
  Tokenizer,
  createStaticSource,
  useToast,
  type SearchableItem,
} from "@joined/design-system";
import {
  AUTHORIZATION_OPTIONS,
  LOCATION_SUGGESTIONS,
  NOTICE_OPTIONS,
  ROLE_SUGGESTIONS,
  SALARY_STEP,
  WORKPLACE_OPTIONS,
  formatSalary,
  normalizeProfile,
  type Profile,
  type Workplace,
} from "@/lib/profile";
import { SectionCard } from "@/components/section-card";
import { saveProfile } from "@/lib/me/pipeline";

const FIELD_MIN_WIDTH = 240;

const toItems = (labels: string[]): SearchableItem[] =>
  labels.map((label) => ({ id: label, label }));

type Preferences = Pick<
  Profile,
  "targetRoles" | "locations" | "workplace" | "salaryFloor" | "authorization" | "noticePeriod"
>;

/** What you want next: roles, places, pay, and eligibility. */
export function ProfilePreferences({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const toast = useToast();
  const roleSource = useMemo(() => createStaticSource(toItems(ROLE_SUGGESTIONS)), []);
  const locationSource = useMemo(() => createStaticSource(toItems(LOCATION_SUGGESTIONS)), []);

  const initial: Preferences = profile;
  const [roles, setRoles] = useState(toItems(initial.targetRoles));
  const [locations, setLocations] = useState(toItems(initial.locations));
  const [workplace, setWorkplace] = useState<Workplace>(initial.workplace);
  const [salary, setSalary] = useState(initial.salaryFloor);
  const [authorization, setAuthorization] = useState(initial.authorization);
  const [notice, setNotice] = useState(initial.noticePeriod);

  const reset = () => {
    setRoles(toItems(initial.targetRoles));
    setLocations(toItems(initial.locations));
    setWorkplace(initial.workplace);
    setSalary(initial.salaryFloor);
    setAuthorization(initial.authorization);
    setNotice(initial.noticePeriod);
  };

  return (
    <SectionCard
      title="Job preferences"
      description="Used to rank jobs for you and shared with companies when you apply."
      footer={
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <Text type="supporting" color="secondary">
            Companies see these only after you apply.
          </Text>
          <HStack gap={2}>
            <Button label="Discard" variant="ghost" onClick={reset} />
            <Button
              label="Save preferences"
              variant="primary"
              clickAction={async () => {
                const next = normalizeProfile(
                  await saveProfile({
                    targetRoles: roles.map((item) => item.label),
                    locations: locations.map((item) => item.label),
                    workplace,
                    salaryFloor: salary,
                    authorization,
                    noticePeriod: notice,
                  }),
                );
                onSaved(next);
                toast({ body: "Preferences saved" });
              }}
            />
          </HStack>
        </HStack>
      }
    >
      <Stack gap={5}>
        <Tokenizer
          label="Target roles"
          description="Pick up to five. We match titles and close variants."
          searchSource={roleSource}
          value={roles}
          onChange={setRoles}
          hasEntriesOnFocus
          hasCreate
          placeholder="Add a role"
        />
        <Tokenizer
          label="Locations"
          searchSource={locationSource}
          value={locations}
          onChange={setLocations}
          hasEntriesOnFocus
          hasCreate
          placeholder="Add a city"
        />
        <Stack gap={2}>
          <Text type="label" display="block">
            Workplace
          </Text>
          <SegmentedControl
            label="Workplace"
            value={workplace}
            onChange={(value) => setWorkplace(value as Workplace)}
            layout="fill"
          >
            {WORKPLACE_OPTIONS.map((option) => (
              <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
            ))}
          </SegmentedControl>
        </Stack>
        <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
          <NumberInput
            label="Salary floor"
            description="Yearly base, before bonus."
            value={salary}
            onChange={setSalary}
            min={0}
            step={SALARY_STEP}
            isIntegerOnly
            formatValue={(value) => formatSalary(value, profile.currency)}
            units={profile.currency}
          />
          <Selector
            label="Available to start"
            options={NOTICE_OPTIONS}
            value={notice}
            onChange={setNotice}
          />
        </Grid>
        <Selector
          label="Work authorization"
          options={AUTHORIZATION_OPTIONS}
          value={authorization}
          onChange={setAuthorization}
        />
      </Stack>
    </SectionCard>
  );
}
