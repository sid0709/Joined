import {
  Avatar,
  Badge,
  Card,
  Code,
  Collapsible,
  Glyph,
  HStack,
  IconButton,
  Text,
  Timeline,
  Token,
  VStack,
} from "sid-ui";

import { openInNewTab } from "../../api/runtimeMessage";
import {
  describeRead,
  describeSelector,
  describeStep,
  describeTransforms,
  fieldLabel,
  PHASE_LABELS,
  QUIET_STEP_KINDS,
  STRATEGY_LABELS,
} from "../../routineKit/describe";
import { listFields } from "../../routineKit/routine";
import { STRATEGY_PHASES } from "../../routineKit/strategies";

function FieldRow({ path, field }) {
  const transforms = describeTransforms(field.then);
  return (
    <li className="crawler-routine-field">
      <HStack align="center" justify="between" gap={2}>
        <Text type="supporting" weight="semibold" maxLines={1}>
          {fieldLabel(path, field)}
        </Text>
        <HStack gap={1}>
          <Token size="sm" color="blue" label={describeRead(field.read)} />
          {transforms.map((name) => (
            <Token key={name} size="sm" color="gray" label={name} />
          ))}
        </HStack>
      </HStack>
      <Text type="supporting" color="secondary" maxLines={1} hasTruncateTooltip>
        <Code color="secondary" size="inherit">
          {describeSelector(field.selector)}
        </Code>
      </Text>
    </li>
  );
}

function stepItems(strategy) {
  return STRATEGY_PHASES[strategy.kind].flatMap((phase) =>
    strategy[phase]
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => !QUIET_STEP_KINDS.has(step.kind))
      .map(({ step, index }) => ({
        id: `${phase}-${index}`,
        group: PHASE_LABELS[phase],
        title: describeStep(step),
        description: step.selector ? describeSelector(step.selector) : undefined,
        tone: step.kind === "click" ? "accent" : "neutral",
      })),
  );
}

/** One routine: where it runs, how it moves through the site, and what it reads. */
export default function RoutineCard({ routine, isActive }) {
  const fields = listFields(routine);
  const steps = stepItems(routine.strategy);
  const [primaryHost] = routine.match.hosts;

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={3} align="center">
          <Avatar name={routine.label} shape="rounded" size="md" className="crawler-fixed" />
          <VStack gap={0.5} className="crawler-grow">
            <HStack gap={1.5} align="center" wrap="wrap">
              <Text weight="semibold">{routine.label}</Text>
              <Badge variant="neutral" label={`v${routine.version}`} />
              {isActive ? <Badge variant="success" label="Active tab" /> : null}
            </HStack>
            <Text type="supporting" color="secondary">
              {STRATEGY_LABELS[routine.strategy.kind]} · {fields.length} fields · {routine.output}
            </Text>
          </VStack>
          <IconButton
            variant="ghost"
            size="sm"
            label={`Open ${primaryHost}`}
            tooltip={`Open ${primaryHost}`}
            icon={<Glyph name="share" />}
            onClick={() => openInNewTab(`https://${primaryHost}`)}
          />
        </HStack>

        <HStack gap={1} wrap="wrap">
          {routine.match.hosts.map((host) => (
            <Token key={host} size="sm" color="teal" label={host} />
          ))}
        </HStack>

        <Collapsible
          trigger={
            <Text type="supporting" weight="semibold">
              Fields · {fields.length}
            </Text>
          }
        >
          <ul className="crawler-routine-fields">
            {fields.map(({ path, field }) => (
              <FieldRow key={path} path={path} field={field} />
            ))}
          </ul>
        </Collapsible>

        <Collapsible
          trigger={
            <Text type="supporting" weight="semibold">
              Steps · {steps.length}
            </Text>
          }
        >
          <Timeline items={steps} variant="compact" label={`${routine.label} steps`} />
        </Collapsible>
      </VStack>
    </Card>
  );
}
