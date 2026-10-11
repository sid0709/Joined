"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  HStack,
  SectionCard,
  Selector,
  Stack,
  TextArea,
  TextInput,
  useToast,
} from "sid-ui";
import { adminSend } from "@/lib/api";
import {
  INCIDENT_IMPACTS,
  INCIDENT_PHASES,
  STATUS_INCIDENTS_PATH,
  type IncidentImpact,
  type IncidentPhase,
  type NewIncidentBody,
  type StatusComponentOption,
} from "@/lib/status-incidents";

/** Open an incident on the public status page with its first update. */
export function NewIncidentForm({
  components,
  onCreated,
  onCancel,
}: {
  components: StatusComponentOption[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<IncidentImpact>("minor");
  const [affected, setAffected] = useState<string[]>([]);
  const [phase, setPhase] = useState<IncidentPhase>("investigating");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setPending(true);
    setError("");
    try {
      const body: NewIncidentBody = {
        title: title.trim(),
        impact,
        components: affected,
        status: phase,
        message: message.trim(),
      };
      await adminSend(STATUS_INCIDENTS_PATH, "POST", body);
      toast({ body: "Incident posted. It shows on the status page within a minute." });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post the incident.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      title="New incident"
      description="Everything here is public on the status page, except who posted it."
    >
      <Stack gap={4}>
        {error ? <Banner status="error" title={error} /> : null}
        <TextInput label="Title" placeholder="Search is slow" value={title} onChange={setTitle} />
        <Selector
          label="Impact"
          options={[...INCIDENT_IMPACTS]}
          value={impact}
          onChange={(value) => setImpact(value as IncidentImpact)}
        />
        <CheckboxList label="Affected" value={affected} onChange={setAffected}>
          {components.map((component) => (
            <CheckboxListItem key={component.id} value={component.id} label={component.name} />
          ))}
        </CheckboxList>
        <Selector
          label="Status"
          options={[...INCIDENT_PHASES]}
          value={phase}
          onChange={(value) => setPhase(value as IncidentPhase)}
        />
        <TextArea
          label="First update"
          placeholder="We’re looking into slow searches."
          value={message}
          onChange={setMessage}
        />
        <HStack gap={2}>
          <Button
            label="Post incident"
            variant="primary"
            isDisabled={pending || !title.trim() || !message.trim() || affected.length === 0}
            clickAction={() => void submit()}
          />
          <Button label="Cancel" variant="ghost" clickAction={onCancel} />
        </HStack>
      </Stack>
    </SectionCard>
  );
}
