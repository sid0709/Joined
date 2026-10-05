"use client";

import {
  Badge,
  Banner,
  Button,
  HStack,
  List,
  ListItem,
  Spinner,
  Stack,
  Text,
  SectionCard,
} from "sid-ui";
import { ApiError, type JobMatch, type MatchCompare, type Submission } from "@joined/scout";
import { useEffect, useState } from "react";

import { adminSend } from "@/lib/api";
import { ROUTES } from "@/lib/nav";

function kindLabel(kind: JobMatch["kind"]) {
  return kind === "link" ? "Same apply link" : "Same company and title";
}

function MatchRow({ match, compare }: { match: JobMatch; compare?: MatchCompare }) {
  return (
    <ListItem
      href={match.job_id ? `${ROUTES.jobs}?job=${match.job_id}` : match.apply_link || undefined}
      label={match.title}
      description={`${match.company}${match.apply_link ? ` · ${match.apply_link}` : ""}`}
      startContent={<Badge label={kindLabel(match.kind)} variant="warning" />}
      endContent={
        compare ? (
          <Badge
            label={compare.same_position ? "Same position" : "Different"}
            variant={compare.same_position ? "red" : "success"}
          />
        ) : match.job_id ? (
          <Text type="supporting" color="secondary">
            Open listing
          </Text>
        ) : null
      }
    />
  );
}

/** Stored matches from submit, with an AI compare for company+title pairs. */
export function MatchesReview({ submission }: { submission: Submission }) {
  const matches = submission.matches ?? [];
  const titleMatches = matches.filter((match) => match.kind === "company_title");
  const [compares, setCompares] = useState<MatchCompare[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(titleMatches.length > 0);

  useEffect(() => {
    if (titleMatches.length === 0) return;
    let cancelled = false;
    adminSend<{ compares: MatchCompare[] }>(
      `/v1/admin/scout/submissions/${submission.id}/compare-matches`,
      "POST",
    )
      .then((body) => {
        if (!cancelled) setCompares(body.compares ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not compare the matching jobs.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submission.id, titleMatches.length]);

  if (matches.length === 0 && !submission.duplicate_claim) {
    return null;
  }

  const byKey = new Map<string, MatchCompare>();
  for (const compare of compares ?? []) {
    byKey.set(
      `${compare.match.kind}-${compare.match.job_id ?? ""}-${compare.match.submission_id ?? ""}`,
      compare,
    );
  }

  return (
    <SectionCard
      title="Possible duplicates"
      description={
        submission.duplicate_claim
          ? "The scout claimed this is not the same job. Decide approve vs reject as duplicate."
          : "Existing jobs that share this apply link or company and title."
      }
    >
      <Stack gap={4}>
        {error ? <Banner status="error" title={error} /> : null}
        {matches.length === 0 ? (
          <Text color="secondary" display="block">
            No stored matches.
          </Text>
        ) : (
          <List density="compact">
            {matches.map((match) => (
              <MatchRow
                key={`${match.kind}-${match.job_id ?? match.submission_id ?? match.apply_link}`}
                match={match}
                compare={
                  match.kind === "company_title"
                    ? byKey.get(`${match.kind}-${match.job_id ?? ""}-${match.submission_id ?? ""}`)
                    : undefined
                }
              />
            ))}
          </List>
        )}
        {loading ? (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Comparing company and title matches…</Text>
          </HStack>
        ) : null}
        {(compares ?? []).map((compare) =>
          compare.reason ? (
            <Banner
              key={`reason-${compare.match.job_id ?? compare.match.submission_id}`}
              status={compare.same_position ? "warning" : "info"}
              title={
                compare.same_position
                  ? "Model thinks this is the same position"
                  : "Model thinks these differ"
              }
              description={`${compare.match.title}: ${compare.reason}`}
            />
          ) : null,
        )}
        {matches.some((match) => match.apply_link) ? (
          <HStack gap={2} wrap="wrap">
            {matches
              .filter((match) => match.apply_link)
              .map((match) => (
                <Button
                  key={`open-${match.job_id ?? match.submission_id ?? match.apply_link}`}
                  label={`Open ${match.title}`}
                  variant="ghost"
                  size="sm"
                  href={match.apply_link}
                  target="_blank"
                />
              ))}
          </HStack>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
