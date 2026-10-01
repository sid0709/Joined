"use client";

import { useMemo, useState } from "react";
import {
  Button,
  HStack,
  Stack,
  TextInput,
  Typeahead,
  createStaticSource,
  useToast,
  type SearchableItem,
  type SearchSource,
} from "@joined/design-system";
import { saveJobTeams } from "@/lib/company/api";

function asItem(label: string): SearchableItem {
  return { id: label, label };
}

function teamSource(teams: string[], canCreate: boolean): SearchSource<SearchableItem> {
  const known = createStaticSource(teams.map(asItem));
  return {
    bootstrap: () => known.bootstrap(),
    cancel: () => known.cancel?.(),
    async search(query) {
      const matches = await known.search(query);
      const text = query.trim();
      if (!canCreate || !text) return matches;
      const exists = teams.some((team) => team.toLowerCase() === text.toLowerCase());
      if (exists) return matches;
      return [...matches, asItem(text)];
    },
  };
}

type TeamsProps = {
  value: string;
  teams: string[];
  canEditTeams: boolean;
  onChange: (team: string) => void;
  onTeams: (teams: string[]) => void;
};

function useTeamList({ value, teams, canEditTeams, onChange, onTeams }: TeamsProps) {
  const toast = useToast();
  const persist = (next: string[], rename?: { from: string; to: string }) => {
    if (!canEditTeams) return Promise.resolve(next);
    return saveJobTeams(next, rename)
      .then((saved) => {
        onTeams(saved);
        return saved;
      })
      .catch((error: Error) => {
        toast({ body: error.message, type: "error" });
        throw error;
      });
  };
  return {
    persist,
    add(name: string) {
      if (!name || teams.some((team) => team.toLowerCase() === name.toLowerCase())) return;
      void persist([...teams, name]);
    },
    rename(from: string, to: string) {
      if (to === from) return;
      void persist(
        teams.map((item) => (item === from ? to : item)),
        { from, to },
      ).then((saved) => {
        if (value === from) onChange(saved.find((item) => item === to) ?? to);
      });
    },
    remove(name: string) {
      void persist(teams.filter((item) => item !== name)).then(() => {
        if (value === name) onChange("");
      });
    },
  };
}

/** Typeahead of this company’s teams. Creators can type a name that is not on the list yet. */
export function JobTeamField(props: TeamsProps) {
  const { value, teams, canEditTeams, onChange } = props;
  const source = useMemo(() => teamSource(teams, canEditTeams), [teams, canEditTeams]);
  const { add } = useTeamList(props);
  return (
    <Typeahead
      label="Team"
      searchSource={source}
      value={value ? asItem(value) : null}
      onChange={(item) => {
        const next = item?.label.trim() ?? "";
        onChange(next);
        if (canEditTeams) add(next);
      }}
      placeholder="Design"
      hasEntriesOnFocus
      emptySearchResultsText={canEditTeams ? "Type a team name" : "No teams yet"}
    />
  );
}

/** Creator-only rename and remove for the company’s hiring teams. */
export function JobTeamList(props: TeamsProps) {
  const { teams, canEditTeams } = props;
  const { rename, remove } = useTeamList(props);
  if (!canEditTeams || teams.length === 0) return null;
  return (
    <Stack gap={2}>
      {teams.map((team) => (
        <TeamRow
          key={team}
          name={team}
          onRename={(to) => rename(team, to)}
          onRemove={() => remove(team)}
        />
      ))}
    </Stack>
  );
}

function TeamRow({
  name,
  onRename,
  onRemove,
}: {
  name: string;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <HStack gap={2} vAlign="end" wrap="wrap">
      <TextInput
        label="Team name"
        isLabelHidden
        value={draft}
        onChange={setDraft}
        onBlur={() => {
          const next = draft.trim();
          if (!next) {
            setDraft(name);
            return;
          }
          if (next !== name) onRename(next);
        }}
      />
      <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} />
    </HStack>
  );
}
