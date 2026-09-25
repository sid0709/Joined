"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  HStack,
  Heading,
  Icon,
  Step,
  Stepper,
  Stack,
  Text,
  TextInput,
  icons,
} from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const STEPS = [
  { label: "Brief", description: "What you need" },
  { label: "Budget", description: "Fixed or hourly" },
  { label: "Invite", description: "Who can bid" },
  { label: "Review", description: "Check and publish" },
];
const ORDER = [
  { label: "Posted", time: "Mon 9:00" },
  { label: "Bids in", time: "Wed 17:00" },
  { label: "Awarded", time: "Thu 11:20" },
  { label: "Paid", time: "Pending" },
];

export default function StepperDemo() {
  const [active, setActive] = useState(1);
  const [wizard, setWizard] = useState(0);
  const [title, setTitle] = useState("");

  return (
    <Examples>
      <Preview label="Horizontal" description="Completed steps show a check; the active step is highlighted.">
        <Stepper activeStep={active}>
          {STEPS.map((s, index) => (
            <Step key={s.label} step={index} label={s.label} />
          ))}
        </Stepper>
      </Preview>

      <Preview label="Descriptions and clicks" description="onStepClick lets people jump back to a finished step.">
        <Stack gap={3}>
          <Stepper activeStep={active} onStepClick={setActive}>
            {STEPS.map((s, index) => (
              <Step key={s.label} step={index} label={s.label} description={s.description} />
            ))}
          </Stepper>
          <HStack gap={2}>
            <Button label="Back" size="sm" variant="ghost" isDisabled={active === 0} onClick={() => setActive((a) => a - 1)} />
            <Button label="Next" size="sm" variant="primary" isDisabled={active === STEPS.length - 1} onClick={() => setActive((a) => a + 1)} />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Vertical" description="For long flows or side panels — each step can hold content.">
        <Card maxWidth={420}>
          <Stepper activeStep={2} orientation="vertical">
            {ORDER.map((s, index) => (
              <Step key={s.label} step={index} label={s.label} description={s.time} endContent={index === 2 ? <Badge label="Today" variant="info" /> : undefined} />
            ))}
          </Stepper>
        </Card>
      </Preview>

      <Preview label="Status, optional, and disabled" description="Mark a step as warning or error, flag optional ones, disable what isn’t reachable.">
        <Stepper activeStep={2}>
          <Step step={0} label="Brief" status="success" />
          <Step step={1} label="Budget" status="warning" description="Above typical" />
          <Step step={2} label="Invite" status="error" description="No invitees" />
          <Step step={3} label="NDA" isOptional />
          <Step step={4} label="Publish" isDisabled />
        </Stepper>
      </Preview>

      <Preview label="Indicators and density" description="Numbers instead of checks, no indicator at all, or a tighter layout.">
        <Stack gap={5}>
          <Stepper activeStep={2}>
            {STEPS.map((s, index) => (
              <Step key={s.label} step={index} label={s.label} indicator="number" />
            ))}
          </Stepper>
          <Stepper activeStep={2} density="compact" indicatorPosition="on-track">
            {STEPS.map((s, index) => (
              <Step key={s.label} step={index} label={s.label} />
            ))}
          </Stepper>
          <Stepper activeStep={1}>
            {STEPS.map((s, index) => (
              <Step key={s.label} step={index} label={s.label} indicator={<Icon icon={[icons.edit, icons.seat, icons.users, icons.check][index]} size="sm" />} />
            ))}
          </Stepper>
        </Stack>
      </Preview>

      <Preview label="Narrow widths" description="horizontalOptions collapse the stepper to the current step with arrows when space runs out.">
        <Card maxWidth={320}>
          <Stepper activeStep={active} onStepClick={setActive} horizontalOptions={{ minimumStepWidth: 120, collapsedVariant: "withLabelAndControls" }}>
            {STEPS.map((s, index) => (
              <Step key={s.label} step={index} label={s.label} />
            ))}
          </Stepper>
        </Card>
      </Preview>

      <Preview label="Post-a-room wizard" description="A stepper that drives real content and validation.">
        <Card maxWidth={560}>
          <Stack gap={4}>
            <Stepper activeStep={wizard} onStepClick={(i) => i < wizard && setWizard(i)}>
              {STEPS.map((s, index) => (
                <Step key={s.label} step={index} label={s.label} />
              ))}
            </Stepper>
            <Stack gap={2}>
              <Heading level={4}>{STEPS[wizard].label}</Heading>
              {wizard === 0 ? (
                <TextInput label="Room title" value={title} onChange={setTitle} placeholder="Brand refresh" isRequired />
              ) : (
                <Text color="secondary">{STEPS[wizard].description} — fill this in, then continue.</Text>
              )}
            </Stack>
            <HStack hAlign="between">
              <Button label="Back" variant="ghost" isDisabled={wizard === 0} onClick={() => setWizard((w) => w - 1)} />
              <Button
                label={wizard === STEPS.length - 1 ? "Publish" : "Continue"}
                variant="primary"
                isDisabled={wizard === 0 && !title.trim()}
                onClick={() => setWizard((w) => Math.min(STEPS.length - 1, w + 1))}
              />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
