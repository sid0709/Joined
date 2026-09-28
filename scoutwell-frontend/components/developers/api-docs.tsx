import {
  Badge,
  CodeBlock,
  HStack,
  List,
  ListItem,
  Stack,
  Text,
  type BadgeVariant,
  SectionCard,
} from "@openseat/design-system";
import { SUBMISSION_STATUS, type Meta, type SubmissionStatus } from "@openseat/scout";

import { FullText } from "@/components/full-text";

const METHOD_BADGE: Record<string, BadgeVariant> = { GET: "blue", POST: "green", DELETE: "red" };

const ENDPOINTS = [
  [
    "POST",
    "/v1/scout/submissions",
    "Submit one job. Answers 201 with the submission in status submitted.",
  ],
  [
    "POST",
    "/v1/scout/submissions/batch",
    "Submit up to {max_batch} jobs; 207 with a result per item.",
  ],
  [
    "POST",
    "/v1/scout/submissions/precheck",
    "Check a link without submitting: reachable, official, duplicate.",
  ],
  [
    "GET",
    "/v1/scout/submissions",
    "Your submissions, newest first. Filters: status, external_ref, updated_since.",
  ],
  ["GET", "/v1/scout/submissions/{id}", "One submission with its check results and usage."],
  ["GET", "/v1/scout/stats", "Level, daily quota, quality metrics, and balance."],
  ["GET", "/v1/scout/earnings", "Reward lines, newest first. Filters: status, submission_id."],
  ["GET", "/v1/scout/meta", "Levels, rewards, and field limits. No key needed."],
] as const;

const ERRORS = [
  ["401", "unauthorized", "Missing, unknown, or revoked key."],
  ["403", "terms_required", "Accept the scout terms in Scoutwell first."],
  ["409", "conflict", "external_ref already used; existing_id names the submission."],
  ["409", "idempotency_key_reused", "Same Idempotency-Key with a different body."],
  ["422", "validation_failed", "errors[] lists each field and what is wrong."],
  ["429", "quota_exceeded", "Daily limit reached; see RateLimit-* and Retry-After."],
] as const;

const FLOW: SubmissionStatus[] = [
  "submitted",
  "auto_checking",
  "needs_review",
  "approved",
  "rejected",
  "duplicate",
];

function curl(base: string) {
  return `curl -X POST ${base}/v1/scout/submissions \\
  -H "Authorization: Bearer $SCOUTWELL_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 7f0c2a6e-5d1b-4f8e-9a3c-2b4d6e8f0a1c" \\
  -d '{
    "url": "https://boards.greenhouse.io/acme/jobs/4012345",
    "company_name": "Acme",
    "title": "Senior Platform Engineer",
    "location_text": "Remote (US)",
    "salary": "$170k - $210k a year",
    "summary": "Owns the deploy pipeline for 40 services; Go and Kubernetes; small team, on-call one week in six.",
    "tags": ["remote", "visa"],
    "skills": ["Go", "Kubernetes"],
    "external_ref": "feed-2026-09-28-0142"
  }'`;
}

const RESPONSE = `HTTP/1.1 201 Created
Location: /v1/scout/submissions/66f7c2b41a9e3d0c5b8a7f21
RateLimit-Limit: 50
RateLimit-Remaining: 49

{
  "id": "66f7c2b41a9e3d0c5b8a7f21",
  "status": "submitted",
  "canonical_url": "https://boards.greenhouse.io/acme/jobs/4012345",
  "ats": "Greenhouse",
  "channel": "api",
  "external_ref": "feed-2026-09-28-0142",
  "auto_check_results": [],
  ...
}`;

function poll(base: string) {
  return `# Every few minutes: everything that changed since your last sync.
curl "${base}/v1/scout/submissions?updated_since=2026-09-28T09:00:00Z&limit=100" \\
  -H "Authorization: Bearer $SCOUTWELL_KEY"
# Follow next_cursor as ?cursor= until it comes back empty.`;
}

const PROBLEM = `HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 422,
  "code": "validation_failed",
  "detail": "One or more fields are invalid.",
  "errors": [{ "field": "summary", "detail": "must be at least 40 characters" }]
}`;

