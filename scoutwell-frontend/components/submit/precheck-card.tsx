import { Badge, HStack, Spinner, Stack, Text, type BadgeVariant, SectionCard } from "sid-ui";

import type { PrecheckState } from "./use-precheck";

type Row = { label: string; value: string; badge: BadgeVariant };

function rows(state: PrecheckState): Row[] {
  if (state.phase !== "done") return [];
  const { result } = state;
  const official: Row = result.official
    ? {
        label: "Official source",
        value: result.ats ? `${result.ats} board` : "Company site",
        badge: "success",
      }
    : { label: "Official source", value: "Job board", badge: "error" };
  const reachable: Row = result.reachable
    ? { label: "Reachable", value: `HTTP ${result.http_status ?? 200}`, badge: "success" }
    : {
        label: "Reachable",
        value: result.http_status ? `HTTP ${result.http_status}` : "Not yet",
        badge: result.official ? "warning" : "neutral",
      };
  const open: Row =
    result.still_open === null
      ? { label: "Still open", value: "Unknown", badge: "neutral" }
      : result.still_open
        ? { label: "Still open", value: "Yes", badge: "success" }
        : { label: "Still open", value: "Looks closed", badge: "error" };
  return [official, reachable, open];
}

/** The live answer for the link being typed: what the automatic checks will likely say. */
export function PrecheckCard({ state }: { state: PrecheckState }) {
  return (
    <SectionCard
      title="Link check"
      description="A preview of the automatic checks. The full run happens after you submit."
    >
      {state.phase === "idle" ? (
        <Text color="secondary" display="block">
          Paste the apply link to check it.
        </Text>
      ) : null}
      {state.phase === "checking" ? (
        <HStack gap={2} vAlign="center">
          <Spinner size="sm" />
          <Text color="secondary">Opening the page…</Text>
        </HStack>
      ) : null}
      {state.phase === "invalid" ? (
        <Text color="secondary" display="block">
          {state.message}
        </Text>
      ) : null}
      {state.phase === "done" ? (
        <Stack gap={3}>
          <Text type="supporting" color="secondary" display="block">
            {state.result.host} — {state.result.reason}
          </Text>
          {rows(state).map((row) => (
            <HStack key={row.label} hAlign="between" vAlign="center" gap={3}>
              <Text>{row.label}</Text>
              <Badge label={row.value} variant={row.badge} />
            </HStack>
          ))}
        </Stack>
      ) : null}
    </SectionCard>
  );
}
