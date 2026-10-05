import { Glyph, HStack, Spinner, Text, VStack } from "sid-ui";

import { fieldLabel } from "../../routineKit/describe";
import { listFields } from "../../routineKit/routine";

import { hitRate } from "./runState";

/** Glyph, tone, and spoken status for each field state (see runState.fieldStatus). */
const FIELD_STATE = {
  pending: { glyph: "dot", tone: "crawler-tone-muted", spoken: "waiting" },
  ok: { glyph: "check", tone: "crawler-tone-success", spoken: "found" },
  empty: { glyph: "minus", tone: "crawler-tone-muted", spoken: "not on the page" },
  invalid: { glyph: "close", tone: "crawler-tone-error", spoken: "missing or invalid" },
};

function FieldState({ state }) {
  if (state === "reading") return <Spinner size="sm" />;
  const { glyph, tone } = FIELD_STATE[state] ?? FIELD_STATE.pending;
  return <Glyph name={glyph} className={tone} />;
}

/** Every field the routine reads: its state in this pass and its hit rate across the run. */
export default function FieldChecklist({ routine, fieldStates, fieldHits }) {
  const fields = listFields(routine);
  const found = fields.filter(({ path }) => fieldStates[path] === "ok").length;
  const invalid = fields.filter(({ path }) => fieldStates[path] === "invalid").length;

  return (
    <VStack gap={2}>
      <HStack align="center" justify="between">
        <Text type="supporting" weight="semibold">
          Fields
        </Text>
        <Text
          type="supporting"
          weight="semibold"
          hasTabularNumbers
          className={invalid ? "crawler-tone-error" : "crawler-tone-muted"}
        >
          {invalid ? `${invalid} invalid` : `${found}/${fields.length} found`}
        </Text>
      </HStack>
      <ul className="crawler-field-grid" aria-label="Fields in this pass">
        {fields.map(({ path, field }) => {
          const state = fieldStates[path] ?? "pending";
          const rate = hitRate(fieldHits[path]);
          const label = fieldLabel(path, field);
          const spoken =
            state === "reading" ? "reading" : (FIELD_STATE[state] ?? FIELD_STATE.pending).spoken;
          return (
            <li
              key={path}
              className="crawler-field"
              data-state={state}
              title={`${label}: ${spoken}${rate === null ? "" : `, found in ${rate}% of passes`}`}
            >
              <FieldState state={state} />
              <Text
                type="supporting"
                weight="medium"
                maxLines={1}
                className={state === "invalid" ? "crawler-tone-error" : undefined}
              >
                {label}
              </Text>
              {rate === null ? null : (
                <Text
                  type="supporting"
                  hasTabularNumbers
                  className={rate < 100 ? "crawler-tone-warning" : "crawler-tone-muted"}
                >
                  {rate}%
                </Text>
              )}
            </li>
          );
        })}
      </ul>
    </VStack>
  );
}