/** Integration guide for partners who submit jobs from their own systems. */
export function ApiDocs({ baseUrl, meta }: { baseUrl: string; meta: Meta }) {
  const { limits } = meta;
  return (
    <Stack gap={6}>
      <SectionCard
        title="Quickstart"
        description="Send a key as a bearer token. Every request and response is JSON with snake_case fields."
      >
        <CodeBlock code={curl(baseUrl)} language="bash" title="Submit a job" hasCopyButton />
        <CodeBlock code={RESPONSE} language="http" title="Response" />
        <Text type="supporting" color="secondary" display="block">
          Checks run in the background, usually within seconds: the link is opened, confirmed
          official and still open, and compared with the pool. Then the job is approved, sent to a
          moderator, or rejected with a reason.
        </Text>
      </SectionCard>

      <SectionCard title="Endpoints" description={`Base URL ${baseUrl}`}>
        <List density="compact">
          {ENDPOINTS.map(([method, path, description]) => (
            <ListItem
              key={`${method} ${path}`}
              label={path}
              description={
                <FullText>{description.replace("{max_batch}", String(limits.max_batch))}</FullText>
              }
              startContent={<Badge label={method} variant={METHOD_BADGE[method] ?? "neutral"} />}
            />
          ))}
        </List>
      </SectionCard>

      <SectionCard
        title="Statuses"
        description="A submission moves left to right and stops at a decision."
      >
        <List density="compact">
          {FLOW.map((status) => (
            <ListItem
              key={status}
              label={status}
              description={<FullText>{SUBMISSION_STATUS[status].description}</FullText>}
              startContent={
                <Badge
                  label={SUBMISSION_STATUS[status].label}
                  variant={SUBMISSION_STATUS[status].badge}
                />
              }
            />
          ))}
        </List>
      </SectionCard>

      <SectionCard title="Staying in sync" description="Poll for changes instead of each id.">
        <CodeBlock code={poll(baseUrl)} language="bash" hasCopyButton />
        <List density="compact">
          <ListItem
            label="Idempotency-Key"
            description={
              <FullText>
                Send a unique key per job. Retrying with the same key and body returns the first
                response instead of a duplicate; keys last 24 hours.
              </FullText>
            }
          />
          <ListItem
            label="external_ref"
            description={
              <FullText>
                Your own id for the job, unique per account. Reusing it answers 409 with
                existing_id, and you can filter by it.
              </FullText>
            }
          />
          <ListItem
            label="Daily quota"
            description={
              <FullText>
                {`Your level sets the daily limit: ${meta.levels.map((level) => `${level.label} ${level.daily_limit}`).join(", ")}. It resets at midnight UTC and every create returns RateLimit-* headers.`}
              </FullText>
            }
          />
        </List>
      </SectionCard>

      <SectionCard title="Fields">
        <List density="compact">
          <ListItem
            label="url · required"
            description={
              <FullText>
                The official posting on the employer&apos;s site or ATS. Never a job board.
              </FullText>
            }
          />
          <ListItem
            label="company_name, title · required"
            description={<FullText>As the employer writes them.</FullText>}
          />
          <ListItem
            label="summary · required"
            description={
              <FullText>{`${limits.min_summary_chars}–${limits.max_summary_chars} characters in your own words. Copied text goes to review.`}</FullText>
            }
          />
          <ListItem
            label="workplace, employment, seniority"
            description={
              <FullText>{`${limits.workplaces.join(" | ")}; ${limits.employments.join(" | ")}; ${limits.seniorities.join(" | ")}. Omit to infer.`}</FullText>
            }
          />
          <ListItem
            label="pay, location_text, tags, skills"
            description={
              <FullText>{`Optional. pay is { min, max, currency, period } with period year or hour. A salary string is still accepted. Up to ${limits.max_tags} tags and ${limits.max_skills} skills.`}</FullText>
            }
          />
          <ListItem
            label="company_id"
            description={
              <FullText>
                Optional. Id from GET /v1/scout/companies. company_name is still required.
              </FullText>
            }
          />
          <ListItem
            label="on_major_boards"
            description={<FullText>true when the job is also on LinkedIn or Indeed.</FullText>}
          />
        </List>
      </SectionCard>

      <SectionCard
        title="Errors"
        description="Failures use RFC 9457 problem details with a stable code."
      >
        <CodeBlock code={PROBLEM} language="http" />
        <List density="compact">
          {ERRORS.map(([status, code, description]) => (
            <ListItem
              key={code}
              label={code}
              description={<FullText>{description}</FullText>}
              startContent={
                <HStack>
                  <Badge label={status} variant="neutral" />
                </HStack>
              }
            />
          ))}
        </List>
      </SectionCard>
    </Stack>
  );
}
