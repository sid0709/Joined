"use client";

import { Grid, TextArea, TextInput } from "@joined/design-system";
import { DateRangeFields } from "@/components/profile/date-range-fields";
import { TimelineSection } from "@/components/profile/timeline-section";
import { useProfileSave } from "@/components/profile/use-profile-save";
import { emptyDateRange, isValidDateRange, type EducationItem, type Profile } from "@/lib/profile";

const FIELD_MIN_WIDTH = 200;

function emptySchool(): EducationItem {
  return {
    id: "",
    school: "",
    degree: "",
    field: "",
    period: "",
    summary: "",
    ...emptyDateRange(),
  };
}

/** Schools and degrees, newest first. Acorn uses them for education questions. */
export function ProfileEducation({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const save = useProfileSave(onSaved);

  return (
    <TimelineSection
      title="Education"
      description="Schools and degrees Acorn uses to answer education questions."
      noun="education"
      emptyText="No education yet. Add your degrees, schools, or programs."
      items={profile.education}
      describe={(item) => ({
        title: item.school,
        subtitle: [item.degree, item.field].filter(Boolean).join(", "),
      })}
      emptyItem={emptySchool}
      isComplete={(item) => Boolean(item.school.trim()) && isValidDateRange(item)}
      save={(education, message) => save({ education }, message)}
      renderFields={(draft, setDraft) => (
        <>
          <TextInput
            label="School"
            value={draft.school}
            onChange={(school) => setDraft({ ...draft, school })}
            placeholder="University of California, Berkeley"
            isRequired
          />
          <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
            <TextInput
              label="Degree"
              value={draft.degree}
              onChange={(degree) => setDraft({ ...draft, degree })}
              placeholder="Bachelor of Science"
              isOptional
            />
            <TextInput
              label="Field of study"
              value={draft.field}
              onChange={(field) => setDraft({ ...draft, field })}
              placeholder="Computer Science"
              isOptional
            />
          </Grid>
          <DateRangeFields
            value={draft}
            onChange={(dates) => setDraft({ ...draft, ...dates })}
            currentLabel="I study here now"
          />
          <TextArea
            label="Notes"
            description="GPA, honors, coursework, or activities."
            value={draft.summary}
            onChange={(summary) => setDraft({ ...draft, summary })}
            rows={3}
            isOptional
          />
        </>
      )}
    />
  );
}
