"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  HStack,
  SectionCard,
  Selector,
  Stack,
  TextArea,
  Timeline,
  useToast,
  type TimelineItem,
} from "sid-ui";
import { adminSend } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  IMPACT_BADGE,
  INCIDENT_IMPACTS,
  INCIDENT_PHASES,
  impactLabel,
  incidentUpdatesPath,
  phaseLabel,
  updateBody,
  type IncidentImpact,
  type IncidentPhase,
  type StatusComponentOption,
  type StatusIncident,
} from "@/lib/status-incidents";

function timeline(incident: StatusIncident): TimelineItem[] {
  return incident.updates.map((update, index) => ({
    id: `${incident.id}-${index}`,
    title: phaseLabel(update.status),
    time: formatDateTime(update.at),
    description: update.message,
    meta: update.by,
    tone: update.status === "resolved" ? "success" : index === 0 ? "warning" : "neutral",
    status: index === 0 ? "current" : "done",
  }));
}

/** One incident: its public timeline and, below, the form to post the next update. */
export function IncidentItem({
  incident,
  components,
  onChanged,
}: {
  incident: StatusIncident;
  components: StatusComponentOption[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const resolved = incident.status === "resolved";
  const [phase, setPhase] = useState<IncidentPhase>(resolved ? "investigating" : incident.status);
  const [impact, setImpact] = useState<IncidentImpact>(incident.impact);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(!resolved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const affected = incident.components
    .map((id) => components.find((component) => component.id === id)?.name ?? id)
    .join(", ");

  async function post() {
    setPending(true);
    setError("");
    try {
      await adminSend(
        incidentUpdatesPath(incident.id),
        "POST",
        updateBody(incident, phase, message, impact),
      );
      setMessage("");
      toast({ body: phase === "resolved" ? "Incident resolved." : "Update posted." });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post the update.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      title={incident.title}
      description={`${affected} · opened ${formatDateTime(incident.createdAt)}`}
      action={
        <HStack gap={2}>
          <Badge label={impactLabel(incident.impact)} variant={IMPACT_BADGE[incident.impact]} />
          <Badge label={phaseLabel(incident.status)} variant={resolved ? "success" : "warning"} />
        </HStack>
      }
    >
      <Stack gap={5}>
        <Timeline label={`Updates on ${incident.title}`} items={timeline(incident)} />
        {open ? (
          <Stack gap={3}>
            {error ? <Banner status="error" title={error} /> : null}
            <HStack gap={3} wrap="wrap">
              <Selector
                label="Status"
                options={[...INCIDENT_PHASES]}
                value={phase}
                onChange={(value) => setPhase(value as IncidentPhase)}
              />
              <Selector
                label="Impact"
                options={[...INCIDENT_IMPACTS]}
                value={impact}
                onChange={(value) => setImpact(value as IncidentImpact)}
              />
            </HStack>
            <TextArea label="Update" value={message} onChange={setMessage} />
            <HStack gap={2}>
              <Button
                label={phase === "resolved" ? "Resolve" : "Post update"}
                variant="primary"
                isDisabled={pending || !message.trim()}
                clickAction={() => void post()}
              />
              {resolved ? (
                <Button label="Cancel" variant="ghost" clickAction={() => setOpen(false)} />
              ) : null}
            </HStack>
          </Stack>
        ) : (
          <HStack>
            <Button
              label="Reopen or add a note"
              variant="ghost"
              clickAction={() => setOpen(true)}
            />
          </HStack>
        )}
      </Stack>
    </SectionCard>
  );
}
