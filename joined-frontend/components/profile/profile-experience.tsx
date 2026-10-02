"use client";

import { TextArea, TextInput } from "@joined/design-system";
import { DateRangeFields } from "@/components/profile/date-range-fields";
import { TimelineSection } from "@/components/profile/timeline-section";
import { useProfileSave } from "@/components/profile/use-profile-save";
import { emptyDateRange, isValidDateRange, type ExperienceItem, type Profile } from "@/lib/profile";

function emptyRole(): ExperienceItem {
  return { id: "", role: "", company: "", period: "", summary: "", ...emptyDateRange() };
}

/** Work history, newest first. Companies see it when you apply; Acorn answers from it. */
export function ProfileExperience({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const save = useProfileSave(onSaved);

  return (
    <TimelineSection
      title="Experience"
      description="Roles companies see when you apply, and Acorn uses to answer application questions."
      noun="role"
      emptyText="No roles yet. Add the work you want companies to see."
      items={profile.experience}
      describe={(item) => ({ title: item.role, subtitle: item.company })}
      emptyItem={emptyRole}
      isComplete={(item) =>
        Boolean(item.role.trim() && item.company.trim()) && isValidDateRange(item)
      }
      save={(experience, message) => save({ experience }, message)}
      renderFields={(draft, setDraft) => (
        <>
          <TextInput
            label="Role"
            value={draft.role}
            onChange={(role) => setDraft({ ...draft, role })}
            isRequired
          />
          <TextInput
            label="Company"
            value={draft.company}
            onChange={(company) => setDraft({ ...draft, company })}
            isRequired
          />
          <DateRangeFields
            value={draft}
            onChange={(dates) => setDraft({ ...draft, ...dates })}
            currentLabel="I work here now"
          />
          <TextArea
            label="Summary"
            description="Product, domain, projects, or responsibilities."
            value={draft.summary}
            onChange={(summary) => setDraft({ ...draft, summary })}
            rows={4}
            isOptional
          />
        </>
      )}
    />
  );
}
