"use client";

import {
  Button,
  HStack,
  Icon,
  IconButton,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
  icons,
} from "@openseat/design-system";
import {
  MAX_OFFER_TEMPLATES,
  centsToDollarsInput,
  dollarsToCents,
  newOfferTemplate,
  type OfferTemplate,
} from "@/lib/offer-hire";

const BODY_ROWS = 4;

/** Edit job-level offer letter templates (local until Einstein persists). */
export function OfferTemplateEditor({
  value,
  onChange,
}: {
  value: OfferTemplate[];
  onChange: (next: OfferTemplate[]) => void;
}) {
  const update = (id: string, patch: Partial<OfferTemplate>) =>
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const updateDefaultComp = (id: string, dollars: string) => {
    const cents = dollarsToCents(dollars);
    onChange(
      value.map((item) =>
        item.id === id
          ? {
              ...item,
              defaultComp: {
                ...(item.defaultComp ?? {}),
                baseSalaryCents: cents,
                currency: item.defaultComp?.currency || "USD",
              },
            }
          : item,
      ),
    );
  };

  return (
    <Stack gap={3}>
      <Text type="supporting" color="secondary">
        Reusable offer letters with optional approval / first-party e-sign flags. Placeholders:
        {" {{name}} "}and{" {{role}}"}.
      </Text>
      {value.map((template, index) => (
        <Stack key={template.id} gap={2}>
          <HStack gap={2} vAlign="end">
            <TextInput
              label={`Template ${index + 1}`}
              value={template.name}
              onChange={(name) => update(template.id, { name })}
              placeholder="Standard offer"
            />
            <IconButton
              label={`Remove ${template.name || "template"}`}
              icon={<Icon icon={icons.trash} />}
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((item) => item.id !== template.id))}
            />
          </HStack>
          <TextArea
            label="Letter body"
            value={template.body}
            onChange={(body) => update(template.id, { body })}
            rows={BODY_ROWS}
            placeholder="Dear {{name}}, …"
          />
          <TextInput
            label="Default base salary ($)"
            value={centsToDollarsInput(template.defaultComp?.baseSalaryCents)}
            onChange={(dollars) => updateDefaultComp(template.id, dollars)}
            placeholder="150000"
          />
          <HStack gap={4} wrap="wrap">
            <Switch
              label="Requires approval"
              value={Boolean(template.requiresApproval)}
              onChange={(requiresApproval) => update(template.id, { requiresApproval })}
            />
            <Switch
              label="Requires e-sign"
              value={Boolean(template.requiresEsign)}
              onChange={(requiresEsign) => update(template.id, { requiresEsign })}
            />
          </HStack>
        </Stack>
      ))}
      <Button
        label="Add offer template"
        variant="secondary"
        isDisabled={value.length >= MAX_OFFER_TEMPLATES}
        onClick={() => onChange([...value, newOfferTemplate()].slice(0, MAX_OFFER_TEMPLATES))}
      />
    </Stack>
  );
}
