"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  PageHeader,
  SectionCard,
  Selector,
  Stack,
  TextArea,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { ListField } from "@/components/list-field";
import { adminSend } from "@/lib/api";
import {
  ADMIN_CASES_PATH,
  CASE_QUEUES,
  CASE_REASON_CODES,
  caseRecordQuery,
  createCaseBody,
  readCasePayload,
} from "@/lib/cases";
import { ROUTES } from "@/lib/nav";

/** Staff POST /v1/admin/cases — open a reports, disputes, or fraud_flags case. */
export function CreateCaseForm() {
  const router = useRouter();
  const toast = useToast();
  const [queue, setQueue] = useState<string>(CASE_QUEUES[0].value);
  const [reasonCode, setReasonCode] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [details, setDetails] = useState("");
  const [evidenceKeys, setEvidenceKeys] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setPending(true);
    setError("");
    try {
      const body = createCaseBody({
        queue,
        reasonCode,
        subjectType,
        subjectId,
        details,
        evidenceKeys,
      });
      const response = await adminSend<unknown>(ADMIN_CASES_PATH, "POST", body);
      const created = readCasePayload(response);
      toast({ body: "Case opened." });
      if (created) {
        const query = caseRecordQuery(created);
        router.push(`${ROUTES.moderationCase(created.id)}${query ? `?${query}` : ""}`);
      } else {
        router.push(`${ROUTES.cases}?queue=${encodeURIComponent(queue)}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the case.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap={5}>
      <PageHeader
        title="Create case"
        description="Open a staff case on reports, disputes, or fraud flags. A reason code and subject are required."
        action={<Button label="Back to cases" variant="ghost" href={ROUTES.cases} />}
      />
      <SectionCard
        title="Case"
        description="POST /v1/admin/cases. The admin proxy records X-Admin-Actor."
      >
        <Stack gap={4}>
          {error ? <Banner status="error" title={error} /> : null}
          <Selector
            label="Queue"
            options={CASE_QUEUES.map((item) => ({ value: item.value, label: item.label }))}
            value={queue}
            onChange={setQueue}
          />
          <Selector
            label="Reason code"
            options={[{ value: "", label: "Choose" }, ...CASE_REASON_CODES]}
            value={reasonCode}
            onChange={setReasonCode}
          />
          <TextInput label="Subject type" value={subjectType} onChange={setSubjectType} />
          <TextInput label="Subject id" value={subjectId} onChange={setSubjectId} />
          <TextArea label="Details" value={details} onChange={setDetails} />
          <ListField
            label="Evidence keys"
            value={evidenceKeys}
            onChange={setEvidenceKeys}
            placeholder="evidence-key"
          />
          <Button
            label="Open case"
            variant="primary"
            isDisabled={pending}
            clickAction={() => void submit()}
          />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
