"use client";

import {
  Badge,
  Button,
  Glyph,
  HStack,
  IconButton,
  SectionCard,
  Selector,
  Stack,
  TextArea,
  TextInput,
} from "sid-ui";
import {
  MONTH_OPTIONS,
  ROLE_SUMMARY_ROWS,
  YEAR_OPTIONS,
  blankEntry,
  entryDates,
  type ApplicantProfile,
  type CareerEntry,
} from "@/lib/workspace/profile";

export function ProfileTimeline({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: (profile: ApplicantProfile) => void;
}) {
  const setEntry = (id: string, patch: Partial<CareerEntry>) => {
    onChange({
      ...profile,
      timeline: profile.timeline.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    });
  };

  const add = (kind: CareerEntry["kind"]) => {
    onChange({ ...profile, timeline: [blankEntry(kind), ...profile.timeline] });
  };

  const remove = (id: string) => {
    onChange({ ...profile, timeline: profile.timeline.filter((entry) => entry.id !== id) });
  };

  return (
    <Stack gap={4}>
      <SectionCard
        title="Career timeline"
        description="Most recent first."
        action={
          <HStack gap={2} wrap="wrap">
            <Button
              label="Education"
              variant="secondary"
              size="sm"
              icon={<Glyph name="plus" />}
              onClick={() => add("education")}
            />
            <Button
              label="Role"
              variant="secondary"
              size="sm"
              icon={<Glyph name="plus" />}
              onClick={() => add("role")}
            />
          </HStack>
        }
      >
        <Stack gap={4}>
          {profile.timeline.map((entry) => (
            <SectionCard
              key={entry.id}
              title={entry.title || (entry.kind === "education" ? "Education" : "Role")}
              description={entry.org ? `${entry.org} · ${entryDates(entry)}` : entryDates(entry)}
              action={
                <HStack gap={2} vAlign="center">
                  {entry.current ? <Badge label="Current" variant="success" /> : null}
                  {entry.kind === "education" ? <Badge label="Education" variant="blue" /> : null}
                  <IconButton
                    label={`Remove ${entry.title || "entry"}`}
                    icon={<Glyph name="trash" />}
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(entry.id)}
                  />
                </HStack>
              }
            >
              <Stack gap={3}>
                <TextInput
                  label={entry.kind === "education" ? "School" : "Company"}
                  value={entry.org}
                  onChange={(org) => setEntry(entry.id, { org })}
                />
                <TextInput
                  label={entry.kind === "education" ? "Credential" : "Title"}
                  value={entry.title}
                  onChange={(title) => setEntry(entry.id, { title })}
                />
                {entry.kind === "role" ? (
                  <TextArea
                    label="What you did"
                    value={entry.summary}
                    onChange={(summary) => setEntry(entry.id, { summary })}
                    rows={ROLE_SUMMARY_ROWS}
                    placeholder="Product, domain, project, or responsibilities"
                  />
                ) : null}
                <HStack gap={2} wrap="wrap">
                  <Selector
                    label="Start month"
                    options={MONTH_OPTIONS}
                    value={entry.startMonth}
                    onChange={(startMonth) => setEntry(entry.id, { startMonth })}
                  />
                  <Selector
                    label="Start year"
                    options={YEAR_OPTIONS}
                    value={entry.startYear}
                    onChange={(startYear) => setEntry(entry.id, { startYear })}
                  />
                  {entry.current ? null : (
                    <>
                      <Selector
                        label="End month"
                        options={MONTH_OPTIONS}
                        value={entry.endMonth}
                        onChange={(endMonth) => setEntry(entry.id, { endMonth })}
                      />
                      <Selector
                        label="End year"
                        options={YEAR_OPTIONS}
                        value={entry.endYear}
                        onChange={(endYear) => setEntry(entry.id, { endYear })}
                      />
                    </>
                  )}
                </HStack>
                <Button
                  label={entry.current ? "Current" : "Mark current"}
                  variant={entry.current ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setEntry(entry.id, { current: !entry.current })}
                />
              </Stack>
            </SectionCard>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
