"use client";

import {
  Stack,
  Text,
  Tokenizer,
  createStaticSource,
  type SearchableItem,
} from "@openseat/design-system";
import { useMemo } from "react";
import type { TeamMember } from "@/lib/company";

/** Assign team interviewers on a candidate. Persists via applicant PATCH when Einstein accepts interviewerIds. */
export function InterviewerAssign({
  members,
  value,
  onChange,
}: {
  members: TeamMember[];
  value: string[];
  onChange: (nextIds: string[]) => void;
}) {
  const source = useMemo(
    () =>
      createStaticSource(
        members.map((member) => ({
          id: member.id,
          label: member.isYou ? `${member.name} (you)` : member.name,
        })),
      ),
    [members],
  );

  const selected: SearchableItem[] = value
    .map((id) => {
      const member = members.find((item) => item.id === id);
      return member
        ? { id: member.id, label: member.isYou ? `${member.name} (you)` : member.name }
        : { id, label: id };
    })
    .filter(Boolean);

  return (
    <Stack gap={2}>
      <Tokenizer
        label="Interviewers"
        description="Who owns the next round for this candidate."
        searchSource={source}
        value={selected}
        onChange={(next) => onChange(next.map((item) => item.id))}
        hasEntriesOnFocus
        placeholder={members.length ? "Add an interviewer" : "Load team to assign"}
      />
      {members.length === 0 ? (
        <Text type="supporting" color="secondary">
          No team members loaded yet.
        </Text>
      ) : null}
      {/* TODO(einstein): PATCH /v1/company/applicants/:id { interviewerIds } */}
    </Stack>
  );
}
