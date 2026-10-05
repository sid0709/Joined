import type { FormEvent, Ref } from "react";
import {
  Button,
  Card,
  Glyph,
  HStack,
  Heading,
  Show,
  Stack,
  StackItem,
  Text,
  TextInput,
  Token,
} from "sid-ui";
import { formatCount } from "@/lib/jobs";

export type SavedQuery = { q: string; where: string };

export type JobSearchBarProps = {
  q: string;
  where: string;
  onChange: (patch: Partial<SavedQuery>) => void;
  onSubmit: () => void;
  recent: SavedQuery[];
  suggestions: string[];
  totals: { jobs: number; companies: number; hidden: number };
  alertOn: boolean;
  onToggleAlert: () => void;
  inputRef?: Ref<HTMLInputElement>;
};

function queryLabel({ q, where }: SavedQuery) {
  return [q, where].filter(Boolean).join(" · ");
}

/** The page hero: what the market looks like, the two search fields, and one-tap searches. */
export function JobSearchBar({
  q,
  where,
  onChange,
  onSubmit,
  recent,
  suggestions,
  totals,
  alertOn,
  onToggleAlert,
  inputRef,
}: JobSearchBarProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Card padding={6} elevation="low">
      <Stack gap={5}>
        <HStack hAlign="between" vAlign="start" gap={4} wrap="wrap">
          <Stack gap={1}>
            <Heading level={1}>Find your next role</Heading>
            <Text color="secondary" display="block">
              {formatCount(totals.jobs, "open role")} at{" "}
              {formatCount(totals.companies, "company", "companies")} ·{" "}
              {formatCount(totals.hidden, "hidden job")} you won’t find on the big boards
            </Text>
          </Stack>
          <Button
            label={alertOn ? "Alert on" : "Create job alert"}
            variant={alertOn ? "secondary" : "ghost"}
            icon={<Glyph name={alertOn ? "check" : "bell"} />}
            onClick={onToggleAlert}
            tooltip={
              alertOn
                ? "Turn off the daily email for this search"
                : "Email me new jobs for this search"
            }
          />
        </HStack>

        <form role="search" aria-label="Search jobs" onSubmit={submit}>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <StackItem size="fill">
              <TextInput
                ref={inputRef}
                label="What"
                placeholder="Job title, skill, or company"
                value={q}
                onChange={(value) => onChange({ q: value })}
                startIcon={<Glyph name="search" />}
                size="md"
                width="100%"
                hasClear
                autoComplete="off"
              />
            </StackItem>
            <StackItem size="fill">
              <TextInput
                label="Where"
                placeholder="City, state, or remote"
                value={where}
                onChange={(value) => onChange({ where: value })}
                startIcon={<Glyph name="pin" />}
                size="md"
                width="100%"
                hasClear
                autoComplete="off"
              />
            </StackItem>
            <Button
              type="submit"
              label="Search"
              variant="primary"
              size="md"
              icon={<Glyph name="search" />}
            />
          </HStack>
        </form>

        <HStack gap={2} vAlign="center" wrap="wrap">
          {recent.length ? (
            <Show from="md" responsiveTo="viewport">
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="supporting" color="secondary">
                  Recent
                </Text>
                {recent.map((item) => (
                  <Token
                    key={queryLabel(item)}
                    label={queryLabel(item)}
                    icon={<Glyph name="clock" />}
                    size="sm"
                    onClick={() => onChange(item)}
                  />
                ))}
              </HStack>
            </Show>
          ) : null}
          <Text type="supporting" color="secondary">
            For you
          </Text>
          {suggestions.map((role) => (
            <Token
              key={role}
              label={role}
              icon={<Glyph name="sparkle" />}
              size="sm"
              color="blue"
              onClick={() => onChange({ q: role, where: "" })}
            />
          ))}
        </HStack>
      </Stack>
    </Card>
  );
}
