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
} from "sid-ui";
import { ListField } from "@/components/list-field";
import { adminSend } from "@/lib/api";
import {
  CASE_REASON_CODES,
  REPORTS_PATH,
  REPORT_IDEMPOTENCY_HEADER,
  caseRecordQueryFromReport,
  fileReportBody,
  newReportIdempotencyKey,
  readReportPayload,
  reportRecordQuery,
} from "@/lib/cases";
import { ROUTES } from "@/lib/nav";

/** Staff POST /v1/reports with Idempotency-Key — files a report and opens a reports case. */
export function FileReportForm() {
  const router = useRouter();
  const toast = useToast();
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
      const body = fileReportBody({
        subjectType,
        subjectId,
        reasonCode,
        details,
        evidenceKeys,
      });
      const response = await adminSend<unknown>(REPORTS_PATH, "POST", body, {
        [REPORT_IDEMPOTENCY_HEADER]: newReportIdempotencyKey(),
      });
      const created = readReportPayload(response);
      toast({ body: "Report filed." });
      if (created?.caseId) {
        const query = caseRecordQueryFromReport(created);
        router.push(`${ROUTES.moderationCase(created.caseId)}${query ? `?${query}` : ""}`);
      } else if (created) {
        const query = reportRecordQuery(created);
        router.push(`${ROUTES.report(created.id)}${query ? `?${query}` : ""}`);
      } else {
        router.push(ROUTES.reports);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not file the report.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap={5}>
      <PageHeader
        title="File report"
        description="Files a report and opens a linked reports case. Each submit sends a fresh Idempotency-Key."
        action={<Button label="Back to reports" variant="ghost" href={ROUTES.reports} />}
      />
      <SectionCard
        title="Report"
        description="POST /v1/reports. The admin proxy records X-Admin-Actor and forwards Idempotency-Key."
      >
        <Stack gap={4}>
          {error ? <Banner status="error" title={error} /> : null}
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
            label="File report"
            variant="primary"
            isDisabled={pending}
            clickAction={() => void submit()}
          />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
