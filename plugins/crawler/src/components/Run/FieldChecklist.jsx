import { Glyph, HStack, Spinner, Text, VStack } from "sid-ui";

import { listDeclaredFields } from "../../routineKit/declaredFields";
import { listFieldGroups } from "../../routineKit/runView";

import { fieldRunSummary, hitRate } from "./runState";

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

function FieldRow({ declared, state, rate }) {
  const spoken =
    state === "reading" ? "reading" : (FIELD_STATE[state] ?? FIELD_STATE.pending).spoken;
  return (
    <li
      className="crawler-field"
      data-state={state}
      data-required={declared.required ? "true" : "false"}
      title={`${declared.label}: ${spoken}${rate === null ? "" : `, found in ${rate}% of jobs`}`}
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
}

/** Declared field groups only: the Run panel never invents a field the routine omitted. */
export default function FieldChecklist({ routine, fieldStates, fieldHits }) {
  const declared = listDeclaredFields(routine);
  const byKey = Object.fromEntries(declared.map((field) => [field.key, field]));
  const groups = listFieldGroups(routine)
    .map((group) => ({
      ...group,
      fields: group.fields.map((key) => byKey[key]).filter(Boolean),
    }))
    .filter((group) => group.fields.length);
  const fields = groups.flatMap((group) => group.fields);
  const { found, invalid } = fieldRunSummary(fields, fieldHits, fieldStates);

  if (!groups.length) return null;

  return (
    <VStack gap={3}>
      {groups.map((group) => (
        <VStack key={group.id} gap={2}>
          <HStack align="center" justify="between">
            <Text type="supporting" weight="semibold">
              {group.label}
            </Text>
            {group.id === groups[0].id ? (
              <Text
                type="supporting"
                weight="semibold"
                hasTabularNumbers
                className={invalid ? "crawler-tone-error" : "crawler-tone-muted"}
              >
                {invalid ? `${invalid} invalid` : `${found}/${fields.length} found`}
              </Text>
            ) : null}
          </HStack>
          <ul className="crawler-field-grid" aria-label={group.label}>
            {group.fields.map((item) => (
              <FieldRow
                key={item.key}
                declared={item}
                state={fieldStates[item.key] ?? "pending"}
                rate={hitRate(fieldHits[item.key])}
              />
            ))}
          </ul>
        </VStack>
      ))}
    </VStack>
  );
}
