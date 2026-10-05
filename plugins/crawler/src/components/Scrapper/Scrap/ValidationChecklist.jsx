import { Glyph, HStack, Text, VStack } from "@joined/design-system";

/** Glyph and tone for each check status. */
const CHECK_STATUS = {
  valid: { glyph: "check", tone: "crawler-tone-success" },
  invalid: { glyph: "close", tone: "crawler-tone-error" },
  pending: { glyph: "dot", tone: "crawler-tone-muted" },
};

function ValidationChecklist({ checks }) {
  const validCount = checks.filter(({ status }) => status === "valid").length;
  const invalidCount = checks.filter(({ status }) => status === "invalid").length;

  return (
    <VStack gap={2} width="100%">
      <HStack align="center" justify="between">
        <Text type="supporting" weight="semibold">
          Field validation
        </Text>
        <Text
          type="supporting"
          weight="semibold"
          className={invalidCount ? "crawler-tone-error" : "crawler-tone-muted"}
        >
          {invalidCount ? `${invalidCount} missing` : `${validCount}/${checks.length} valid`}
        </Text>
      </HStack>

      <div className="crawler-check-grid">
        {checks.map((check, index) => {
          const { glyph, tone } = CHECK_STATUS[check.status] || CHECK_STATUS.pending;
          const isWide = checks.length % 2 === 1 && index === checks.length - 1;

          return (
            <HStack
              key={check.id}
              gap={1.5}
              align="center"
              className={isWide ? "crawler-check crawler-check-wide" : "crawler-check"}
            >
              <Glyph name={glyph} className={tone} />
              <Text
                type="supporting"
                weight="semibold"
                maxLines={1}
                className={check.status === "invalid" ? "crawler-tone-error" : "crawler-tone-muted"}
              >
                <span title={`${check.label}: ${check.status}`}>{check.label}</span>
              </Text>
            </HStack>
          );
        })}
      </div>
    </VStack>
  );
}

export default ValidationChecklist;
