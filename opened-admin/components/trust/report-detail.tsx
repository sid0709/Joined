"use client";

import { useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  Stack,
  Text,
} from "@openseat/design-system";
import {
  caseRecordQueryFromReport,
  isCompanyAtsReason,
  reasonCodeLabel,
  reportFromSearch,
} from "@/lib/cases";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

/** One report from the list row. There is no locked get-by-id. */
export function ReportDetail({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const record = reportFromSearch(id, searchParams);
  const caseQuery = record.caseId ? caseRecordQueryFromReport(record) : "";

  return (
    <Stack gap={5}>
      <PageHeader
        title={record.subjectId || "Report"}
        description="Filed report detail. Linked cases open on the cases queue for decision."
        action={
          <HStack gap={2} wrap="wrap">
            {record.caseId ? (
              <Button
                label="Open linked case"
                variant="primary"
                href={`${ROUTES.moderationCase(record.caseId)}${caseQuery ? `?${caseQuery}` : ""}`}
              />
            ) : null}
            <Button label="Back to reports" variant="ghost" href={ROUTES.reports} />
          </HStack>
        }
      />
      <SectionCard title="Report">
        <Stack gap={4}>
          <HStack gap={2} wrap="wrap">
            <Badge label={record.status || "open"} variant="warning" />
            <Badge
              label={reasonCodeLabel(record.reasonCode)}
              variant={isCompanyAtsReason(record.reasonCode) ? "warning" : "neutral"}
            />
            {record.resolution ? <Badge label={record.resolution} variant="neutral" /> : null}
          </HStack>
          <MetadataList columns={2}>
            <MetadataListItem label="Subject type">{record.subjectType || "—"}</MetadataListItem>
            <MetadataListItem label="Subject id">{record.subjectId || "—"}</MetadataListItem>
            <MetadataListItem label="Filed">{formatDateTime(record.createdAt)}</MetadataListItem>
            <MetadataListItem label="Linked case">{record.caseId || "—"}</MetadataListItem>
            <MetadataListItem label="Resolution">{record.resolution || "—"}</MetadataListItem>
          </MetadataList>
          <Text color="secondary">{record.details || "No statement on this report."}</Text>
        </Stack>
      </SectionCard>
      <SectionCard title="Evidence">
        {record.evidenceKeys.length ? (
          <Stack gap={2}>
            {record.evidenceKeys.map((key) => (
              <Text key={key}>{key}</Text>
            ))}
          </Stack>
        ) : (
          <Text color="secondary">No evidence keys on this report.</Text>
        )}
      </SectionCard>
      {record.appealStatement || record.appealAt || record.appealEvidenceKeys.length ? (
        <SectionCard title="Appeal">
          <Stack gap={3}>
            <MetadataList columns={2}>
              <MetadataListItem label="Appealed">
                {formatDateTime(record.appealAt)}
              </MetadataListItem>
            </MetadataList>
            <Text color="secondary">
              {record.appealStatement || "Appeal recorded without a statement."}
            </Text>
            {record.appealEvidenceKeys.length ? (
              <Stack gap={2}>
                {record.appealEvidenceKeys.map((key) => (
                  <Text key={key}>{key}</Text>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </SectionCard>
      ) : null}
    </Stack>
  );
}
