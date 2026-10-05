import { Button, Glyph, HStack, ProgressBar, Stack, StatusDot, Text } from "@joined/design-system";
import { ROUTES } from "@/lib/routes";
import type { ChecklistItem } from "@/lib/workspace/profile";

export type ReadinessCheck = {
  label: string;
  detail: string;
  done: boolean;
  href: string;
  action: string;
};

/** How ready Acorn is to apply: profile coverage plus the pieces it attaches and watches. */
export function Readiness({
  percent,
  checklist,
  checks,
}: {
  percent: number;
  checklist: ChecklistItem[];
  checks: ReadinessCheck[];
}) {
  const missing = checklist.filter((item) => !item.done);
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <ProgressBar
          label="Profile answers"
          value={percent}
          hasValueLabel
          variant={percent >= 80 ? "success" : percent >= 50 ? "accent" : "warning"}
        />
        <Text type="supporting" color="secondary">
          {missing.length === 0
            ? "Every common application question has an answer."
            : `Missing: ${missing.map((item) => item.label.toLowerCase()).join(", ")}.`}
        </Text>
      </Stack>
      <Stack gap={4}>
        {checks.map((check) => (
          <HStack key={check.label} gap={3} vAlign="center" hAlign="between" wrap="wrap">
            <HStack gap={3} vAlign="center">
              <StatusDot
                variant={check.done ? "success" : "warning"}
                label={check.done ? "Ready" : "Needs attention"}
              />
              <Stack gap={0}>
                <Text weight="semibold">{check.label}</Text>
                <Text type="supporting" color="secondary">
                  {check.detail}
                </Text>
              </Stack>
            </HStack>
            {check.done ? null : (
              <Button
                label={check.action}
                size="sm"
                variant="secondary"
                href={check.href}
                icon={<Glyph name="plus" />}
              />
            )}
          </HStack>
        ))}
      </Stack>
      <Button label="Review profile" variant="ghost" size="sm" href={ROUTES.profile} />
    </Stack>
  );
}
