import { Glyph, HStack, Spinner, Text, VStack } from "sid-ui";

import { listDeclaredFields } from "../../routineKit/declaredFields";

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

/** Every declared field: required marker, state in this pass, and hit rate across the run. */
export default function FieldChecklist({ routine, fieldStates, fieldHits }) {
  const fields = listDeclaredFields(routine);
  const found = fields.filter(({ key }) => fieldStates[key] === "ok").length;
  const invalid = fields.filter(({ key }) => fieldStates[key] === "invalid").length;

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
        {fields.map((declared) => {
          const state = fieldStates[declared.key] ?? "pending";
          const rate = hitRate(fieldHits[declared.key]);
          const spoken =
            state === "reading" ? "reading" : (FIELD_STATE[state] ?? FIELD_STATE.pending).spoken;
          return (
            <li
              key={declared.key}
              className="crawler-field"
              data-state={state}
              data-required={declared.required ? "true" : "false"}
              title={`${declared.label}: ${spoken}${rate === null ? "" : `, found in ${rate}% of passes`}`}
            >
              <FieldState state={state} />
              <Text
                type="supporting"
                weight="medium"
                maxLines={1}
                className={state === "invalid" ? "crawler-tone-error" : undefined}
              >
                {declared.label}
                {declared.required ? (
                  <span className="crawler-field-required" aria-label="required">
                    *
                  </span>
                ) : null}
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
